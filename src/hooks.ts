import { useRef, useState } from 'react'
export type Dlg = { k: 'crisis' } | { k: 'data' } | { k: 'delete' } | { k: 'try'; id: number } | { k: 'report'; key: string; what: string } | null
export function useToast() { const [msg, setMsg] = useState(''); return [msg, (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2600) }] as const }
/** Opening remembers the triggering element; closing restores focus to it. */
export function useDialog() {
  const [dlg, raw] = useState<Dlg>(null); const opener = useRef<HTMLElement | null>(null)
  const setDlg = (x: Dlg) => { if (x) { opener.current = document.activeElement as HTMLElement | null; raw(x) } else { raw(null); const o = opener.current; opener.current = null; window.setTimeout(() => o?.focus(), 0) } }
  return [dlg, setDlg] as const
}
