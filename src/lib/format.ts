import type { Unit } from './types'

const nf = (digits: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: digits })

export function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return nf(digits).format(n)
}

export function fmtFixed(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
}

export function fmtSigned(n: number | null | undefined, digits = 1, unit = ''): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const v = Math.abs(n) < 10 ** -digits / 2 ? 0 : n
  const sign = v > 0 ? '+' : v < 0 ? '−' : '±'
  return `${sign}${nf(digits).format(Math.abs(v))}${unit ? ` ${unit}` : ''}`
}

export function fmtLoad(weight: number | null | undefined, unit: Unit): string {
  if (unit === 'PDC') return weight ? `PDC +${fmtNum(weight)} kg` : 'PDC'
  if (weight === null || weight === undefined) return '—'
  return `${fmtNum(weight)} ${unit === 'kg/main' ? 'kg/main' : 'kg'}`
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function fmtRest(seconds: number): string {
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return fmtDuration(seconds)
}

export function plural(n: number, one: string, many: string): string {
  return `${fmtNum(n, 0)} ${Math.abs(n) >= 2 ? many : one}`
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x))
}

export function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step
}

export function parseNumber(v: string): number | null {
  const t = v.replace(',', '.').trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
