import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

try { process.loadEnvFile('.env.local') } catch { /* CI can provide credentials directly. */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const credentials = [
  [process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_A_PASSWORD],
  [process.env.TEST_USER_B_EMAIL, process.env.TEST_USER_B_PASSWORD],
]
if (!url || !key || credentials.some(([email, password]) => !email || !password)) {
  throw new Error('Set project URL, publishable key, and both confirmed TEST_USER_* credentials')
}

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const a = client()
const b = client()
const anon = client()
const results = []
const tag = `rls-${Date.now()}`

function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
  if (!condition) console.error(`FAIL ${name}: ${detail}`)
}

async function required(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? ''} ${result.error.message}`)
  return result.data
}

async function signIn(c, [email, password], label) {
  const { data, error } = await c.auth.signInWithPassword({ email, password })
  if (error || !data.user || !data.session) throw new Error(`${label} sign-in failed: ${error?.message ?? 'no session'}`)
  return data.user.id
}

const [aId, bId] = await Promise.all([
  signIn(a, credentials[0], 'A'),
  signIn(b, credentials[1], 'B'),
])
assert.notEqual(aId, bId, 'Test users must be distinct')
check('auth sessions', true)

const created = { a: {}, b: {} }
const previous = { a: {}, b: {} }
const specs = [
  ['profiles', 'id', { display_name: `${tag}-changed` }],
  ['watchlists', 'id', { name: `${tag}-changed` }],
  ['watchlist_items', 'id', { position: 2 }],
  ['workspaces', 'id', { name: `${tag}-changed` }],
  ['workspace_panels', 'id', { position: 2 }],
  ['portfolios', 'id', { name: `${tag}-changed` }],
  ['portfolio_transactions', 'id', { price: 101 }],
  ['alerts', 'id', { enabled: false }],
  ['saved_screeners', 'id', { name: `${tag}-changed` }],
  ['notes', 'id', { body: `${tag}-changed` }],
  ['user_preferences', 'user_id', { density: 'COMFORTABLE' }],
]

async function createFor(c, userId, side) {
  const own = created[side]
  const old = previous[side]
  for (const table of ['profiles', 'user_preferences']) {
    const keyName = table === 'profiles' ? 'id' : 'user_id'
    const { data, error } = await c.from(table).select('*').eq(keyName, userId).maybeSingle()
    if (error) throw error
    old[table] = data
  }
  if (!old.profiles) own.profiles = await required(await c.from('profiles').insert({ id: userId, display_name: tag }).select('*').single(), 'create profile')
  else own.profiles = old.profiles
  own.watchlists = await required(await c.from('watchlists').insert({ name: tag }).select('*').single(), 'create watchlist')
  own.watchlist_items = await required(await c.from('watchlist_items').insert({ watchlist_id: own.watchlists.id, symbol: side === 'a' ? 'BBCA' : 'BBRI' }).select('*').single(), 'create watchlist item')
  own.workspaces = await required(await c.from('workspaces').insert({ name: tag, layout: { kind: 'panel', panel: { id: tag, type: 'CHART', symbol: 'BBCA', locked: false, settings: {} } } }).select('*').single(), 'create workspace')
  own.workspace_panels = await required(await c.from('workspace_panels').insert({ workspace_id: own.workspaces.id, panel_type: 'CHART' }).select('*').single(), 'create workspace panel')
  own.portfolios = await required(await c.from('portfolios').insert({ name: tag }).select('*').single(), 'create portfolio')
  own.portfolio_transactions = await required(await c.from('portfolio_transactions').insert({ portfolio_id: own.portfolios.id, symbol: 'BBCA', transaction_type: 'BUY', transaction_date: new Date().toISOString().slice(0, 10), quantity: 10, price: 100 }).select('*').single(), 'create transaction')
  own.alerts = await required(await c.from('alerts').insert({ symbol: 'BBCA', metric: 'PRICE', operator: 'GT', threshold: 9000 }).select('*').single(), 'create alert')
  own.saved_screeners = await required(await c.from('saved_screeners').insert({ name: tag, conditions: [], sort_config: { field: 'value', descending: true } }).select('*').single(), 'create screener')
  own.notes = await required(await c.from('notes').insert({ symbol: 'BBCA', body: tag }).select('*').single(), 'create note')
  if (!old.user_preferences) own.user_preferences = await required(await c.from('user_preferences').insert({ user_id: userId, columns: { screener: { hidden: ['volume'], pinned: ['symbol'] } } }).select('*').single(), 'create preferences')
  else own.user_preferences = old.user_preferences
}

function foreignInsert(table) {
  const row = created.b
  switch (table) {
    case 'watchlists': return { user_id: bId, name: `${tag}-foreign` }
    case 'watchlist_items': return { watchlist_id: row.watchlists.id, symbol: 'TLKM' }
    case 'workspaces': return { user_id: bId, name: `${tag}-foreign`, layout: {} }
    case 'workspace_panels': return { workspace_id: row.workspaces.id, panel_type: 'CHART' }
    case 'portfolios': return { user_id: bId, name: `${tag}-foreign` }
    case 'portfolio_transactions': return { portfolio_id: row.portfolios.id, symbol: 'TLKM', transaction_type: 'BUY', transaction_date: new Date().toISOString().slice(0, 10), quantity: 1, price: 1 }
    case 'alerts': return { user_id: bId, symbol: 'TLKM', metric: 'PRICE', operator: 'GT', threshold: 1 }
    case 'saved_screeners': return { user_id: bId, name: `${tag}-foreign`, conditions: [], sort_config: {} }
    case 'notes': return { user_id: bId, body: `${tag}-foreign` }
    default: return null
  }
}

try {
  await createFor(a, aId, 'a')
  await createFor(b, bId, 'b')
  for (const [table, pk, patch] of specs) {
    const aRow = created.a[table]
    const bRow = created.b[table]
    const ownRead = await a.from(table).select('*').eq(pk, aRow[pk]).single()
    check(`${table} own SELECT`, !ownRead.error && ownRead.data?.[pk] === aRow[pk], ownRead.error?.message)
    const ownUpdate = await a.from(table).update(patch).eq(pk, aRow[pk]).select(pk)
    check(`${table} own UPDATE`, !ownUpdate.error && ownUpdate.data?.length === 1, ownUpdate.error?.message)
    const foreignRead = await a.from(table).select('*').eq(pk, bRow[pk])
    check(`${table} cross-user SELECT`, !foreignRead.error && foreignRead.data?.length === 0, foreignRead.error?.message)
    const foreignUpdate = await a.from(table).update(patch).eq(pk, bRow[pk]).select(pk)
    check(`${table} cross-user UPDATE`, !foreignUpdate.error && foreignUpdate.data?.length === 0, foreignUpdate.error?.message)
    const foreignDelete = await a.from(table).delete().eq(pk, bRow[pk]).select(pk)
    check(`${table} cross-user DELETE`, !foreignDelete.error && foreignDelete.data?.length === 0, foreignDelete.error?.message)
    const bStillExists = await b.from(table).select(pk).eq(pk, bRow[pk]).single()
    check(`${table} B record intact`, !bStillExists.error && bStillExists.data?.[pk] === bRow[pk], bStillExists.error?.message)
    const anonRead = await anon.from(table).select(pk).eq(pk, aRow[pk])
    check(`${table} anonymous SELECT`, Boolean(anonRead.error) || anonRead.data?.length === 0, anonRead.error?.message)
    const row = foreignInsert(table)
    if (row) {
      const foreignCreate = await a.from(table).insert(row).select(pk)
      check(`${table} cross-user INSERT`, Boolean(foreignCreate.error) && !foreignCreate.data?.length, foreignCreate.error?.message)
      if (foreignCreate.data?.length) await b.from(table).delete().eq(pk, foreignCreate.data[0][pk])
    }
  }
  const anonInsert = await anon.from('watchlists').insert({ name: `${tag}-anonymous` })
  check('anonymous INSERT denied', Boolean(anonInsert.error), anonInsert.error?.message)
  const notificationInsert = await a.from('notifications').insert({ user_id: bId, type: 'SYSTEM', title: tag, message: tag })
  check('cross-user notification INSERT denied', Boolean(notificationInsert.error), notificationInsert.error?.message)
} finally {
  const deleteOrder = ['workspace_panels', 'watchlist_items', 'portfolio_transactions', 'alerts', 'saved_screeners', 'notes', 'workspaces', 'watchlists', 'portfolios', 'profiles', 'user_preferences']
  for (const [side, c, userId] of [['a', a, aId], ['b', b, bId]]) {
    for (const table of deleteOrder) {
      const row = created[side][table]
      if (!row) continue
      const old = previous[side][table]
      if (old) {
        const keyName = table === 'profiles' ? 'id' : 'user_id'
        await c.from(table).update(old).eq(keyName, userId)
        continue
      }
      const pk = table === 'user_preferences' ? 'user_id' : 'id'
      const deleted = await c.from(table).delete().eq(pk, row[pk]).select(pk)
      check(`${table} own DELETE ${side}`, !deleted.error && deleted.data?.length === 1, deleted.error?.message)
    }
  }
}

const failed = results.filter((result) => !result.pass)
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, failures: failed.map(({ name, detail }) => ({ name, detail })) }, null, 2))
if (failed.length) process.exitCode = 1
