import { RunningTradeGateway } from './gateway.ts'

const providerUrl = process.env.HEULATRADE_RUNNING_TRADE_WS_URL
const providerKey = process.env.HEULATRADE_RUNNING_TRADE_WS_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!providerUrl || !providerKey || !supabaseUrl || !supabaseKey) throw new Error('Running-trade gateway environment is incomplete')

async function authenticate(token) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, authorization: `Bearer ${token}` } })
  return response.ok
}

const gateway = new RunningTradeGateway({
  authenticate,
  connect: (handlers) => new Promise((resolve, reject) => {
    const socket = new WebSocket(providerUrl, { headers: { 'X-API-Key': providerKey } })
    socket.onopen = () => resolve({ close: () => socket.close() })
    socket.onmessage = (event) => { try { handlers.message(JSON.parse(String(event.data))) } catch {} }
    socket.onclose = (event) => handlers.close(event.code)
    socket.onerror = (event) => { handlers.error(event); reject(new Error('Provider WebSocket failed')) }
  }),
})

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8787),
  fetch(request, server) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true })
    if (url.pathname !== '/ws') return new Response('Not found', { status: 404 })
    const id = crypto.randomUUID()
    return server.upgrade(request, { data: { id } }) ? undefined : new Response('Upgrade failed', { status: 400 })
  },
  websocket: {
    open(socket) { gateway.addClient(socket.data.id, (value) => socket.send(JSON.stringify(value))) },
    async message(socket, raw) { try { const message = JSON.parse(String(raw)); if (message.type === 'authenticate' && message.accessToken) { const ok = await gateway.authenticateClient(socket.data.id, message.accessToken); socket.send(JSON.stringify({ type: 'authentication', ok })); if (!ok) socket.close(4401, 'Unauthorized') } } catch { socket.close(4400, 'Invalid message') } },
    close(socket) { gateway.removeClient(socket.data.id) },
  },
})

void gateway.start()
console.log(`HeulaTrade running-trade gateway listening on ${server.port}`)
