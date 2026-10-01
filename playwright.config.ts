import { defineConfig } from '@playwright/test'
// Set PW_SPARTICUZ=1 to use the bundled Chromium from @sparticuz/chromium (used where Playwright's own browser download is blocked).
const launchOptions = process.env.PW_SPARTICUZ ? await (async () => { const c = (await import('@sparticuz/chromium')).default; return { executablePath: await c.executablePath(), args: c.args } })() : {}
export default defineConfig({ testDir: 'e2e', testMatch: '*.spec.ts', workers: 1, timeout: 120000, use: { baseURL: 'http://localhost:4173', launchOptions } })
