import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, type ApiLogEntry, type ApiModNote, type ApiModReport } from '../api'
import { useStill } from '../store'
import { Empty } from '../components/Cards'
const REASON: Record<string, string> = { harassment: 'Harassment or bullying', spam: 'Spam', harmful: 'Harmful or unsafe content', impersonation: 'Impersonation', other: 'Something else' }
type Action = 'reviewed' | 'dismiss' | 'remove_content'
export default function Moderation() {
  const s = useStill(); const [tab, setTab] = useState<'open' | 'all' | 'log' | 'notes'>('open'); const [rows, setRows] = useState<ApiModReport[]>([]); const [log, setLog] = useState<ApiLogEntry[]>([]); const [pend, setPend] = useState<ApiModNote[]>([])
  const [st, setSt] = useState<'loading' | 'ok' | 'error' | 'denied'>('loading'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [notes, setNotes] = useState<Record<number, string>>({})
  const load = useCallback(async () => {
    setSt('loading')
    try { if (tab === 'notes') setPend(await api.modNotes()); else if (tab === 'log') setLog(await api.modLog()); else setRows((await api.modReports(tab)).items); setSt('ok') }
    catch (e) { if (e instanceof ApiError && e.status === 403) setSt('denied'); else { setSt('error'); setErr(e instanceof ApiError ? e.detail : 'Could not load.') } }
  }, [tab])
  useEffect(() => { if (s.isModerator) void load() }, [load, s.isModerator])
  const act = async (r: ApiModReport, action: Action) => {
    if (busy) return; if (action === 'remove_content' && !window.confirm('Remove this content for everyone? It will be hidden from all users.')) return
    setBusy(true)
    try { await api.modReview(r.id, action, notes[r.id]?.trim() || null); s.toast(action === 'dismiss' ? 'Report dismissed.' : action === 'reviewed' ? 'Marked as reviewed.' : 'Content removed.'); await load() }
    catch (e) { if (!(e instanceof ApiError && e.status === 401)) s.toast(e instanceof ApiError ? e.detail : 'Something went wrong. Nothing was changed.') } finally { setBusy(false) }
  }
  const decide = async (id: number, action: 'approve' | 'reject') => { if (busy) return; setBusy(true); try { await api.modNoteReview(id, action, null); s.toast(action === 'approve' ? 'Note approved.' : 'Note not shared.'); await load() } catch (e) { if (!(e instanceof ApiError && e.status === 401)) s.toast(e instanceof ApiError ? e.detail : 'Something went wrong. Nothing was changed.') } finally { setBusy(false) } }
  if (!s.isModerator || st === 'denied') return <><h1>Moderation</h1><Empty t="Moderators only" b="You don't have access to moderation." /></>
  return (<><h1>Moderation</h1><p className="meta">Review reports. Everything you do here is recorded in an audit log.</p>
    <div className="chips" role="group" aria-label="View">{([['open', 'Open reports'], ['all', 'All reports'], ['notes', 'Notes to review'], ['log', 'Audit log']] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
    {st === 'loading' && <div className="card" aria-busy="true"><p className="meta" role="status">Loading…</p></div>}
    {st === 'error' && <div className="card text-center"><h3>Couldn't load</h3><p className="meta">{err}</p><button className="btn p" onClick={() => void load()}>Try again</button></div>}
    {st === 'ok' && tab === 'log' && (log.length ? log.map(e => <div key={e.id} className="card"><div className="lbl">{e.action.replace('_', ' ')} · {new Date(e.created_at).toLocaleString()}</div><div className="meta">{e.moderator}{e.target_type ? ` · ${e.target_type} ${e.target_id}` : ''}{e.note ? ` · "${e.note}"` : ''}</div></div>) : <Empty t="No entries yet" b="Moderation actions will appear here." />)}
    {st === 'ok' && tab === 'notes' && (pend.length ? pend.map(n => <article key={n.id} className="card"><div className="lbl">Anonymous note · {new Date(n.created_at).toLocaleString()}</div><p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
      <div className="row"><button className="btn p" disabled={busy} onClick={() => void decide(n.id, 'approve')}>Approve</button><button className="btn" disabled={busy} onClick={() => void decide(n.id, 'reject')}>Don't share</button></div></article>) : <Empty t="No notes waiting" b="The queue is clear." />)}
    {st === 'ok' && (tab === 'open' || tab === 'all') && (rows.length ? rows.map(r => (
      <article key={r.id} className="card"><div className="lbl">{REASON[r.reason] ?? r.reason} · {r.status} · reported {new Date(r.created_at).toLocaleString()}</div>
        {r.details && <p className="meta" style={{ margin: '4px 0' }}>Reporter's note: "{r.details}"</p>}
        <div className="card" style={{ background: 'var(--bg2)' }}><div className="meta">{r.target_type === 'note' ? 'anonymous note' : `${r.target_type} by ${r.target.author ?? 'deleted account'}`} · {r.target.content_status}</div><p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{r.target.body ?? '(no longer available)'}</p></div>
        {r.status === 'open' ? (<><label className="meta" htmlFor={`n${r.id}`}>Note for the audit log (optional)</label><textarea id={`n${r.id}`} maxLength={500} value={notes[r.id] ?? ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} />
          <div className="row"><button className="btn" disabled={busy} onClick={() => void act(r, 'reviewed')}>Mark reviewed</button><button className="btn" disabled={busy} onClick={() => void act(r, 'dismiss')}>Dismiss</button><button className="btn p" disabled={busy} onClick={() => void act(r, 'remove_content')}>Remove content</button></div></>)
          : <div className="meta">Handled ({r.status}) by {r.reviewed_by ?? 'a former moderator'}{r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleString()}` : ''}</div>}</article>))
      : <Empty t={tab === 'open' ? 'Nothing to review' : 'No reports yet'} b="The queue is clear." />)}
  </>)
}
