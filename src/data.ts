import type { Activity, Mood, Post, Reply } from './types'
export const ME = 'quietfern'
const H = 3600e3, n = Date.now()
export const CATS = ['Feeling disconnected','Feeling lonely','Feeling numb','Life feels confusing','Wanting genuine friendship','Music and memories','Finding new interests','Just wanting company']
export const ACATS = ['2-minute moments','Quiet activities','Creative experiments','Getting outside','Music and memories','Being around people','Learning something new','Low-energy activities']
export const MOODS: Record<Mood, { sun: boolean; lav: boolean; cat: string }> = {
  Numb: { sun: false, lav: false, cat: 'Feeling numb' }, Lonely: { sun: false, lav: true, cat: 'Feeling lonely' },
  Disconnected: { sun: false, lav: false, cat: 'Feeling disconnected' }, Overwhelmed: { sun: false, lav: true, cat: 'Life feels confusing' },
  Restless: { sun: true, lav: false, cat: 'Finding new interests' }, Okay: { sun: true, lav: false, cat: 'Just wanting company' },
  Curious: { sun: true, lav: false, cat: 'Finding new interests' }, Hopeful: { sun: true, lav: false, cat: 'Music and memories' } }
export const MOOD_LIST = Object.keys(MOODS) as Mood[]
export const THOUGHTS: Record<Mood | '_', string> = {
  Numb: "Numb is a feeling too. It doesn't need to be fixed today.", Lonely: 'What would company look like right now: someone nearby, or someone who just gets it?',
  Disconnected: 'Some days the world is behind glass. You can still be here.', Overwhelmed: 'What is one thing that can wait until tomorrow?',
  Restless: 'Where does the restlessness want to go, if it could go anywhere?', Okay: 'What made today feel okay? Small answers count.',
  Curious: "What is something you've wondered about lately and never looked up?", Hopeful: "What is one thing you're quietly looking forward to?",
  _: "What is something you noticed today and didn't tell anyone?" }
const P: [number, string, string, string, number][] = [
  [1,'Feeling disconnected','Does anyone else have days where nothing is particularly wrong, but nothing really feels right either?','lowtide_',3],
  [2,'Music and memories','I listened to an old song today and remembered what it felt like to be excited about something.','paperlantern',7],
  [3,'Feeling lonely',"I have people. I just don't feel known by them. Is that a weird thing to say out loud?",'nightbus44',12],
  [4,'Wanting genuine friendship','Would love a friend who is fine with long silences and bad memes.','orbit_moth',20],
  [5,'Life feels confusing','Everyone seems to have a plan. I have a to-do list and a vague feeling.','softstatic',26],
  [6,'Finding new interests','Started learning to identify birds from my window. I am terrible at it. It\'s great.','windowseat',30],
  [7,'Feeling numb','Not sad, not happy. Just very quiet inside. Anyone else?','graymoss',41],
  [8,'Just wanting company','No need to talk about anything. Just glad someone else is up.','latelamp',50]]
const R: [number, number, string, string, number][] = [
  [1,1,'moonpebble','Yes. Constantly. Glad you said it.',2],[2,1,'lowtide_',"Same here. It helps to hear it isn't just me.",1],[3,3,'orbit_moth',"Not weird. I feel that too.",5]]
/** Development fixtures, clearly flagged `sample`. Never persisted with user data. */
export const DEMO_POSTS: Post[] = P.map(([id, cat, body, au, h]) => ({ id, cat, body, au, t: n - h * H, sample: true }))
export const DEMO_REPLIES: Reply[] = R.map(([id, pid, au, body, h]) => ({ id, pid, au, body, t: n - h * H, sample: true }))
const A: [string, string, string, 'Low' | 'Medium', 'Solo' | 'Social'][] = [
  ['Listen to one song without opening another app.','Music and memories','2 min','Low','Solo'],
  ['Step outside and notice three things you usually overlook.','Getting outside','5 min','Low','Solo'],
  ['Send a message to someone you miss. No pressure to start a long conversation.','Being around people','3 min','Medium','Social'],
  ['Draw something badly on purpose.','Creative experiments','10 min','Medium','Solo'],
  ["Visit a place nearby you've never explored.",'Getting outside','30 min','Medium','Solo'],
  ['Find a song from a year you remember clearly.','Music and memories','5 min','Low','Solo'],
  ['Drink something warm and just look out of a window.','Low-energy activities','5 min','Low','Solo'],
  ["Look up one thing you've always wondered about.",'Learning something new','10 min','Low','Solo'],
  ['Take three slow breaths. That\'s the whole thing.','2-minute moments','2 min','Low','Solo'],
  ['Sit somewhere with other people around, no need to talk.','Quiet activities','20 min','Medium','Social']]
export const ACTIVITIES: Activity[] = A.map(([title, cat, dur, en, soc], i) => ({ id: i + 1, title, cat, dur, en, soc }))
