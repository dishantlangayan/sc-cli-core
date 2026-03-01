import keytar from 'keytar'
import pkg from 'node-machine-id'
import {randomBytes} from 'node:crypto'
const {machineIdSync} = pkg

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
    return machineIdSync()
  }

  /**
   * Get a password from the keychain
   * @param service - Service name
   * @param account - Account name
   * @returns Password string or null if not found
   */
  public async getPassword(service: string, account: string): Promise<null | string> {
    return keytar.getPassword(service, account)
  }

  /**
   * Set a password in the keychain
   * @param service - Service name
   * @param account - Account name
   * @param password - Password to store
   */
  public async setPassword(service: string, account: string, password: string): Promise<void> {
    return keytar.setPassword(service, account, password)
  }
}
