/**
 * Encryption metadata stored alongside encrypted data
 */
export interface EncryptionMetadata {
  algorithm: string
  iterations: number
  keyDerivation: string
  saltLength: number
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  authTag: string
  encryptedContent: string
  iv: string
  metadata: EncryptionMetadata
  salt: string
}
