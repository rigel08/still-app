import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, type ApiPost, type ApiUser } from './api'
import { buzz } from './lib'
import { useDialog, useToast, type Dlg } from './hooks'
import { blank, C, type Ctx } from './store'
import type { Activity, Mood, Post, Pref, Reply, UserData, View } from './types'

const toPost = (p: ApiPost): Post => ({ id: p.id, cat: p.category, body: p.body, au: p.author, t: Date.parse(p.created_at), replies: p.replies })
/** Server-backed state. Nothing here touches localStorage; every change is applied only after the API confirms it. */
function useServer(user: ApiUser, onLeave: (note?: string) => void): Ctx {
  const [d, setD] = useState<UserData>({ ...blank, pref: user.prefs.company ?? 'either', low: user.low_energy })
  const [posts, setPosts] = useState<Post[]>([]); const [rep, setRep] = useState<Record<number, Reply[]>>({})
  const [v, setV] = useState<View>('home'); const [open, setOpen] = useState<number | null>(null); const [phase, setPhase] = useState(0)
  const [msg, toast] = useToast(); const [dlg, rawDlg] = useDialog(); const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState<string | null>(null); const [exportJson, setExport] = useState<string | null>(null)
  const lock = useRef(false); const pageRef = useRef(1); const savedPage = useRef(1)
  const [activities, setActivities] = useState<Activity[]>([]); const [hasMore, setHasMore] = useState(false); const [savedPosts, setSavedPosts] = useState<Post[]>([]); const [savedMore, setSavedMore] = useState(false)
  const [ds, setDs] = useState<'ok' | 'loading' | 'error'>('ok'); const [de, setDe] = useState<string | null>(null)
  const setDlg = (x: Dlg) => { if (!x) setExport(null); rawDlg(x) }
  const fail = (e: unknown) => {
    if (!(e instanceof ApiError)) return toast('Something went wrong. Nothing was saved.')
    if (e.status === 401) return  // handled centrally (session expiry)
    toast(e.status === 422 ? Object.values(e.fields)[0] ?? e.detail : e.status === 429 ? 'Too many requests. Please wait a moment and try again.' : e.detail)
  }
  /** One request at a time: prevents duplicate submissions. Resolves true only if the server confirmed. */
  const run = async (f: () => Promise<unknown>, ok?: string) => {
    if (lock.current) return false
    lock.current = true; setBusy(true)
    try { await f(); if (ok) toast(ok); return true } catch (e) { fail(e); return false } finally { lock.current = false; setBusy(false) }
  }
  const applyPosts = (items: ApiPost[], append: boolean) => {
    const ps = items.map(toPost); setPosts(p => append ? [...p, ...ps] : ps)
    setD(x => ({ ...x, posts: [...(append ? x.posts : []), ...items.filter(p => p.mine).map(toPost)], mt: [...(append ? x.mt : []), ...items.filter(p => p.me_too).map(p => p.id)] }))
  }
  const loadPosts = async () => { const pg = await api.posts(1); applyPosts(pg.items, false); setHasMore(pg.has_more); pageRef.current = 1 }
  const loadSaved = async () => { const pg = await api.savedPosts(1); setSavedPosts(pg.items.map(toPost)); setSavedMore(pg.has_more); savedPage.current = 1 }
  const loadActs = async () => { setActivities((await api.activities()).map(a => ({ id: a.id, title: a.title, cat: a.category, dur: `${a.duration_minutes} min`, en: a.energy_level as Activity['en'], soc: a.social_type as Activity['soc'] }))) }
  const fetchDetail = async (id: number) => {
    setDs('loading'); setDe(null)
    try { await loadDetail(id); setDs('ok') } catch (e) { if (e instanceof ApiError && e.status === 401) return; setDs('error'); setDe(e instanceof ApiError ? e.detail : 'Could not load replies.') }
  }
  const loadRest = async () => {
    const [ci, jr, sv, bl, dn] = await Promise.all([api.checkins(), api.journal(), api.saved(), api.blocks(), api.completions()])
    setD(x => ({ ...x, ci: ci.map(c => ({ id: c.id, e: c.emotion, t: Date.parse(c.created_at) })).reverse(), jr: jr.map(j => ({ id: j.id, b: j.body, t: Date.parse(j.created_at) })).reverse(),
      sp: sv.filter(s => s.item_type === 'post').map(s => s.item_id), sa: sv.filter(s => s.item_type === 'activity').map(s => s.item_id), blk: bl, done: dn.map(c => ({ id: c.activity_id, r: c.reflection ?? '', t: Date.parse(c.created_at) })) }))
  }
  const loadDetail = async (id: number) => { const p = await api.post(id); setRep(r => ({ ...r, [id]: p.reply_list.map(x => ({ id: x.id, pid: id, au: x.author, body: x.body, t: Date.parse(x.created_at), mine: x.mine })) })) }
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try { await Promise.all([loadPosts(), loadRest(), loadSaved(), loadActs()]) } catch (e) { if (!(e instanceof ApiError && e.status === 401)) setLoadError(e instanceof ApiError ? e.detail : 'Could not load your data.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const back = () => { setV('community'); setOpen(null) }

  return {
    d, posts, replies: useMemo(() => Object.values(rep).flat(), [rep]), visible: posts, v, open, msg, phase, dlg, setDlg, toast,
    mode: 'account', user: user.pseudonym, isModerator: user.role === 'moderator', busy, loading, loadError, retry: () => { void load() }, exportJson,
    repliesFor: (pid: number) => rep[pid] ?? [], replyCount: (p: Post) => p.replies ?? rep[p.id]?.length ?? 0,
    go: (x: View) => { buzz(); setV(x); setOpen(null); window.scrollTo(0, 0) },
    openPost: (id: number) => { buzz(); setD(x => ({ ...x, last: id })); setOpen(id); setV('post'); window.scrollTo(0, 0); void fetchDetail(id) },
    cyclePhase: () => { const nx = (phase + 1) % 3; setPhase(nx); toast('Moon: ' + ['crescent', 'half', 'full'][nx]) },
    setMood: async (m: Mood) => {
      buzz(); if (d.mood === m) return setD(x => ({ ...x, mood: null }))
      await run(async () => { const c = await api.addCheckIn(m); setD(x => ({ ...x, mood: m, ci: [...x.ci, { id: c.id, e: m, t: Date.parse(c.created_at) }] })) }, 'Noted, just for you.')
    },
    toggle: async (k: 'mt' | 'sp' | 'sa', id: number) => {
      buzz(); const on = !d[k].includes(id)
      await run(async () => { if (k === 'mt') await api.meToo(id, on); else await api.save(k === 'sp' ? 'post' : 'activity', id, on); if (k === 'sp') await loadSaved(); setD(x => ({ ...x, [k]: on ? [...x[k], id] : x[k].filter(i => i !== id) })) },
        k === 'mt' ? undefined : on ? (k === 'sp' ? 'Saved privately' : 'Saved for later') : 'Removed')
    },
    report: (key: string, what: string) => setDlg({ k: 'report', key, what }),
    submitReport: async (reason: string, details: string) => {
      if (dlg?.k !== 'report') return false; const kind = dlg.key[0] === 'p' ? 'post' : dlg.key[0] === 'n' ? 'note' : 'reply'; const id = +dlg.key.slice(1)
      const ok = await run(async () => { await api.report(kind, id, reason as 'other', details || null); if (kind !== 'note') { await loadPosts(); await loadSaved() } if (kind === 'post') back(); else if (kind === 'reply' && open) await loadDetail(open) }, "Reported. Thank you. It's hidden for you.")
      if (ok) setDlg(null); return ok
    },
    updJournal: async (id: number, b: string) => { if (!b.trim()) { toast('Write a few words first'); return false } return run(async () => { const j = await api.updJournal(id, b.trim()); setD(x => ({ ...x, jr: x.jr.map(e => e.id === id ? { ...e, b: j.body } : e) })) }, 'Saved.') },
    activities, hasMore, savedPosts, savedMore, detailStatus: ds, detailError: de, retryDetail: () => { if (open) void fetchDetail(open) },
    loadMore: () => { void run(async () => { const n = pageRef.current + 1; const pg = await api.posts(n); applyPosts(pg.items, true); setHasMore(pg.has_more); pageRef.current = n }) },
    loadMoreSaved: () => { void run(async () => { const n = savedPage.current + 1; const pg = await api.savedPosts(n); setSavedPosts(x => [...x, ...pg.items.map(toPost)]); setSavedMore(pg.has_more); savedPage.current = n }) },
    block: (u: string) => {
      if (!window.confirm(`Block ${u}? You won't see their posts or replies.`)) return
      void run(async () => { await api.block(u, true); await loadPosts(); await loadSaved(); setD(x => ({ ...x, blk: [...x.blk.filter(b => b !== u), u] })); if (v === 'post') back() }, 'Blocked')
    },
    unblock: (u: string) => { void run(async () => { await api.block(u, false); await loadPosts(); await loadSaved(); setD(x => ({ ...x, blk: x.blk.filter(b => b !== u) })) }) },
    addPost: async (cat: string, body: string) => { if (body.trim().length < 3) { toast('Write a few words first'); return false } return run(async () => { await api.addPost(cat, body.trim()); await loadPosts() }, 'Posted') },
    delPost: (id: number) => { if (window.confirm('Delete this post?')) void run(async () => { await api.delPost(id); await loadPosts(); back() }, 'Deleted') },
    addReply: async (pid: number, body: string) => { if (!body.trim()) { toast('Write a few words first'); return false } return run(async () => { await api.addReply(pid, body.trim()); await loadDetail(pid); await loadPosts() }, 'Reply sent') },
    delReply: (id: number) => { void run(async () => { await api.delReply(id); if (open) await loadDetail(open) }, 'Deleted') },
    addJournal: async (b: string) => { if (!b.trim()) return false; return run(async () => { const j = await api.addJournal(b.trim()); setD(x => ({ ...x, jr: [...x.jr, { id: j.id, b: j.body, t: Date.parse(j.created_at) }] })) }, 'Saved. Only you can see it.') },
    delJournal: (id: number) => { void run(async () => { await api.delJournal(id); setD(x => ({ ...x, jr: x.jr.filter(j => j.id !== id) })) }) },
    delCheckIn: (id: number) => { void run(async () => { await api.delCheckIn(id); setD(x => ({ ...x, ci: x.ci.filter(c => c.id !== id) })) }) },
    complete: (id: number, r: string) => { void run(async () => { await api.complete(id, r.trim() || null); await loadRest(); setDlg(null) }, "You made room for a moment. That's enough.") },
    setPref: (pref: Pref) => { void run(async () => { const u = await api.prefs({ company: pref }); setD(x => ({ ...x, pref: u.prefs.company ?? pref })) }, 'Preference updated') },
    toggleLow: () => { void run(async () => { const u = await api.prefs({ low_energy: !d.low }); setD(x => ({ ...x, low: u.low_energy })) }) },
    wipe: () => setDlg({ k: 'delete' }),
    deleteAccount: async (pw: string) => { const ok = await run(() => api.deleteMe(pw)); if (ok) onLeave('Your account and its data were deleted.'); return ok },
    openExport: () => { void run(async () => { setExport(JSON.stringify(await api.export(), null, 1)); rawDlg({ k: 'data' }) }) },
    logout: () => { void run(() => api.logout()).then(ok => { if (ok) onLeave('You signed out.') }) },
  }
}
export function ServerProvider({ user, onLeave, children }: { user: ApiUser; onLeave: (note?: string) => void; children: ReactNode }) { const v = useServer(user, onLeave); return <C.Provider value={v}>{children}</C.Provider> }
