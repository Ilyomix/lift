// Stored copies of library texts (exercise names, muscles, program notes, default gym
// names) follow the interface language: they are rewritten when the language changes.
import { L } from './i18n'
import { LIBRARY } from './library'
import { planNote, reentryForGap, TYPE_META } from './program'
import type { AppState, ReentryInfo, Template, TemplateExercise, WorkoutType } from './types'

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

export function localizeState(s: AppState): AppState {
  const gym = (s.settings.setup?.place ?? 'gym') === 'gym'
  const templates = {} as Record<WorkoutType, Template>
  for (const [type, t] of Object.entries(s.templates) as [WorkoutType, Template][]) {
    templates[type] = {
      ...t,
      label: TYPE_META[type]?.label ?? t.label,
      exercises: t.exercises.map((e) => {
        const n = named(e)
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
      exercises: w.exercises.map(named),
      // The changes a session made name the exercise, and a return after a break its rule: both follow the language.
      ...(w.changes ? { changes: w.changes.map((c) => ({ ...c, name: LIBRARY[c.exerciseId]?.name ?? c.name })) } : {}),
      ...(w.reentry ? { reentry: relabel(w.reentry) } : {}),
    })),
    activeWorkout: s.activeWorkout ? { ...s.activeWorkout, exercises: s.activeWorkout.exercises.map(named), ...(s.activeWorkout.reentry ? { reentry: relabel(s.activeWorkout.reentry) } : {}) } : null,
    gyms: s.gyms.map((g) => ({ ...g, name: localizeGymName(g.name) })),
  }
}
