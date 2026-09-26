// iCalendar export: native iPhone reminders (Calendar alerts) without any server.
import { addDays, parseISO, todayISO, weekday } from './date'
import { GOAL_DATE, PERIODS, PROGRAM_START, TYPE_META } from './program'
import type { AppState, ISODate } from './types'

export interface IcsOptions {
  training: boolean
  weighIn: boolean
  waist: boolean
  photos: boolean
  deloads: boolean
  phases: boolean
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Folds content lines at 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.join('\r\n ')
}

const compact = (d: ISODate) => d.replace(/-/g, '')
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function firstOnOrAfter(from: ISODate, dow: number): ISODate {
  let d = from
  while (weekday(d) !== dow) d = addDays(d, 1)
  return d
}

function timed(uid: string, date: ISODate, time: string, minutes: number, summary: string, description: string, rrule: string | null, alarmMinutesBefore: number): string[] {
  const [h, m] = time.split(':').map(Number)
  const start = `${compact(date)}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${start}`,
    `DURATION:PT${minutes}M`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    ...(rrule ? [`RRULE:${rrule}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    `TRIGGER:${alarmMinutesBefore > 0 ? `-PT${alarmMinutesBefore}M` : 'PT0M'}`,
    'END:VALARM',
    'END:VEVENT',
  ]
}

function allDay(uid: string, start: ISODate, endInclusive: ISODate, summary: string, description: string, alarm: boolean): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${compact(start)}`,
    `DTEND;VALUE=DATE:${compact(addDays(endInclusive, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    'TRANSP:TRANSPARENT',
    ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(summary)}`, 'TRIGGER:-PT15H', 'END:VALARM'] : []),
    'END:VEVENT',
  ]
}

export function buildIcs(state: AppState, o: IcsOptions, today: ISODate = todayISO()): string {
  const from = today < PROGRAM_START ? PROGRAM_START : today
  const until = `${compact(GOAL_DATE)}T235959`
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Golgoth//Programme hypertrophie//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Golgoth']
  if (o.training) {
    for (let dow = 0; dow < 7; dow++) {
      const type = state.schedule[dow]
      if (!type) continue
      const first = firstOnOrAfter(from, dow)
      const meta = TYPE_META[type]
      lines.push(...timed(
        `golgoth-training-${BYDAY[dow]}@golgoth`,
        first,
        state.prefs.trainingTime,
        meta.minutes,
        `Séance ${meta.label} · Golgoth`,
        `${meta.fr}. La rotation se décale si une séance est manquée : ouvre Golgoth pour la séance du jour.`,
        `FREQ=WEEKLY;BYDAY=${BYDAY[dow]};UNTIL=${until}`,
        30,
      ))
    }
  }
  if (o.weighIn) {
    lines.push(...timed('golgoth-weigh-in@golgoth', from, state.prefs.weighInTime, 5, 'Pesée à jeun · Golgoth', 'Même balance, au réveil, après les toilettes. La moyenne sur 7 jours guide les calories.', `FREQ=DAILY;UNTIL=${until}`, 0))
  }
  if (o.waist) {
    lines.push(...timed('golgoth-waist@golgoth', firstOnOrAfter(from, 0), state.prefs.weighInTime, 5, 'Tour de taille · Golgoth', 'À jeun, au niveau du nombril, même point de mesure.', `FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;UNTIL=${until}`, 0))
  }
  if (o.photos) {
    lines.push(...timed('golgoth-photos@golgoth', firstOnOrAfter(from, 0), state.prefs.weighInTime, 10, 'Photos de progression · Golgoth', 'Même lumière, même pose, même distance.', `FREQ=WEEKLY;INTERVAL=4;BYDAY=SU;UNTIL=${until}`, 0))
  }
  for (const p of PERIODS) {
    if (p.end < from) continue
    if (o.deloads && p.kind === 'deload') {
      lines.push(...allDay(`golgoth-${p.id}@golgoth`, p.start, p.end, `${p.label} · Golgoth`, p.note, true))
    }
    if (o.phases && (p.id === 'b1' || p.id === 'b3' || p.id === 'stab' || p.id === 'fetes')) {
      const title = p.id === 'b1' ? 'Début du programme' : p.id === 'b3' ? 'Début de la sèche' : p.label
      lines.push(...allDay(`golgoth-phase-${p.id}@golgoth`, p.start, p.start, `${title} · Golgoth`, p.note, true))
    }
  }
  if (o.phases) lines.push(...allDay('golgoth-goal@golgoth', GOAL_DATE, GOAL_DATE, 'Objectif Summer body · Golgoth', 'Fin du programme.', true))
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function icsEventCount(ics: string): number {
  return (ics.match(/BEGIN:VEVENT/g) ?? []).length
}

export const firstTrainingDate = (state: AppState, from: ISODate = todayISO()): ISODate | null => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(from < PROGRAM_START ? PROGRAM_START : from, i)
    if (state.schedule[weekday(d)]) return d
  }
  return null
}

export const _test = { fold, escapeText, parseISO }
