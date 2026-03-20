import {beforeEach, describe, it} from 'mocha'

import {BrokerAuthManager} from '../../src/auth/broker-auth-manager.js'
import {BrokerAuthError, BrokerAuthErrorCode} from '../../src/auth/broker-auth-types.js'
import {expect} from '../setup.js'
import {createMockBasicBroker, createMockOAuthBroker} from './auth-helpers.js'
import {MockKeychainService} from './mock-keychain.js'

describe('BrokerAuthManager', () => {
  let manager: BrokerAuthManager
  let mockKeychainService: MockKeychainService

  beforeEach(() => {
    // Create mock keychain service
    mockKeychainService = new MockKeychainService()

    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BrokerAuthManager as any).instance = null

    manager = BrokerAuthManager.getInstance(mockKeychainService)
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BrokerAuthManager.getInstance()
      const instance2 = BrokerAuthManager.getInstance()

      expect(instance1).to.equal(instance2)
    })
  })

  describe('validation', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should validate broker name', async () => {
      const broker = createMockOAuthBroker('')

      await expect(manager.addBroker(broker)).to.be.rejectedWith(BrokerAuthError)
    })

    it('should validate SEMP endpoint', async () => {
      const broker = createMockOAuthBroker('test')
      broker.sempEndpoint = 'invalid-url'

      await expect(manager.addBroker(broker)).to.be.rejectedWith(BrokerAuthError)
    })

    it('should validate SEMP port range', async () => {
      const broker = createMockOAuthBroker('test')
      broker.sempPort = 99_999

      await expect(manager.addBroker(broker)).to.be.rejectedWith(BrokerAuthError)
    })

    it('should validate OAuth required fields', async () => {
      const broker = createMockOAuthBroker('test')
      broker.accessToken = ''

      await expect(manager.addBroker(broker)).to.be.rejectedWith(BrokerAuthError)
    })

    it('should validate Basic auth required fields', async () => {
      const broker = createMockBasicBroker('test')
      broker.encodedCredentials = ''

      await expect(manager.addBroker(broker)).to.be.rejectedWith(BrokerAuthError)
    })
  })

  describe('error handling', () => {
    it('should throw error when calling methods before initialize', async () => {
      await expect(manager.addBroker(createMockOAuthBroker('test'))).to.be.rejectedWith(BrokerAuthError).and.eventually.have.property('code', BrokerAuthErrorCode.NOT_INITIALIZED)

      await expect(manager.getBroker('test')).to.be.rejectedWith(BrokerAuthError).and.eventually.have.property('code', BrokerAuthErrorCode.NOT_INITIALIZED)

      await expect(manager.listBrokers()).to.be.rejectedWith(BrokerAuthError).and.eventually.have.property('code', BrokerAuthErrorCode.NOT_INITIALIZED)
    })
  })

  describe('type safety', () => {
    it('should work with OAuth brokers', () => {
      const broker = createMockOAuthBroker('test')
      expect(broker).to.have.property('accessToken')
      expect(broker).to.have.property('refreshToken')
      expect(broker).to.have.property('clientId')
    })

    it('should work with Basic auth brokers', () => {
      const broker = createMockBasicBroker('test')
      expect(broker).to.have.property('encodedCredentials')
    })
  })

  describe('createConnection', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should throw error for non-existent broker', async () => {
      await expect(manager.createConnection('non-existent')).to.be.rejectedWith(BrokerAuthError).and.eventually.have.property('code', BrokerAuthErrorCode.BROKER_NOT_FOUND)
    })
  })
})
