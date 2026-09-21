import { test, expect } from '@playwright/test'

test('command changes global security and an unlocked chart panel', async ({ page }) => {
  const hydrationErrors: string[] = []
  page.on('console', (message) => { if (message.type() === 'error' && message.text().includes('hydrated')) hydrationErrors.push(message.text()) })
  await page.goto('/terminal')
  await expect(page.getByRole('main')).toContainText('HEULA')
  const input = page.getByRole('textbox', { name: 'Terminal command' })
  await input.fill('BBCA')
  await input.press('Enter')
  await expect(page.getByText('BBCA', { exact: true }).first()).toBeVisible()
  await input.fill('BBCA CHART')
  await input.press('Enter')
  await expect(page.getByRole('region', { name: 'CHART panel' }).first()).toBeVisible()
  expect(hydrationErrors).toEqual([])
})

test('keyboard focus reaches command bar', async ({ page }) => {
  await page.goto('/terminal')
  await expect(page.getByRole('button', { name: '⌘K' })).toBeVisible()
  await page.getByRole('main').click({ position: { x: 10, y: 100 } })
  await page.keyboard.press('/')
  await expect(page.getByRole('textbox', { name: 'Terminal command' })).toBeFocused()
})

test('provider screener renders structured rows', async ({ page }) => {
  await page.route('**/api/screener/latest', (route) => route.fulfill({ json: { data: { date: '2026-09-18', source: 'screener_v5.py', cachedForSeconds: 60, rows: [{ symbol: 'BBCA', name: 'Bank Central Asia Tbk.', bucket: 'ACCUMULATION', flags: 'FOREIGN', wrEvent: null, potential: null, drawdown: null, note: 'sample' }] }, meta: { source: 'arjum', fetchedAt: '2026-09-21T00:00:00.000Z', dataAsOf: '2026-09-18', freshness: 'SNAPSHOT' } } }))
  await page.goto('/terminal')
  const command = page.getByRole('textbox', { name: 'Terminal command' })
  await command.fill('SCREENER')
  await command.press('Enter')
  const panel = page.getByRole('region', { name: 'SCREENER panel' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Bank Central Asia Tbk.')
  await expect(panel).toContainText('ACCUMULATION')
})
