import { expect, test, vi } from 'vitest'
import { RunningTradeGateway } from '@/services/running-trade-gateway/gateway'

test('gateway creates exactly one upstream and fans normalized trades to authenticated clients', async () => {
  const sentA: unknown[] = []; const sentB: unknown[] = []
  const upstream = { close: vi.fn() }
  let message: ((value: unknown) => void) | undefined
  const connect = vi.fn(async (handlers: { message: (value: unknown) => void }) => { message = handlers.message; return upstream })
  const gateway = new RunningTradeGateway({ connect, authenticate: async (token) => token === 'valid', random: () => 0 })
  gateway.addClient('a', (value) => sentA.push(value)); gateway.addClient('b', (value) => sentB.push(value))
  await gateway.authenticateClient('a', 'valid'); await gateway.authenticateClient('b', 'valid')
  await gateway.start(); await gateway.start()
  message?.({ type: 'trade', t: '09:00:00', c: 'BBCA', a: 'BUY', p: 6300, l: 1, v: 630000, pc: 25, tn: 1 })
  expect(connect).toHaveBeenCalledTimes(1)
  expect(sentA.at(-1)).toMatchObject({ type: 'trade', trade: { symbol: 'BBCA' } })
  expect(sentB.at(-1)).toMatchObject({ type: 'trade', trade: { symbol: 'BBCA' } })
})

test('gateway does not fan out to unauthenticated clients', async () => {
  const sent: unknown[] = []
  const gateway = new RunningTradeGateway({ connect: async (handlers) => { handlers.message({ type: 'top5', data: [{ c: 'BBCA', v: 1, tn: 1 }] }); return { close() {} } }, authenticate: async () => false, random: () => 0 })
  gateway.addClient('client', (value) => sent.push(value)); await gateway.authenticateClient('client', 'bad'); await gateway.start()
  expect(sent).toEqual([])
})

test('4408 schedules a takeover cooldown while 4401 stops reconnecting', async () => {
  const delays: number[] = []; let close: ((code: number) => void) | undefined
  const gateway = new RunningTradeGateway({ connect: async (handlers) => { close = handlers.close; return { close() {} } }, authenticate: async () => true, random: () => 0, schedule: (_fn, delay) => { delays.push(delay); return 1 } })
  await gateway.start(); close?.(4408); expect(delays[0]).toBeGreaterThanOrEqual(60_000)
  close?.(4401); expect(delays).toHaveLength(1)
})
