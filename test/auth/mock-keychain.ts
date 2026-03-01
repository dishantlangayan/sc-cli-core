import {randomBytes} from 'node:crypto'

import {KeychainService} from '../../src/auth/keychain.js'

/**
 * Mock keychain service for testing
 * Stores credentials in memory instead of OS keychain
 */
export class MockKeychainService extends KeychainService {
  private mockMachineId = 'mock-machine-id-12345'
  private storage: Map<string, string> = new Map()

  /**
   * Delete a password from mock storage
   */
  public async deletePassword(service: string, account: string): Promise<boolean> {
    const key = `${service}:${account}`
    return this.storage.delete(key)
  }

  /**
   * Generate a random master key
   */
  public generateMasterKey(): string {
    return randomBytes(32).toString('base64')
  }

  /**
   * Get mock machine ID
   */
  public getMachineId(): string {
    return this.mockMachineId
  }

  /**
   * Get a password from mock storage
   */
  public async getPassword(service: string, account: string): Promise<null | string> {
    const key = `${service}:${account}`
    return this.storage.get(key) ?? null
  }

  /**
   * Set the mock machine ID for testing
   */
  public setMockMachineId(machineId: string): void {
    this.mockMachineId = machineId
  }

  /**
   * Set a password in mock storage
   */
  public async setPassword(service: string, account: string, password: string): Promise<void> {
    const key = `${service}:${account}`
    this.storage.set(key, password)
  }
}
