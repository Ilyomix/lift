// iCalendar export: native reminders (alerts of the phone's calendar) without any server.
// Event texts follow the interface language; UIDs stay the same so a re-import updates the events.
import { addDays, parseISO, todayISO, weekday } from './date'
import { L } from './i18n'
import { GOAL_DATE, keyPeriods, MAINTENANCE, PERIODS, PROGRAM_START, scaledSession, sessionMinutes, sessionSlots, TYPE_META } from './program'
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
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lift//Programme hypertrophie//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Lift']
  if (o.training) {
    for (let dow = 0; dow < 7; dow++) {
      const type = state.schedule[dow]
      if (!type) continue
      const first = firstOnOrAfter(from, dow)
      const meta = TYPE_META[type]
      // With fewer than five days, sessions take more sets: the event lasts as long as they do.
      const sets = scaledSession(sessionSlots(state.templates[type].exercises)).reduce((a, n) => a + n, 0)
      lines.push(...timed(
        `golgoth-training-${BYDAY[dow]}@golgoth`,
        first,
        state.prefs.trainingTime,
        sessionMinutes(type, sets),
        L(`Séance ${meta.label} · Lift`, `${meta.label} session · Lift`),
        L(
          `${meta.fr}. La rotation se décale si une séance est manquée : ouvre Lift pour la séance du jour.`,
          `${meta.fr !== meta.label ? `${meta.fr}. ` : ''}The rotation shifts if a session is missed: open Lift for today’s session.`,
        ),
        `FREQ=WEEKLY;BYDAY=${BYDAY[dow]};UNTIL=${until}`,
        30,
      ))
    }
  }
  if (o.weighIn) {
    lines.push(...timed(
      'golgoth-weigh-in@golgoth',
      from,
      state.prefs.weighInTime,
      5,
      L('Pesée à jeun · Lift', 'Fasted weigh-in · Lift'),
      L('Même balance, au réveil, après les toilettes. La moyenne sur 7 jours guide les calories.', 'Same scale, right after waking up and using the bathroom. The 7-day average guides your calories.'),
      `FREQ=DAILY;UNTIL=${until}`,
      0,
    ))
  }
  if (o.waist) {
    lines.push(...timed(
      'golgoth-waist@golgoth',
      firstOnOrAfter(from, 0),
      state.prefs.weighInTime,
      5,
      L('Tour de taille · Lift', 'Waist measurement · Lift'),
      L('À jeun, au niveau du nombril, même point de mesure.', 'Fasted, at navel level, same measuring point.'),
      `FREQ=WEEKLY;INTERVAL=2;BYDAY=SU;UNTIL=${until}`,
      0,
    ))
  }
  if (o.photos) {
    lines.push(...timed(
      'golgoth-photos@golgoth',
      firstOnOrAfter(from, 0),
      state.prefs.weighInTime,
      10,
      L('Photos de progression · Lift', 'Progress photos · Lift'),
      L('Même lumière, même pose, même distance.', 'Same light, same pose, same distance.'),
      `FREQ=WEEKLY;INTERVAL=4;BYDAY=SU;UNTIL=${until}`,
      0,
    ))
  }
  for (const p of PERIODS) {
    if (p.end < from) continue
    if (o.deloads && p.kind === 'deload') {
      lines.push(...allDay(`golgoth-${p.id}@golgoth`, p.start, p.end, `${p.label} · Lift`, p.note, true))
    }
  }
  if (o.phases) {
    for (const { period: p, title } of keyPeriods()) {
      if (p.start < from) continue
      lines.push(...allDay(`golgoth-phase-${p.id}@golgoth`, p.start, p.start, `${title} · Lift`, p.note, true))
    }
  }
  if (o.phases && !MAINTENANCE) lines.push(...allDay('golgoth-goal@golgoth', GOAL_DATE, GOAL_DATE, L('Objectif Summer body · Lift', 'Summer body goal · Lift'), L('Fin du programme.', 'End of the program.'), true))
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
