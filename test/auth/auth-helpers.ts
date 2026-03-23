import type {OrgConfig} from '../../src/auth/org-types.js'

import {AuthType, type BrokerAuth} from '../../src/auth/broker-auth-types.js'

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
 * @param isSolaceCloud - Optional: Whether this is a Solace Cloud broker
 * @returns Mock OAuth broker configuration
 */
export function createMockOAuthBroker(name: string, isSolaceCloud?: boolean): BrokerAuth {
  return {
    accessToken: `access-token-${name}`,
    authType: AuthType.OAUTH,
    ...(isSolaceCloud !== undefined && {isSolaceCloud}),
    name,
    sempEndpoint: `https://${name}.example.com`,
    sempPort: 943,
  }
}

/**
 * Create mock Basic auth broker for testing
 * @param name - Broker name
 * @param isSolaceCloud - Optional: Whether this is a Solace Cloud broker
 * @returns Mock Basic auth broker configuration
 */
export function createMockBasicBroker(name: string, isSolaceCloud?: boolean): BrokerAuth {
  return {
    accessToken: Buffer.from(`${name}:password`).toString('base64'),
    authType: AuthType.BASIC,
    ...(isSolaceCloud !== undefined && {isSolaceCloud}),
    name,
    sempEndpoint: `https://${name}.example.com`,
    sempPort: 8080,
  }
}
