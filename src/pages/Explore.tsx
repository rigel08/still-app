import { useState } from 'react'
import { ACATS } from '../data'
import { useStill } from '../store'
import { ActCard, Empty } from '../components/Cards'
export default function Explore() {
  const s = useStill(); const [f, setF] = useState<string | null>(null); const l = s.activities.filter(a => !f || a.cat === f)
  return (<><h1>Explore</h1><p className="meta">Small, optional moments. Skipping is always fine.</p>
    <div className="chips">{ACATS.map(c => <button key={c} className="chip" aria-pressed={f === c} onClick={() => setF(f === c ? null : c)}>{c}</button>)}</div>
    {l.map(a => <ActCard key={a.id} a={a} />)}{!l.length && <Empty t={s.activities.length ? 'Nothing in this group yet' : 'No activities yet'} b={s.activities.length ? 'Try another one.' : 'The activity catalogue is empty.'} />}</>)
}
