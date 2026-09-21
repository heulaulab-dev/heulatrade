import { expect, test, type Page } from '@playwright/test'

const meta = { source: 'arjum', fetchedAt: '2026-09-21T00:00:00.000Z', dataAsOf: '2026-09-18', freshness: 'HISTORICAL' }
async function stubMarket(page: Page, counters?: { history: number }) {
  await page.route('**/api/market', (route) => route.fulfill({ json: { data: { tradingDate: '2026-09-18', indices: [], topGainers: [], topLosers: [], mostActive: [], foreignFlow: [] }, meta } }))
  await page.route('**/api/search?q=*', (route) => route.fulfill({ json: { data: [{ symbol: 'BBCA', companyName: 'Bank Central Asia Tbk.', lastDate: '2026-09-18', normalizedName: 'bank central asia', initials: 'bca' }], meta: { ...meta, freshness: 'SNAPSHOT' } } }))
  await page.route('**/api/history/BBCA*', (route) => { if (counters) counters.history += 1; return route.fulfill({ json: { data: { symbol: 'BBCA', frame: 'daily', rows: [{ time: '2026-09-18', open: 6325, high: 6350, low: 6225, close: 6300, average: 6276, change: -50, changePercent: -0.79, value: 1_109_371_660_000, volume: 176_753_700, frequency: 29028, foreignBuy: 97_747_700, foreignSell: 154_509_600, foreignNet: -56_761_900 }] }, meta } }) })
  await page.route('**/api/broker-summary/BBCA', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', startDate: '2026-09-18', endDate: '2026-09-18', brokers: [{ code: 'YU', name: 'CGS', buyValue: 284e9, sellValue: 91e9, netValue: 193e9, buyVolume: 45e6, sellVolume: 14e6, netVolume: 31e6, buyFrequency: 2043, sellFrequency: 288, netFrequency: 1755 }], levels: [] }, meta } }))
  await page.route('**/api/broker-accumulation/BBCA*', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', startDate: '2026-09-01', endDate: '2026-09-18', series: [{ code: 'YU', name: 'CGS', points: [{ date: '2026-09-18', netValue: 1, netVolume: 1, cumulativeNetValue: 1, buyAverage: 6300, sellAverage: 6290 }] }], topBuyers: [{ code: 'YU', name: 'CGS', totalNetValue: 1 }], topSellers: [{ code: 'ZP', name: 'Maybank', totalNetValue: -1 }] }, meta } }))
  await page.route('**/api/financial-statements/BBCA*', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', reportType: 'INCOME_STATEMENT', period: 'quarterly', count: 1, periods: [{ year: '2025', quarter: '4', label: "Q4'25", fetchedAt: '2026-09-18' }], rows: [{ key: 'laba_rugi', label: 'Laba Rugi', depth: 0, expandable: false, values: [14_149_630_000_000] }] }, meta } }))
  await page.route('**/api/insiders/BBCA*', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', count: 1, total: 1, page: 1, pageSize: 10, totalPages: 1, rows: [{ person: 'TONNY KUSNADI', date: '2026-03-25', action: 'BUY', nationality: 'local', previousHolding: '7,502,058', currentHolding: '7,819,950', sharesChange: '+317,892', price: '6,982', broker: '', roles: ['KOMISARIS'] }] }, meta } }))
  await page.route('**/api/done-details*', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', date: '2026-09-18', total: 1, page: 1, perPage: 100, totalPages: 1, rows: [{ time: '16:18:00', board: 'NG', price: 6300, lots: 1, value: 630000, buyer: 'AK', seller: 'YP', buyerType: 'F', sellerType: 'D', aggressor: 'BUY' }] }, meta } }))
  await page.route('**/api/seasonal/BBCA', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', months: ['Jan'], rows: [{ year: '2026', average: 1.5, values: [1.5] }], summary: [{ month: 'Jan', average: 1.5, upProbability: 60, samples: 5 }] }, meta } }))
  await page.route('**/api/analysis/BBCA', (route) => route.fulfill({ json: { data: { symbol: 'BBCA', document: 'PRICE ACTION\nProvider conclusion' }, meta } }))
}

test('fresh workspace composes one security and shares canonical history', async ({ page }) => {
  const counters = { history: 0 }
  await stubMarket(page, counters)
  await page.goto('/terminal')
  const expected = ['CHART', 'SEASONAL', 'QUOTE', 'TAPE', 'BROKER', 'ANALYSIS', 'INSIDER', 'HISTORY', 'FUND']
  for (const panel of expected) await expect(page.getByRole('region', { name: `${panel} panel` })).toBeVisible()
  const command = page.getByRole('textbox', { name: 'Terminal command' })
  await command.fill('BBCA'); await command.press('Enter')
  await expect(page.getByRole('region', { name: 'QUOTE panel' })).toContainText('Bank Central Asia Tbk.')
  await expect(page.getByRole('region', { name: 'QUOTE panel' })).toContainText('LAST')
  await expect(page.getByRole('region', { name: 'HISTORY panel' })).toContainText('NET FOREIGN')
  await expect.poll(() => counters.history).toBe(1)
  await command.fill('BBCA CHART'); await command.press('Enter')
  await expect(page.getByRole('region')).toHaveCount(9)
  await expect(page.getByRole('region', { name: 'CHART panel' })).toBeFocused()
})

test('search selection drives chart, broker, accumulation, financials, insiders, and tape history', async ({ page }) => {
  await stubMarket(page); await page.goto('/terminal'); await expect(page.getByRole('main')).toBeVisible()
  await page.getByRole('button', { name: '⌘K' }).click(); const search = page.getByPlaceholder('Search function, company, or enter command'); await search.fill('BBCA')
  await expect(page.getByText('Bank Central Asia Tbk.')).toBeVisible(); await page.getByText('Bank Central Asia Tbk.').click()
  const command = page.getByRole('textbox', { name: 'Terminal command' })
  for (const [value, panel, content] of [['BBCA CHART', 'CHART panel', 'O 6,325'], ['BBCA BROKER', 'BROKER panel', 'YU'], ['BBCA BACC', 'BACC panel', 'TOP BUYERS'], ['BBCA FUND', 'FUND panel', 'Laba Rugi'], ['BBCA INSIDER', 'INSIDER panel', 'TONNY KUSNADI'], ['BBCA TAPE', 'TAPE panel', '16:18:00']] as const) {
    await command.fill(value); await command.press('Enter'); const region = page.getByRole('region', { name: panel }).last(); await expect(region).toBeVisible(); await expect(region).toContainText(content)
  }
})
