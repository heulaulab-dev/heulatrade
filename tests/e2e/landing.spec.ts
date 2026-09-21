import { expect, test } from '@playwright/test'

test('landing page is public and routes unauthenticated users to login', async ({ page }) => {
  const requestedUrls: string[] = []
  page.on('request', (request) => requestedUrls.push(request.url()))

  await page.goto('/')

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Read the market. Follow the flow.' })).toBeVisible()
  await expect(page.getByText('SAMPLE / PREVIEW')).toBeVisible()
  await expect(page.getByRole('link', { name: 'OPEN TERMINAL' }).first()).toHaveAttribute('href', '/login')
  await expect(page.getByRole('link', { name: 'LOG IN' })).toHaveAttribute('href', '/login')
  expect(requestedUrls.some((url) => url.includes('/api/'))).toBe(false)
})

test('serves the HeulaTrade favicon', async ({ request }) => {
  const response = await request.get('/icon.svg')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('image/svg+xml')
  await expect(response.text()).resolves.toContain('HEULA')
})
