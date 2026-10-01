import { MOODS } from './data'
import type { Mood, Post } from './types'
export const ago = (t: number) => { const m = (Date.now() - t) / 6e4; return m < 60 ? `${Math.max(1, Math.floor(m))}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago` }
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** Gentle haptic tap; skipped when the user prefers reduced motion. */
export const buzz = () => { if (!reduced() && 'vibrate' in navigator) navigator.vibrate(8) }
/** Relevance order: matches the selected feeling first, then newest. Never popularity. */
export const rank = (l: Post[], m: Mood | null) => { const c = m ? MOODS[m].cat : ''; return [...l].sort((a, b) => Number(b.cat === c) - Number(a.cat === c) || b.t - a.t) }
