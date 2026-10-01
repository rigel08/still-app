import { useState, type FormEvent } from 'react'
import { api, ApiError, type ApiUser } from './api'
import Scene from './components/Scene'
export default function Welcome({ note, onAuthed, onDemo }: { note?: string; onAuthed: (u: ApiUser) => void; onDemo: () => void }) {
  const [reg, setReg] = useState(false); const [f, setF] = useState({ email: '', pseudonym: '', password: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState<ApiError | null>(null); const [ph, setPh] = useState(0)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setErr(null)
    try { onAuthed(reg ? await api.register(f.pseudonym, f.email, f.password) : await api.login(f.email, f.password)) } catch (x) { setErr(x instanceof ApiError ? x : new ApiError(0, 'Something went wrong.')) } finally { setBusy(false) }
  }
  const fld = (id: 'email' | 'pseudonym' | 'password', label: string, type = 'text') => (
    <div style={{ marginTop: 10 }}><label className="meta" htmlFor={id}>{label}</label>
      <input id={id} type={type} required value={f[id]} aria-invalid={!!err?.fields[id]} autoComplete={id === 'password' ? (reg ? 'new-password' : 'current-password') : id === 'email' ? 'email' : 'username'} minLength={id === 'password' && reg ? 10 : undefined} onChange={e => setF({ ...f, [id]: e.target.value })} />
      {err?.fields[id] && <p className="meta" role="alert" style={{ color: 'var(--dusk)', margin: '4px 0 0' }}>{err.fields[id]}</p>}</div>)
  return (
    <main id="app" style={{ marginLeft: 'auto' }}>
      <span className="wm">still.</span><h1 style={{ margin: '18px 0 8px' }}>You don't have to pretend here.</h1>
      <p className="meta" style={{ margin: '0 0 16px' }}>Sign in to keep your check-ins, journal and conversations. A pseudonym isn't a guarantee of anonymity.</p>
      <Scene mood={null} phase={ph} onTap={() => setPh((ph + 1) % 3)} />
      {note && <p className="meta" role="status" style={{ marginTop: 14 }}>{note}</p>}
      <form className="card" onSubmit={submit} aria-label={reg ? 'Create account' : 'Sign in'}>
        <div className="chips" role="group" aria-label="Account"><button type="button" className="chip" aria-pressed={!reg} onClick={() => { setReg(false); setErr(null) }}>I have an account</button><button type="button" className="chip" aria-pressed={reg} onClick={() => { setReg(true); setErr(null) }}>I'm new here</button></div>
        {fld('email', 'Email', 'email')}{reg && fld('pseudonym', 'Pseudonym (letters, numbers, underscore)')}{fld('password', reg ? 'Password (10+ characters)' : 'Password', 'password')}
        {err && <p role="alert" style={{ color: 'var(--dusk)' }}>{err.detail}</p>}
        <div className="row"><button className="btn p" type="submit" disabled={busy}>{busy ? 'One moment…' : reg ? 'Create account' : 'Sign in'}</button></div></form>
      <div className="card"><p className="meta" style={{ margin: 0 }}>Just looking? Local demo mode uses sample content, stays on this device, and isn't connected to any account.</p><div className="row"><button className="btn" onClick={onDemo}>Try local demo mode</button></div></div>
    </main>)
}
