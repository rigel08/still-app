import { useState } from 'react'
import { useStill } from '../store'
import type { Pref } from '../types'
import Sky from '../components/Sky'
import { ActCard, Empty, PostCard } from '../components/Cards'
export default function MySpace() {
  const s = useStill(); const [j, setJ] = useState(''); const [ed, setEd] = useState<{ id: number; text: string } | null>(null)
  const sp = s.savedPosts; const sa = s.activities.filter(a => s.d.sa.includes(a.id))
  return (<><h1>My Space</h1><p className="meta">Private by default. In this demo everything stays on this device.</p>
    <h2>Check-in constellation</h2><Sky ci={s.d.ci} jr={s.d.jr} />
    <div className="chips">{s.d.ci.slice(-6).reverse().map(c => <span key={c.id} className="chip">{c.e} · {new Date(c.t).toLocaleDateString()} <button className="btn g" style={{ padding: '0 4px', minHeight: 0 }} aria-label="Delete check-in" onClick={() => s.delCheckIn(c.id)}>×</button></span>)}</div>
    <h2 style={{ marginTop: 22 }}>Journal</h2>
    <textarea aria-label="New journal entry" placeholder="Only you can read this." value={j} onChange={e => setJ(e.target.value)} />
    <div className="row"><button className="btn p" disabled={s.busy} onClick={() => { void Promise.resolve(s.addJournal(j)).then(ok => { if (ok) setJ('') }) }}>Save entry</button></div>
    {[...s.d.jr].reverse().map(e => <div key={e.id} className="card">{ed?.id === e.id ? (<><label className="meta" htmlFor="je">Edit entry</label>
      <textarea id="je" autoFocus maxLength={10000} value={ed.text} onChange={x => setEd({ id: e.id, text: x.target.value })} />
      {!ed.text.trim() && <p className="meta" role="alert">An entry can't be empty.</p>}
      <div className="row"><button className="btn p" disabled={s.busy || !ed.text.trim()} onClick={() => { void Promise.resolve(s.updJournal(e.id, ed.text)).then(ok => { if (ok) setEd(null) }) }}>{s.busy ? 'Saving…' : 'Save changes'}</button><button className="btn g" disabled={s.busy} onClick={() => setEd(null)}>Cancel</button></div></>)
      : (<><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{e.b}</p><div className="meta">{new Date(e.t).toLocaleString()}</div><div className="row"><button className="btn g" onClick={() => setEd({ id: e.id, text: e.b })}>Edit</button><button className="btn g" onClick={() => s.delJournal(e.id)}>Delete</button></div></>)}</div>)}
    <h2 style={{ marginTop: 22 }}>Saved</h2>{sp.map(p => <PostCard key={p.id} p={p} />)}{sa.map(a => <ActCard key={a.id} a={a} />)}
    {s.savedMore && <div className="row"><button className="btn" disabled={s.busy} onClick={s.loadMoreSaved}>Show more saved posts</button></div>}
    {!sp.length && !sa.length && <Empty t="Nothing saved" b="Save posts and activities to find them here." />}
    <h2 style={{ marginTop: 22 }}>Preferences</h2>
    <div className="card"><label className="meta" htmlFor="pf">When I'm feeling low, I'd like…</label>
      <select id="pf" value={s.d.pref} onChange={e => s.setPref(e.target.value as Pref)}><option value="either">Either, no pressure</option><option value="company">Some company</option><option value="alone">To be alone (no social nudges)</option></select>
      <div className="row"><button className="chip" aria-pressed={s.d.low} onClick={s.toggleLow}>Low-energy mode</button></div>
      <p className="meta">No notifications are sent in this demo. Nothing here nudges you to come back.</p></div>
    {s.d.blk.length > 0 && <div className="card"><div className="lbl">Blocked</div>{s.d.blk.map(u => <button key={u} className="chip" onClick={() => s.unblock(u)}>Unblock {u}</button>)}</div>}
    <div className="row">{s.isModerator && <button className="btn" onClick={() => s.go('mod')}>Moderation queue</button>}<button className="btn" onClick={s.openExport}>View my data</button><button className="btn" onClick={s.wipe}>{s.mode === 'account' ? 'Delete my account and data' : 'Delete all my data'}</button><button className="btn" onClick={() => s.setDlg({ k: 'crisis' })}>Support resources</button></div></>)
}
