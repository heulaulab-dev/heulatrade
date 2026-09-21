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
  await page.keyboard.press('/')
  await expect(page.getByRole('textbox', { name: 'Terminal command' })).toBeFocused()
})

test('screener composes validated filters and reports source unavailability', async ({ page }) => {
  await page.goto('/terminal')
  const command = page.getByRole('textbox', { name: 'Terminal command' })
  await command.fill('SCREENER')
  await command.press('Enter')
  const panel = page.getByRole('region', { name: 'SCREENER panel' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: '+ CONDITION' }).click()
  await panel.getByRole('combobox', { name: 'Field 1' }).selectOption('roe')
  await panel.getByRole('spinbutton', { name: 'Value 1' }).fill('15')
  await panel.getByRole('button', { name: 'RUN' }).click()
  await expect(panel).toContainText('1 CONDITIONS')
  await expect(panel).toContainText('UNAVAILABLE')
})
