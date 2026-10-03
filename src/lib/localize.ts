// Stored copies of library texts (exercise names, muscles, program notes, default gym
// names) follow the interface language: they are rewritten when the language changes.
import { L } from './i18n'
import { isGeneratedTarget, localizeComparison, localizeLoadHint } from './trainingMessages'
import { LIBRARY } from './library'
import { nextTargetText, planNote, reentryForGap, TYPE_META } from './program'
import type { AppState, ReentryInfo, Template, TemplateExercise, WorkoutExercise, WorkoutType } from './types'

const DEFAULT_GYM_NAMES: [string, string][] = [
  ['Ma salle', 'My gym'],
  ['Maison', 'Home'],
  ['Nouvelle salle', 'New gym'],
]

/** Default gym names in the current language; names the user typed stay as they are. */
export function localizeGymName(name: string): string {
  const pair = DEFAULT_GYM_NAMES.find(([fr, en]) => name === fr || name === en)
  return pair ? L(pair[0], pair[1]) : name
}

function named<T extends Pick<TemplateExercise, 'exerciseId' | 'name' | 'muscle'>>(e: T): T {
  const info = LIBRARY[e.exerciseId]
  return info ? { ...e, name: info.name, muscle: info.muscle } : e
}

/** Generated targets may be cached in a different language; custom coach targets are preserved. */
function localizeTarget<T extends TemplateExercise>(e: T): T {
  const n = named(e)
  return e.nextTarget && isGeneratedTarget(e.nextTarget) ? { ...n, nextTarget: nextTargetText(e) } : n
}

function localizeLoggedExercise(e: WorkoutExercise): WorkoutExercise {
  const n = localizeTarget(e)
  return {
    ...n,
    comparison: e.comparison ? localizeComparison(e.comparison, e.comparisonContext || e.skipReason) : e.comparison,
    ...(e.hint ? { hint: localizeLoadHint(e) } : {}),
  }
}

export function localizeState(s: AppState): AppState {
  const gym = (s.settings.setup?.place ?? 'gym') === 'gym'
  const templates = {} as Record<WorkoutType, Template>
  for (const [type, t] of Object.entries(s.templates) as [WorkoutType, Template][]) {
    templates[type] = {
      ...t,
      label: TYPE_META[type]?.label ?? t.label,
      exercises: t.exercises.map((e) => {
        const n = localizeTarget(e)
        const note = gym ? planNote(type, e.exerciseId) : undefined
        return note !== undefined ? { ...n, note } : n
      }),
    }
  }
  // The return-after-a-break rule keeps its progress; its label and advice follow the language.
  const relabel = (r: ReentryInfo): ReentryInfo => {
    const fresh = reentryForGap(r.days)
    return fresh ? { ...r, label: fresh.label, advice: fresh.advice } : r
  }
  const reentry = s.reentry ? relabel(s.reentry) : s.reentry
  return {
    ...s,
    reentry,
    templates,
    workouts: s.workouts.map((w) => ({
      ...w,
      exercises: w.exercises.map(localizeLoggedExercise),
      // The changes a session made name the exercise, and a return after a break its rule: both follow the language.
      ...(w.changes ? { changes: w.changes.map((c) => ({ ...c, name: LIBRARY[c.exerciseId]?.name ?? c.name })) } : {}),
      ...(w.reentry ? { reentry: relabel(w.reentry) } : {}),
    })),
    activeWorkout: s.activeWorkout ? { ...s.activeWorkout, exercises: s.activeWorkout.exercises.map(localizeLoggedExercise), ...(s.activeWorkout.reentry ? { reentry: relabel(s.activeWorkout.reentry) } : {}) } : null,
    gyms: s.gyms.map((g) => ({ ...g, name: localizeGymName(g.name) })),
  }
}
