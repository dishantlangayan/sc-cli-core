import {createCipheriv, createDecipheriv, pbkdf2, randomBytes} from 'node:crypto'
import {promisify} from 'node:util'

import type {EncryptedData} from './auth-types.js'

const pbkdf2Async = promisify(pbkdf2)

/**
 * Generic encryption utility for authentication storage
 * Uses AES-256-GCM for authenticated encryption
 * Can be used by both OrgManager and BrokerAuthManager
 */
export class AuthEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly DIGEST = 'sha256'
  private static readonly ITERATIONS = 100_000 // OWASP recommended minimum for PBKDF2
  private static readonly IV_LENGTH = 16
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly SALT_LENGTH = 32
  private static readonly TAG_LENGTH = 16

  /**
   * Decrypt storage data
   * @param encryptedData - Encrypted data to decrypt
   * @param key - Decryption key
   * @returns Decrypted storage
   */
  public static async decrypt<T>(encryptedData: EncryptedData, key: Buffer): Promise<T> {
    try {
      // Parse metadata and buffers
      const iv = Buffer.from(encryptedData.iv, 'base64')
      const authTag = Buffer.from(encryptedData.authTag, 'base64')

      // Create decipher
      const decipher = createDecipheriv(this.ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encryptedContent, 'base64', 'utf8')
      decrypted += decipher.final('utf8')

      // Parse JSON
      const storage = JSON.parse(decrypted) as T

      return storage
    } catch (error) {
      const err = new Error(
        'Failed to decrypt storage. The password may be incorrect or the file may be corrupted.',
      )
      err.cause = error as Error
      throw err
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   * @param password - User password
   * @param salt - Salt for key derivation
   * @returns Derived encryption key
   */
  public static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    try {
      if (!password || password.length === 0) {
        throw new Error('Password cannot be empty')
      }

      return await pbkdf2Async(password, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST)
    } catch (error) {
      if (error instanceof Error && error.message === 'Password cannot be empty') {
        throw error
      }

      const err = new Error('Failed to derive encryption key')
      err.cause = error as Error
      throw err
    }
  }

  /**
   * Encrypt storage data
   * @param data - Storage to encrypt
   * @param key - Encryption key
   * @returns Encrypted data with metadata
   */
  public static async encrypt<T>(data: T, key: Buffer): Promise<EncryptedData> {
    try {
      // Generate random IV
      const iv = randomBytes(this.IV_LENGTH)

      // Create cipher
      const cipher = createCipheriv(this.ALGORITHM, key, iv)

      // Encrypt data
      const plaintext = JSON.stringify(data)
      let encrypted = cipher.update(plaintext, 'utf8', 'base64')
      encrypted += cipher.final('base64')

      // Get authentication tag
      const authTag = cipher.getAuthTag()

      // Generate new salt for next key derivation
      const salt = this.generateSalt()

      return {
        authTag: authTag.toString('base64'),
        encryptedContent: encrypted,
        iv: iv.toString('base64'),
        metadata: {
          algorithm: this.ALGORITHM,
          iterations: this.ITERATIONS,
          keyDerivation: 'pbkdf2',
          saltLength: this.SALT_LENGTH,
        },
        salt: salt.toString('base64'),
      }
    } catch (error) {
      const err = new Error('Failed to encrypt storage')
      err.cause = error as Error
      throw err
    }
  }

  /**
   * Generate cryptographically secure random salt
   * @returns Random salt buffer
   */
  public static generateSalt(): Buffer {
    return randomBytes(this.SALT_LENGTH)
  }
}
