import type { Mood, Pref } from './types'
export interface ApiUser { id: number; role?: 'user' | 'moderator'; pseudonym: string; low_energy: boolean; prefs: { company?: Pref; theme?: string; notifications?: boolean } }
export interface ApiPost { id: number; category: string; body: string; author: string; created_at: string; replies: number; me_too: boolean; saved: boolean; mine: boolean }
export interface ApiReply { id: number; author: string; body: string; created_at: string; mine: boolean }
export interface ApiPostDetail extends ApiPost { reply_list: ApiReply[] }
export interface ApiCheckIn { id: number; emotion: Mood; note: string | null; created_at: string }
export interface ApiJournal { id: number; body: string; created_at: string; updated_at: string }
export interface ApiCompletion { id: number; activity_id: number; reflection: string | null; created_at: string }
export interface ApiSaved { item_type: 'post' | 'activity'; item_id: number }
export interface ApiActivity { id: number; title: string; description: string; duration_minutes: number; energy_level: string; social_type: string; category: string }

export interface ApiModReport { id: number; target_type: 'post' | 'reply' | 'note'; target_id: number; reason: string; details: string | null; status: string; created_at: string; reviewed_at: string | null; reviewed_by: string | null; target: { author: string | null; category: string | null; body: string | null; content_status: string } }
export interface ApiLogEntry { id: number; moderator: string; action: string; report_id: number | null; target_type: string | null; target_id: number | null; note: string | null; created_at: string }
export interface ApiQuiet { present: number; mine: boolean; window_seconds: number }
export interface ApiNoteMine { id: number; body: string; status: 'pending' | 'approved' | 'rejected' | 'removed'; created_at: string }
export interface ApiNoteRead { id: number; body: string }
export interface ApiModNote { id: number; body: string; created_at: string }
/** status 0 = network failure; `fields` holds per-field messages from 422 responses. Never contains request bodies. */
export class ApiError extends Error { constructor(public status: number, public detail: string, public fields: Record<string, string> = {}) { super(detail) } }
const BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (f: (() => void) | null) => { onUnauthorized = f }

async function req<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  let res: Response
  try { res = await fetch(`${BASE}/api${path}`, { method, credentials: 'include', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined }) }
  catch { throw new ApiError(0, "Can't reach the server. Nothing was saved.") }
  if (res.status === 204) return undefined as T
  const j = await res.json().catch(() => null)
  if (!res.ok) {
    const d = j?.detail; const fields: Record<string, string> = {}; let msg = typeof d === 'string' ? d : 'Something went wrong.'
    if (Array.isArray(d)) { msg = 'Please check what you entered.'; for (const e of d) fields[String(e.loc?.[e.loc.length - 1])] = String(e.msg) }
    if (res.status === 401 && auth) onUnauthorized?.()  // session expired: handled centrally
    throw new ApiError(res.status, msg, fields)
  }
  return j as T
}
export const api = {
  me: () => req<ApiUser>('GET', '/me', undefined, false),
  register: (pseudonym: string, email: string, password: string) => req<ApiUser>('POST', '/auth/register', { pseudonym, email, password }, false),
  login: (email: string, password: string) => req<ApiUser>('POST', '/auth/login', { email, password }, false),
  logout: () => req<void>('POST', '/auth/logout'),
  prefs: (p: { low_energy?: boolean; company?: Pref }) => req<ApiUser>('PATCH', '/me/preferences', p),
  checkins: () => req<ApiCheckIn[]>('GET', '/checkins'),
  addCheckIn: (emotion: Mood) => req<ApiCheckIn>('POST', '/checkins', { emotion }),
  delCheckIn: (id: number) => req<void>('DELETE', `/checkins/${id}`),
  journal: () => req<ApiJournal[]>('GET', '/journal'),
  addJournal: (body: string) => req<ApiJournal>('POST', '/journal', { body }),
  updJournal: (id: number, body: string) => req<ApiJournal>('PATCH', `/journal/${id}`, { body }),
  delJournal: (id: number) => req<void>('DELETE', `/journal/${id}`),
  posts: (page = 1) => req<{ items: ApiPost[]; has_more: boolean }>('GET', `/posts?per=20&page=${page}`),
  savedPosts: (page = 1) => req<{ items: ApiPost[]; has_more: boolean }>('GET', `/saved/posts?per=20&page=${page}`),
  post: (id: number) => req<ApiPostDetail>('GET', `/posts/${id}`),
  addPost: (category: string, body: string) => req<ApiPost>('POST', '/posts', { category, body }),
  delPost: (id: number) => req<void>('DELETE', `/posts/${id}`),
  addReply: (id: number, body: string) => req<ApiReply>('POST', `/posts/${id}/replies`, { body }),
  delReply: (id: number) => req<void>('DELETE', `/replies/${id}`),
  meToo: (id: number, on: boolean) => req<void>(on ? 'PUT' : 'DELETE', `/posts/${id}/me-too`),
  saved: () => req<ApiSaved[]>('GET', '/saved'),
  save: (t: 'post' | 'activity', id: number, on: boolean) => req<void>(on ? 'PUT' : 'DELETE', `/saved/${t}/${id}`),
  report: (t: 'post' | 'reply' | 'note', id: number, reason: 'harassment' | 'spam' | 'harmful' | 'impersonation' | 'other', details?: string | null) => req<{ status: string }>('POST', '/reports', { target_type: t, target_id: id, reason, details: details || null }),
  blocks: () => req<string[]>('GET', '/blocks'),
  block: (u: string, on: boolean) => req<void>(on ? 'PUT' : 'DELETE', `/blocks/${encodeURIComponent(u)}`),
  activities: () => req<ApiActivity[]>('GET', '/activities'),
  complete: (id: number, reflection: string | null) => req<{ id: number }>('POST', `/activities/${id}/complete`, { reflection }),
  completions: () => req<ApiCompletion[]>('GET', '/completions'),
  export: () => req<unknown>('GET', '/me/export'),
  modReports: (status: 'open' | 'all') => req<{ items: ApiModReport[]; has_more: boolean }>('GET', `/mod/reports?status=${status}`),
  modReview: (id: number, action: 'reviewed' | 'dismiss' | 'remove_content', note: string | null) => req<ApiModReport>('POST', `/mod/reports/${id}/review`, { action, note }),
  quiet: () => req<ApiQuiet>('GET', '/quiet'), quietJoin: () => req<ApiQuiet>('POST', '/quiet/join'), quietBeat: () => req<ApiQuiet>('POST', '/quiet/heartbeat'), quietLeave: () => req<ApiQuiet>('POST', '/quiet/leave'),
  notesNext: () => req<ApiNoteRead | null>('GET', '/notes/next'), notesMine: () => req<ApiNoteMine[]>('GET', '/notes/mine'), addNote: (body: string) => req<ApiNoteMine>('POST', '/notes', { body }), delNote: (id: number) => req<void>('DELETE', `/notes/${id}`),
  modNotes: () => req<ApiModNote[]>('GET', '/mod/notes'), modNoteReview: (id: number, action: 'approve' | 'reject', note: string | null) => req<{ status: string }>('POST', `/mod/notes/${id}/review`, { action, note }),
  modLog: () => req<ApiLogEntry[]>('GET', '/mod/log'),
  deleteMe: (password: string) => req<void>('DELETE', '/me', { password }),
}
