import { useState } from 'react'
import { useStill } from '../store'
import { CATS } from '../data'
import { rank } from '../lib'
import { Empty, PostCard } from '../components/Cards'
export default function Discover() {
  const s = useStill(); const [f, setF] = useState<string | null>(null); const [page, setPage] = useState(1)
  const l = rank(s.visible.filter(p => !f || p.cat === f), s.d.mood); const n = page * 4
  return (<><h1>Discover</h1><p className="meta">Ordered by relevance to what you picked, then newest. Never by popularity.</p>
    <div className="chips">{CATS.map(c => <button key={c} className="chip" aria-pressed={f === c} onClick={() => { setF(f === c ? null : c); setPage(1) }}>{c}</button>)}</div>
    {l.slice(0, n).map(p => <PostCard key={p.id} p={p} />)}
    {!l.length && <Empty t="Nothing here yet" b="Try another topic, or write the first post." />}
    {l.length > n ? <div className="row"><button className="btn" onClick={() => setPage(page + 1)}>Show 4 more</button></div>
      : s.hasMore ? <div className="row"><button className="btn" disabled={s.busy} onClick={s.loadMore}>Load older posts</button></div> : l.length > 0 && <p className="meta text-center" style={{ marginTop: 24 }}>That's everything for now. It's fine to close the app.</p>}</>)
}
