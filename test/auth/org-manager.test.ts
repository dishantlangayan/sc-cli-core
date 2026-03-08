import {afterEach, beforeEach, describe, it} from 'mocha'
import {unlink} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import {OrgManager} from '../../src/auth/org-manager.js'
import {OrgError, OrgErrorCode} from '../../src/auth/org-types.js'
import {ScConnection} from '../../src/util/sc-connection.js'
import {expect} from '../setup.js'
import {createMockOrg} from './auth-helpers.js'
import {MockKeychainService} from './mock-keychain.js'

describe('OrgManager', () => {
  let manager: OrgManager
  let mockKeychainService: MockKeychainService
  const configFile = join(homedir(), '.sc', 'orgs.json')

  beforeEach(() => {
    // Create mock keychain service
    mockKeychainService = new MockKeychainService()

    // Reset singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(OrgManager as any).instance = null

    manager = OrgManager.getInstance(mockKeychainService)
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
      const instance1 = OrgManager.getInstance()
      const instance2 = OrgManager.getInstance()

      expect(instance1).to.equal(instance2)
    })
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(manager.initialize()).to.be.fulfilled
    })

    it('should create empty storage on first initialization', async () => {
      await manager.initialize()
      const orgs = await manager.getAllOrgs()

      expect(orgs).to.be.an('array').that.is.empty
    })
  })

  describe('addOrg', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should add organization successfully', async () => {
      const org = createMockOrg('org-123')

      await manager.addOrg(org)
      const retrieved = await manager.getOrg('org-123')

      expect(retrieved).to.deep.equal(org)
    })

    it('should add organization with alias', async () => {
      const org = createMockOrg('org-123', 'my-org')

      await manager.addOrg(org)
      const retrievedById = await manager.getOrg('org-123')
      const retrievedByAlias = await manager.getOrg('my-org')

      expect(retrievedById).to.deep.equal(org)
      expect(retrievedByAlias).to.deep.equal(org)
    })

    it('should reject duplicate orgId', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-123', 'different-alias')

      await manager.addOrg(org1)

      await expect(manager.addOrg(org2))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_ALREADY_EXISTS)
    })

    it('should reject duplicate alias', async () => {
      const org1 = createMockOrg('org-123', 'my-org')
      const org2 = createMockOrg('org-456', 'my-org')

      await manager.addOrg(org1)

      await expect(manager.addOrg(org2))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_ALREADY_EXISTS)
    })

    it('should allow multiple orgs without aliases', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      const orgs = await manager.getAllOrgs()
      expect(orgs).to.have.lengthOf(2)
    })
  })

  describe('getOrg', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return null for non-existent organization', async () => {
      const result = await manager.getOrg('non-existent')

      expect(result).to.be.null
    })

    it('should retrieve organization by orgId', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('org-123')

      expect(retrieved).to.deep.equal(org)
    })

    it('should retrieve organization by alias', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('my-org')

      expect(retrieved).to.deep.equal(org)
    })
  })

  describe('getAllOrgs', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return empty array when no organizations', async () => {
      const orgs = await manager.getAllOrgs()

      expect(orgs).to.be.an('array').that.is.empty
    })

    it('should return all organizations', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456', 'my-org')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      const orgs = await manager.getAllOrgs()

      expect(orgs).to.have.lengthOf(2)
      expect(orgs).to.deep.include(org1)
      expect(orgs).to.deep.include(org2)
    })
  })

  describe('listOrgs', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return empty array when no organizations', async () => {
      const list = await manager.listOrgs()

      expect(list).to.be.an('array').that.is.empty
    })

    it('should list organization identifiers', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456', 'my-org')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      const list = await manager.listOrgs()

      expect(list).to.have.lengthOf(2)
      expect(list).to.include('org-123')
      expect(list).to.include('my-org')
    })

    it('should prefer alias over orgId in listing', async () => {
      const org = createMockOrg('org-123', 'my-org')

      await manager.addOrg(org)

      const list = await manager.listOrgs()

      expect(list).to.deep.equal(['my-org'])
    })
  })

  describe('orgExists', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return false for non-existent organization', async () => {
      const exists = await manager.orgExists('non-existent')

      expect(exists).to.be.false
    })

    it('should return true for existing organization by orgId', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      const exists = await manager.orgExists('org-123')

      expect(exists).to.be.true
    })

    it('should return true for existing organization by alias', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      const exists = await manager.orgExists('my-org')

      expect(exists).to.be.true
    })
  })

  describe('updateOrg', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should throw error for non-existent organization', async () => {
      await expect(manager.updateOrg('non-existent', {accessToken: 'new-token'}))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_NOT_FOUND)
    })

    it('should update access token', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await manager.updateOrg('org-123', {accessToken: 'new-token'})

      const updated = await manager.getOrg('org-123')
      expect(updated?.accessToken).to.equal('new-token')
    })

    it('should update alias', async () => {
      const org = createMockOrg('org-123', 'old-alias')
      await manager.addOrg(org)

      await manager.updateOrg('org-123', {alias: 'new-alias'})

      const updated = await manager.getOrg('org-123')
      expect(updated?.alias).to.equal('new-alias')

      const byNewAlias = await manager.getOrg('new-alias')
      expect(byNewAlias).to.not.be.null

      const byOldAlias = await manager.getOrg('old-alias')
      expect(byOldAlias).to.be.null
    })

    it('should allow updating by alias', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      await manager.updateOrg('my-org', {accessToken: 'new-token'})

      const updated = await manager.getOrg('org-123')
      expect(updated?.accessToken).to.equal('new-token')
    })

    it('should reject alias conflict', async () => {
      const org1 = createMockOrg('org-123', 'alias-1')
      const org2 = createMockOrg('org-456', 'alias-2')
      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await expect(manager.updateOrg('org-123', {alias: 'alias-2'}))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_ALREADY_EXISTS)
    })
  })

  describe('removeOrg', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should throw error for non-existent organization', async () => {
      await expect(manager.removeOrg('non-existent'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_NOT_FOUND)
    })

    it('should remove organization by orgId', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await manager.removeOrg('org-123')

      const retrieved = await manager.getOrg('org-123')
      expect(retrieved).to.be.null
    })

    it('should remove organization by alias', async () => {
      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      await manager.removeOrg('my-org')

      const retrievedById = await manager.getOrg('org-123')
      const retrievedByAlias = await manager.getOrg('my-org')

      expect(retrievedById).to.be.null
      expect(retrievedByAlias).to.be.null
    })
  })

  describe('clearAll', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should clear all organizations', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456', 'my-org')
      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.clearAll()

      const orgs = await manager.getAllOrgs()
      expect(orgs).to.be.an('array').that.is.empty
    })
  })

  describe('validation', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should validate orgId is required', async () => {
      const org = createMockOrg('')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ORG_ID)
    })

    it('should validate orgId is not just whitespace', async () => {
      const org = createMockOrg('   ')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ORG_ID)
    })

    it('should validate accessToken is required', async () => {
      const org = createMockOrg('org-123')
      org.accessToken = ''

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ACCESS_TOKEN)
    })

    it('should validate accessToken is not just whitespace', async () => {
      const org = createMockOrg('org-123')
      org.accessToken = '   '

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ACCESS_TOKEN)
    })

    it('should reject empty alias if provided', async () => {
      const org = createMockOrg('org-123', '')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ORG_ID)
    })

    it('should reject whitespace-only alias', async () => {
      const org = createMockOrg('org-123', '   ')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_ORG_ID)
    })

    it('should allow undefined alias', async () => {
      const org = createMockOrg('org-123')
      delete org.alias

      await expect(manager.addOrg(org)).to.be.fulfilled
    })
  })

  describe('error handling', () => {
    it('should throw error when calling methods before initialize', async () => {
      await expect(manager.addOrg(createMockOrg('org-123')))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.getOrg('org-123'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.listOrgs())
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.getAllOrgs())
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.updateOrg('org-123', {accessToken: 'new-token'}))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.removeOrg('org-123'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)

      await expect(manager.clearAll())
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)
    })
  })

  describe('persistence', () => {
    it('should persist organizations across instances', async () => {
      await manager.initialize()

      const org = createMockOrg('org-123', 'my-org')
      await manager.addOrg(org)

      // Create new instance with same keychain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(OrgManager as any).instance = null
      const newManager = OrgManager.getInstance(mockKeychainService)
      await newManager.initialize()

      const retrieved = await newManager.getOrg('org-123')
      expect(retrieved?.orgId).to.equal(org.orgId)
      expect(retrieved?.accessToken).to.equal(org.accessToken)
      expect(retrieved?.alias).to.equal(org.alias)
    })
  })

  describe('default organization', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should return null when no default is set', async () => {
      const defaultOrg = await manager.getDefaultOrg()

      expect(defaultOrg).to.be.null
    })

    it('should add organization with isDefault=true', async () => {
      const org = createMockOrg('org-123', 'my-org')
      org.isDefault = true

      await manager.addOrg(org)

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg).to.not.be.null
      expect(defaultOrg?.orgId).to.equal('org-123')
      expect(defaultOrg?.isDefault).to.be.true
    })

    it('should only allow one default organization when adding', async () => {
      const org1 = createMockOrg('org-123', 'org-1')
      org1.isDefault = true
      const org2 = createMockOrg('org-456', 'org-2')
      org2.isDefault = true

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-456')

      const org1Retrieved = await manager.getOrg('org-123')
      expect(org1Retrieved?.isDefault).to.be.false
    })

    it('should set organization as default by orgId', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.setDefaultOrg('org-456')

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-456')
    })

    it('should set organization as default by alias', async () => {
      const org1 = createMockOrg('org-123', 'first')
      const org2 = createMockOrg('org-456', 'second')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.setDefaultOrg('second')

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-456')
    })

    it('should unset previous default when setting new default', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.setDefaultOrg('org-123')
      await manager.setDefaultOrg('org-456')

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-456')

      const org1Retrieved = await manager.getOrg('org-123')
      expect(org1Retrieved?.isDefault).to.be.false
    })

    it('should throw error when setting non-existent org as default', async () => {
      await expect(manager.setDefaultOrg('non-existent'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_NOT_FOUND)
    })

    it('should update organization to be default', async () => {
      const org1 = createMockOrg('org-123')
      const org2 = createMockOrg('org-456')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.updateOrg('org-123', {isDefault: true})

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-123')
    })

    it('should unset previous default when updating another org to default', async () => {
      const org1 = createMockOrg('org-123')
      org1.isDefault = true
      const org2 = createMockOrg('org-456')

      await manager.addOrg(org1)
      await manager.addOrg(org2)

      await manager.updateOrg('org-456', {isDefault: true})

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg?.orgId).to.equal('org-456')

      const org1Retrieved = await manager.getOrg('org-123')
      expect(org1Retrieved?.isDefault).to.be.false
    })

    it('should allow explicitly unsetting default', async () => {
      const org = createMockOrg('org-123')
      org.isDefault = true

      await manager.addOrg(org)
      await manager.updateOrg('org-123', {isDefault: false})

      const defaultOrg = await manager.getDefaultOrg()
      expect(defaultOrg).to.be.null
    })

    it('should persist default flag across instances', async () => {
      const org = createMockOrg('org-123', 'my-org')
      org.isDefault = true
      await manager.addOrg(org)

      // Create new instance with same keychain
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(OrgManager as any).instance = null
      const newManager = OrgManager.getInstance(mockKeychainService)
      await newManager.initialize()

      const defaultOrg = await newManager.getDefaultOrg()
      expect(defaultOrg).to.not.be.null
      expect(defaultOrg?.orgId).to.equal('org-123')
      expect(defaultOrg?.isDefault).to.be.true
    })
  })

  describe('baseUrl field', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should allow adding org without baseUrl (optional field)', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('org-123')
      expect(retrieved?.baseUrl).to.be.undefined
    })

    it('should store and retrieve baseUrl when provided', async () => {
      const org = createMockOrg('org-123', undefined, 'https://custom-api.example.com')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('org-123')
      expect(retrieved?.baseUrl).to.equal('https://custom-api.example.com')
    })

    it('should validate baseUrl starts with http:// or https://', async () => {
      const org = createMockOrg('org-123', undefined, 'ftp://invalid.example.com')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_BASE_URL)
    })

    it('should reject empty baseUrl string', async () => {
      const org = createMockOrg('org-123', undefined, '   ')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_BASE_URL)
    })

    it('should reject baseUrl ending with slash', async () => {
      const org = createMockOrg('org-123', undefined, 'https://api.example.com/')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_BASE_URL)
    })

    it('should allow updating baseUrl', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await manager.updateOrg('org-123', {baseUrl: 'https://updated-api.example.com'})

      const updated = await manager.getOrg('org-123')
      expect(updated?.baseUrl).to.equal('https://updated-api.example.com')
    })

    it('should validate baseUrl when updating', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await expect(manager.updateOrg('org-123', {baseUrl: 'invalid'}))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_BASE_URL)
    })

    it('should persist baseUrl across instances', async () => {
      const org = createMockOrg('org-123', 'my-org', 'https://custom.example.com')
      await manager.addOrg(org)

      // Create new instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(OrgManager as any).instance = null
      const newManager = OrgManager.getInstance(mockKeychainService)
      await newManager.initialize()

      const retrieved = await newManager.getOrg('org-123')
      expect(retrieved?.baseUrl).to.equal('https://custom.example.com')
    })
  })

  describe('createConnection', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should throw error for non-existent organization', async () => {
      await expect(manager.createConnection('non-existent'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.ORG_NOT_FOUND)
    })

    it('should create connection instance', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      const connection = await manager.createConnection('org-123')

      expect(connection).to.be.instanceOf(ScConnection)
    })

    it('should create connection with custom baseUrl', async () => {
      const org = createMockOrg('org-123', undefined, 'https://custom-api.example.com')
      await manager.addOrg(org)

      const connection = await manager.createConnection('org-123')

      expect(connection).to.be.instanceOf(ScConnection)
    })

    it('should accept custom timeout parameter', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      const connection = await manager.createConnection('org-123', 5000)

      expect(connection).to.be.instanceOf(ScConnection)
    })

    it('should work with organization alias', async () => {
      const org = createMockOrg('org-123', 'my-org', 'https://custom-api.example.com')
      await manager.addOrg(org)

      const connection = await manager.createConnection('my-org')

      expect(connection).to.be.instanceOf(ScConnection)
    })

    it('should throw error when called before initialize', async () => {
      // Create a fresh uninitialized manager
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(OrgManager as any).instance = null
      const uninitializedManager = OrgManager.getInstance(mockKeychainService)

      await expect(uninitializedManager.createConnection('org-123'))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.NOT_INITIALIZED)
    })
  })

  describe('apiVersion field', () => {
    beforeEach(async () => {
      await manager.initialize()
    })

    it('should allow adding org without apiVersion (optional field)', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('org-123')
      expect(retrieved?.apiVersion).to.be.undefined
    })

    it('should store and retrieve apiVersion when provided', async () => {
      const org = createMockOrg('org-123', undefined, undefined, 'v3')
      await manager.addOrg(org)

      const retrieved = await manager.getOrg('org-123')
      expect(retrieved?.apiVersion).to.equal('v3')
    })

    it('should reject empty apiVersion string', async () => {
      const org = createMockOrg('org-123', undefined, undefined, '   ')

      await expect(manager.addOrg(org))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_API_VERSION)
    })

    it('should allow updating apiVersion', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await manager.updateOrg('org-123', {apiVersion: 'v3'})

      const updated = await manager.getOrg('org-123')
      expect(updated?.apiVersion).to.equal('v3')
    })

    it('should validate apiVersion when updating', async () => {
      const org = createMockOrg('org-123')
      await manager.addOrg(org)

      await expect(manager.updateOrg('org-123', {apiVersion: '   '}))
        .to.be.rejectedWith(OrgError)
        .and.eventually.have.property('code', OrgErrorCode.INVALID_API_VERSION)
    })
  })
})
