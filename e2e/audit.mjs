import fs from 'node:fs'
import chromium from '@sparticuz/chromium'
import { chromium as pw } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const URL = 'http://localhost:4173/', out = {}
const launch = () => pw.launch({ executablePath: chromiumPath, args: chromium.args, headless: true })
const chromiumPath = await chromium.executablePath()
const VPS = [[375, 812], [390, 844], [768, 1024], [1440, 900]], TABS = ['Home', 'Discover', 'Community', 'Explore', 'My Space']
const g = p => p.evaluate(() => { const [m, s] = [...document.querySelectorAll('#scene g')]; return { moon: +getComputedStyle(m).opacity, sun: +getComputedStyle(s).opacity, cutCx: document.querySelector('#scene mask circle').getAttribute('cx'), ac: getComputedStyle(document.documentElement).getPropertyValue('--ac').trim() } })
async function run(key, w, h, fn, opts = {}) { if (process.env.ONLY && !key.startsWith(process.env.ONLY)) return; const b = await launch(); try { const p = await (await b.newContext(opts)).newPage(); await p.setViewportSize({ width: w, height: h }); const r = out[key] = { errors: [] }; p.on('console', m => m.type() === 'error' && r.errors.push(m.text())); p.on('pageerror', e => r.errors.push(String(e))); await p.goto(URL); await p.waitForTimeout(700); await Promise.race([fn(p, r), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 100s')), 100000))]) } catch (e) { out[key] = { ...(out[key] || {}), CRASH: String(e).slice(0, 120) } } finally { fs.writeFileSync('/tmp/audit-' + (process.env.ONLY || 'all') + '.json', JSON.stringify(out, null, 1)); await b.close().catch(() => {}) } }
for (const [w, h] of VPS) await run('layout' + w, w, h, async (p, r) => { r.tabs = {}
  for (const t of TABS) {
    await p.click(`nav[aria-label=Main] >> text="${t}"`); await p.waitForTimeout(700)
    await p.screenshot({ path: `shots/${w}-${t.replace(' ', '')}.png`, fullPage: w < 1440 })
    r.tabs[t] = await p.evaluate(() => { const m = document.querySelector('main').getBoundingClientRect(), n = document.querySelector('nav').getBoundingClientRect()
      const small = [...document.querySelectorAll('button,select,input,textarea')].filter(e => { const q = e.getBoundingClientRect(); return q.width && (q.height < 44 || q.width < 44) }).map(e => (e.textContent || e.ariaLabel || e.tagName).trim().slice(0, 18))
      const last = document.querySelector('main').lastElementChild.getBoundingClientRect().bottom + scrollY
      return { overflowX: document.documentElement.scrollWidth > innerWidth, mainW: Math.round(m.width), mainLeft: Math.round(m.left), nav: n.top > innerHeight / 2 ? 'bottom' : 'left-rail', navW: Math.round(n.width), small: [...new Set(small)].slice(0, 6), docH: document.documentElement.scrollHeight, lastEl: Math.round(last) } })
    const ax = await new AxeBuilder({ page: p }).withRules(['color-contrast']).analyze()
    r.tabs[t].contrast = ax.violations.flatMap(v => v.nodes.map(n => n.any[0]?.message?.slice(0, 90) + ' | ' + n.target.join(' '))).slice(0, 4)
  } })
for (const [w, h] of [[390, 844], [1440, 900]]) {
  await run('mood' + w, w, h, async (p, r) => { r.before = await g(p); await p.click('button:has-text("Hopeful")'); await p.waitForTimeout(300); r.mid = await g(p); await p.waitForTimeout(1600); r.sun = await g(p)
    await p.screenshot({ path: `shots/${w}-Home-Hopeful.png` }); await p.click('button:has-text("Lonely")'); await p.waitForTimeout(1600); r.lonely = await g(p); await p.click('#scene'); r.afterTap = await g(p) })
  await run('dialog' + w, w, h, async (p, r) => { await p.click('text="Need support now?"'); r.visible = await p.isVisible('[role=dialog]'); r.focusInDialog = await p.evaluate(() => !!document.activeElement.closest('[role=dialog]')); await p.screenshot({ path: `shots/${w}-Dialog.png` }); await p.keyboard.press('Escape'); r.closedByEsc = !(await p.isVisible('[role=dialog]')) })
  await run('keys' + w, w, h, async (p, r) => { r.stops = []; for (let i = 0; i < 9; i++) { await p.keyboard.press('Tab'); r.stops.push(await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return (e.ariaLabel || e.textContent || e.tagName).trim().slice(0, 20) + (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? ' [ring]' : ' [NO RING]') })) }
    await p.evaluate(() => document.querySelector('#scene').focus()); await p.keyboard.press('Enter'); r.keyboardMoon = await g(p) })
}
await run('reduced', 390, 844, async (p, r) => { await p.emulateMedia({ reducedMotion: 'reduce' }); await p.reload(); await p.waitForTimeout(500)
  Object.assign(r, await p.evaluate(() => ({ starsAnim: getComputedStyle(document.body, '::before').animationName, cardAnim: getComputedStyle(document.querySelector('.card')).animationName, sceneTransition: getComputedStyle(document.querySelector('#scene g')).transitionDuration }))) })
console.log(JSON.stringify(out, null, 1))
