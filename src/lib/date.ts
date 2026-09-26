import type { ISODate } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const DAY_MS = 86_400_000

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from a to b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS)
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(s: ISODate): number {
  return parseISO(s).getDay()
}

export function mondayOf(s: ISODate): ISODate {
  return addDays(s, -((weekday(s) + 6) % 7))
}

export function isoFromTimestamp(ts: string | number): ISODate {
  return toISO(new Date(ts))
}

/** Monotonic day number, used as a chart x coordinate. */
export function dayNumber(s: ISODate): number {
  const d = parseISO(s)
  return Math.round((d.getTime() - d.getTimezoneOffset() * 60_000) / DAY_MS)
}

export function fromDayNumber(n: number): ISODate {
  const d = new Date(n * DAY_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7)
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function clampDate(s: ISODate, min: ISODate, max: ISODate): ISODate {
  return s < min ? min : s > max ? max : s
}

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
export const DAYS_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export function fmtDate(s: ISODate, opts: { weekday?: boolean; year?: boolean; long?: boolean } = {}): string {
  const d = parseISO(s)
  const month = opts.long ? MONTHS[d.getMonth()] : MONTHS_SHORT[d.getMonth()]
  let out = `${d.getDate() === 1 ? '1er' : d.getDate()} ${month}`
  if (opts.weekday) out = `${opts.long ? DAYS[d.getDay()] : DAYS_SHORT[d.getDay()]} ${out}`
  if (opts.year) out += ` ${d.getFullYear()}`
  return out
}

export function fmtRelativeDay(s: ISODate, ref: ISODate = todayISO()): string {
  const n = diffDays(ref, s)
  if (n === 0) return "aujourd'hui"
  if (n === 1) return 'demain'
  if (n === -1) return 'hier'
  if (n > 1 && n < 7) return DAYS[weekday(s)]
  if (n < -1 && n > -7) return `il y a ${-n} jours`
  return fmtDate(s, { weekday: true })
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
