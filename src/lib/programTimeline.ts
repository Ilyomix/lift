import { contextAt, milestones, PERIODS } from './program'
import type { ISODate } from './types'

/** Date-only presentation of the existing plan; never changes its periods. */
export function programTimelineAt(today: ISODate) {
  const context = contextAt(today)
  const periods = PERIODS.filter((period) => period.kind !== 'pre')
  return {
    context,
    current: context.period?.kind === 'pre' ? null : context.period,
    upcoming: periods.filter((period) => period.start > today),
    past: periods.filter((period) => period.end < today),
  }
}

/** The calendar highlights changes to prepare for, not the full block sequence. */
export function calendarMilestonesAt(today: ISODate) {
  return milestones(today).filter((milestone) => milestone.kind !== 'block').slice(0, 3)
}
