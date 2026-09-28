import { L, lang } from './i18n'
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

/** Same day n months later; the last day of a month stays the last day (30 June + 1 → 31 July). */
export function shiftMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  const lastOfMonth = d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(lastOfMonth ? last : Math.min(d.getDate(), last))
  return toISO(target)
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

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MONTHS_SHORT_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const DAYS_SHORT_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const DAYS_LETTER_FR = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_LETTER_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** Month name, 0 = January (French names are lowercase, as in running text). */
export function monthName(month: number, short = false): string {
  const en = lang() === 'en'
  return (short ? (en ? MONTHS_SHORT_EN : MONTHS_SHORT_FR) : en ? MONTHS_EN : MONTHS_FR)[month]
}

/** Weekday name, 0 = Sunday. */
export function dayName(day: number, short = false): string {
  const en = lang() === 'en'
  return (short ? (en ? DAYS_SHORT_EN : DAYS_SHORT_FR) : en ? DAYS_EN : DAYS_FR)[day]
}

/** One-letter weekday, 0 = Sunday. */
export function dayLetter(day: number): string {
  return (lang() === 'en' ? DAYS_LETTER_EN : DAYS_LETTER_FR)[day]
}

/** « lun. 28 sept. 2026 » / « Mon 28 Sep 2026 », long: « lundi 28 septembre » / « Monday 28 September ». */
export function fmtDate(s: ISODate, opts: { weekday?: boolean; year?: boolean; long?: boolean } = {}): string {
  const d = parseISO(s)
  const month = monthName(d.getMonth(), !opts.long)
  const day = lang() === 'fr' && d.getDate() === 1 ? '1er' : String(d.getDate())
  let out = `${day} ${month}`
  if (opts.weekday) out = `${dayName(d.getDay(), !opts.long)} ${out}`
  if (opts.year) out += ` ${d.getFullYear()}`
  return out
}

export function fmtRelativeDay(s: ISODate, ref: ISODate = todayISO()): string {
  const n = diffDays(ref, s)
  if (n === 0) return L('aujourd’hui', 'today')
  if (n === 1) return L('demain', 'tomorrow')
  if (n === -1) return L('hier', 'yesterday')
  if (n > 1 && n < 7) return dayName(weekday(s))
  if (n < -1 && n > -7) return L(`il y a ${-n} jours`, `${-n} days ago`)
  return fmtDate(s, { weekday: true })
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
