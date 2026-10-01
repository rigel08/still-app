import { test, expect, chromium } from '@playwright/test'
test('new screens: Quiet Room presence, Notes submission, Tiny Returns and the sky work for a real account', async () => {
  const id = Date.now().toString(36), name = 'cal' + id, b = await chromium.launch(test.info().project.use.launchOptions); const p = await (await b.newContext()).newPage(); await p.goto('/')
  await p.getByRole('button', { name: "I'm new here" }).click(); await p.getByLabel('Email').fill(`${name}@example.test`); await p.getByLabel(/Pseudonym/).fill(name); await p.getByLabel(/Password/).fill('correct horse battery')
  await p.getByRole('button', { name: 'Create account' }).click(); await expect(p.getByText(`Signed in as ${name}`)).toBeVisible()
  await p.getByRole('button', { name: /The Quiet Room/ }).click(); await expect(p.getByText('No one is in the room right now.')).toBeVisible(); await p.getByRole('button', { name: 'Join the quiet room' }).click()
  await expect(p.getByText("You're here. No one else is in the room right now.")).toBeVisible(); await p.getByRole('button', { name: 'Leave the room' }).click(); await expect(p.getByRole('button', { name: 'Join the quiet room' })).toBeVisible()
  await p.getByRole('navigation').getByRole('button', { name: 'Home' }).click(); await p.getByRole('button', { name: /Notes from strangers/ }).click(); await expect(p.getByText('No notes to read yet')).toBeVisible()
  await p.getByLabel(/Something kind or true/).fill('You are allowed to rest today, truly.'); await p.getByRole('button', { name: 'Send for review' }).click(); await expect(p.getByText('Waiting for review')).toBeVisible()
  await p.getByRole('navigation').getByRole('button', { name: 'Home' }).click(); await p.getByRole('button', { name: /Tiny Returns/ }).click(); await expect(p.getByRole('heading', { name: 'Tiny Returns' })).toBeVisible(); await p.getByRole('button', { name: 'Low energy' }).click(); await expect(p.getByRole('button', { name: 'Try this' }).first()).toBeVisible()
  await p.getByRole('navigation').getByRole('button', { name: 'Home' }).click(); await p.getByRole('button', { name: 'Hopeful' }).click(); await expect(p.getByRole('button', { name: 'Hopeful' })).toHaveAttribute('aria-pressed', 'true')
  await p.getByRole('navigation').getByRole('button', { name: 'My Space' }).click(); const star = p.getByRole('group', { name: /as stars/ }).getByRole('button').first(); await star.focus(); await p.keyboard.press('Enter'); await expect(p.getByRole('region', { name: 'Star details' })).toContainText('Hopeful')
  await b.close()
})
