import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, Mood, Pref, Post, UserData, View } from './types'
import { useDialog, useToast, type Dlg } from './hooks'
import { ACTIVITIES, DEMO_POSTS, DEMO_REPLIES, ME } from './data'
import { buzz } from './lib'
export const KEY = 'still-user-data'
export type { Dlg }
export const blank: UserData = { posts: [], replies: [], sp: [], sa: [], mt: [], ci: [], jr: [], blk: [], rep: [], done: [], last: null, mood: null, pref: 'either', low: false, nid: 100 }
const load = (): UserData => { try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return blank } }
function flip<T>(a: T[], v: T) { return a.includes(v) ? a.filter(x => x !== v) : [...a, v] }

function useBuild(onLeave: () => void = () => {}) {
  const [d, setD] = useState<UserData>(load)
  const [v, setV] = useState<View>('home'); const [open, setOpen] = useState<number | null>(null)
  const [msg, toast] = useToast(); const [phase, setPhase] = useState(0); const [dlg, setDlg] = useDialog()
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage unavailable: session-only */ } }, [d])
  const up = (f: (p: UserData) => Partial<UserData>) => setD(p => ({ ...p, ...f(p) }))
  const posts = useMemo(() => [...DEMO_POSTS, ...d.posts], [d.posts])
  const replies = useMemo(() => [...DEMO_REPLIES, ...d.replies], [d.replies])
  const visible = useMemo(() => posts.filter(p => !d.blk.includes(p.au) && !d.rep.includes('p' + p.id)), [posts, d.blk, d.rep])
  return {
    d, posts, replies, visible, v, open, msg, phase, dlg, setDlg, toast,
    activities: ACTIVITIES as Activity[], hasMore: false, loadMore: () => {}, savedPosts: visible.filter(p => d.sp.includes(p.id)), savedMore: false, loadMoreSaved: () => {}, detailStatus: 'ok' as 'ok' | 'loading' | 'error', detailError: null as string | null, retryDetail: () => {},
    isModerator: false,
    mode: 'demo' as 'demo' | 'account', user: null as string | null, busy: false, loading: false, loadError: null as string | null, retry: () => {}, exportJson: null as string | null,
    logout: () => onLeave(), deleteAccount: async (_pw: string) => false, openExport: () => setDlg({ k: 'data' }), replyCount: (p: Post) => replies.filter(r => r.pid === p.id && !d.blk.includes(r.au) && !d.rep.includes('r' + r.id)).length,
    repliesFor: (pid: number) => replies.filter(r => r.pid === pid && !d.blk.includes(r.au) && !d.rep.includes('r' + r.id)),
    go: (x: View) => { buzz(); setV(x); setOpen(null); window.scrollTo(0, 0) },
    openPost: (id: number) => { buzz(); up(() => ({ last: id })); setOpen(id); setV('post'); window.scrollTo(0, 0) },
    cyclePhase: () => { const nx = (phase + 1) % 3; setPhase(nx); toast('Moon: ' + ['crescent', 'half', 'full'][nx]) },
    setMood: (m: Mood) => { buzz(); const sel = d.mood !== m; up(p => p.mood === m ? { mood: null } : { mood: m, ci: [...p.ci, { id: p.nid, e: m, t: Date.now() }], nid: p.nid + 1 }); if (sel) toast('Noted, just for you.') },
    toggle: (k: 'mt' | 'sp' | 'sa', id: number) => { buzz(); const on = !d[k].includes(id); up(p => ({ ...p, [k]: flip(p[k], id) })); if (k === 'sp') toast(on ? 'Saved privately' : 'Removed from saved'); if (k === 'sa') toast(on ? 'Saved for later' : 'Removed') },
    report: (key: string, what: string) => setDlg({ k: 'report', key, what }),
    submitReport: (_reason: string, _details: string) => { if (dlg?.k !== 'report') return false; const key = dlg.key; up(p => ({ rep: [...p.rep, key] })); setDlg(null); toast("Reported. Thank you. It's hidden for you."); return true },
    updJournal: (id: number, b: string) => { const t = b.trim(); if (!t) { toast('Write a few words first'); return false } up(p => ({ jr: p.jr.map(j => j.id === id ? { ...j, b: t } : j) })); toast('Saved.'); return true },
    block: (u: string) => { if (window.confirm(`Block ${u}? You won't see their posts or replies.`)) { up(p => ({ blk: [...p.blk, u] })); toast('Blocked') } },
    unblock: (u: string) => up(p => ({ blk: p.blk.filter(x => x !== u) })),
    addPost: (cat: string, body: string, au: string) => { const t = body.trim(); if (t.length < 3) { toast('Write a few words first'); return false }
      up(p => ({ posts: [...p.posts, { id: p.nid, cat, body: t, au: (au.trim() || ME).slice(0, 24), t: Date.now() }], nid: p.nid + 1 })); toast('Posted'); return true },
    delPost: (id: number) => { if (window.confirm('Delete this post?')) { up(p => ({ posts: p.posts.filter(x => x.id !== id), replies: p.replies.filter(r => r.pid !== id) })); setV('community'); toast('Deleted') } },
    addReply: (pid: number, body: string) => { const t = body.trim(); if (!t) { toast('Write a few words first'); return false }
      up(p => ({ replies: [...p.replies, { id: p.nid, pid, au: ME, body: t, t: Date.now() }], nid: p.nid + 1 })); toast('Reply sent'); return true },
    delReply: (id: number) => { up(p => ({ replies: p.replies.filter(r => r.id !== id) })); toast('Deleted') },
    addJournal: (b: string) => { const t = b.trim(); if (!t) return false; up(p => ({ jr: [...p.jr, { id: p.nid, b: t, t: Date.now() }], nid: p.nid + 1 })); toast('Saved. Only you can see it.'); return true },
    delJournal: (id: number) => up(p => ({ jr: p.jr.filter(j => j.id !== id) })),
    delCheckIn: (id: number) => up(p => ({ ci: p.ci.filter(c => c.id !== id) })),
    complete: (id: number, r: string) => { up(p => ({ done: [...p.done, { id, r: r.trim(), t: Date.now() }] })); setDlg(null); toast("You made room for a moment. That's enough.") },
    setPref: (pref: Pref) => { up(() => ({ pref })); toast('Preference updated') },
    toggleLow: () => up(p => ({ low: !p.low })),
    wipe: () => { if (window.confirm("Delete all your data on this device? This can't be undone.")) { setD(blank); toast('All local data deleted') } },
  }
}
export type Ctx = Omit<ReturnType<typeof useBuild>, 'addPost' | 'addReply' | 'addJournal' | 'updJournal' | 'submitReport'> & { addPost: (cat: string, body: string, au: string) => boolean | Promise<boolean>; addReply: (pid: number, body: string) => boolean | Promise<boolean>; addJournal: (b: string) => boolean | Promise<boolean>; updJournal: (id: number, b: string) => boolean | Promise<boolean>; submitReport: (reason: string, details: string) => boolean | Promise<boolean> }
export const C = createContext<Ctx | null>(null)
export function StillProvider({ children, onLeave }: { children: ReactNode; onLeave?: () => void }) { const v = useBuild(onLeave); return <C.Provider value={v}>{children}</C.Provider> }
export function useStill() { const c = useContext(C); if (!c) throw new Error('StillProvider missing'); return c }
