import type { Activity, Post } from '../types'
import { useStill } from '../store'
import { ago } from '../lib'
export const Empty = ({ t, b }: { t: string; b: string }) => <div className="card text-center"><h3>{t}</h3><p className="meta">{b}</p></div>
export function PostCard({ p, detail }: { p: Post; detail?: boolean }) {
  const s = useStill(); const n = s.replyCount(p)
  const mine = s.d.posts.some(x => x.id === p.id); const sv = s.d.sp.includes(p.id)
  return (
    <article className="card"><div className="lbl">{p.cat}</div>
      <p style={{ margin: '.2rem 0', fontSize: '1.05rem' }}>{p.body}</p>
      <div className="meta">{p.au} · {ago(p.t)}{p.sample ? ' · sample post' : ''}</div>
      <div className="row">
        <button className="chip" aria-pressed={s.d.mt.includes(p.id)} onClick={() => s.toggle('mt', p.id)}>Me too</button>
        {!detail && <button className="btn g" onClick={() => s.openPost(p.id)}>{n} {n === 1 ? 'reply' : 'replies'}</button>}
        <button className="btn g" onClick={() => s.toggle('sp', p.id)}>{sv ? 'Saved' : 'Save'}</button>
        {mine ? <button className="btn g" onClick={() => s.delPost(p.id)}>Delete</button>
          : <><button className="btn g" onClick={() => s.report('p' + p.id, 'post')}>Report</button><button className="btn g" onClick={() => s.block(p.au)}>Block</button></>}
      </div></article>)
}
export function ActCard({ a }: { a: Activity }) {
  const s = useStill(); const dn = s.d.done.some(d => d.id === a.id)
  return (
    <article className="card"><h3>{a.title}</h3><div className="meta">{a.dur} · {a.en} energy · {a.soc} · {a.cat}</div>
      <div className="row"><button className="btn p" onClick={() => s.setDlg({ k: 'try', id: a.id })}>{dn ? 'Try again' : 'Try this'}</button>
        <button className="btn g" onClick={() => s.toggle('sa', a.id)}>{s.d.sa.includes(a.id) ? 'Saved' : 'Save for later'}</button></div></article>)
}
