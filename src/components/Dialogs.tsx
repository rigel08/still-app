import { useEffect, useRef, useState } from 'react'
import { useStill } from '../store'
function TryBody({ id }: { id: number }) {
  const s = useStill(); const [r, setR] = useState(''); const a = s.activities.find(x => x.id === id); if (!a) return <p>That activity is no longer available.</p>
  return (<><h2>{a.title}</h2><p className="meta">{a.dur} · no pressure to finish.</p>
    <label className="meta" htmlFor="rf">Anything you noticed? (optional, private)</label><textarea id="rf" value={r} onChange={e => setR(e.target.value)} />
    <div className="row"><button className="btn p" onClick={() => s.complete(id, r)}>I made room for it</button></div></>)
}
const REASONS: [string, string][] = [['harassment', 'Harassment or bullying'], ['spam', 'Spam'], ['harmful', 'Harmful or unsafe content'], ['impersonation', 'Impersonation'], ['other', 'Something else']]
function ReportBody({ what }: { what: string }) {
  const s = useStill(); const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [err, setErr] = useState('')
  return (<><h2>Report this {what}</h2><p className="meta">This hides it for you and records your report.</p>
    <fieldset style={{ border: 0, padding: 0, margin: '10px 0' }}><legend className="meta">Reason (required)</legend>
      {REASONS.map(([v, l]) => <label key={v} style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => { setReason(v); setErr('') }} style={{ width: 'auto' }} />{l}</label>)}</fieldset>
    {err && <p role="alert" style={{ color: 'var(--dusk)' }}>{err}</p>}
    <label className="meta" htmlFor="rd">Anything you'd like to add? (optional)</label><textarea id="rd" maxLength={500} value={details} onChange={e => setDetails(e.target.value)} />
    <div className="row"><button className="btn p" disabled={s.busy} onClick={() => { if (!reason) return setErr('Please choose a reason.'); void s.submitReport(reason, details.trim()) }}>Send report</button></div></>)
}
function DeleteBody() {
  const s = useStill(); const [pw, setPw] = useState('')
  return (<><h2>Delete your account?</h2><p className="meta">This permanently deletes your account, journal, check-ins, posts, replies and saved items. It can't be undone.</p>
    <label className="meta" htmlFor="dpw">Confirm your password</label><input id="dpw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} />
    <div className="row"><button className="btn p" disabled={s.busy || !pw} onClick={() => { void s.deleteAccount(pw) }}>Delete my account</button></div></>)
}
export default function Dialogs() {
  const s = useStill(); const dlg = s.dlg
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!dlg) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return s.setDlg(null)
      if (e.key !== 'Tab' || !box.current) return
      const f = [...box.current.querySelectorAll<HTMLElement>('a[href],button,textarea,input,select')].filter(x => !x.hasAttribute('disabled'))
      if (!f.length) return
      const a = document.activeElement
      if (!box.current.contains(a)) { e.preventDefault(); f[0].focus() }
      else if (e.shiftKey && a === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && a === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [dlg])
  if (!dlg) return null
  const body = dlg.k === 'try' ? <TryBody id={dlg.id} />
    : dlg.k === 'report' ? <ReportBody what={dlg.what} />
    : dlg.k === 'delete' ? <DeleteBody />
    : dlg.k === 'crisis' ? (<><h2>If you need support now</h2><p>still. isn't a crisis service or a replacement for professional care.</p>
      <p>In the US, call or text <b>988</b>. Elsewhere, <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a> lists free lines by country. If you're in immediate danger, contact local emergency services.</p></>)
    : (<><h2>Your data</h2><textarea readOnly aria-label="Your data as JSON" style={{ minHeight: 200 }} value={s.exportJson ?? JSON.stringify({ checkins: s.d.ci, journal: s.d.jr, saved: { posts: s.d.sp, activities: s.d.sa }, completions: s.d.done }, null, 1)} /></>)
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center p-4" style={{ background: '#000a' }} onClick={() => s.setDlg(null)}>
      <div ref={box} role="dialog" aria-modal="true" className="card" style={{ maxWidth: 440, width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        {body}<div className="row"><button className="btn" autoFocus onClick={() => s.setDlg(null)}>Close</button></div></div></div>)
}
