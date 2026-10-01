import { useCallback, useEffect, useState } from 'react'
import { api, ApiError, setUnauthorizedHandler, type ApiUser } from './api'
import App from './App'
import { StillProvider } from './store'
import { ServerProvider } from './serverStore'
import Welcome from './Welcome'
type St = { k: 'loading' } | { k: 'anon'; note?: string } | { k: 'demo' } | { k: 'down' } | { k: 'account'; user: ApiUser }
export default function Root() {
  const [st, setSt] = useState<St>({ k: 'loading' })
  const check = useCallback(() => { setSt({ k: 'loading' }); api.me().then(u => setSt({ k: 'account', user: u }), e => setSt(e instanceof ApiError && e.status === 401 ? { k: 'anon' } : { k: 'down' })) }, [])
  useEffect(() => { check() }, [check])
  useEffect(() => { setUnauthorizedHandler(() => setSt({ k: 'anon', note: 'Your session expired. Please sign in again.' })); return () => setUnauthorizedHandler(null) }, [])
  if (st.k === 'loading') return <main id="app" aria-busy="true"><div className="card"><p className="meta" role="status">Checking your session…</p></div></main>
  if (st.k === 'down') return (<main id="app"><div className="card text-center"><h3>We can't reach the still. server</h3><p className="meta">Nothing has been lost. You can try again, or choose local demo mode yourself.</p>
    <div className="row" style={{ justifyContent: 'center' }}><button className="btn p" onClick={check}>Try again</button><button className="btn" onClick={() => setSt({ k: 'demo' })}>Use local demo mode instead</button></div></div></main>)
  if (st.k === 'anon') return <Welcome note={st.note} onAuthed={u => setSt({ k: 'account', user: u })} onDemo={() => setSt({ k: 'demo' })} />
  if (st.k === 'demo') return <StillProvider onLeave={() => setSt({ k: 'anon' })}><App /></StillProvider>
  return <ServerProvider key={st.user.id} user={st.user} onLeave={note => setSt({ k: 'anon', note })}><App /></ServerProvider>
}
