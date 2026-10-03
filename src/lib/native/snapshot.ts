import type { ActiveWorkout } from '../types'

/** Flat, versioned contract shared by ActivityKit and the Android service. Epochs are milliseconds. */
export interface WorkoutActivityState {
  version: 1
  workoutId: string
  workoutType: string
  exercise: string
  setLabel: string
  detail: string
  completedSets: number
  totalSets: number
  restEndAt: number | null
  restTotal: number
  expiresAt: number
  restLabel: string
  readyLabel: string
  progressLabel: string
}

export function workoutActivityState(a: ActiveWorkout | null, lang: 'fr' | 'en', now = Date.now()): WorkoutActivityState | null {
  if (!a || a.reopened) return null
  const exercises = a.exercises.filter(e => !e.skipped)
  // A rest may follow a set entered out of order: prefer the store's explicit next exercise.
  const next = a.timer?.next?.replace(/^(?:Série|Set) \d+(?:\/\d+)? · /, '')
  const exercise = exercises.find(e => e.name === next && e.sets.some(s => !s.completed))
    ?? exercises.find(e => e.sets.some(s => !s.completed))
  const i = exercise?.sets.findIndex(s => !s.completed) ?? -1
  const prescription = exercise?.prescription ?? exercise?.target
  const weight = i >= 0 ? (exercise!.sets[i].weight ?? prescription?.weight) : null
  const displayWeight = weight == null ? '' : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(weight)
  const completedSets = exercises.reduce((n, e) => n + e.sets.filter(s => s.completed).length, 0)
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0)
  const detail = exercise && prescription ? [
    exercise.unit === 'PDC' ? (weight ? `${lang === 'fr' ? 'PDC' : 'BW'} + ${displayWeight} kg` : (lang === 'fr' ? 'PDC' : 'BW')) : weight == null ? '' : `${displayWeight} ${exercise.unit === 'kg/main' ? (lang === 'fr' ? 'kg/main' : 'kg/hand') : exercise.unit}`,
    `${prescription.minReps}–${prescription.maxReps} reps`,
    prescription.rir ? `RIR ${prescription.rir}` : '',
  ].filter(Boolean).join(' · ') : ''
  const restEndAt = a.timer && Number.isFinite(a.timer.endAt) ? a.timer.endAt : null
  return {
    version: 1, workoutId: a.id, workoutType: a.type,
    exercise: exercise?.name ?? (lang === 'fr' ? 'Séance terminée' : 'Workout complete'),
    setLabel: i >= 0 ? `${lang === 'fr' ? 'Série' : 'Set'} ${i + 1}/${exercise!.sets.length}` : `${completedSets}/${totalSets}`,
    detail, completedSets, totalSets, restEndAt,
    restTotal: a.timer?.total ?? 0,
    // A dismissed/abandoned session must not leave an endless native service.
    expiresAt: now + 8 * 60 * 60 * 1000,
    restLabel: lang === 'fr' ? 'Repos' : 'Rest',
    readyLabel: lang === 'fr' ? 'À toi' : 'Go',
    progressLabel: lang === 'fr' ? 'séries' : 'sets',
  }
}
