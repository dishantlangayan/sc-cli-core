import {afterEach, beforeEach, describe, it} from 'mocha'
import {unlink} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {BrokerAuthManager} from '../src/auth/broker-auth-manager.js'
import {OrgManager} from '../src/auth/org-manager.js'
import {ScCommand} from '../src/sc-command.js'
import {MockKeychainService} from './auth/mock-keychain.js'
import {expect} from './setup.js'

// Mock command class for testing
class TestCommand extends ScCommand<typeof TestCommand> {
  async run(): Promise<void> {
    // Test command implementation
  }

  // Expose protected methods for testing
  public async testGetBrokerAuthManager() {
    return this.getBrokerAuthManager()
  }

  public async testGetOrgManager() {
    return this.getOrgManager()
  }
}

describe('ScCommand', () => {
  const brokersConfigFile = join(homedir(), '.solace', 'sc', 'cli', 'brokers.json')
  const orgsConfigFile = join(homedir(), '.solace', 'sc', 'cli', 'orgs.json')
  let mockKeychain: MockKeychainService

  beforeEach(() => {
    // Create mock keychain for testing
    mockKeychain = new MockKeychainService()

    // Reset singletons and initialize with mock keychain
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(BrokerAuthManager as any).instance = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(OrgManager as any).instance = null

    // Initialize singletons with mock keychain
    BrokerAuthManager.getInstance(mockKeychain)
    OrgManager.getInstance(mockKeychain)
  })

  afterEach(async () => {
    // Clean up config files
    try {
      await unlink(brokersConfigFile)
    } catch {
      // Ignore if file doesn't exist
    }

    try {
      await unlink(orgsConfigFile)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  describe('getBrokerAuthManager', () => {
    it('should return BrokerAuthManager instance', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager = await cmd.testGetBrokerAuthManager()

      expect(manager).to.be.instanceOf(BrokerAuthManager)
    })

    it('should return same instance on multiple calls', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager1 = await cmd.testGetBrokerAuthManager()
      const manager2 = await cmd.testGetBrokerAuthManager()

      expect(manager1).to.equal(manager2)
    })

    it('should return initialized manager', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager = await cmd.testGetBrokerAuthManager()

      // Should be able to call methods without error
      const brokers = await manager.listBrokers()
      expect(brokers).to.be.an('array')
    })
  })

  describe('getOrgManager', () => {
    it('should return OrgManager instance', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager = await cmd.testGetOrgManager()

      expect(manager).to.be.instanceOf(OrgManager)
    })

    it('should return same instance on multiple calls', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager1 = await cmd.testGetOrgManager()
      const manager2 = await cmd.testGetOrgManager()

      expect(manager1).to.equal(manager2)
    })

    it('should return initialized manager', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const manager = await cmd.testGetOrgManager()

      // Should be able to call methods without error
      const orgs = await manager.listOrgs()
      expect(orgs).to.be.an('array')
    })
  })

  describe('manager independence', () => {
    it('should allow using both managers independently', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cmd = new TestCommand([], {} as any)

      const brokerManager = await cmd.testGetBrokerAuthManager()
      const orgManager = await cmd.testGetOrgManager()

      expect(brokerManager).to.be.instanceOf(BrokerAuthManager)
      expect(orgManager).to.be.instanceOf(OrgManager)
      expect(brokerManager).to.not.equal(orgManager)
    })
  })
})
