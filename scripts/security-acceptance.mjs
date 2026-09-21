/**
 * SECURITY Workspace live Chromium acceptance for BBCA + HRTA.
 *
 * Usage: node scripts/security-acceptance.mjs
 *
 * Requires: dev server running on http://localhost:3000
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const URL = 'http://localhost:3000/terminal'
const OUT = join(process.cwd(), 'test-results', 'security-live')
const EXPECTED_PANELS = ['CHART', 'SEASONAL', 'QUOTE', 'TAPE', 'BROKER', 'ANALYSIS', 'INSIDER', 'HISTORY', 'FUND']

mkdirSync(OUT, { recursive: true })

async function acceptSymbol(page, symbol) {
  console.log(`\n=== ${symbol} ACCEPTANCE ===`)
  const results = { symbol, ui: 'FAIL', panels: [], historyRequests: 0, hasNaN: false, hasUndefined: false }

  // Count history API requests BEFORE navigation
  let historyCount = 0
  await page.route('**/api/history/**', (route) => {
    historyCount += 1
    return route.continue()
  })

  // Navigate to terminal (fresh load)
  await page.goto(URL)
  await page.waitForSelector('main', { timeout: 15000 })

  // Type symbol and press Enter
  const input = page.getByRole('textbox', { name: 'Terminal command' })
  await input.fill(symbol)
  await input.press('Enter')

  // Wait for GLOBAL to show the symbol
  await page.waitForFunction(
    (sym) => document.querySelector('main')?.textContent?.includes(sym),
    symbol,
    { timeout: 20000 },
  )
  console.log(`  GLOBAL shows ${symbol}: PASS`)

  // Wait for panels to render and data to load
  await page.waitForTimeout(5000)

  // Check all 9 expected panels
  const panels = []
  for (const panelType of EXPECTED_PANELS) {
    const panel = page.getByRole('region', { name: `${panelType} panel` }).first()
    const visible = await panel.isVisible().catch(() => false)
    panels.push({ type: panelType, visible })
    console.log(`  ${panelType} panel: ${visible ? 'PASS' : 'FAIL'}`)
  }
  results.panels = panels
  const allPanelsVisible = panels.every((p) => p.visible)
  results.ui = allPanelsVisible ? 'PASS' : 'FAIL'
  results.historyRequests = historyCount

  // Check for NaN / undefined in visible text
  const bodyText = await page.locator('main').textContent() ?? ''
  results.hasNaN = /\bNaN\b/.test(bodyText)
  results.hasUndefined = /\bundefined\b/.test(bodyText)
  console.log(`  NaN in UI: ${results.hasNaN ? 'FOUND (FAIL)' : 'absent (PASS)'}`)
  console.log(`  undefined in UI: ${results.hasUndefined ? 'FOUND (FAIL)' : 'absent (PASS)'}`)
  console.log(`  historyRequests: ${historyCount}`)

  // Screenshot
  const screenshotPath = join(OUT, `${symbol.toLowerCase()}-security.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })
  console.log(`  Screenshot: ${screenshotPath}`)

  return results
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()

  const bbca = await acceptSymbol(page, 'BBCA')

  // Fresh page for HRTA
  const page2 = await context.newPage()
  const hrta = await acceptSymbol(page2, 'HRTA')

  await browser.close()

  console.log('\n=== SUMMARY ===')
  for (const r of [bbca, hrta]) {
    console.log(`\n${r.symbol}:`)
    console.log(`  UI:        ${r.ui}`)
    console.log(`  Panels:    ${r.panels.filter((p) => p.visible).length}/9 visible`)
    console.log(`  history:   ${r.historyRequests} request(s)`)
    console.log(`  NaN:       ${r.hasNaN ? 'FAIL' : 'PASS'}`)
    console.log(`  undefined: ${r.hasUndefined ? 'FAIL' : 'PASS'}`)
  }

  // Fail process if any check failed
  const failed = [bbca, hrta].some(
    (r) => r.ui !== 'PASS' || r.hasNaN || r.hasUndefined
  )
  if (failed) {
    console.error('\nACCEPTANCE FAILED')
    process.exit(1)
  }
  console.log('\nACCEPTANCE PASSED')
}

main().catch((err) => { console.error(err); process.exit(1) })
