/**
 * Authentication types supported by the broker auth system
 */
export enum AuthType {
  BASIC = 'basic',
  OAUTH = 'oauth',
}

/**
 * Base broker authentication configuration
 */
export interface BrokerAuthBase {
  authType: AuthType
  name: string
  sempEndpoint: string
  sempPort: number
}

/**
 * OAuth broker authentication configuration
 */
export interface OAuthBrokerAuth extends BrokerAuthBase {
  accessToken: string
  authType: AuthType.OAUTH
  clientId: string
  refreshToken: string
}

/**
 * Basic authentication broker configuration
 */
export interface BasicBrokerAuth extends BrokerAuthBase {
  authType: AuthType.BASIC
  encodedCredentials: string
}

/**
 * Union type for broker authentication
 */
export type BrokerAuth = BasicBrokerAuth | OAuthBrokerAuth

/**
 * Storage format for broker configurations
 */
export interface BrokerAuthStorage {
  brokers: BrokerAuth[]
  version: string
}

/**
 * Error codes for broker auth operations
 */
export enum BrokerAuthErrorCode {
  BROKER_ALREADY_EXISTS = 'BROKER_ALREADY_EXISTS',
  BROKER_NOT_FOUND = 'BROKER_NOT_FOUND',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  INVALID_AUTH_TYPE = 'INVALID_AUTH_TYPE',
  INVALID_BASIC_CONFIG = 'INVALID_BASIC_CONFIG',
  INVALID_ENDPOINT = 'INVALID_ENDPOINT',
  INVALID_NAME = 'INVALID_NAME',
  INVALID_OAUTH_CONFIG = 'INVALID_OAUTH_CONFIG',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_PORT = 'INVALID_PORT',
  NOT_INITIALIZED = 'NOT_INITIALIZED',
}

/**
 * Custom error class for broker authentication operations
 */
export class BrokerAuthError extends Error {
  constructor(
    message: string,
    public readonly code: BrokerAuthErrorCode,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'BrokerAuthError'
  }
}
