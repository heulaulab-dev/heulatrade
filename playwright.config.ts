import { defineConfig, devices } from '@playwright/test'
import { globSync } from 'node:fs'
import { homedir } from 'node:os'

const cachedBrowser = globSync(`${homedir()}/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`).sort().at(-1)

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:3000', ...devices['Desktop Chrome'], launchOptions: cachedBrowser ? { executablePath: cachedBrowser } : undefined },
  webServer: {
    command: 'bun run dev --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3000/terminal',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Opt into the deployed project only for the authenticated persistence suite.
    env: process.env.SUPABASE_LIVE_E2E === '1' ? {} : { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
  },
})
