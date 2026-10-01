import { useState } from 'react'
import { useStill } from '../store'
import { CATS, ME } from '../data'
import { Empty, PostCard } from '../components/Cards'
export default function Community() {
  const s = useStill(); const [b, setB] = useState(''); const [c, setC] = useState(CATS[0]); const [n, setN] = useState(ME)
  const l = [...s.visible].sort((x, y) => y.t - x.t)
  return (<><h1>Community</h1>
    <section className="card"><h2 style={{ fontSize: '1.4rem' }}>What's something you've been carrying around in your head?</h2>
      <p className="meta" style={{ margin: '0 0 10px' }}>You don't have to make sense. Just start somewhere.</p>
      <label className="meta" htmlFor="pb">Post</label><textarea id="pb" maxLength={600} value={b} onChange={e => setB(e.target.value)} />
      <div className="row"><select aria-label="Topic" value={c} onChange={e => setC(e.target.value)} className="flex-1" style={{ minWidth: 180 }}>{CATS.map(x => <option key={x}>{x}</option>)}</select>
        <input aria-label="Pseudonym" maxLength={24} value={s.user ?? n} disabled={!!s.user} onChange={e => setN(e.target.value)} className="flex-1" style={{ minWidth: 140 }} />
        <button className="btn p" disabled={s.busy} onClick={() => { void Promise.resolve(s.addPost(c, b, n)).then(ok => { if (ok) setB('') }) }}>Post</button></div>
      <p className="meta" style={{ margin: '8px 0 0' }}>A pseudonym isn't a guarantee of anonymity. Avoid sharing identifying details.</p></section>
    <div className="lbl" style={{ marginTop: 22 }}>Small group spaces · slow, asynchronous (labels only in this demo)</div>
    <div className="chips">{['Night owls', 'Music & memories', 'New in town', 'Quiet creatives'].map(g => <span key={g} className="chip">{g}</span>)}</div>
    <h2 style={{ marginTop: 18 }}>Recent conversations</h2>
    {l.map(p => <PostCard key={p.id} p={p} />)}{!l.length && <Empty t="Quiet in here" b="Be the first to say something." />}</>)
}
