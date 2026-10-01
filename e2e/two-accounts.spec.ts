import { test, expect, chromium, type Page } from '@playwright/test'
const API = 'http://localhost:8000/api'
const nav = (p: Page, n: string) => p.getByRole('navigation').getByRole('button', { name: n }).click()
async function signUp(p: Page, name: string) {
  await p.goto('/'); await p.getByRole('button', { name: "I'm new here" }).click()
  await p.getByLabel('Email').fill(`${name}@example.test`); await p.getByLabel(/Pseudonym/).fill(name); await p.getByLabel(/Password/).fill('correct horse battery')
  await p.getByRole('button', { name: 'Create account' }).click(); await expect(p.getByText(`Signed in as ${name}`)).toBeVisible()
}
test('two real accounts: private data stays private, community works, session survives refresh, logout ends it', async () => {
  const id = Date.now().toString(36), an = 'ann' + id, bn = 'bob' + id, opts = test.info().project.use.launchOptions
  // The bundled Chromium is unstable with several browsers/contexts alive at once, so each account gets its own short-lived browser (session state carried via storageState).
  let b = await chromium.launch(opts); let p = await (await b.newContext()).newPage(); await signUp(p, an)
  await p.getByRole('button', { name: 'Numb' }).click(); await expect(p.getByRole('button', { name: 'Numb' })).toHaveAttribute('aria-pressed', 'true')
  await nav(p, 'My Space'); await p.getByLabel('New journal entry').fill('ann-private-journal'); await p.getByRole('button', { name: 'Save entry' }).click(); await expect(p.getByText('ann-private-journal')).toBeVisible()
  await p.getByRole('button', { name: 'Edit' }).click(); await p.getByLabel('Edit entry').fill('ann-private-journal edited'); await p.getByRole('button', { name: 'Save changes' }).click(); await expect(p.getByText('ann-private-journal edited')).toBeVisible()
  await nav(p, 'Community'); await p.getByLabel('Post', { exact: true }).fill('hello from ann e2e'); await p.getByRole('button', { name: 'Post', exact: true }).click(); await expect(p.getByText('hello from ann e2e')).toBeVisible()
  const stateA = await p.context().storageState(); await b.close()

  b = await chromium.launch(opts); p = await (await b.newContext()).newPage(); await signUp(p, bn)
  await nav(p, 'My Space'); await expect(p.getByText('ann-private-journal')).toHaveCount(0); await expect(p.getByText('Your sky is empty')).toBeVisible()
  expect(await (await p.request.get(`${API}/journal`)).json()).toEqual([]); expect(await (await p.request.get(`${API}/checkins`)).json()).toEqual([])
  await nav(p, 'Community'); await expect(p.getByText('hello from ann e2e')).toBeVisible(); await expect(p.getByText('ann-private-journal')).toHaveCount(0); await b.close()

  b = await chromium.launch(opts); p = await (await b.newContext({ storageState: stateA })).newPage(); await p.goto('/')
  await expect(p.getByText(`Signed in as ${an}`)).toBeVisible(); await nav(p, 'My Space'); await expect(p.getByText('ann-private-journal edited')).toBeVisible()
  await p.getByRole('button', { name: 'Sign out' }).click(); await expect(p.getByRole('button', { name: 'Sign in' })).toBeVisible(); expect((await p.request.get(`${API}/journal`)).status()).toBe(401); await b.close()
})
