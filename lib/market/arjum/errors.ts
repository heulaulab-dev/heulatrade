export type ProviderErrorCode = 'PROVIDER_UNAUTHORIZED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'MALFORMED_PROVIDER_RESPONSE' | 'INVALID_REQUEST'

export class ArjumError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly status: number, public readonly retryAfterSeconds?: number) {
    super(message)
    this.name = 'ArjumError'
  }
}
