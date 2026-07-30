import {mkdir, readFile, rename, unlink, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {ScConnection} from '../util/sc-connection.js'
import {AuthEncryption} from './auth-encryption.js'
import {type EncryptedData} from './auth-types.js'
import {
  AuthType,
  type BrokerAuth,
  BrokerAuthError,
  BrokerAuthErrorCode,
  type BrokerAuthStorage,
} from './broker-auth-types.js'
import {KeychainService} from './keychain.js'

const SERVICE_NAME = 'local'
const KEY_NAME = 'sc-cli'

/**
 * Manager for broker authentication storage
 * Handles encrypted storage of broker credentials
 */
export class BrokerAuthManager {
  private static instance: BrokerAuthManager | null = null
  private readonly configDir: string
  private readonly configFile: string
  private encryptionKey: Buffer | null = null
  private readonly keychainService: KeychainService
  private machineId: null | string = null
  private masterKey: null | string = null
  private storage: BrokerAuthStorage | null = null

  private constructor(keychainService?: KeychainService) {
    const homeDirectory = homedir()
    this.configDir = join(homeDirectory, '.solace', 'sc', 'cli')
    this.configFile = join(this.configDir, 'brokers.json')
    this.keychainService = keychainService ?? new KeychainService()
  }

  /**
   * Get singleton instance
   * @param keychainService - Optional keychain service for testing
   */
  public static getInstance(keychainService?: KeychainService): BrokerAuthManager {
    if (!BrokerAuthManager.instance) {
      BrokerAuthManager.instance = new BrokerAuthManager(keychainService)
    }

    return BrokerAuthManager.instance
  }

  /**
   * Add a new broker configuration
   * @param broker - Broker authentication configuration
   */
  public async addBroker(broker: BrokerAuth): Promise<void> {
    this.ensureInitialized()

    // Validate broker
    this.validateBroker(broker)

    // Check if broker already exists
    const existing = this.storage!.brokers.find((b) => b.name === broker.name)
    if (existing) {
      throw new BrokerAuthError(
        `Broker '${broker.name}' already exists`,
        BrokerAuthErrorCode.BROKER_ALREADY_EXISTS,
      )
    }

    // If this broker is being set as default, unset any existing default
    if (broker.isDefault) {
      this.unsetAllDefaults()
    }

    // Add broker
    this.storage!.brokers.push(broker)

    // Save to file
    await this.saveStorage()
  }

  /**
   * Check if broker exists
   * @param name - Broker name
   * @returns true if broker exists
   */
  public async brokerExists(name: string): Promise<boolean> {
    this.ensureInitialized()

    return this.storage!.brokers.some((b) => b.name === name)
  }

  /**
   * Clear all broker configurations
   */
  public async clearAll(): Promise<void> {
    this.ensureInitialized()

    this.storage!.brokers = []
    await this.saveStorage()
  }

  /**
   * Create ScConnection instance from stored broker config
   * @param brokerName - Name of the broker to connect to
   * @param timeout - Optional timeout override
   * @returns Configured ScConnection instance
   */
  public async createConnection(brokerName: string, timeout = 10_000): Promise<ScConnection> {
    this.ensureInitialized()

    const broker = await this.getBroker(brokerName)
    if (!broker) {
      throw new BrokerAuthError(`Broker '${brokerName}' not found`, BrokerAuthErrorCode.BROKER_NOT_FOUND)
    }

    const baseURL = `${broker.sempEndpoint}:${broker.sempPort}`
    const {accessToken} = broker

    return new ScConnection(baseURL, accessToken, {
      apiType: 'semp',
      authType: broker.authType === AuthType.BASIC ? 'basic' : 'bearer',
      timeout,
    })
  }

  /**
   * Get all broker configurations
   * @returns Array of all broker configurations
   */
  public async getAllBrokers(): Promise<BrokerAuth[]> {
    this.ensureInitialized()

    return [...this.storage!.brokers]
  }

  /**
   * Get broker configuration by name
   * @param name - Broker name/alias
   * @returns Broker configuration or null if not found
   */
  public async getBroker(name: string): Promise<BrokerAuth | null> {
    this.ensureInitialized()

    const broker = this.storage!.brokers.find((b) => b.name === name)
    return broker ?? null
  }

  /**
   * Get the default broker
   * @returns Default broker or null if no default is set
   */
  public async getDefaultBroker(): Promise<BrokerAuth | null> {
    this.ensureInitialized()

    const broker = this.storage!.brokers.find((b) => b.isDefault === true)
    return broker ?? null
  }

  /**
   * Initialize the auth manager with encryption key derived from OS keychain and machine ID
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
        const salt = AuthEncryption.generateSalt()
        this.encryptionKey = await AuthEncryption.deriveKey(combinedKey, salt)
        this.storage = {
          brokers: [],
          version: '1.0.0',
        }
      }
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error
      }

      throw new BrokerAuthError(
        'Failed to initialize broker auth manager',
        BrokerAuthErrorCode.NOT_INITIALIZED,
        error as Error,
      )
    }
  }

  /**
   * List all broker names
   * @returns Array of broker names
   */
  public async listBrokers(): Promise<string[]> {
    this.ensureInitialized()

    return this.storage!.brokers.map((b) => b.name)
  }

  /**
   * Remove broker configuration
   * @param name - Broker name to remove
   */
  public async removeBroker(name: string): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.brokers.findIndex((b) => b.name === name)
    if (index === -1) {
      throw new BrokerAuthError(`Broker '${name}' not found`, BrokerAuthErrorCode.BROKER_NOT_FOUND)
    }

    // Remove broker
    this.storage!.brokers.splice(index, 1)

    // Save to file
    await this.saveStorage()
  }

  /**
   * Set a broker as the default
   * @param name - Broker name to set as default
   */
  public async setDefaultBroker(name: string): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.brokers.findIndex((b) => b.name === name)
    if (index === -1) {
      throw new BrokerAuthError(`Broker '${name}' not found`, BrokerAuthErrorCode.BROKER_NOT_FOUND)
    }

    // Unset all existing defaults
    this.unsetAllDefaults()

    // Set this broker as default
    this.storage!.brokers[index].isDefault = true

    // Save to file
    await this.saveStorage()
  }

  /**
   * Update existing broker configuration
   * @param name - Broker name to update
   * @param updates - Partial updates to apply
   */
  public async updateBroker(name: string, updates: Partial<Omit<BrokerAuth, 'name'>>): Promise<void> {
    this.ensureInitialized()

    const index = this.storage!.brokers.findIndex((b) => b.name === name)
    if (index === -1) {
      throw new BrokerAuthError(`Broker '${name}' not found`, BrokerAuthErrorCode.BROKER_NOT_FOUND)
    }

    // If setting this broker as default, unset any existing default
    if (updates.isDefault === true) {
      this.unsetAllDefaults()
    }

    // Merge updates
    const updated = {
      ...this.storage!.brokers[index],
      ...updates,
      name, // Ensure name doesn't change
    }

    // Validate updated broker
    this.validateBroker(updated as BrokerAuth)

    // Update broker
    this.storage!.brokers[index] = updated as BrokerAuth

    // Save to file
    await this.saveStorage()
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.encryptionKey || !this.storage) {
      throw new BrokerAuthError(
        'BrokerAuthManager not initialized. Call initialize() first.',
        BrokerAuthErrorCode.NOT_INITIALIZED,
      )
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
      this.encryptionKey = await AuthEncryption.deriveKey(combinedKey, salt)

      // Decrypt storage
      this.storage = await AuthEncryption.decrypt(encryptedData, this.encryptionKey)
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error
      }

      throw new BrokerAuthError('Failed to load broker storage', BrokerAuthErrorCode.FILE_READ_ERROR, error as Error)
    }
  }

  /**
   * Save storage to encrypted file
   */
  private async saveStorage(): Promise<void> {
    try {
      if (!this.masterKey || !this.machineId) {
        throw new BrokerAuthError('Auth manager not initialized', BrokerAuthErrorCode.NOT_INITIALIZED)
      }

      // If storage is empty, delete the file instead of saving
      if (this.storage!.brokers.length === 0) {
        try {
          await unlink(this.configFile)
        } catch (error) {
          // Ignore if file doesn't exist (ENOENT)
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
        }

        return
      }

      // Ensure directory exists
      await mkdir(this.configDir, {mode: 0o700, recursive: true})

      // Generate new salt and derive key for THIS save
      const combinedKey = `${this.masterKey}:${this.machineId}`
      const newSalt = AuthEncryption.generateSalt()
      const newKey = await AuthEncryption.deriveKey(combinedKey, newSalt)

      // Encrypt data with the new key
      const encrypted = await AuthEncryption.encrypt(this.storage!, newKey)

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

      if (error instanceof BrokerAuthError) {
        throw error
      }

      throw new BrokerAuthError('Failed to save broker storage', BrokerAuthErrorCode.FILE_WRITE_ERROR, error as Error)
    }
  }

  /**
   * Unset the default flag on all brokers
   */
  private unsetAllDefaults(): void {
    for (const broker of this.storage!.brokers) {
      broker.isDefault = false
    }
  }

  /**
   * Validate broker configuration
   * @param broker - Broker to validate
   */
  private validateBroker(broker: BrokerAuth): void {
    // Validate name
    if (!broker.name || broker.name.trim() === '') {
      throw new BrokerAuthError('Broker name is required', BrokerAuthErrorCode.INVALID_NAME)
    }

    // Validate endpoint
    if (!broker.sempEndpoint || !(broker.sempEndpoint.startsWith('http://') || broker.sempEndpoint.startsWith('https://'))) {
      throw new BrokerAuthError('SEMP endpoint must start with http:// or https://', BrokerAuthErrorCode.INVALID_ENDPOINT)
    }

    // Validate port
    if (broker.sempPort < 1 || broker.sempPort > 65_535) {
      throw new BrokerAuthError('SEMP port must be between 1 and 65535', BrokerAuthErrorCode.INVALID_PORT)
    }

    // Validate auth type
    if (broker.authType !== AuthType.OAUTH && broker.authType !== AuthType.BASIC) {
      throw new BrokerAuthError('Invalid auth type', BrokerAuthErrorCode.INVALID_AUTH_TYPE)
    }

    // Validate access token
    if (!broker.accessToken || broker.accessToken.trim() === '') {
      throw new BrokerAuthError('Access token is required', BrokerAuthErrorCode.INVALID_ACCESS_TOKEN)
    }
  }
}
