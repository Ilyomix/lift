import type { ActiveWorkout, Prefs } from '../types'
import { currentExerciseIndex } from '../activeExercise'

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
  theme: 'light' | 'dark'
  accent: Prefs['accent']
}

export function workoutActivityState(a: ActiveWorkout | null, lang: 'fr' | 'en', now = Date.now(), appearance: Partial<Pick<Prefs, 'theme' | 'accent'>> & { systemDark?: boolean } = {}): WorkoutActivityState | null {
  if (!a || a.reopened) return null
  const exercises = a.exercises.filter(e => !e.skipped)
  const exercise = a.exercises[currentExerciseIndex(a)]
  const i = exercise?.sets.findIndex(s => !s.completed) ?? -1
  const prescription = exercise?.prescription ?? exercise?.target
  const weight = i >= 0 ? (exercise!.unit === 'PDC' ? exercise!.sets[i].weight : (exercise!.sets[i].weight ?? prescription?.weight)) : null
  const displayWeight = weight == null ? '' : new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(weight)
  const completedSets = exercises.reduce((n, e) => n + e.sets.filter(s => s.completed).length, 0)
  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0)
  const detail = exercise && prescription ? [
    exercise.unit === 'PDC' ? (weight ? `${lang === 'fr' ? 'PDC' : 'BW'} + ${displayWeight} kg` : (lang === 'fr' ? 'PDC' : 'BW')) : weight == null ? '' : `${displayWeight} ${exercise.unit === 'kg/main' ? (lang === 'fr' ? 'kg/main' : 'kg/hand') : exercise.unit}`,
    `${prescription.minReps}–${prescription.maxReps} ${lang === 'fr' ? 'rép.' : 'reps'}`,
    prescription.rir ? (lang === 'fr' ? `réserve ${prescription.rir}` : `${prescription.rir} in reserve`) : '',
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
    readyLabel: lang === 'fr' ? 'Prêt' : 'Ready',
    progressLabel: lang === 'fr' ? (totalSets === 1 ? 'série' : 'séries') : (totalSets === 1 ? 'set' : 'sets'),
    // WidgetKit's colorScheme can follow the wallpaper. Send the app's actual mode.
    theme: appearance.theme === 'dark' || (appearance.theme !== 'light' && appearance.systemDark) ? 'dark' : 'light',
    accent: appearance.accent ?? 'orange',
  }
}
