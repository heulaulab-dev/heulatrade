import { closePolicy, normalizeRunningTradeMessage } from '../../lib/market/arjum/websocket'

type Upstream = { close: () => void }
type Handlers = { message: (value: unknown) => void; close: (code: number) => void; error: (error: unknown) => void }
type Dependencies = {
  connect: (handlers: Handlers) => Promise<Upstream>
  authenticate: (token: string) => Promise<boolean>
  random?: () => number
  schedule?: (callback: () => void, delay: number) => unknown
}

export class RunningTradeGateway {
  private upstream: Upstream | null = null
  private connecting: Promise<void> | null = null
  private attempt = 0
  private clients = new Map<string, { send: (value: unknown) => void; authenticated: boolean }>()
  private readonly random: () => number
  private readonly schedule: (callback: () => void, delay: number) => unknown

  constructor(private readonly dependencies: Dependencies) {
    this.random = dependencies.random ?? Math.random
    this.schedule = dependencies.schedule ?? ((callback, delay) => setTimeout(callback, delay))
  }

  addClient(id: string, send: (value: unknown) => void) { this.clients.set(id, { send, authenticated: false }) }
  removeClient(id: string) { this.clients.delete(id) }
  async authenticateClient(id: string, token: string) { const client = this.clients.get(id); if (!client) return false; client.authenticated = await this.dependencies.authenticate(token); return client.authenticated }

  async start() {
    if (this.upstream) return
    if (this.connecting) return this.connecting
    this.connecting = this.connect().finally(() => { this.connecting = null })
    return this.connecting
  }

  private async connect() {
    try {
      this.upstream = await this.dependencies.connect({
        message: (value) => this.handleMessage(value),
        close: (code) => this.handleClose(code),
        error: () => this.handleClose(1006),
      })
      this.attempt = 0
      this.broadcast({ type: 'connection', state: 'LIVE' })
    } catch { this.handleClose(1006) }
  }

  private handleMessage(value: unknown) {
    try { this.broadcast(normalizeRunningTradeMessage(value)) }
    catch { /* A malformed upstream event must not terminate the feed. */ }
  }

  private handleClose(code: number) {
    this.upstream = null
    const policy = closePolicy(code)
    this.broadcast({ type: 'connection', state: policy.state, reason: policy.reason })
    if (!policy.reconnect) return
    const exponential = Math.min(30_000, 1_000 * 2 ** this.attempt++)
    const delay = Math.max(policy.minimumDelayMs, exponential) + Math.floor(this.random() * 1_000)
    this.schedule(() => { void this.start() }, delay)
  }

  private broadcast(value: unknown) { for (const client of this.clients.values()) if (client.authenticated) client.send(value) }
}
