import 'server-only'
import type { z } from 'zod'
import { ArjumError } from './errors'
import { buildProviderUrl, type QueryValue } from './queries'

export type ArjumClientOptions = { baseUrl?: string; apiKey?: string; timeoutMs?: number; fetcher?: typeof fetch }

export class ArjumClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetcher: typeof fetch

  constructor(options: ArjumClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.HEULATRADE_MARKET_API_BASE_URL ?? ''
    this.apiKey = options.apiKey ?? process.env.HEULATRADE_MARKET_API_KEY ?? ''
    this.timeoutMs = options.timeoutMs ?? 12_000
    this.fetcher = options.fetcher ?? fetch
    if (!this.baseUrl || !this.apiKey) throw new ArjumError('PROVIDER_UNAVAILABLE', 'Market provider is not configured', 503)
  }

  async get<T extends z.ZodTypeAny>(path: string, schema: T, query: Record<string, QueryValue> = {}, signal?: AbortSignal): Promise<z.infer<T>> {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    let response: Response
    try {
      response = await this.fetcher(buildProviderUrl(this.baseUrl, path, query), { headers: { 'x-api-key': this.apiKey, accept: 'application/json' }, signal: combined, cache: 'no-store' })
    } catch (error) {
      throw new ArjumError('PROVIDER_UNAVAILABLE', error instanceof Error ? error.message : 'Provider unavailable', 503)
    }
    if (response.status === 401 || response.status === 403) throw new ArjumError('PROVIDER_UNAUTHORIZED', 'Provider rejected its server credential', 502)
    if (response.status === 429) throw new ArjumError('RATE_LIMITED', 'Provider rate limit reached', 429, Number(response.headers.get('retry-after')) || undefined)
    if (!response.ok) throw new ArjumError('PROVIDER_UNAVAILABLE', `Provider returned ${response.status}`, 503)
    try { return schema.parse(await response.json()) }
    catch { throw new ArjumError('MALFORMED_PROVIDER_RESPONSE', 'Provider response did not match its contract', 502) }
  }
}
