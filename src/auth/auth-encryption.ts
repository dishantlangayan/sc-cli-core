import {createCipheriv, createDecipheriv, pbkdf2, randomBytes} from 'node:crypto'
import {promisify} from 'node:util'

import {BrokerAuthError, BrokerAuthErrorCode, type BrokerAuthStorage, type EncryptedData} from './auth-types.js'

const pbkdf2Async = promisify(pbkdf2)

/**
 * Encryption utility for broker authentication storage
 * Uses AES-256-GCM for authenticated encryption
 */
export class BrokerAuthEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly DIGEST = 'sha256'
  private static readonly ITERATIONS = 100_000 // OWASP recommended minimum for PBKDF2
  private static readonly IV_LENGTH = 16
  private static readonly KEY_LENGTH = 32 // 256 bits
  private static readonly SALT_LENGTH = 32
  private static readonly TAG_LENGTH = 16

  /**
   * Decrypt broker storage data
   * @param encryptedData - Encrypted data to decrypt
   * @param key - Decryption key
   * @returns Decrypted broker storage
   */
  public static async decrypt(encryptedData: EncryptedData, key: Buffer): Promise<BrokerAuthStorage> {
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
      const storage = JSON.parse(decrypted) as BrokerAuthStorage

      return storage
    } catch (error) {
      throw new BrokerAuthError(
        'Failed to decrypt broker storage. The password may be incorrect or the file may be corrupted.',
        BrokerAuthErrorCode.DECRYPTION_FAILED,
        error as Error,
      )
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
        throw new BrokerAuthError('Password cannot be empty', BrokerAuthErrorCode.INVALID_PASSWORD)
      }

      return await pbkdf2Async(password, salt, this.ITERATIONS, this.KEY_LENGTH, this.DIGEST)
    } catch (error) {
      if (error instanceof BrokerAuthError) {
        throw error
      }

      throw new BrokerAuthError(
        'Failed to derive encryption key',
        BrokerAuthErrorCode.ENCRYPTION_FAILED,
        error as Error,
      )
    }
  }

  /**
   * Encrypt broker storage data
   * @param data - Broker storage to encrypt
   * @param key - Encryption key
   * @returns Encrypted data with metadata
   */
  public static async encrypt(data: BrokerAuthStorage, key: Buffer): Promise<EncryptedData> {
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
      throw new BrokerAuthError(
        'Failed to encrypt broker storage',
        BrokerAuthErrorCode.ENCRYPTION_FAILED,
        error as Error,
      )
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
