import {describe, it} from 'mocha'

import {AuthEncryption} from '../../src/auth/auth-encryption.js'
import {AuthType, type BrokerAuthStorage} from '../../src/auth/broker-auth-types.js'
import {expect} from '../setup.js'

describe('AuthEncryption', () => {
  const testPassword = 'test-password-123'
  const testStorage: BrokerAuthStorage = {
    brokers: [
      {
        accessToken: 'test-access-token',
        authType: AuthType.OAUTH,
        name: 'test-broker',
        sempEndpoint: 'https://test.example.com',
        sempPort: 943,
      },
    ],
    version: '1.0.0',
  }

  describe('generateSalt', () => {
    it('should generate salt of correct length', () => {
      const salt = AuthEncryption.generateSalt()
      expect(salt).to.be.instanceOf(Buffer)
      expect(salt.length).to.equal(32)
    })

    it('should generate different salts', () => {
      const salt1 = AuthEncryption.generateSalt()
      const salt2 = AuthEncryption.generateSalt()
      expect(salt1.equals(salt2)).to.be.false
    })
  })

  describe('deriveKey', () => {
    it('should derive key from password and salt', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)

      expect(key).to.be.instanceOf(Buffer)
      expect(key.length).to.equal(32) // 256 bits
    })

    it('should derive consistent key from same password and salt', async () => {
      const salt = AuthEncryption.generateSalt()
      const key1 = await AuthEncryption.deriveKey(testPassword, salt)
      const key2 = await AuthEncryption.deriveKey(testPassword, salt)

      expect(key1.equals(key2)).to.be.true
    })

    it('should derive different keys from different passwords', async () => {
      const salt = AuthEncryption.generateSalt()
      const key1 = await AuthEncryption.deriveKey('password1', salt)
      const key2 = await AuthEncryption.deriveKey('password2', salt)

      expect(key1.equals(key2)).to.be.false
    })

    it('should derive different keys with different salts', async () => {
      const salt1 = AuthEncryption.generateSalt()
      const salt2 = AuthEncryption.generateSalt()
      const key1 = await AuthEncryption.deriveKey(testPassword, salt1)
      const key2 = await AuthEncryption.deriveKey(testPassword, salt2)

      expect(key1.equals(key2)).to.be.false
    })

    it('should reject empty password', async () => {
      const salt = AuthEncryption.generateSalt()
      await expect(AuthEncryption.deriveKey('', salt)).to.be.rejectedWith(Error, 'Password cannot be empty')
    })
  })

  describe('encrypt', () => {
    it('should encrypt data successfully', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)

      expect(encrypted).to.have.property('encryptedContent')
      expect(encrypted).to.have.property('iv')
      expect(encrypted).to.have.property('authTag')
      expect(encrypted).to.have.property('salt')
      expect(encrypted).to.have.property('metadata')

      expect(encrypted.encryptedContent).to.be.a('string')
      expect(encrypted.iv).to.be.a('string')
      expect(encrypted.authTag).to.be.a('string')
      expect(encrypted.salt).to.be.a('string')

      expect(encrypted.metadata.algorithm).to.equal('aes-256-gcm')
      expect(encrypted.metadata.keyDerivation).to.equal('pbkdf2')
      expect(encrypted.metadata.iterations).to.equal(100_000)
      expect(encrypted.metadata.saltLength).to.equal(32)
    })

    it('should produce different ciphertext for same data (different IV)', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted1 = await AuthEncryption.encrypt(testStorage, key)
      const encrypted2 = await AuthEncryption.encrypt(testStorage, key)

      expect(encrypted1.encryptedContent).to.not.equal(encrypted2.encryptedContent)
      expect(encrypted1.iv).to.not.equal(encrypted2.iv)
    })

    it('should include authentication tag', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)

      expect(encrypted.authTag).to.be.a('string')
      expect(encrypted.authTag.length).to.be.greaterThan(0)
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)
      const decrypted = await AuthEncryption.decrypt(encrypted, key)

      expect(decrypted).to.deep.equal(testStorage)
    })

    it('should fail with wrong key', async () => {
      const salt1 = AuthEncryption.generateSalt()
      const salt2 = AuthEncryption.generateSalt()
      const key1 = await AuthEncryption.deriveKey(testPassword, salt1)
      const key2 = await AuthEncryption.deriveKey('wrong-password', salt2)

      const encrypted = await AuthEncryption.encrypt(testStorage, key1)

      await expect(AuthEncryption.decrypt(encrypted, key2)).to.be.rejectedWith(Error)
    })

    it('should fail with tampered ciphertext', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)

      // Tamper with encrypted content
      const tamperedEncrypted = {
        ...encrypted,
        encryptedContent: encrypted.encryptedContent.slice(0, -5) + 'XXXXX',
      }

      await expect(AuthEncryption.decrypt(tamperedEncrypted, key)).to.be.rejectedWith(Error)
    })

    it('should fail with tampered auth tag', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)

      // Tamper with auth tag
      const tamperedEncrypted = {
        ...encrypted,
        authTag: 'AAAAAAAAAAAAAAAAAAAAAA==',
      }

      await expect(AuthEncryption.decrypt(tamperedEncrypted, key)).to.be.rejectedWith(Error)
    })

    it('should fail with tampered IV', async () => {
      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(testStorage, key)

      // Tamper with IV
      const tamperedEncrypted = {
        ...encrypted,
        iv: 'AAAAAAAAAAAAAAAAAAAAAA==',
      }

      await expect(AuthEncryption.decrypt(tamperedEncrypted, key)).to.be.rejectedWith(Error)
    })
  })

  describe('encrypt and decrypt roundtrip', () => {
    it('should handle multiple brokers', async () => {
      const storage: BrokerAuthStorage = {
        brokers: [
          {
            accessToken: 'oauth-token',
            authType: AuthType.OAUTH,
            name: 'broker1',
            sempEndpoint: 'https://broker1.example.com',
            sempPort: 943,
          },
          {
            accessToken: Buffer.from('admin:admin').toString('base64'),
            authType: AuthType.BASIC,
            name: 'broker2',
            sempEndpoint: 'https://broker2.example.com',
            sempPort: 8080,
          },
        ],
        version: '1.0.0',
      }

      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(storage, key)
      const decrypted = await AuthEncryption.decrypt(encrypted, key)

      expect(decrypted).to.deep.equal(storage)
    })

    it('should handle empty brokers array', async () => {
      const storage: BrokerAuthStorage = {
        brokers: [],
        version: '1.0.0',
      }

      const salt = AuthEncryption.generateSalt()
      const key = await AuthEncryption.deriveKey(testPassword, salt)
      const encrypted = await AuthEncryption.encrypt(storage, key)
      const decrypted = await AuthEncryption.decrypt(encrypted, key)

      expect(decrypted).to.deep.equal(storage)
    })
  })
})
