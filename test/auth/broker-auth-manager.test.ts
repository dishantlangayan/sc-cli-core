import {afterEach, beforeEach, describe, it} from 'mocha'
import {unlink} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {BrokerAuthManager} from '../../src/auth/broker-auth-manager.js'
import {BrokerAuthError, BrokerAuthErrorCode} from '../../src/auth/broker-auth-types.js'
import {expect} from '../setup.js'
import {createMockBasicBroker, createMockOAuthBroker} from './auth-helpers.js'
import {MockKeychainService} from './mock-keychain.js'

describe('BrokerAuthManager', () => {
  let manager: BrokerAuthManager
  let mockKeychainService: MockKeychainService
  const configFile = join(homedir(), '.sc', 'brokers.json')

  beforeEach(() => {
    // Create mock keychain service
    mockKeychainService = new MockKeychainService()

    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BrokerAuthManager as any).instance = null

    manager = BrokerAuthManager.getInstance(mockKeychainService)
  })

  afterEach(async () => {
    // Clean up config file
    try {
      await unlink(configFile)
    } catch {
      // Ignore if file doesn't exist
    }
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
      broker.accessToken = ''

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
      expect(broker).to.have.property('authType')
    })

    it('should work with Basic auth brokers', () => {
      const broker = createMockBasicBroker('test')
      expect(broker).to.have.property('accessToken')
      expect(broker).to.have.property('authType')
    })

    it('should support optional msgVpnName field', () => {
      const brokerWithVpn = createMockOAuthBroker('test', undefined, 'my-vpn')
      expect(brokerWithVpn).to.have.property('msgVpnName', 'my-vpn')

      const brokerWithoutVpn = createMockOAuthBroker('test')
      expect(brokerWithoutVpn).to.not.have.property('msgVpnName')
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

  describe('optional fields', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should persist and retrieve msgVpnName field', async () => {
      const broker = createMockOAuthBroker('test-broker', undefined, 'test-vpn')

      await manager.addBroker(broker)

      const retrieved = await manager.getBroker('test-broker')
      expect(retrieved).to.not.be.null
      expect(retrieved?.msgVpnName).to.equal('test-vpn')
    })

    it('should handle brokers without msgVpnName', async () => {
      const broker = createMockOAuthBroker('test-broker')

      await manager.addBroker(broker)

      const retrieved = await manager.getBroker('test-broker')
      expect(retrieved).to.not.be.null
      expect(retrieved).to.not.have.property('msgVpnName')
    })
  })

  describe('default broker', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return null when no default is set', async () => {
      const defaultBroker = await manager.getDefaultBroker()

      expect(defaultBroker).to.be.null
    })

    it('should add broker with isDefault=true', async () => {
      const broker = createMockOAuthBroker('test-broker')
      broker.isDefault = true

      await manager.addBroker(broker)

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker).to.not.be.null
      expect(defaultBroker?.name).to.equal('test-broker')
      expect(defaultBroker?.isDefault).to.be.true
    })

    it('should only allow one default broker when adding', async () => {
      const broker1 = createMockOAuthBroker('broker1')
      broker1.isDefault = true
      const broker2 = createMockOAuthBroker('broker2')
      broker2.isDefault = true

      await manager.addBroker(broker1)
      await manager.addBroker(broker2)

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker?.name).to.equal('broker2')

      const retrieved1 = await manager.getBroker('broker1')
      expect(retrieved1?.isDefault).to.be.false
    })

    it('should unset previous default when setting new default', async () => {
      await manager.addBroker(createMockOAuthBroker('broker1'))
      await manager.addBroker(createMockOAuthBroker('broker2'))

      await manager.setDefaultBroker('broker1')
      await manager.setDefaultBroker('broker2')

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker?.name).to.equal('broker2')

      const retrieved1 = await manager.getBroker('broker1')
      expect(retrieved1?.isDefault).to.be.false
    })

    it('should update broker to be default', async () => {
      await manager.addBroker(createMockOAuthBroker('broker1'))
      await manager.addBroker(createMockOAuthBroker('broker2'))

      await manager.updateBroker('broker1', {isDefault: true})

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker?.name).to.equal('broker1')
    })

    it('should allow explicitly unsetting default', async () => {
      const broker = createMockOAuthBroker('broker1')
      broker.isDefault = true
      await manager.addBroker(broker)

      await manager.updateBroker('broker1', {isDefault: false})

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker).to.be.null
    })

    it('should clear default when removing the default broker', async () => {
      const broker = createMockOAuthBroker('broker1')
      broker.isDefault = true
      await manager.addBroker(broker)

      await manager.removeBroker('broker1')

      const defaultBroker = await manager.getDefaultBroker()
      expect(defaultBroker).to.be.null
    })
  })
})
