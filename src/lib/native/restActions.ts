import type { ActiveWorkout } from '../types'

/** Absolute result of an iOS action. Applying it twice must never add time twice. */
export interface NativeRestAction {
  id: string
  workoutId: string
  expectedRestEndAt: number
  restEndAt: number | null
  restTotal: number
  action: 'add30' | 'skip'
}

export function applyNativeRestAction(workout: ActiveWorkout | null, action: NativeRestAction): ActiveWorkout | null {
  if (!workout || workout.reopened || workout.id !== action.workoutId || !workout.timer) return workout
  if (!Number.isFinite(action.expectedRestEndAt) || !Number.isFinite(action.restTotal) || action.restTotal < 0) return workout
  if (action.restEndAt !== null && (!Number.isFinite(action.restEndAt) || action.restEndAt <= 0)) return workout
  if (workout.timer.endAt === action.restEndAt) return workout
  // An old lock-screen action must not modify a newly started rest.
  if (workout.timer.endAt !== action.expectedRestEndAt) return workout
  if (action.action === 'skip' && action.restEndAt === null) return { ...workout, timer: null, timerEndAt: null }
  if (action.action !== 'add30' || action.restEndAt === null) return workout
  return { ...workout, timer: { ...workout.timer, endAt: action.restEndAt, total: action.restTotal }, timerEndAt: new Date(action.restEndAt).toISOString() }
}

export function matchesRestNotification(workout: ActiveWorkout | null, extra: unknown): boolean {
  if (!extra || typeof extra !== 'object' || !workout || workout.reopened || !workout.timer) return false
  const value = extra as Record<string, unknown>
  return value.workoutId === workout.id && typeof value.restEndAt === 'number' && value.restEndAt === workout.timer.endAt
}
