import { useEffect } from 'react'
import { useStill } from './store'
import { MOODS } from './data'
import Nav from './components/Nav'
import Dialogs from './components/Dialogs'
import ErrorBoundary from './components/ErrorBoundary'
import Home from './pages/Home'
import Discover from './pages/Discover'
import Community from './pages/Community'
import PostDetail from './pages/PostDetail'
import Explore from './pages/Explore'
import MySpace from './pages/MySpace'
import Moderation from './pages/Moderation'
import Quiet from './pages/Quiet'
import Notes from './pages/Notes'
import Tiny from './pages/Tiny'
export default function App() {
  const s = useStill(); const m = s.d.mood ? MOODS[s.d.mood] : null
  useEffect(() => { document.documentElement.style.setProperty('--ac', m?.sun ? '#F0C98B' : m?.lav ? '#A897D5' : '#AABBE8') }, [m])
  useEffect(() => { document.body.classList.toggle('low', s.d.low) }, [s.d.low])
  const page = { home: <Home />, discover: <Discover />, community: <Community />, post: <PostDetail />, explore: <Explore />, space: <MySpace />, mod: <Moderation />, quiet: <Quiet />, notes: <Notes />, tiny: <Tiny /> }[s.v]
  return (<>
    <Nav /><main id="app">
      <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span>{s.mode === 'demo' ? 'Local demo mode · sample content · data stays on this device' : `Signed in as ${s.user}`}</span>
        <button className="btn g" style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={s.logout}>{s.mode === 'demo' ? 'Leave demo' : 'Sign out'}</button></div>
      {s.loading ? <div className="card" aria-busy="true"><p className="meta">Loading your space…</p></div>
        : s.loadError ? <div className="card text-center"><h3>We couldn't load your data</h3><p className="meta">{s.loadError}</p><button className="btn p" onClick={s.retry}>Try again</button></div>
        : <ErrorBoundary key={s.v}>{page}</ErrorBoundary>}
    </main><Dialogs />
    {s.msg && <div className="toast" role="status">{s.msg}</div>}
  </>)
}
