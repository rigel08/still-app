export type Mood = 'Numb' | 'Lonely' | 'Disconnected' | 'Overwhelmed' | 'Restless' | 'Okay' | 'Curious' | 'Hopeful'
export type View = 'home' | 'discover' | 'community' | 'post' | 'explore' | 'space' | 'mod' | 'quiet' | 'notes' | 'tiny'
export type Pref = 'either' | 'company' | 'alone'
export interface Post { id: number; cat: string; body: string; au: string; t: number; sample?: boolean; replies?: number }
export interface Reply { id: number; pid: number; au: string; body: string; t: number; sample?: boolean; mine?: boolean }
export interface Activity { id: number; title: string; cat: string; dur: string; en: 'Low' | 'Medium'; soc: 'Solo' | 'Social' }
export interface CheckIn { id: number; e: Mood; t: number }
export interface Journal { id: number; b: string; t: number }
export interface Done { id: number; r: string; t: number }
/** Everything the user creates. Demo content is never stored here. */
export interface UserData {
  posts: Post[]; replies: Reply[]; sp: number[]; sa: number[]; mt: number[]; ci: CheckIn[]; jr: Journal[]
  blk: string[]; rep: string[]; done: Done[]; last: number | null; mood: Mood | null; pref: Pref; low: boolean; nid: number
}
