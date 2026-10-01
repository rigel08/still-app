import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import App from './App'
import { StillProvider, KEY } from './store'
const mount = () => render(<StillProvider><App /></StillProvider>)
const tab = (n: string) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: n }))
const btn = (n: string) => screen.getByRole('button', { name: n })
const articles = () => screen.queryAllByRole('article').length
const journal = async (t: string) => { fireEvent.change(screen.getByLabelText('New journal entry'), { target: { value: t } }); fireEvent.click(btn('Save entry')); await waitFor(() => expect(screen.getByLabelText('New journal entry')).toHaveValue('')) }
const mm = (matches: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches, media: q, addEventListener() {}, removeEventListener() {} }))

it('navigates all five sections', () => {
  mount()
  for (const [n, h] of [['Discover', 'Discover'], ['Community', 'Community'], ['Explore', 'Explore'], ['My Space', 'My Space'], ['Home', /enough/]] as const) {
    tab(n); expect(screen.getAllByRole('heading', { level: 1 })[0]).toHaveTextContent(h)
    expect(within(screen.getByRole('navigation')).getByRole('button', { name: n })).toHaveAttribute('aria-current', 'page')
  }
})
it('records a check-in, shows it in My Space, and deletes it', () => {
  mount(); fireEvent.click(btn('Numb')); expect(btn('Numb')).toHaveAttribute('aria-pressed', 'true')
  tab('My Space'); expect(screen.getByText(/^Numb ·/)).toBeInTheDocument()
  fireEvent.click(btn('Delete check-in')); expect(screen.getByText('Your sky is empty')).toBeInTheDocument()
})
it('filters and paginates the Discover feed', () => {
  mount(); tab('Discover'); expect(articles()).toBe(4)
  fireEvent.click(btn('Show 4 more')); expect(articles()).toBe(8)
  fireEvent.click(btn('Feeling numb')); expect(articles()).toBe(1); expect(screen.getByText(/very quiet inside/)).toBeInTheDocument()
})
it('creates a post and a reply', async () => {
  mount(); tab('Community')
  fireEvent.change(screen.getByLabelText('Post'), { target: { value: 'hello from tests' } }); fireEvent.click(btn('Post')); await waitFor(() => expect(screen.getByLabelText('Post')).toHaveValue(''))
  expect(screen.getByText('hello from tests')).toBeInTheDocument()
  fireEvent.click(within(screen.getByText('hello from tests').closest('article') as HTMLElement).getByRole('button', { name: '0 replies' })); fireEvent.change(screen.getByLabelText('Your reply'), { target: { value: 'a kind reply' } }); fireEvent.click(btn('Reply')); await waitFor(() => expect(screen.getByLabelText('Your reply')).toHaveValue(''))
  expect(screen.getByText('a kind reply')).toBeInTheDocument()
})
it('saves posts and activities privately', () => {
  mount(); tab('Discover'); fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]); expect(screen.getAllByRole('button', { name: 'Saved' })).toHaveLength(1)
  tab('Explore'); fireEvent.click(screen.getAllByRole('button', { name: 'Save for later' })[0])
  tab('My Space'); expect(screen.queryByText('Nothing saved')).toBeNull(); expect(articles()).toBe(2)
})
it('reports and blocks, then unblocks', () => {
  mount(); tab('Community'); expect(articles()).toBe(8)
  fireEvent.click(screen.getAllByRole('button', { name: 'Report' })[0]); fireEvent.click(screen.getByRole('radio', { name: 'Spam' })); fireEvent.click(btn('Send report')); expect(articles()).toBe(7)
  fireEvent.click(screen.getAllByRole('button', { name: 'Block' })[0]); expect(articles()).toBe(6)
  tab('My Space'); fireEvent.click(screen.getByRole('button', { name: /^Unblock/ })); tab('Community'); expect(articles()).toBe(7)
})
it('keeps journal entries private and off the network', async () => {
  const f = vi.fn(); vi.stubGlobal('fetch', f); mount(); tab('My Space'); await journal('secret thought')
  expect(screen.getByText('secret thought')).toBeInTheDocument()
  for (const t of ['Home', 'Discover', 'Community', 'Explore']) { tab(t); expect(screen.queryByText('secret thought')).toBeNull() }
  expect(f).not.toHaveBeenCalled()
})
it('deletes all local data', async () => {
  mount(); fireEvent.click(btn('Lonely')); tab('My Space'); await journal('to be deleted'); fireEvent.click(btn('Delete all my data'))
  expect(screen.getByText('Your sky is empty')).toBeInTheDocument(); expect(screen.queryByText('to be deleted')).toBeNull()
  const s = JSON.parse(localStorage.getItem(KEY)!); expect(s.ci).toEqual([]); expect(s.jr).toEqual([]); expect(s.mood).toBeNull()
})
it('skips haptics under reduced motion and uses them otherwise', () => {
  const vib = vi.fn(); Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true })
  mm(true); const a = mount(); fireEvent.click(btn('Okay')); expect(vib).not.toHaveBeenCalled(); a.unmount()
  mm(false); mount(); fireEvent.click(btn('Okay')); expect(vib).toHaveBeenCalled()
})
it('low-energy mode toggles the simplified layout; the moon phase is keyboard-operable', () => {
  mount(); fireEvent.keyDown(screen.getByRole('button', { name: /Night sky/ }), { key: 'Enter' }); expect(screen.getByRole('status')).toHaveTextContent('Moon: half')
  tab('My Space'); fireEvent.click(btn('Low-energy mode')); expect(document.body).toHaveClass('low')
})
it('traps focus in dialogs, closes on Escape, and restores focus to the opener', async () => {
  mount(); const opener = btn('Need support now?'); opener.focus(); fireEvent.click(opener)
  const d = screen.getByRole('dialog'); const close = within(d).getByRole('button', { name: 'Close' }); const link = within(d).getByRole('link')
  expect(close).toHaveFocus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(link).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(close).toHaveFocus()
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() => expect(opener).toHaveFocus())
})
