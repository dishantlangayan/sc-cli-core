import {mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import type {EncryptedData} from './auth-types.js'

import {DefaultBaseUrl, EnvironmentVariable, envVars} from '../config/env-vars.js'
import {ScConnection} from '../util/sc-connection.js'
import {BrokerAuthEncryption} from './auth-encryption.js'
import {KeychainService} from './keychain.js'
import {type OrgConfig, OrgError, OrgErrorCode, type OrgStorage} from './org-types.js'

const SERVICE_NAME = 'local'
const KEY_NAME = 'sc-cli'

/**
 * Manager for organization storage
 * Handles encrypted storage of Solace Cloud organization credentials
 */
export class OrgManager {
  private static instance: null | OrgManager = null
  private readonly configDir: string
  private readonly configFile: string
  private encryptionKey: Buffer | null = null
  private readonly keychainService: KeychainService
  private machineId: null | string = null
  private masterKey: null | string = null
  private storage: null | OrgStorage = null

  private constructor(keychainService?: KeychainService) {
    const homeDirectory = homedir()
    this.configDir = join(homeDirectory, '.sc')
    this.configFile = join(this.configDir, 'orgs.json')
    this.keychainService = keychainService ?? new KeychainService()
  }

  /**
   * Get singleton instance
   * @param keychainService - Optional keychain service for testing
   */
  public static getInstance(keychainService?: KeychainService): OrgManager {
    if (!OrgManager.instance) {
      OrgManager.instance = new OrgManager(keychainService)
    }

    return OrgManager.instance
  }

  /**
   * Add a new organization configuration
   * @param org - Organization configuration
   */
  public async addOrg(org: OrgConfig): Promise<void> {
    this.ensureInitialized()

    // Validate organization
    this.validateOrg(org)

    // Check if organization already exists (by orgId or alias)
    const existingByOrgId = this.storage!.orgs.find((o) => o.orgId === org.orgId)
    if (existingByOrgId) {
      throw new OrgError(`Organization '${org.orgId}' already exists`, OrgErrorCode.ORG_ALREADY_EXISTS)
    }

    if (org.alias) {
      const existingByAlias = this.storage!.orgs.find((o) => o.alias === org.alias)
      if (existingByAlias) {
        throw new OrgError(`Organization with alias '${org.alias}' already exists`, OrgErrorCode.ORG_ALREADY_EXISTS)
      }
    }

    // If this org is being set as default, unset any existing default
    if (org.isDefault) {
      this.unsetAllDefaults()
    }

    // Add organization
    this.storage!.orgs.push(org)

    // Save to file
    await this.saveStorage()
  }

  /**
   * Clear all organization configurations
   */
  public async clearAll(): Promise<void> {
    this.ensureInitialized()

    this.storage!.orgs = []
    await this.saveStorage()
  }

  /**
   * Create ScConnection instance from stored org config
   * @param identifier - Organization ID or alias
   * @param timeout - Optional timeout override (default: 10000ms)
   * @returns Configured ScConnection instance
   */
  public async createConnection(identifier: string, timeout = 10_000): Promise<ScConnection> {
    this.ensureInitialized()

    const org = await this.getOrg(identifier)
    if (!org) {
      throw new OrgError(`Organization '${identifier}' not found`, OrgErrorCode.ORG_NOT_FOUND)
    }

    // Use org's baseUrl if provided, otherwise fall back to default
    const baseURL = org.baseUrl ?? envVars.getString(EnvironmentVariable.SC_BASE_URL, DefaultBaseUrl)

    return new ScConnection(baseURL, org.accessToken, timeout)
  }

  /**
   * Get all organization configurations
   * @returns Array of all organization configurations
   */
  public async getAllOrgs(): Promise<OrgConfig[]> {
    this.ensureInitialized()

    return [...this.storage!.orgs]
  }

  /**
   * Get the default organization
   * @returns Default organization or null if no default is set
   */
  public async getDefaultOrg(): Promise<null | OrgConfig> {
    this.ensureInitialized()

    const org = this.storage!.orgs.find((o) => o.isDefault === true)
    return org ?? null
  }

  /**
   * Get organization configuration by orgId or alias
   * @param identifier - Organization ID or alias
   * @returns Organization configuration or null if not found
   */
  public async getOrg(identifier: string): Promise<null | OrgConfig> {
    this.ensureInitialized()

    const org = this.storage!.orgs.find((o) => o.orgId === identifier || o.alias === identifier)
    return org ?? null
  }

  /**
   * Initialize the org manager with encryption key derived from OS keychain and machine ID
   */
  public async initialize(): Promise<void> {
    try {
      // Get machine ID
      this.machineId = this.keychainService.getMachineId()

      // Get or create master key from OS keychain
      this.masterKey = await this.keychainService.getPassword(KEY_NAME, SERVICE_NAME)
      if (!this.masterKey) {
        // Generate new master key and store in OS keychain
        this.masterKey = this.keychainService.generateMasterKey()
        await this.keychainService.setPassword(KEY_NAME, SERVICE_NAME, this.masterKey)
      }

      // Combine master key with machine ID for encryption
      const combinedKey = `${this.masterKey}:${this.machineId}`

      // Try to load existing storage
      const fileExists = await this.fileExists()

      if (fileExists) {
        // Load existing file and derive key from stored salt
        await this.loadStorage(combinedKey)
      } else {
        // Create new storage with new salt
        const salt = BrokerAuthEncryption.generateSalt()
        this.encryptionKey = await BrokerAuthEncryption.deriveKey(combinedKey, salt)
        this.storage = {
          orgs: [],
          version: '1.0.0',
        }
      }
    } catch (error) {
      if (error instanceof OrgError) {
        throw error
      }

      throw new OrgError('Failed to initialize org manager', OrgErrorCode.NOT_INITIALIZED, error as Error)
    }
  }

  /**
   * List all organization identifiers (orgId or alias if available)
   * @returns Array of organization identifiers
   */
  public async listOrgs(): Promise<string[]> {
    this.ensureInitialized()

    return this.storage!.orgs.map((o) => o.alias ?? o.orgId)
  }

  /**
   * Check if organization exists
   * @param identifier - Organization ID or alias
   * @returns true if organization exists
   */
  public async orgExists(identifier: string): Promise<boolean> {
    this.ensureInitialized()

    return this.storage!.orgs.some((o) => o.orgId === identifier || o.alias === identifier)
  }

  /**
   * Remove organization configuration
   * @param identifier - Organization ID or alias to remove
   */
  public async removeOrg(identifier: string): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.orgs.findIndex((o) => o.orgId === identifier || o.alias === identifier)
    if (index === -1) {
      throw new OrgError(`Organization '${identifier}' not found`, OrgErrorCode.ORG_NOT_FOUND)
    }

    // Remove organization
    this.storage!.orgs.splice(index, 1)

    // Save to file
    await this.saveStorage()
  }

  /**
   * Set an organization as the default
   * @param identifier - Organization ID or alias to set as default
   */
  public async setDefaultOrg(identifier: string): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.orgs.findIndex((o) => o.orgId === identifier || o.alias === identifier)
    if (index === -1) {
      throw new OrgError(`Organization '${identifier}' not found`, OrgErrorCode.ORG_NOT_FOUND)
    }

    // Unset all existing defaults
    this.unsetAllDefaults()

    // Set this org as default
    this.storage!.orgs[index].isDefault = true

    // Save to file
    await this.saveStorage()
  }

  /**
   * Update existing organization configuration
   * @param identifier - Organization ID or alias to update
   * @param updates - Partial updates to apply
   */
  public async updateOrg(identifier: string, updates: Partial<Omit<OrgConfig, 'orgId'>>): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.orgs.findIndex((o) => o.orgId === identifier || o.alias === identifier)
    if (index === -1) {
      throw new OrgError(`Organization '${identifier}' not found`, OrgErrorCode.ORG_NOT_FOUND)
    }

    const currentOrg = this.storage!.orgs[index]

    // Check if new alias conflicts with another org
    if (updates.alias && updates.alias !== currentOrg.alias) {
      const conflictingOrg = this.storage!.orgs.find((o) => o.alias === updates.alias && o.orgId !== currentOrg.orgId)
      if (conflictingOrg) {
        throw new OrgError(`Organization with alias '${updates.alias}' already exists`, OrgErrorCode.ORG_ALREADY_EXISTS)
      }
    }

    // If setting this org as default, unset any existing default
    if (updates.isDefault === true) {
      this.unsetAllDefaults()
    }

    // Merge updates
    const updated = {
      ...currentOrg,
      ...updates,
    }

    // Validate updated organization
    this.validateOrg(updated as OrgConfig)

    // Update organization
    this.storage!.orgs[index] = updated as OrgConfig

    // Save to file
    await this.saveStorage()
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.encryptionKey || !this.storage) {
      throw new OrgError('OrgManager not initialized. Call initialize() first.', OrgErrorCode.NOT_INITIALIZED)
    }
  }

  /**
   * Check if config file exists
   */
  private async fileExists(): Promise<boolean> {
    try {
      await readFile(this.configFile)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load storage from encrypted file
   * @param combinedKey - Combined master key and machine ID for decryption
   */
  private async loadStorage(combinedKey: string): Promise<void> {
    try {
      const fileContent = await readFile(this.configFile, 'utf8')
      const encryptedData = JSON.parse(fileContent) as EncryptedData

      // Derive key from combined key and stored salt
      const salt = Buffer.from(encryptedData.salt, 'base64')
      this.encryptionKey = await BrokerAuthEncryption.deriveKey(combinedKey, salt)

      // Decrypt storage
      this.storage = await BrokerAuthEncryption.decrypt<OrgStorage>(encryptedData, this.encryptionKey)
    } catch (error) {
      if (error instanceof OrgError) {
        throw error
      }

      throw new OrgError('Failed to load organization storage', OrgErrorCode.FILE_READ_ERROR, error as Error)
    }
  }

  /**
   * Save storage to encrypted file
   */
  private async saveStorage(): Promise<void> {
    try {
      if (!this.masterKey || !this.machineId) {
        throw new OrgError('Org manager not initialized', OrgErrorCode.NOT_INITIALIZED)
      }

      // Ensure directory exists
      await mkdir(this.configDir, {mode: 0o700, recursive: true})

      // Generate new salt and derive key for THIS save
      const combinedKey = `${this.masterKey}:${this.machineId}`
      const newSalt = BrokerAuthEncryption.generateSalt()
      const newKey = await BrokerAuthEncryption.deriveKey(combinedKey, newSalt)

      // Encrypt data with the new key
      const encrypted = await BrokerAuthEncryption.encrypt<OrgStorage>(this.storage!, newKey)

      // Update the salt in encrypted data to match the salt we used for key derivation
      encrypted.salt = newSalt.toString('base64')

      // Store the new key for next operation
      this.encryptionKey = newKey

      // Write to temp file first (atomic write)
      const jsonData = JSON.stringify(encrypted, null, 2)
      const tempFile = `${this.configFile}.tmp`
      await writeFile(tempFile, jsonData, {mode: 0o600})

      // Atomic rename
      await rename(tempFile, this.configFile)

      // Set restrictive permissions (Unix only)
      if (process.platform !== 'win32') {
        // Already set via writeFile mode option
      }
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await unlink(`${this.configFile}.tmp`)
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof OrgError) {
        throw error
      }

      throw new OrgError('Failed to save organization storage', OrgErrorCode.FILE_WRITE_ERROR, error as Error)
    }
  }

  /**
   * Unset the default flag on all organizations
   */
  private unsetAllDefaults(): void {
    for (const org of this.storage!.orgs) {
      org.isDefault = false
    }
  }

  /**
   * Validate organization configuration
   * @param org - Organization to validate
   */
  private validateOrg(org: OrgConfig): void {
    // Validate orgId
    if (!org.orgId || org.orgId.trim() === '') {
      throw new OrgError('Organization ID is required', OrgErrorCode.INVALID_ORG_ID)
    }

    // Validate accessToken
    if (!org.accessToken || org.accessToken.trim() === '') {
      throw new OrgError('Access token is required', OrgErrorCode.INVALID_ACCESS_TOKEN)
    }

    // Validate alias if provided
    if (org.alias !== undefined && org.alias.trim() === '') {
      throw new OrgError('Alias cannot be empty if provided', OrgErrorCode.INVALID_ORG_ID)
    }

    // Validate baseUrl if provided
    if (org.baseUrl !== undefined) {
      // Must not be empty or whitespace
      if (org.baseUrl.trim() === '') {
        throw new OrgError('Base URL cannot be empty if provided', OrgErrorCode.INVALID_BASE_URL)
      }

      // Must start with http:// or https://
      if (!(org.baseUrl.startsWith('http://') || org.baseUrl.startsWith('https://'))) {
        throw new OrgError('Base URL must start with http:// or https://', OrgErrorCode.INVALID_BASE_URL)
      }

      // Should not end with trailing slash
      if (org.baseUrl.endsWith('/')) {
        throw new OrgError('Base URL should not end with a slash', OrgErrorCode.INVALID_BASE_URL)
      }
    }
  }
}
