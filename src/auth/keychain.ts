import {randomBytes} from 'node:crypto'
import {createRequire} from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Keychain service for storing and retrieving encryption keys
 * This abstraction allows for easier testing and mocking
 */
export class KeychainService {
  /**
   * Delete a password from the keychain
   * @param service - Service name
   * @param account - Account name
   * @returns True if deleted, false if not found
   */
  public async deletePassword(service: string, account: string): Promise<boolean> {
    const keytar = await this.loadKeytar()
    return keytar.deletePassword(service, account)
  }

  /**
   * Generate a random master key
   * @returns Base64-encoded random key
   */
  public generateMasterKey(): string {
    return randomBytes(32).toString('base64')
  }

  /**
   * Get unique machine identifier
   * @returns Machine ID string
   */
  public getMachineId(): string {
    const machineIdPkg = this.loadMachineId()
    return machineIdPkg.machineIdSync()
  }

  /**
   * Get a password from the keychain
   * @param service - Service name
   * @param account - Account name
   * @returns Password string or null if not found
   */
  public async getPassword(service: string, account: string): Promise<null | string> {
    const keytar = await this.loadKeytar()
    return keytar.getPassword(service, account)
  }

  /**
   * Set a password in the keychain
   * @param service - Service name
   * @param account - Account name
   * @param password - Password to store
   */
  public async setPassword(service: string, account: string, password: string): Promise<void> {
    const keytar = await this.loadKeytar()
    return keytar.setPassword(service, account, password)
  }

  /**
   * Lazy load keytar module
   * @returns keytar module
   */
  private async loadKeytar(): Promise<{
    deletePassword: (service: string, account: string) => Promise<boolean>
    getPassword: (service: string, account: string) => Promise<null | string>
    setPassword: (service: string, account: string, password: string) => Promise<void>
  }> {
    const keytar = await import('keytar')
    return keytar.default
  }

  /**
   * Lazy load node-machine-id module
   * @returns node-machine-id module
   */
  private loadMachineId(): {machineIdSync: () => string} {
    // Use require for CommonJS module (node-machine-id)
    return require('node-machine-id')
  }
}
