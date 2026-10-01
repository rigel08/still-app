import type { View } from '../types'
import { useStill } from '../store'
const IC: Record<string, string> = { home: '<path d="M4 11l8-7 8 7v9H4z"/>', discover: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-2 6-4 0 2-6z"/>', community: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 15c3 0 6 1 6 5"/>', explore: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>', space: '<path d="M20 14A8 8 0 019.5 4 8 8 0 1020 14z"/>' }
const TABS: [View, string][] = [['home', 'Home'], ['discover', 'Discover'], ['community', 'Community'], ['explore', 'Explore'], ['space', 'My Space']]
export default function Nav() {
  const s = useStill()
  return (<nav aria-label="Main">{TABS.map(([k, l]) => (
    <button key={k} aria-current={s.v === k || (k === 'community' && s.v === 'post') ? 'page' : undefined} onClick={() => s.go(k)}>
      <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: IC[k] }} />{l}</button>))}</nav>)
}
