import { useMemo, useState } from 'react'
import { MOODS } from '../data'
import type { CheckIn, Journal, Mood } from '../types'
import { Empty } from './Cards'
type Star = { key: string; t: number; kind: 'ci' | 'jr'; label: string; id: number; text?: string }
/** The user's own check-ins (filled stars) and journal entries (rings). Position is decorative: no score, no trend, no ranking. */
export default function Sky({ ci, jr }: { ci: CheckIn[]; jr: Journal[] }) {
  const [feel, setFeel] = useState<Mood | null>(null); const [showJ, setShowJ] = useState(true); const [sel, setSel] = useState<string | null>(null); const [read, setRead] = useState(false)
  const stars = useMemo<Star[]>(() => [...ci.filter(c => !feel || c.e === feel).map(c => ({ key: 'c' + c.id, t: c.t, kind: 'ci' as const, label: c.e, id: c.id })),
    ...(showJ ? jr.map(j => ({ key: 'j' + j.id, t: j.t, kind: 'jr' as const, label: 'Journal entry', id: j.id, text: j.b })) : [])].sort((a, b) => a.t - b.t).slice(-60), [ci, jr, feel, showJ])
  if (!ci.length && !jr.length) return <Empty t="Your sky is empty" b="Check-ins and journal entries you make will appear here as stars, only visible to you." />
  const step = Math.min(552 / Math.max(stars.length - 1, 1), 44); const X = (i: number) => 24 + i * step; const Y = (s: Star) => 28 + (s.id * 47) % 130
  const cur = stars.find(s => s.key === sel); const present = [...new Set(ci.map(c => c.e))]
  const pick = (k: string) => { setSel(k); setRead(false) }
  return (<>
    <div className="chips" role="group" aria-label="Filter the sky"><button className="chip" aria-pressed={!feel} onClick={() => setFeel(null)}>All feelings</button>
      {present.map(e => <button key={e} className="chip" aria-pressed={feel === e} onClick={() => setFeel(feel === e ? null : e)}>{e}</button>)}
      <button className="chip" aria-pressed={showJ} onClick={() => setShowJ(!showJ)}>Journal entries</button></div>
    <svg viewBox="0 0 600 190" role="group" aria-label="Your check-ins and journal entries as stars" style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 20 }}>
      {stars.map((s, i) => i > 0 && <line key={'l' + s.key} x1={X(i - 1)} y1={Y(stars[i - 1])} x2={X(i)} y2={Y(s)} stroke="#293145" />)}
      {stars.map((s, i) => (
        <g key={s.key} role="button" tabIndex={0} aria-pressed={sel === s.key} aria-label={`${s.label}, ${new Date(s.t).toLocaleString()}`} style={{ cursor: 'pointer', outline: 'none' }} onClick={() => pick(s.key)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(s.key) } }}>
          {sel === s.key && <circle cx={X(i)} cy={Y(s)} r={14} fill="none" stroke="var(--ac)" />}
          <circle cx={X(i)} cy={Y(s)} r={18} fill="transparent" />
          {s.kind === 'ci' ? <circle cx={X(i)} cy={Y(s)} r={6} fill={MOODS[s.label as Mood].sun ? '#F0C98B' : '#AABBE8'} /> : <circle cx={X(i)} cy={Y(s)} r={7} fill="none" stroke="#A897D5" strokeWidth={2} />}
        </g>))}
    </svg>
    <p className="meta">Filled star: a check-in. Ring: a journal entry. Position is decorative. There's no score and no "better" or "worse".</p>
    {cur && <section className="card" role="region" aria-label="Star details"><div className="lbl">{cur.kind === 'ci' ? 'Check-in' : 'Journal entry'} · {new Date(cur.t).toLocaleString()}</div>
      {cur.kind === 'ci' ? <p style={{ margin: 0 }}>You chose <b>{cur.label}</b>.</p> : read ? <><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{cur.text}</p><div className="row"><button className="btn g" onClick={() => setRead(false)}>Hide entry</button></div></>
        : <div className="row"><button className="btn" onClick={() => setRead(true)}>Read this entry</button></div>}</section>}
  </>)
}
