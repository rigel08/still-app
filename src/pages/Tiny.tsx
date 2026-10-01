import { useState } from 'react'
import { useStill } from '../store'
import { ActCard, Empty } from '../components/Cards'
const T: [string, number][] = [['Any time', 999], ['Up to 5 min', 5], ['Up to 10 min', 10], ['Up to 30 min', 30]]
const mins = (d: string) => parseInt(d, 10) || 0
export default function Tiny() {
  const s = useStill(); const [en, setEn] = useState<'Low' | 'Medium' | null>(null); const [t, setT] = useState(999); const [soc, setSoc] = useState<'Solo' | 'Social' | null>(null)
  const list = s.activities.filter(a => (!en || a.en === en) && mins(a.dur) <= t && (!soc || a.soc === soc) && !(s.d.pref === 'alone' && a.soc === 'Social' && !soc))
  const recent = [...s.d.done].reverse().slice(0, 5)
  return (<><h1>Tiny Returns</h1><p className="meta">Small things to do away from the screen. Tell us how much energy you have, and only things that fit are shown. Skipping is always fine; nothing here counts or keeps score.</p>
    <div className="chips" role="group" aria-label="Energy"><button className="chip" aria-pressed={!en} onClick={() => setEn(null)}>Any energy</button><button className="chip" aria-pressed={en === 'Low'} onClick={() => setEn('Low')}>Low energy</button><button className="chip" aria-pressed={en === 'Medium'} onClick={() => setEn('Medium')}>Some energy</button></div>
    <div className="chips" role="group" aria-label="Time">{T.map(([l, v]) => <button key={l} className="chip" aria-pressed={t === v} onClick={() => setT(v)}>{l}</button>)}</div>
    <div className="chips" role="group" aria-label="Company"><button className="chip" aria-pressed={!soc} onClick={() => setSoc(null)}>Alone or with others</button><button className="chip" aria-pressed={soc === 'Solo'} onClick={() => setSoc('Solo')}>On my own</button><button className="chip" aria-pressed={soc === 'Social'} onClick={() => setSoc('Social')}>With someone</button></div>
    {list.map(a => <ActCard key={a.id} a={a} />)}
    {!list.length && <Empty t={s.activities.length ? 'Nothing matches right now' : 'No activities yet'} b={s.activities.length ? 'Try a different amount of energy or time.' : 'The activity catalogue is empty.'} />}
    {recent.length > 0 && <><h2 style={{ marginTop: 22 }}>Recent returns</h2><p className="meta">Private to you.</p>{recent.map((d, i) => <div key={d.t + '-' + i} className="card"><h3>{s.activities.find(a => a.id === d.id)?.title ?? 'An activity'}</h3><div className="meta">{new Date(d.t).toLocaleDateString()}{d.r ? ` · "${d.r}"` : ''}</div></div>)}</>}
  </>)
}
