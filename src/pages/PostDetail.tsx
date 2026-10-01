import { useState } from 'react'
import { useStill } from '../store'
import { ago } from '../lib'
import { Empty, PostCard } from '../components/Cards'
export default function PostDetail() {
  const s = useStill(); const [b, setB] = useState(''); const p = s.visible.find(x => x.id === s.open)
  const back = <button className="btn g" onClick={() => s.go('community')}>← Back</button>
  if (!p) return <>{back}<Empty t="That post isn't available" b="It may have been deleted, reported, or hidden by a block." /></>
  const rs = s.repliesFor(p.id)
  return (<>{back}<PostCard p={p} detail /><h2>Replies</h2>
    {s.detailStatus === 'loading' ? <div className="card" aria-busy="true"><p className="meta" role="status">Loading replies…</p></div> : s.detailStatus === 'error' ? <div className="card text-center"><h3>Couldn't load replies</h3><p className="meta">{s.detailError}</p><button className="btn p" onClick={s.retryDetail}>Try again</button></div> : <>{rs.map(r => (<div key={r.id} className="card"><p style={{ margin: 0 }}>{r.body}</p><div className="meta">{r.au} · {ago(r.t)}{r.sample ? ' · sample reply' : ''}</div>
      <div className="row">{(r.mine || s.d.replies.some(x => x.id === r.id)) ? <button className="btn g" onClick={() => s.delReply(r.id)}>Delete</button>
        : <><button className="btn g" onClick={() => s.report('r' + r.id, 'reply')}>Report</button><button className="btn g" onClick={() => s.block(r.au)}>Block</button></>}</div></div>))}
    {!rs.length && <Empty t="No replies yet" b="A kind word is enough." />}</>}
    <textarea aria-label="Your reply" maxLength={500} placeholder="Reply gently…" value={b} onChange={e => setB(e.target.value)} />
    <div className="row"><button className="btn p" disabled={s.busy} onClick={() => { void Promise.resolve(s.addReply(p.id, b)).then(ok => { if (ok) setB('') }) }}>Reply</button></div></>)
}
