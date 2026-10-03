import { gymOf, HOME_GYM, isGymBound } from './gyms'
import { LIBRARY } from './library'
import { nextTargetText, takesLest } from './program'
import { previousPerformance } from './training'
import { WORKOUT_TYPES, type AppState, type ReplacementScope, type SessionReplacement, type TemplateExercise, type WorkoutType } from './types'

export type ReplacementResult = { state: AppState; reason?: 'invalid' | 'duplicate' | 'completed' | 'conflict' | 'reopened' }
const validId = (id: string) => Object.hasOwn(LIBRARY, id)
export const validReplacementSlot = (state: AppState, type: WorkoutType, index: number) =>
  WORKOUT_TYPES.includes(type) && Number.isInteger(index) && index >= 0 && !!state.templates[type]?.exercises[index]

/** Rebuild movement-specific fields; only the slot's training dose and pairing survive. */
export function replacementTemplate(state: AppState, original: TemplateExercise, id: string, gymId = state.gymId): TemplateExercise {
  const info = LIBRARY[id]
  const workouts = state.workouts.filter(workout => gymOf(workout) === gymId)
    .map(workout => ({ ...workout, exercises: workout.exercises.filter(ex => ex.unit === info.unit) }))
  const previous = previousPerformance(workouts, id, undefined, gymId, original.target)?.exercise
  const weight = info.unit === 'PDC' && !takesLest({ exerciseId: id, unit: info.unit }) ? null
    : previous?.sets.find(set => set.completed && typeof set.weight === 'number' && Number.isFinite(set.weight))?.weight ?? null
  const bound = isGymBound({ exerciseId: id, unit: info.unit })
  const next: TemplateExercise = {
    exerciseId: id, name: info.name, muscle: info.muscle, unit: info.unit, role: info.role,
    ...(info.unit === 'PDC' ? { bodyweight: true } : {}),
    ...(original.supersetWithNext ? { supersetWithNext: true } : {}),
    ...(original.volumeTag ? { volumeTag: original.volumeTag } : {}),
    ...(original.focus ? { focus: true } : {}),
    target: { ...original.target, weight: bound && gymId !== HOME_GYM ? null : weight },
    ...(bound && gymId !== HOME_GYM ? { gymLoads: { [gymId]: weight } } : {}),
  }
  next.nextTarget = nextTargetText(next)
  return next
}

/** Drop corrupt, stale, repeated and duplicate-exercise choices without trusting backup keys. */
export function normalizeSessionReplacements(raw: unknown, templates: AppState['templates']): AppState['sessionReplacements'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const result: NonNullable<AppState['sessionReplacements']> = {}
  for (const type of WORKOUT_TYPES) {
    const entries = (raw as Record<string, unknown>)[type]
    if (!Array.isArray(entries)) continue
    const effective = templates[type].exercises.map(ex => ex.exerciseId)
    const accepted: SessionReplacement[] = []
    for (const item of entries) {
      if (!item || typeof item !== 'object') continue
      const { index, fromId, exerciseId } = item as Partial<SessionReplacement>
      if (!Number.isInteger(index) || typeof index !== 'number' || index < 0 ||
          typeof fromId !== 'string' || typeof exerciseId !== 'string' || !validId(exerciseId) ||
          templates[type].exercises[index]?.exerciseId !== fromId || exerciseId === fromId ||
          accepted.some(entry => entry.index === index) || effective.some((id, i) => i !== index && id === exerciseId)) continue
      accepted.push({ index, fromId, exerciseId }); effective[index] = exerciseId
    }
    if (accepted.length) result[type] = accepted
  }
  return Object.keys(result).length ? result : undefined
}

export function sessionExercises(state: AppState, type: WorkoutType): TemplateExercise[] {
  const exercises = state.templates[type]?.exercises ?? []
  const drafts = normalizeSessionReplacements(state.sessionReplacements, state.templates)?.[type]
  if (!drafts?.length) return exercises
  return exercises.map((exercise, index) => {
    const choice = drafts.find(item => item.index === index)
    return choice ? replacementTemplate(state, exercise, choice.exerciseId) : exercise
  })
}

export function clearSessionReplacement(state: AppState, type: WorkoutType, index?: number): AppState {
  if (!state.sessionReplacements?.[type]) return state
  const next = { ...state.sessionReplacements }
  const kept = index === undefined ? [] : next[type]!.filter(item => item.index !== index)
  if (kept.length) next[type] = kept
  else delete next[type]
  return { ...state, sessionReplacements: Object.keys(next).length ? next : undefined }
}

/** Durable choices affect future sessions only. An active workout is a historical snapshot. */
export function replaceTemplate(state: AppState, type: WorkoutType, index: number, id: string): ReplacementResult {
  if (!validReplacementSlot(state, type, index) || !validId(id)) return { state, reason: 'invalid' }
  const template = state.templates[type], original = template.exercises[index]
  if (template.exercises.some((ex, i) => i !== index && ex.exerciseId === id) ||
      sessionExercises(state, type).some((ex, i) => i !== index && ex.exerciseId === id)) return { state, reason: 'duplicate' }
  if (id === original.exerciseId) return { state: clearSessionReplacement(state, type, index) }
  const next = clearSessionReplacement(state, type, index)
  const exercises = template.exercises.map((ex, i) => i === index ? replacementTemplate(state, ex, id) : ex)
  return { state: { ...next, templates: { ...next.templates, [type]: { ...template, exercises } } } }
}

export function replacePlanned(state: AppState, type: WorkoutType, index: number, id: string, scope: ReplacementScope): ReplacementResult {
  if (scope === 'program') return replaceTemplate(state, type, index, id)
  if (scope !== 'session' || !validReplacementSlot(state, type, index) || !validId(id)) return { state, reason: 'invalid' }
  const exercises = sessionExercises(state, type)
  if (exercises[index].exerciseId === id) return { state }
  if (exercises.some((ex, i) => i !== index && ex.exerciseId === id)) return { state, reason: 'duplicate' }
  const next = clearSessionReplacement(state, type, index)
  const fromId = state.templates[type].exercises[index].exerciseId
  if (id === fromId) return { state: next }
  return { state: { ...next, sessionReplacements: { ...next.sessionReplacements,
    [type]: [...(next.sessionReplacements?.[type] ?? []), { index, fromId, exerciseId: id }],
  } } }
}
