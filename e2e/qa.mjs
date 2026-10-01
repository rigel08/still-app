import fs from 'node:fs'
import chromium from '@sparticuz/chromium'
import { chromium as pw } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const w = +process.argv[2], h = +process.argv[3], out = { w, errors: [] }, exe = await chromium.executablePath()
const save = () => fs.writeFileSync(`/tmp/qa-${w}.json`, JSON.stringify(out, null, 1))
const b = await pw.launch({ executablePath: exe, args: chromium.args }); const p = await (await b.newContext()).newPage(); await p.setViewportSize({ width: w, height: h })
p.on('console', m => m.type() === 'error' && out.errors.push(m.text().slice(0, 100))); p.on('requestfailed', r => out.errors.push('REQFAIL ' + r.url().slice(0, 80)))
const probe = async name => { const o = await p.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > innerWidth })); const ax = await new AxeBuilder({ page: p }).withRules(['color-contrast']).analyze().catch(() => null); out[name] = { ...o, contrast: ax ? ax.violations.flatMap(v => v.nodes.map(n => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '').slice(0, 70))).slice(0, 3) : 'axe failed' }; await p.screenshot({ path: `shots/qa-${w}-${name}.png` }); save() }
await p.goto('http://localhost:4173/'); await p.waitForTimeout(1200); await probe('welcome')
out.fonts = await p.evaluate(async () => { await document.fonts.ready; return { dm: document.fonts.check('16px "DM Sans"'), serif: document.fonts.check('32px "Instrument Serif"'), loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).slice(0, 4) } }); save()
await p.getByRole('button', { name: 'I\'m new here' }).click(); await probe('register')
await p.getByRole('button', { name: 'Try local demo mode' }).click(); await p.waitForTimeout(800)
for (const t of ['Home', 'Discover', 'Community', 'Explore', 'My Space']) { await p.getByRole('navigation').getByRole('button', { name: t }).click(); await p.waitForTimeout(700); await probe(t.replace(' ', '')) }
await p.getByRole('navigation').getByRole('button', { name: 'Discover' }).click(); await p.waitForTimeout(500); await p.getByRole('button', { name: 'Report' }).first().click(); await p.waitForTimeout(400); await probe('reportDialog')
out.dialogFocusInside = await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]')); await p.keyboard.press('Escape'); await p.waitForTimeout(300); out.dialogClosed = (await p.locator('[role=dialog]').count()) === 0
out.focusRestored = await p.evaluate(() => document.activeElement?.textContent?.trim()); out.done = true; save(); await b.close()
