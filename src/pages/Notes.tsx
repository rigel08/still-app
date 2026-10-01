import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type ApiNoteMine, type ApiNoteRead } from '../api'
import { useStill } from '../store'
import { Empty } from '../components/Cards'
const STATUS = { pending: 'Waiting for review', approved: 'Shared with others', rejected: 'Not shared', removed: 'Removed' } as const
export default function Notes() {
  const s = useStill(); const account = s.mode === 'account'; const [note, setNote] = useState<ApiNoteRead | null>(null); const [ph, setPh] = useState<'loading' | 'ok' | 'error'>('loading'); const [err, setErr] = useState('')
  const [mine, setMine] = useState<ApiNoteMine[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('')
  const fail = (e: unknown) => { if (e instanceof ApiError && e.status === 401) return; setErr(e instanceof ApiError ? e.detail : 'Something went wrong.'); setPh('error') }
  const load = useCallback(() => { setPh('loading'); Promise.all([api.notesNext(), api.notesMine()]).then(([n, m]) => { setNote(n); setMine(m); setPh('ok') }, fail) }, [])
  useEffect(() => { if (account) load() }, [account, load])
  useEffect(() => { if (account && !s.dlg && ph === 'ok') api.notesNext().then(setNote, () => undefined) }, [s.dlg])  // after the report dialog closes, fetch a note again (a reported note is never served back)
  if (!account) return <><h1>Notes from strangers</h1><Empty t="Notes need an account" b="Notes come from real people and are reviewed by a moderator, so they aren't available in local demo mode." /></>
  const send = async () => {
    if (busy) return; const t = text.trim(); setMsg(''); if (t.length < 10) return setMsg('Please write at least 10 characters.'); setBusy(true)
    try { const n = await api.addNote(t); setMine(m => [n, ...m]); setText(''); s.toast('Thank you. A moderator will read it before anyone else can.') } catch (e) { if (!(e instanceof ApiError && e.status === 401)) s.toast(e instanceof ApiError ? (e.status === 429 ? 'You have sent several notes recently. Please try again later.' : e.fields.body ?? e.detail) : 'Something went wrong. Nothing was sent.') } finally { setBusy(false) }
  }
  const del = async (id: number) => { if (busy) return; setBusy(true); try { await api.delNote(id); setMine(m => m.filter(x => x.id !== id)) } catch (e) { if (!(e instanceof ApiError && e.status === 401)) s.toast(e instanceof ApiError ? e.detail : 'Something went wrong.') } finally { setBusy(false) } }
  return (<><h1>Notes from strangers</h1><p className="meta">Short, anonymous notes from other people. Every note is read by a moderator before anyone else can see it. Nobody can tell who wrote what.</p>
    {ph === 'loading' && <div className="card" aria-busy="true"><p className="meta" role="status">Loading…</p></div>}
    {ph === 'error' && <div className="card text-center"><h3>Couldn't load notes</h3><p className="meta">{err}</p><button className="btn p" onClick={load}>Try again</button></div>}
    {ph === 'ok' && (note ? <section className="card" aria-label="A note"><p style={{ fontSize: '1.15rem', margin: 0, whiteSpace: 'pre-wrap' }}>{note.body}</p>
      <div className="row"><button className="btn" onClick={() => { api.notesNext().then(setNote, fail) }}>Another note</button><button className="btn g" onClick={() => s.report('n' + note.id, 'note')}>Report</button></div></section>
      : <Empty t="No notes to read yet" b="Nothing has been shared with you right now. You could leave one for someone." />)}
    <h2 style={{ marginTop: 22 }}>Leave a note</h2><label className="meta" htmlFor="nt">Something kind or true that might help someone (10-280 characters). No names, contact details or personal information.</label>
    <textarea id="nt" maxLength={280} value={text} onChange={e => setText(e.target.value)} />{msg && <p role="alert" className="meta" style={{ color: 'var(--dusk)' }}>{msg}</p>}
    <div className="row"><button className="btn p" disabled={busy} onClick={() => void send()}>Send for review</button><span className="meta">{text.length}/280</span></div>
    {mine.length > 0 && <><h2 style={{ marginTop: 22 }}>Your notes</h2><p className="meta">Only you can see this list.</p>{mine.map(n => <div key={n.id} className="card"><p style={{ margin: 0 }}>{n.body}</p><div className="meta">{STATUS[n.status]}</div><div className="row"><button className="btn g" disabled={busy} onClick={() => void del(n.id)}>Delete</button></div></div>)}</>}
  </>)
}
