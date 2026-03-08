/**
 * Organization configuration
 */
export interface OrgConfig {
  accessToken: string
  alias?: string
  apiVersion?: string
  baseUrl?: string
  isDefault?: boolean
  orgId: string
}

/**
 * Storage format for organization configurations
 */
export interface OrgStorage {
  orgs: OrgConfig[]
  version: string
}

/**
 * Error codes for organization operations
 */
export enum OrgErrorCode {
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  INVALID_ACCESS_TOKEN = 'INVALID_ACCESS_TOKEN',
  INVALID_API_VERSION = 'INVALID_API_VERSION',
  INVALID_BASE_URL = 'INVALID_BASE_URL',
  INVALID_ORG_ID = 'INVALID_ORG_ID',
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  ORG_ALREADY_EXISTS = 'ORG_ALREADY_EXISTS',
  ORG_NOT_FOUND = 'ORG_NOT_FOUND',
}

/**
 * Custom error class for organization operations
 */
export class OrgError extends Error {
  constructor(
    message: string,
    public readonly code: OrgErrorCode,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'OrgError'
  }
}
