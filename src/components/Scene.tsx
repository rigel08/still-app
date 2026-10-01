import type { Mood } from '../types'
import { MOODS } from '../data'
const PH = [26, 70, 400]
const STARS = [[60,40],[140,90],[240,30],[420,60],[520,110],[350,25],[90,150]]
export default function Scene({ mood, phase, onTap }: { mood: Mood | null; phase: number; onTap: () => void }) {
  const sunny = !!mood && MOODS[mood].sun
  return (
    <svg id="scene" viewBox="0 0 600 300" role="button" tabIndex={0} aria-label="Night sky with a moon and a sun. Activate to change the moon phase."
      onClick={onTap} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap() } }}>
      <defs>
        <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: sunny ? '#2a2140' : '#080B12' }} /><stop offset="1" style={{ stopColor: sunny ? '#8a5a58' : '#1b2140' }} /></linearGradient>
        <radialGradient id="mg"><stop offset="0" stopColor="#AABBE8" stopOpacity=".5" /><stop offset="1" stopColor="#AABBE8" stopOpacity="0" /></radialGradient>
        <radialGradient id="sg"><stop offset="0" stopColor="#F0C98B" stopOpacity=".7" /><stop offset="1" stopColor="#C98979" stopOpacity="0" /></radialGradient>
        <mask id="mk"><rect width="600" height="300" fill="#fff" /><circle cx={300 + PH[phase]} cy={-8} r="46" fill="#000" /></mask>
      </defs>
      <rect width="600" height="300" fill="url(#sk)" />
      {STARS.map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.3" fill="#fff" opacity=".7" />)}
      <g style={{ transform: `translateY(${sunny ? 260 : 100}px)`, opacity: sunny ? 0 : 1 }}><circle cx="300" cy="0" r="120" fill="url(#mg)" /><circle cx="300" cy="0" r="44" fill="#AABBE8" mask="url(#mk)" /></g>
      <g style={{ transform: `translateY(${sunny ? 205 : 330}px)`, opacity: sunny ? 1 : 0 }}><circle cx="300" cy="0" r="130" fill="url(#sg)" /><circle cx="300" cy="0" r="40" fill="#F0C98B" /></g>
      <path d="M0 250 Q150 215 300 240 T600 235 V300 H0z" fill="#0d1120" /><path d="M0 275 Q200 250 380 268 T600 262 V300 H0z" fill="#101522" />
    </svg>)
}
