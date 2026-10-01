import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, type ApiQuiet } from '../api'
import { useStill } from '../store'
import { Empty } from '../components/Cards'
export default function Quiet() {
  const s = useStill(); const account = s.mode === 'account'; const [st, setSt] = useState<ApiQuiet | null>(null); const [phase, setPhase] = useState<'loading' | 'ok' | 'error'>('loading'); const [err, setErr] = useState('')
  const [since, setSince] = useState<number | null>(null); const [now, setNow] = useState(Date.now()); const [busy, setBusy] = useState(false); const joined = useRef(false)
  const fail = (e: unknown) => { if (e instanceof ApiError && e.status === 401) return; setErr(e instanceof ApiError ? e.detail : 'Something went wrong.'); setPhase('error') }
  const refresh = useCallback(() => { setPhase('loading'); api.quiet().then(x => { setSt(x); setPhase('ok') }, fail) }, [])
  useEffect(() => { if (account) refresh() }, [account, refresh])
  const mine = !!st?.mine
  useEffect(() => { if (!mine) return; const hb = setInterval(() => { api.quietBeat().then(setSt, fail) }, 30000); const tick = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(hb); clearInterval(tick) } }, [mine])
  useEffect(() => () => { if (joined.current) void api.quietLeave().catch(() => undefined) }, [])  // leaving the page leaves the room
  const act = async (f: () => Promise<ApiQuiet>, join: boolean) => { if (busy) return; setBusy(true); try { const x = await f(); setSt(x); joined.current = join; setSince(join ? Date.now() : null) } catch (e) { if (!(e instanceof ApiError && e.status === 401)) s.toast(e instanceof ApiError ? e.detail : 'Something went wrong.') } finally { setBusy(false) } }
  if (!account) return <><h1>The Quiet Room</h1><Empty t="The Quiet Room needs an account" b="It shows who is really here right now, so it isn't available in local demo mode." /></>
  const others = st ? st.present - (st.mine ? 1 : 0) : 0
  const line = !st ? '' : st.mine ? (others === 0 ? "You're here. No one else is in the room right now." : `You're here with ${others} other ${others === 1 ? 'person' : 'people'}.`) : others === 0 ? 'No one is in the room right now.' : `${others} ${others === 1 ? 'person is' : 'people are'} in the room right now.`
  const secs = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0
  return (<><h1>The Quiet Room</h1><p className="meta">Sit here for as long as you like. There's no chat, no names and nothing to say. You only count as present while this page is open, and the count is real.</p>
    {phase === 'loading' && <div className="card" aria-busy="true"><p className="meta" role="status">Looking in…</p></div>}
    {phase === 'error' && <div className="card text-center"><h3>Couldn't check the room</h3><p className="meta">{err}</p><button className="btn p" onClick={refresh}>Try again</button></div>}
    {phase === 'ok' && st && <section className="card text-center" aria-label="Quiet room"><svg viewBox="0 0 120 60" width="120" height="60" aria-hidden="true"><circle cx="60" cy="30" r="26" fill="#AABBE8" opacity=".12" /><circle cx="60" cy="30" r="12" fill={st.mine ? '#F0C98B' : '#AABBE8'} /></svg>
      <p style={{ fontSize: '1.1rem' }} aria-live="polite">{line}</p>
      {st.mine && <p className="meta">{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')} here</p>}
      <div className="row" style={{ justifyContent: 'center' }}>{st.mine ? <button className="btn" disabled={busy} onClick={() => void act(api.quietLeave, false)}>Leave the room</button> : <button className="btn p" disabled={busy} onClick={() => void act(api.quietJoin, true)}>Join the quiet room</button>}
        <button className="btn g" disabled={busy} onClick={refresh}>Check again</button></div></section>}
  </>)
}
