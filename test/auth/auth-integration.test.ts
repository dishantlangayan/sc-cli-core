import {describe, it} from 'mocha'

import {AuthType} from '../../src/auth/auth-types.js'
import {expect} from '../setup.js'
import {createMockBasicBroker, createMockOAuthBroker} from './auth-helpers.js'

describe('BrokerAuthManager Integration Tests', () => {
  // Note: Full integration tests that write to the file system are not included
  // to keep the test suite fast and avoid side effects

  describe('ScConnection integration', () => {
    it('should be able to create ScConnection instances', () => {
      // This test just verifies the types work together
      const oauth = createMockOAuthBroker('test')
      const basic = createMockBasicBroker('test2')

      expect(oauth.authType).to.equal(AuthType.OAUTH)
      expect(basic.authType).to.equal(AuthType.BASIC)
    })
  })
})
