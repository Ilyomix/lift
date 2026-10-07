import { chronological } from './comparability'
import { isGymBound, gymOf } from './gyms'
import { dropAlert, finalizeWorkout } from './training'
import type { AppState, Template, Workout, WorkoutType } from './types'

export const TRAINING_REVISION = 3
const automaticReasons = new Set(['nette baisse 2 séances de suite', 'clear drop 2 sessions in a row', 'baisse 2 séances de suite', 'down 2 sessions in a row'])

/**
 * Repair derived diagnostics once. Raw sets, dates, notes, photos and load targets are untouched.
 * Remove only legacy automatic volume reductions unsupported by the corrected comparisons.
 * The caller configures the user's calendar before calling this function.
 */
export function upgradeTrainingDiagnostics(state: AppState): AppState {
  if (state.progressRevision >= TRAINING_REVISION) return state
  const history: Workout[] = []
  for (const w of chronological(state.workouts)) {
    const result = finalizeWorkout(history, w)
    history.push({ ...w, exercises: w.exercises.map((ex, i) => ({ ...ex, comparison: result.workout.exercises[i].comparison })) })
  }
  const supported = (date: string, exerciseId: string, type: WorkoutType) => {
    const w = history.find((x) => x.date === date && x.type === type && x.exercises.some((e) => e.exerciseId === exerciseId))
    const ex = w?.exercises.find((e) => e.exerciseId === exerciseId)
    if (!w || !ex) return false
    const past = history.filter((x) => x.date < w.date || (x.date === w.date && x.sessionNumber <= w.sessionNumber))
    return !!dropAlert(past, exerciseId, isGymBound(ex) ? gymOf(w) : undefined, ex.prescription ?? ex.target)
  }
  const templates = { ...state.templates }
  for (const [type, template] of Object.entries(templates) as [WorkoutType, Template][]) {
    templates[type] = { ...template, exercises: template.exercises.map((ex) => {
      const adjust = ex.autoAdjust
      if (!adjust || adjust.sets !== -1 || !automaticReasons.has(adjust.reason) || supported(adjust.since, ex.exerciseId, type)) return ex
      const { autoAdjust: _removed, ...kept } = ex
      return kept
    }) }
  }
  const byId = new Map(history.map((w) => [w.id, w]))
  return {
    ...state, templates, progressRevision: TRAINING_REVISION,
    // Preserve the user's stored order, even when imports were out of order.
    workouts: state.workouts.map((w) => {
      const graded = byId.get(w.id)!
      return w.changes ? { ...graded, changes: w.changes.filter((c) => c.kind !== 'sets' || supported(c.date, c.exerciseId, c.type)) } : graded
    }),
  }
}
