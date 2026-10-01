import { useStill } from '../store'
import { MOOD_LIST, THOUGHTS } from '../data'
import { rank } from '../lib'
import Scene from '../components/Scene'
import { PostCard } from '../components/Cards'
function HomeCards() {
  const s = useStill(); const m = s.d.mood; const low = m === 'Numb' || m === 'Overwhelmed' || s.d.low
  const pool = s.activities.filter(a => !(s.d.pref === 'alone' && a.soc === 'Social') && (!low || a.en === 'Low'))
  const a = pool.length ? pool[(new Date().getDate() + (m ? m.length : 0)) % pool.length] : undefined
  const ps = rank(s.visible, m); const p = s.d.pref === 'alone' && m !== 'Lonely' ? (ps.find(x => x.cat !== 'Just wanting company') ?? ps[0]) : ps[0]
  const lp = s.visible.find(x => x.id === s.d.last)
  return (<>
    {a && <section className="card"><div className="lbl">Today's small moment · optional</div><h3>{a.title}</h3><div className="meta">{a.dur} · {a.en} energy · {a.soc}</div>
      <div className="row"><button className="btn p" onClick={() => s.setDlg({ k: 'try', id: a.id })}>Try this</button><button className="btn g" onClick={() => s.go('explore')}>See more</button></div></section>}
    <div className="hi">
      {p && <><div className="lbl" style={{ marginTop: 22 }}>Something that resonates</div><PostCard p={p} /></>}
      <section className="card"><div className="lbl">A thought for today</div><h3 className="italic">{THOUGHTS[m ?? '_']}</h3></section>
      <section className="card"><div className="lbl">Continue where you left off</div>
        {lp ? <><p style={{ margin: 0 }}>{lp.body.slice(0, 90)}…</p><div className="row"><button className="btn" onClick={() => s.openPost(lp.id)}>Open conversation</button></div></>
          : <p className="meta" style={{ margin: 0 }}>Nothing yet. Conversations you open will wait for you here.</p>}</section>
    </div></>)
}
export default function Home() {
  const s = useStill()
  return (<>
    <div className="top"><span className="wm">still.</span><button className="btn" onClick={() => s.setDlg({ k: 'crisis' })}>Need support now?</button></div>
    <h1 style={{ margin: '26px 0 8px' }}>You're here.<br />That's enough.</h1>
    <p className="meta" style={{ fontSize: '1.05rem', margin: '0 0 18px' }}>Whatever today feels like, you don't have to figure it all out right now.</p>
    <Scene mood={s.d.mood} phase={s.phase} onTap={s.cyclePhase} />
    <p className="meta text-center" style={{ margin: 6 }}>Tap the sky to change the moon. It's just for looking at.</p>
    <h2 style={{ marginTop: 26 }}>What's it like inside your head today?</h2>
    <div className="chips" role="group" aria-label="Feelings">{MOOD_LIST.map(k => <button key={k} className="chip" aria-pressed={s.d.mood === k} onClick={() => s.setMood(k)}>{k}</button>)}</div>
    <HomeCards />
    <div className="hi"><div className="lbl" style={{ marginTop: 22 }}>More ways to be here</div>
      {([['quiet', 'The Quiet Room', 'Sit in silence alongside whoever else happens to be here.'], ['notes', 'Notes from strangers', 'Read a short, moderated note, or leave one.'], ['tiny', 'Tiny Returns', 'Small, energy-aware things to do away from the screen.']] as const).map(([k, t, d]) =>
        <button key={k} className="card" style={{ display: 'block', width: '100%', textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }} onClick={() => s.go(k)}><h3>{t}</h3><p className="meta" style={{ margin: 0 }}>{d}</p></button>)}</div></>)
}
