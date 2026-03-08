import type {OrgConfig} from '../../src/auth/org-types.js'

import {AuthType, type BasicBrokerAuth, type OAuthBrokerAuth} from '../../src/auth/auth-types.js'

/**
 * Create mock organization config for testing
 * @param orgId - Organization ID
 * @param alias - Optional alias
 * @param baseUrl - Optional base URL
 * @param apiVersion - Optional API version
 * @returns Mock organization configuration
 */
export function createMockOrg(orgId: string, alias?: string, baseUrl?: string, apiVersion?: string): OrgConfig {
  return {
    accessToken: `access-token-${orgId}`,
    alias,
    apiVersion,
    baseUrl,
    orgId,
  }
}

/**
 * Create mock OAuth broker for testing
 * @param name - Broker name
 * @returns Mock OAuth broker configuration
 */
export function createMockOAuthBroker(name: string): OAuthBrokerAuth {
  return {
    accessToken: `access-token-${name}`,
    authType: AuthType.OAUTH,
    clientId: `client-id-${name}`,
    name,
    refreshToken: `refresh-token-${name}`,
    sempEndpoint: `https://${name}.example.com`,
    sempPort: 943,
  }
}

/**
 * Create mock Basic auth broker for testing
 * @param name - Broker name
 * @returns Mock Basic auth broker configuration
 */
export function createMockBasicBroker(name: string): BasicBrokerAuth {
  return {
    authType: AuthType.BASIC,
    encodedCredentials: Buffer.from(`${name}:password`).toString('base64'),
    name,
    sempEndpoint: `https://${name}.example.com`,
    sempPort: 8080,
  }
}
