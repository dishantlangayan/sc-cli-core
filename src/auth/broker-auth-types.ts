/**
 * Authentication types supported by the broker auth system
 */
export enum AuthType {
  BASIC = 'basic',
  OAUTH = 'oauth',
}

/**
 * Broker authentication configuration
 *
 * @property {string} accessToken - For OAuth: access token string. For Basic: base64-encoded credentials
 * @property {AuthType} authType - Type of authentication (BASIC or OAUTH)
 * @property {boolean} isSolaceCloud - Indicates if this is a Solace Cloud broker
 * @property {string} name - Human-readable name/alias for the broker
 * @property {string} sempEndpoint - SEMP endpoint URL (must start with http:// or https://)
 * @property {number} sempPort - SEMP port number (1-65535)
 */
export interface BrokerAuth {
  accessToken: string
  authType: AuthType
  isDefault?: boolean
  isSolaceCloud?: boolean
  name: string
  sempEndpoint: string
  sempPort: number
}

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
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  INVALID_AUTH_TYPE = 'INVALID_AUTH_TYPE',
  INVALID_ENDPOINT = 'INVALID_ENDPOINT',
  INVALID_NAME = 'INVALID_NAME',
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
