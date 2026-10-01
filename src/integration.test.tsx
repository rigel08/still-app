import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import Root from './Root'
import { ApiError, api, setUnauthorizedHandler } from './api'
type H = (body: any, url?: URL) => [number, unknown?]
const ann = { id: 1, pseudonym: 'ann', low_energy: false, prefs: { company: 'either' } }
const routes = (o: Record<string, H> = {}): Record<string, H> => ({ 'GET /me': () => [200, ann], 'GET /posts': () => [200, { items: [], has_more: false }], 'GET /checkins': () => [200, []], 'GET /journal': () => [200, []], 'GET /saved': () => [200, []], 'GET /blocks': () => [200, []], 'GET /completions': () => [200, []], 'GET /saved/posts': () => [200, { items: [], has_more: false }], 'GET /activities': () => [200, []], ...o })
function mockApi(r: Record<string, H>) {
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${new URL(url).pathname.replace('/api', '')}`; const h = r[key] ?? r[key.replace(/\/\d+/g, '/:id')]
    if (!h) return new Response(JSON.stringify({ detail: 'no route ' + key }), { status: 500 })
    const [s, b] = h(init?.body ? JSON.parse(String(init.body)) : undefined, new URL(url)); return s === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(b ?? null), { status: s })
  }); vi.stubGlobal('fetch', f); return f
}
const calls = (f: ReturnType<typeof mockApi>) => f.mock.calls.map(c => `${(c[1] as RequestInit | undefined)?.method ?? 'GET'} ${new URL(c[0] as string).pathname.replace('/api', '')}`)
const tab = (n: string) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: n }))
const btn = (n: string) => screen.getByRole('button', { name: n })
const ready = async () => { render(<Root />); await screen.findByText('Signed in as ann'); await waitFor(() => expect(screen.queryByText('Loading your space…')).toBeNull()) }
afterEach(() => setUnauthorizedHandler(null))

it('api client: sends cookies, maps network errors and 422 fields, reports 401 centrally', async () => {
  const f = mockApi({ 'POST /checkins': () => [422, { detail: [{ loc: ['body', 'emotion'], msg: 'bad emotion' }] }] })
  const err = await api.addCheckIn('Numb').catch(e => e); expect(err).toBeInstanceOf(ApiError); expect(err.status).toBe(422); expect(err.fields.emotion).toBe('bad emotion')
  expect((f.mock.calls[0][1] as RequestInit).credentials).toBe('include')
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') })); expect(await api.me().catch(e => e)).toMatchObject({ status: 0 })
  const h = vi.fn(); setUnauthorizedHandler(h); mockApi({ 'GET /journal': () => [401, { detail: 'Not signed in' }], 'GET /me': () => [401, { detail: 'Not signed in' }] })
  await api.journal().catch(() => 0); await api.me().catch(() => 0); expect(h).toHaveBeenCalledTimes(1)  // /me is exempt
})
it('restores the session on load and never persists account data in localStorage', async () => {
  mockApi(routes()); await ready(); expect(screen.queryByText(/Local demo mode/)).toBeNull(); expect(localStorage.length).toBe(0)
})
it('shows sign-in when signed out, and reports failed login without entering demo mode', async () => {
  const f = mockApi(routes({ 'GET /me': () => [401, { detail: 'Not signed in' }], 'POST /auth/login': () => [401, { detail: 'Email or password is incorrect.' }] })); render(<Root />)
  fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.test' } }); fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'whatever whatever' } }); fireEvent.click(btn('Sign in'))
  expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.'); expect(screen.queryByText(/Signed in as/)).toBeNull(); expect(calls(f)).not.toContain('GET /posts')
})
it('registers, shows field errors from 422, then signs in', async () => {
  let n = 0; mockApi(routes({ 'GET /me': () => [401, { detail: 'x' }], 'POST /auth/register': () => (n++ ? [201, ann] : [422, { detail: [{ loc: ['body', 'password'], msg: 'String should have at least 10 characters' }] }]) })); render(<Root />)
  fireEvent.click(await screen.findByRole('button', { name: "I'm new here" })); fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.test' } }); fireEvent.change(screen.getByLabelText(/Pseudonym/), { target: { value: 'ann' } }); fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 'short' } })
  fireEvent.click(btn('Create account')); expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument()
  fireEvent.click(btn('Create account')); await screen.findByText('Signed in as ann')
})
it('backend down: explains, offers retry, and only enters demo mode when the user chooses it', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') })); render(<Root />)
  expect(await screen.findByText(/can't reach the still. server/i)).toBeInTheDocument(); expect(screen.queryByText(/Local demo mode ·/)).toBeNull()
  fireEvent.click(btn('Use local demo mode instead')); expect(await screen.findByText(/Local demo mode · sample content/)).toBeInTheDocument()
})
it('check-ins are saved on the server first; a failed save is reported and not shown as saved', async () => {
  const f = mockApi(routes({ 'POST /checkins': () => [201, { id: 5, emotion: 'Numb', note: null, created_at: new Date().toISOString() }] })); await ready()
  fireEvent.click(btn('Numb')); await waitFor(() => expect(btn('Numb')).toHaveAttribute('aria-pressed', 'true')); expect(calls(f)).toContain('POST /checkins'); tab('My Space'); expect(screen.getByText(/^Numb ·/)).toBeInTheDocument()
  vi.unstubAllGlobals(); mockApi(routes({ 'POST /checkins': () => [500, { detail: 'Server error' }] })); document.body.innerHTML = ''
})
it('a failed check-in shows an error toast and no check-in', async () => {
  mockApi(routes({ 'POST /checkins': () => [500, { detail: 'Server error' }] })); await ready(); fireEvent.click(btn('Lonely'))
  expect(await screen.findByText('Server error')).toBeInTheDocument(); expect(btn('Lonely')).toHaveAttribute('aria-pressed', 'false'); tab('My Space'); expect(screen.getByText('Your sky is empty')).toBeInTheDocument()
})
it('journal entries go only to the journal endpoint and never appear in community views or URLs', async () => {
  const f = mockApi(routes({ 'POST /journal': b => [201, { id: 9, body: b.body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] })); await ready(); tab('My Space')
  fireEvent.change(screen.getByLabelText('New journal entry'), { target: { value: 'ann-private-words' } }); fireEvent.click(btn('Save entry')); await screen.findByText('ann-private-words')
  for (const t of ['Discover', 'Community']) { tab(t); expect(screen.queryByText('ann-private-words')).toBeNull() }
  expect(f.mock.calls.filter(c => String(c[0]).includes('ann-private')).length).toBe(0); expect(calls(f).filter(c => c.includes('journal'))).toEqual(['GET /journal', 'POST /journal'])
})
it('community: posting reloads from the server; rate limiting keeps the draft and says so', async () => {
  let posted = false, limited = false; const post = { id: 3, category: 'Feeling numb', body: 'a real thought', author: 'ann', created_at: new Date().toISOString(), replies: 0, me_too: false, saved: false, mine: true }
  mockApi(routes({ 'GET /posts': () => [200, { items: posted ? [post] : [], has_more: false }], 'POST /posts': () => (limited ? (posted = true, [201, post]) : (limited = true, [429, { detail: 'Too many requests.' }])) })); await ready(); tab('Community')
  fireEvent.change(screen.getByLabelText('Post'), { target: { value: 'a real thought' } }); fireEvent.click(btn('Post'))
  expect(await screen.findByText(/Too many requests. Please wait/)).toBeInTheDocument(); expect(screen.getByLabelText('Post')).toHaveValue('a real thought'); expect(screen.queryByRole('article')).toBeNull()
  await waitFor(() => expect(btn('Post')).not.toBeDisabled()); fireEvent.click(btn('Post')); expect(await screen.findByRole('article')).toHaveTextContent('a real thought'); expect(within(screen.getByRole('article')).queryByText('Report')).toBeNull()
})
it('session expiry mid-use returns to sign-in with a clear note and clears the account view', async () => {
  mockApi(routes({ 'POST /checkins': () => [401, { detail: 'Not signed in' }] })); await ready(); fireEvent.click(btn('Numb'))
  expect(await screen.findByText('Your session expired. Please sign in again.')).toBeInTheDocument(); expect(screen.queryByText(/Signed in as/)).toBeNull()
})
it('sign out calls the server and returns to sign-in; account deletion needs the password', async () => {
  const f = mockApi(routes({ 'POST /auth/logout': () => [204], 'DELETE /me': b => (b.password === 'right password' ? [204] : [403, { detail: 'Password is incorrect.' }]) })); await ready()
  tab('My Space'); fireEvent.click(btn('Delete my account and data')); fireEvent.change(screen.getByLabelText('Confirm your password'), { target: { value: 'nope' } }); fireEvent.click(btn('Delete my account'))
  expect(await screen.findByText('Password is incorrect.')).toBeInTheDocument(); expect(screen.getByText('Signed in as ann')).toBeInTheDocument()
  await waitFor(() => expect(btn('Delete my account')).not.toBeDisabled()); fireEvent.change(screen.getByLabelText('Confirm your password'), { target: { value: 'right password' } }); fireEvent.click(btn('Delete my account'))
  expect(await screen.findByText('Your account and its data were deleted.')).toBeInTheDocument()
  vi.unstubAllGlobals(); const g = mockApi(routes({ 'POST /auth/logout': () => [204] })); document.body.innerHTML = ''; void g; void f
})
it('sign out button', async () => {
  const f = mockApi(routes({ 'POST /auth/logout': () => [204] })); await ready(); fireEvent.click(btn('Sign out'))
  expect(await screen.findByText('You signed out.')).toBeInTheDocument(); expect(calls(f)).toContain('POST /auth/logout')
})

const iso = () => new Date().toISOString()
const act = (id: number, title: string) => ({ id, title, description: title, duration_minutes: 5, energy_level: 'Low', social_type: 'Solo', category: 'Getting outside' })
const post = (id: number, body: string, o = {}) => ({ id, category: 'Feeling numb', body, author: 'bob', created_at: iso(), replies: 0, me_too: false, saved: false, mine: false, ...o })
const page = (u?: URL) => u?.searchParams.get('page') ?? '1'

it('journal entries can be edited: cancel discards, empty is refused, a failed save keeps the editor and draft, a good save uses PATCH', async () => {
  let fail = true; const j = { id: 9, body: 'first words', created_at: iso(), updated_at: iso() }
  const f = mockApi(routes({ 'GET /journal': () => [200, [j]], 'PATCH /journal/:id': b => (fail ? [500, { detail: 'Server error' }] : [200, { ...j, body: b.body }]) })); await ready(); tab('My Space')
  fireEvent.click(btn('Edit')); fireEvent.change(screen.getByLabelText('Edit entry'), { target: { value: 'typed then cancelled' } }); fireEvent.click(btn('Cancel')); expect(screen.getByText('first words')).toBeInTheDocument(); expect(calls(f)).not.toContain('PATCH /journal/9')
  fireEvent.click(btn('Edit')); fireEvent.change(screen.getByLabelText('Edit entry'), { target: { value: '   ' } }); expect(btn('Save changes')).toBeDisabled(); expect(screen.getByText("An entry can't be empty.")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Edit entry'), { target: { value: 'edited words' } }); fireEvent.click(btn('Save changes'))
  expect(await screen.findByText('Server error')).toBeInTheDocument(); expect(screen.getByLabelText('Edit entry')).toHaveValue('edited words')
  fail = false; await waitFor(() => expect(btn('Save changes')).not.toBeDisabled()); fireEvent.click(btn('Save changes'))
  await waitFor(() => expect(screen.queryByLabelText('Edit entry')).toBeNull()); expect(screen.getByText('edited words')).toBeInTheDocument()
  expect(JSON.parse(String((f.mock.calls.find(c => (c[1] as RequestInit).method === 'PATCH')![1] as RequestInit).body))).toEqual({ body: 'edited words' })
})
it('report dialog requires a reason, sends reason and details, and stays open with the error if the request fails', async () => {
  let fail = true; const f = mockApi(routes({ 'GET /posts': () => [200, { items: [post(4, 'someone elses words')], has_more: false }], 'POST /reports': () => (fail ? [429, { detail: 'Too many requests.' }] : [201, { status: 'received' }]) })); await ready(); tab('Community')
  fireEvent.click(btn('Report')); const d = () => within(screen.getByRole('dialog')); fireEvent.click(d().getByRole('button', { name: 'Send report' }))
  expect(d().getByRole('alert')).toHaveTextContent('Please choose a reason.'); expect(calls(f)).not.toContain('POST /reports')
  fireEvent.click(d().getByRole('radio', { name: 'Harassment or bullying' })); fireEvent.change(d().getByLabelText(/Anything you'd like to add/), { target: { value: 'targeted me' } }); fireEvent.click(d().getByRole('button', { name: 'Send report' }))
  expect(await screen.findByText(/Too many requests. Please wait/)).toBeInTheDocument(); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByText('someone elses words')).toBeInTheDocument()
  fail = false; await waitFor(() => expect(d().getByRole('button', { name: 'Send report' })).not.toBeDisabled()); fireEvent.click(d().getByRole('button', { name: 'Send report' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const c = f.mock.calls.filter(x => (x[1] as RequestInit).method === 'POST' && String(x[0]).endsWith('/reports'))
  expect(JSON.parse(String((c[c.length - 1][1] as RequestInit).body))).toEqual({ target_type: 'post', target_id: 4, reason: 'harassment', details: 'targeted me' })
})
it('opening a post shows a loading state, recovers from an error via retry, and keeps a failed reply draft', async () => {
  const p = post(4, 'a post to open'); let detailOk = false, replyOk = false
  mockApi(routes({ 'GET /posts': () => [200, { items: [p], has_more: false }], 'GET /posts/:id': () => (detailOk ? [200, { ...p, reply_list: replyOk ? [{ id: 7, author: 'ann', body: 'my reply', created_at: iso(), mine: true }] : [] }] : [500, { detail: 'Replies are unavailable' }]),
    'POST /posts/:id/replies': () => (replyOk ? [201, { id: 7, author: 'ann', body: 'my reply', created_at: iso(), mine: true }] : [429, { detail: 'Too many requests.' }]) })); await ready(); tab('Community')
  fireEvent.click(btn('0 replies')); expect(screen.getByText('Loading replies…')).toBeInTheDocument()
  expect(await screen.findByText('Replies are unavailable')).toBeInTheDocument(); detailOk = true; fireEvent.click(btn('Try again')); expect(await screen.findByText('No replies yet')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'my reply' } }); fireEvent.click(btn('Reply')); expect(await screen.findByText(/Too many requests/)).toBeInTheDocument(); expect(screen.getByLabelText('Your reply')).toHaveValue('my reply')
  replyOk = true; await waitFor(() => expect(btn('Reply')).not.toBeDisabled()); fireEvent.click(btn('Reply')); await waitFor(() => expect(screen.getByLabelText('Your reply')).toHaveValue('')); expect(screen.getByText('my reply')).toBeInTheDocument()
})
it('activities use the ids the backend returns for saving and completing (not 1-10)', async () => {
  const f = mockApi(routes({ 'GET /activities': () => [200, [act(41, 'Walk somewhere new'), act(57, 'Hum a tune')]], 'PUT /saved/activity/:id': () => [204], 'POST /activities/:id/complete': () => [201, { id: 1 }] })); await ready(); tab('Explore')
  expect(await screen.findByText('Walk somewhere new')).toBeInTheDocument(); fireEvent.click(screen.getAllByRole('button', { name: 'Save for later' })[1]); await waitFor(() => expect(calls(f)).toContain('PUT /saved/activity/57'))
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Try this' })[0]).not.toBeDisabled()); fireEvent.click(screen.getAllByRole('button', { name: 'Try this' })[0]); fireEvent.click(btn('I made room for it'))
  await waitFor(() => expect(calls(f)).toContain('POST /activities/41/complete')); expect(calls(f).filter(c => /\/activity\/\d$|activities\/\d\//.test(c))).toEqual([])
})
it('an empty activity catalogue shows an empty state and Home still renders; a failing catalogue shows a retryable error', async () => {
  mockApi(routes()); await ready(); tab('Explore'); expect(screen.getByText('No activities yet')).toBeInTheDocument(); tab('Home'); expect(screen.getByText(/What's it like inside your head/)).toBeInTheDocument(); expect(screen.queryByText(/Today's small moment/)).toBeNull()
  document.body.innerHTML = ''; mockApi(routes({ 'GET /activities': () => [500, { detail: 'Catalogue unavailable' }] })); render(<Root />)
  expect(await screen.findByText("We couldn't load your data")).toBeInTheDocument(); expect(screen.getByText('Catalogue unavailable')).toBeInTheDocument(); expect(btn('Try again')).toBeInTheDocument()
})
it('My Space lists saved posts that are outside the newest page and pages through more', async () => {
  const f = mockApi(routes({ 'GET /posts': () => [200, { items: [post(50, 'a brand new post')], has_more: false }], 'GET /saved/posts': (_b, u) => (page(u) === '2' ? [200, { items: [post(2, 'an even older saved post')], has_more: false }] : [200, { items: [post(1, 'an old saved post')], has_more: true }]) })); await ready(); tab('My Space')
  expect(await screen.findByText('an old saved post')).toBeInTheDocument(); expect(screen.queryByText('a brand new post')).toBeNull(); expect(screen.queryByText('an even older saved post')).toBeNull()
  fireEvent.click(btn('Show more saved posts')); expect(await screen.findByText('an even older saved post')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Show more saved posts' })).toBeNull(); expect(calls(f).filter(c => c === 'GET /saved/posts').length).toBe(2)
})
it('Discover loads older pages from the server on request and never reorders by popularity', async () => {
  mockApi(routes({ 'GET /posts': (_b, u) => (page(u) === '2' ? [200, { items: [post(3, 'older page post')], has_more: false }] : [200, { items: [post(4, 'newer page post')], has_more: true }]) })); await ready(); tab('Discover')
  expect(await screen.findByText('newer page post')).toBeInTheDocument(); expect(screen.queryByText('older page post')).toBeNull(); fireEvent.click(btn('Load older posts'))
  expect(await screen.findByText('older page post')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Load older posts' })).toBeNull()
})

const modUser = { ...ann, role: 'moderator' }
const modReport = (o = {}) => ({ id: 5, target_type: 'post', target_id: 4, reason: 'harassment', details: 'targeted me', status: 'open', created_at: iso(), reviewed_at: null, reviewed_by: null, target: { author: 'bob', category: 'Feeling numb', body: 'the reported words', content_status: 'active' }, ...o })
it('the moderation queue is offered only to moderators, and shows reason, note, content, date and status', async () => {
  mockApi(routes()); await ready(); tab('My Space'); expect(screen.queryByRole('button', { name: 'Moderation queue' })).toBeNull(); document.body.innerHTML = ''
  mockApi(routes({ 'GET /me': () => [200, modUser], 'GET /mod/reports': () => [200, { items: [modReport()], has_more: false }] })); await ready(); tab('My Space'); fireEvent.click(btn('Moderation queue'))
  expect(await screen.findByText(/Harassment or bullying · open · reported/)).toBeInTheDocument(); expect(screen.getByText(/targeted me/)).toBeInTheDocument(); expect(screen.getByText('the reported words')).toBeInTheDocument(); expect(screen.getByText(/post by bob · active/)).toBeInTheDocument()
})
it('moderators can dismiss with a note, and removing content asks first then sends the action', async () => {
  let handled = false; const f = mockApi(routes({ 'GET /me': () => [200, modUser], 'GET /mod/reports': () => [200, { items: handled ? [] : [modReport()], has_more: false }], 'POST /mod/reports/:id/review': () => { handled = true; return [200, modReport({ status: 'dismissed' })] } }))
  await ready(); tab('My Space'); fireEvent.click(btn('Moderation queue')); await screen.findByText('the reported words')
  const body = () => JSON.parse(String((f.mock.calls.filter(c => (c[1] as RequestInit).method === 'POST' && String(c[0]).includes('/review')).pop()![1] as RequestInit).body))
  window.confirm = () => false; fireEvent.click(btn('Remove content')); expect(calls(f).some(c => c.includes('/review'))).toBe(false)
  fireEvent.change(screen.getByLabelText(/Note for the audit log/), { target: { value: 'not abusive' } }); fireEvent.click(btn('Dismiss')); expect(await screen.findByText('Nothing to review')).toBeInTheDocument(); expect(body()).toEqual({ action: 'dismiss', note: 'not abusive' })
})
it('removing content sends remove_content after confirmation; a 403 shows an access message and no data', async () => {
  const f = mockApi(routes({ 'GET /me': () => [200, modUser], 'GET /mod/reports': () => [200, { items: [modReport()], has_more: false }], 'POST /mod/reports/:id/review': () => [200, modReport({ status: 'actioned' })] }))
  await ready(); tab('My Space'); fireEvent.click(btn('Moderation queue')); await screen.findByText('the reported words'); window.confirm = () => true; fireEvent.click(btn('Remove content'))
  await waitFor(() => expect(f.mock.calls.some(c => String(c[0]).includes('/review') && String((c[1] as RequestInit).body).includes('"remove_content"'))).toBe(true))
  document.body.innerHTML = ''; mockApi(routes({ 'GET /me': () => [200, modUser], 'GET /mod/reports': () => [403, { detail: 'Moderator access required' }] })); await ready(); tab('My Space'); fireEvent.click(btn('Moderation queue'))
  expect(await screen.findByText("You don't have access to moderation.")).toBeInTheDocument(); expect(screen.queryByText('the reported words')).toBeNull()
})

const link = (n: RegExp) => fireEvent.click(screen.getByRole('button', { name: n }))
it('Quiet Room: shows only a real count, joins and leaves, and explains itself in demo mode', async () => {
  const q = (present: number, mine: boolean) => [200, { present, mine, window_seconds: 90 }] as [number, unknown]
  const f = mockApi(routes({ 'GET /quiet': () => q(0, false), 'POST /quiet/join': () => q(2, true), 'POST /quiet/leave': () => q(1, false) })); await ready(); link(/The Quiet Room/)
  expect(await screen.findByText('No one is in the room right now.')).toBeInTheDocument(); fireEvent.click(btn('Join the quiet room'))
  expect(await screen.findByText("You're here with 1 other person.")).toBeInTheDocument(); fireEvent.click(btn('Leave the room')); expect(await screen.findByText('1 person is in the room right now.')).toBeInTheDocument()
  expect(calls(f)).toEqual(expect.arrayContaining(['POST /quiet/join', 'POST /quiet/leave']))
  document.body.innerHTML = ''; vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') })); render(<Root />); fireEvent.click(await screen.findByRole('button', { name: 'Use local demo mode instead' })); link(/The Quiet Room/)
  expect(await screen.findByText('The Quiet Room needs an account')).toBeInTheDocument()
})
it('Notes: never invents a note, validates, and shows a submitted note as waiting for review', async () => {
  const f = mockApi(routes({ 'GET /notes/next': () => [200, null], 'GET /notes/mine': () => [200, []], 'POST /notes': b => [201, { id: 8, body: b.body, status: 'pending', created_at: iso() }] })); await ready(); link(/Notes from strangers/)
  expect(await screen.findByText('No notes to read yet')).toBeInTheDocument(); fireEvent.change(screen.getByLabelText(/Something kind or true/), { target: { value: 'too short' } }); fireEvent.click(btn('Send for review'))
  expect(screen.getByRole('alert')).toHaveTextContent('at least 10 characters'); expect(calls(f)).not.toContain('POST /notes')
  fireEvent.change(screen.getByLabelText(/Something kind or true/), { target: { value: 'You matter more than today feels.' } }); fireEvent.click(btn('Send for review'))
  expect(await screen.findByText('Waiting for review')).toBeInTheDocument(); expect(screen.getByText('You matter more than today feels.')).toBeInTheDocument()
})
it('Notes: shows an approved note anonymously and reports it through the report dialog', async () => {
  const f = mockApi(routes({ 'GET /notes/next': () => [200, { id: 3, body: 'Small steps still count.' }], 'GET /notes/mine': () => [200, []], 'POST /reports': () => [201, { status: 'received' }] })); await ready(); link(/Notes from strangers/)
  expect(await screen.findByText('Small steps still count.')).toBeInTheDocument(); fireEvent.click(btn('Report')); fireEvent.click(screen.getByRole('radio', { name: 'Spam' })); fireEvent.click(btn('Send report'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); const c = f.mock.calls.filter(x => String(x[0]).endsWith('/reports')); expect(JSON.parse(String((c[0][1] as RequestInit).body))).toMatchObject({ target_type: 'note', target_id: 3, reason: 'spam' })
})
it('Sky: stars come from real check-ins and journal entries, are keyboard-operable, filterable, and never show journal text until asked', async () => {
  mockApi(routes({ 'GET /checkins': () => [200, [{ id: 2, emotion: 'Lonely', note: null, created_at: iso() }, { id: 1, emotion: 'Numb', note: null, created_at: iso() }]], 'GET /journal': () => [200, [{ id: 3, body: 'deeply private words', created_at: iso(), updated_at: iso() }]] })); await ready(); tab('My Space')
  const sky = screen.getByRole('group', { name: /as stars/ }); expect(within(sky).getAllByRole('button')).toHaveLength(3); expect(sky).not.toHaveTextContent('deeply private words')
  fireEvent.keyDown(within(sky).getByRole('button', { name: /^Journal entry/ }), { key: 'Enter' }); const panel = screen.getByRole('region', { name: 'Star details' }); expect(panel).not.toHaveTextContent('deeply private words')
  fireEvent.click(within(panel).getByRole('button', { name: 'Read this entry' })); expect(panel).toHaveTextContent('deeply private words'); fireEvent.click(within(panel).getByRole('button', { name: 'Hide entry' })); expect(panel).not.toHaveTextContent('deeply private words')
  fireEvent.click(within(screen.getByRole('group', { name: 'Filter the sky' })).getByRole('button', { name: 'Lonely' })); expect(within(sky).getAllByRole('button')).toHaveLength(2)
})
it('Tiny Returns: only shows what fits the chosen energy and time, completes with the backend id, and lists recent returns privately', async () => {
  const a = (id: number, title: string, mins: number, en: string, soc = 'Solo') => ({ id, title, description: title, duration_minutes: mins, energy_level: en, social_type: soc, category: 'Getting outside' }); let done = false
  const f = mockApi(routes({ 'GET /activities': () => [200, [a(41, 'Hum a tune', 2, 'Low'), a(57, 'Walk somewhere new', 30, 'Medium')]], 'POST /activities/:id/complete': () => { done = true; return [201, { id: 1 }] }, 'GET /completions': () => [200, done ? [{ id: 1, activity_id: 41, reflection: 'felt lighter', created_at: iso() }] : []] })); await ready(); link(/Tiny Returns/)
  expect(await screen.findByText('Hum a tune')).toBeInTheDocument(); expect(screen.getByText('Walk somewhere new')).toBeInTheDocument()
  fireEvent.click(btn('Low energy')); expect(screen.queryByText('Walk somewhere new')).toBeNull(); fireEvent.click(btn('Some energy')); fireEvent.click(btn('Up to 5 min')); expect(screen.getByText('Nothing matches right now')).toBeInTheDocument()
  fireEvent.click(btn('Low energy')); fireEvent.click(btn('Try this')); fireEvent.change(screen.getByLabelText(/Anything you noticed/), { target: { value: 'felt lighter' } }); fireEvent.click(btn('I made room for it'))
  await waitFor(() => expect(calls(f)).toContain('POST /activities/41/complete')); expect(await screen.findByText('Recent returns')).toBeInTheDocument(); expect(screen.getByText(/felt lighter/)).toBeInTheDocument()
})
it('moderators review anonymous notes without seeing who wrote them', async () => {
  let handled = false; const f = mockApi(routes({ 'GET /me': () => [200, modUser], 'GET /mod/reports': () => [200, { items: [], has_more: false }], 'GET /mod/notes': () => [200, handled ? [] : [{ id: 7, body: 'A pending anonymous note.', created_at: iso() }]], 'POST /mod/notes/:id/review': () => { handled = true; return [200, { status: 'approved' }] } }))
  await ready(); tab('My Space'); fireEvent.click(btn('Moderation queue')); fireEvent.click(await screen.findByRole('button', { name: 'Notes to review' })); expect(await screen.findByText('A pending anonymous note.')).toBeInTheDocument(); expect(screen.getByText(/^Anonymous note/)).toBeInTheDocument()
  fireEvent.click(btn('Approve')); expect(await screen.findByText('No notes waiting')).toBeInTheDocument(); expect(JSON.parse(String((f.mock.calls.find(c => String(c[0]).includes('/mod/notes/7/review'))![1] as RequestInit).body))).toEqual({ action: 'approve', note: null })
})
