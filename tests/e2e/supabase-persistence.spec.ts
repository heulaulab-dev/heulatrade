import { test, expect, type Page } from '@playwright/test'

try { process.loadEnvFile('.env.local') } catch { /* CI can provide credentials through its environment. */ }

const live = process.env.SUPABASE_LIVE_E2E === '1'
const email = process.env.TEST_USER_A_EMAIL
const password = process.env.TEST_USER_A_PASSWORD

test.skip(!live || !email || !password, 'Requires SUPABASE_LIVE_E2E=1 and confirmed test-user credentials')

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'EMAIL' }).fill(email!)
  await page.getByLabel('PASSWORD').fill(password!)
  await page.getByRole('button', { name: 'SIGN IN →' }).click()
  await expect(page.getByRole('button', { name: 'SIGN OUT' })).toBeVisible()
}

async function command(page: Page, value: string) {
  const input = page.getByRole('textbox', { name: 'Terminal command' })
  await input.fill(value)
  await input.press('Enter')
}

function workspaceSaved(page: Page) {
  return page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes('/rest/v1/workspaces') && response.ok())
}

test('authenticated terminal data survives refresh and a new session', async ({ page }) => {
  const name = `Persistence ${Date.now()}`
  // Market ingestion is separate from Supabase; a single screener row exposes
  // column controls while all user-data requests still reach the real project.
  await page.route('**/api/screener', (route) => route.fulfill({ json: {
    data: { rows: [{ symbol: 'BBCA', name: 'Bank Central Asia', price: 100, volume: 1000 }], total: 1, supportedFields: [] },
    meta: { source: 'playwright-market-row', fetchedAt: new Date().toISOString(), dataAsOf: null, freshness: 'EOD' },
  } }))
  await signIn(page)

  const watchlist = page.getByRole('region', { name: 'WL panel' }).first()
  if (!(await watchlist.getByRole('button', { name: 'BBCA', exact: true }).count())) {
    await watchlist.getByRole('textbox', { name: 'Ticker to add' }).fill('BBCA')
    await watchlist.getByRole('button', { name: 'ADD' }).click()
  }
  await expect(watchlist.getByRole('button', { name: 'BBCA', exact: true })).toBeVisible()

  await page.getByRole('textbox', { name: 'Workspace name' }).fill(name)
  await page.getByRole('button', { name: 'SAVE', exact: true }).first().click()
  await expect(page.getByText('SAVED', { exact: true })).toBeVisible()

  await Promise.all([workspaceSaved(page), command(page, 'BBCA CHART')])
  const chart = page.getByRole('region', { name: 'CHART panel' }).last()
  await expect(chart).toBeVisible()
  await Promise.all([workspaceSaved(page), chart.getByRole('button', { name: 'Lock symbol' }).click()])
  await expect(chart.getByLabel('Symbol locked')).toBeVisible()

  await Promise.all([workspaceSaved(page), command(page, 'PORT')])
  const portfolio = page.getByRole('region', { name: 'PORT panel' }).last()
  await portfolio.getByRole('textbox', { name: 'Symbol' }).fill('BBCA')
  await portfolio.getByRole('textbox', { name: 'Quantity' }).fill('10')
  await portfolio.getByRole('textbox', { name: 'Price' }).fill('100')
  await portfolio.getByRole('button', { name: 'RECORD' }).click()
  await expect(portfolio).toContainText('BBCA')

  await Promise.all([workspaceSaved(page), command(page, 'ALERTS')])
  const alerts = page.getByRole('region', { name: 'ALERTS panel' }).last()
  await alerts.getByRole('textbox', { name: 'Alert symbol' }).fill('BBCA')
  await alerts.getByRole('textbox', { name: 'Alert threshold' }).fill('9876')
  await alerts.getByRole('button', { name: 'CREATE' }).click()
  await expect(alerts).toContainText('9,876')

  await Promise.all([workspaceSaved(page), command(page, 'SCREENER')])
  const screener = page.getByRole('region', { name: 'SCREENER panel' }).last()
  await screener.getByRole('textbox', { name: 'Screener name' }).fill(name)
  await screener.getByRole('button', { name: 'SAVE', exact: true }).click()
  await expect(screener.getByText('SAVED', { exact: true })).toBeVisible()
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/rest/v1/user_preferences') && response.ok()),
    screener.getByRole('button', { name: 'Hide volume' }).click(),
  ])
  await expect(screener.getByRole('button', { name: '+ VOLUME' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'SIGN OUT' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Workspace name' })).toHaveValue(name)
  await expect(page.getByRole('region', { name: 'WL panel' }).first().getByRole('button', { name: 'BBCA', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'CHART panel' }).last().getByLabel('Symbol locked')).toBeVisible()
  await expect(page.getByRole('region', { name: 'PORT panel' }).last()).toContainText('BBCA')
  await expect(page.getByRole('region', { name: 'ALERTS panel' }).last()).toContainText('9,876')
  await expect(page.getByRole('region', { name: 'SCREENER panel' }).last().getByRole('button', { name: '+ VOLUME' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Load saved screener' })).toContainText(name)

  await page.getByRole('button', { name: 'SIGN OUT' }).click()
  await expect(page).toHaveURL(/\/login/)
  await signIn(page)
  await expect(page.getByRole('textbox', { name: 'Workspace name' })).toHaveValue(name)
  await expect(page.getByRole('region', { name: 'WL panel' }).first().getByRole('button', { name: 'BBCA', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'CHART panel' }).last().getByLabel('Symbol locked')).toBeVisible()
  await expect(page.getByRole('region', { name: 'PORT panel' }).last()).toContainText('BBCA')
  await expect(page.getByRole('region', { name: 'ALERTS panel' }).last()).toContainText('9,876')
  await expect(page.getByRole('region', { name: 'SCREENER panel' }).last().getByRole('button', { name: '+ VOLUME' })).toBeVisible()
})
