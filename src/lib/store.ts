import { create } from 'zustand'
import { clear, createStore, del, entries, get as idbGet, set as idbSet } from 'idb-keyval'
import { defaultState, makeBackup, normalizeState, upgradeToResearchProgram, type ParsedBackup, type ProgramChange } from './backup'
import { applyPlanUpdate, type PlanUpdate } from './coach'
import { diffDays, isoFromTimestamp, todayISO } from './date'
import { uid } from './format'
import { infoFor, LIBRARY } from './library'
import {
  contextAt, gapSinceLastSession, nextInRotation, nextTargetText, prescribe, reentryForGap,
} from './program'
import { applyProgression, finalizeWorkout, previousPerformance, type FinishResult } from './training'
import type {
  ActiveWorkout, AppState, Backup, BodyEntry, Goals, ISODate, NutritionEntry, NutritionTargets, PauseReason, Photo, Prefs,
  SetFlag, Template, TemplateExercise, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from './types'

const kv = createStore('golgoth', 'kv')
const photoDb = createStore('golgoth-photos', 'photos')

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'good' | 'bad'
}

interface Store {
  ready: boolean
  hasData: boolean
  storage: 'idb' | 'memory'
  state: AppState
  photos: Photo[]
  lastFinish: (FinishResult & { applied: string[] }) | null
  lastImport: { changes: ProgramChange[] } | null
  toast: Toast | null

  init: () => Promise<void>
  update: (fn: (s: AppState) => AppState) => void
  flush: () => Promise<void>
  notify: (message: string, tone?: Toast['tone']) => void

  startFresh: () => void
  importBackup: (parsed: ParsedBackup, opts: { upgrade: boolean }) => Promise<void>
  exportBackup: () => Backup
  resetAll: () => Promise<void>

  startSession: (type?: WorkoutType) => void
  updateSet: (ex: number, set: number, patch: Partial<WorkoutSet>) => void
  completeSet: (ex: number, set: number, fallback: { weight: number | null; reps: number | null }) => void
  addSet: (ex: number) => void
  removeSet: (ex: number, set: number) => void
  toggleFlag: (ex: number, set: number, flag: SetFlag) => void
  skipExercise: (ex: number, skipped: boolean, reason?: string) => void
  replaceExercise: (ex: number, newId: string) => void
  setExerciseField: (ex: number, patch: Partial<Pick<WorkoutExercise, 'notes' | 'comparisonContext'>>) => void
  setSessionField: (patch: Partial<Pick<ActiveWorkout, 'notes' | 'date'>>) => void
  startRest: (seconds: number, label: string, next?: string) => void
  adjustRest: (delta: number) => void
  stopRest: () => void
  finishSession: () => string | null
  discardSession: () => void
  applyProgressions: (items: { exerciseId: string; weight: number; name: string }[]) => void
  deleteWorkout: (id: string) => void

  saveBody: (entry: Omit<BodyEntry, 'id'> & { id?: string }) => void
  deleteBody: (id: string) => void
  setNutrition: (date: ISODate, patch: Partial<NutritionEntry>) => void
  setNutritionTargets: (patch: Partial<NutritionTargets>) => void

  startPause: (p: { reason: PauseReason; plannedEnd: ISODate | null; note?: string }) => void
  endPause: () => void

  setGoals: (patch: Partial<Goals>) => void
  setPrefs: (patch: Partial<Prefs>) => void
  setSchedule: (dow: number, type: WorkoutType | null) => void
  editTemplateExercise: (type: WorkoutType, index: number, patch: Partial<TemplateExercise>) => void
  addTemplateExercise: (type: WorkoutType, exerciseId: string) => void
  removeTemplateExercise: (type: WorkoutType, index: number) => void
  moveTemplateExercise: (type: WorkoutType, index: number, dir: -1 | 1) => void
  setExerciseVideo: (exerciseId: string, url: string) => void
  applyPlan: (u: PlanUpdate) => void

  addPhoto: (p: Photo) => Promise<void>
  deletePhoto: (id: string) => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let toastSeq = 0

function withActive(s: AppState, fn: (a: ActiveWorkout) => ActiveWorkout): AppState {
  return s.activeWorkout ? { ...s, activeWorkout: fn(s.activeWorkout) } : s
}

function mapExercise(a: ActiveWorkout, i: number, fn: (e: WorkoutExercise) => WorkoutExercise): ActiveWorkout {
  return { ...a, exercises: a.exercises.map((e, j) => (j === i ? fn(e) : e)) }
}

function mapSet(e: WorkoutExercise, i: number, fn: (s: WorkoutSet) => WorkoutSet): WorkoutExercise {
  return { ...e, sets: e.sets.map((s, j) => (j === i ? fn(s) : s)) }
}

function emptySet(weight: number | null): WorkoutSet {
  return { weight, reps: null, cleanReps: null, flags: [], note: '', completed: false, rir: null }
}

function buildExercise(t: TemplateExercise, date: ISODate, state: AppState): WorkoutExercise {
  const p = prescribe(t, date, state.reentry)
  const prev = previousPerformance(state.workouts, t.exerciseId)?.exercise
  const lastWeight = prev?.sets.filter((s) => s.completed).map((s) => s.weight).find((w) => typeof w === 'number') ?? null
  const weight = t.unit === 'PDC' ? null : (p.weight ?? lastWeight ?? null)
  return {
    ...t,
    target: { ...t.target },
    prescription: p,
    sets: Array.from({ length: p.sets }, () => emptySet(weight)),
    notes: '',
    skipped: false,
    validated: false,
    comparison: null,
  }
}

function applyTheme(theme: Prefs['theme']) {
  try {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('golgoth-theme', theme)
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
}

export const useStore = create<Store>((set, get) => ({
  ready: false,
  hasData: false,
  storage: 'idb',
  state: defaultState(),
  photos: [],
  lastFinish: null,
  lastImport: null,
  toast: null,

  init: async () => {
    try {
      const raw = await idbGet('state', kv)
      const photos = (await entries<string, Photo>(photoDb)).map(([, v]) => v).sort((a, b) => (a.date < b.date ? -1 : 1))
      if (raw) {
        const state = normalizeState(raw)
        applyTheme(state.prefs.theme)
        set({ ready: true, hasData: true, state, photos, storage: 'idb' })
      } else {
        set({ ready: true, hasData: false, storage: 'idb' })
      }
      navigator.storage?.persist?.().catch(() => undefined)
    } catch {
      set({ ready: true, hasData: false, storage: 'memory' })
    }
  },

  update: (fn) => {
    set((st) => ({ state: fn(st.state) }))
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void get().flush(), 150)
  },

  flush: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (get().storage !== 'idb' || !get().hasData) return
    try {
      await idbSet('state', get().state, kv)
    } catch {
      set({ storage: 'memory' })
      get().notify('Stockage indisponible : les données ne sont gardées que pendant cette session.', 'bad')
    }
  },

  notify: (message, tone = 'default') => set({ toast: { id: ++toastSeq, message, tone } }),

  startFresh: () => {
    set({ hasData: true, state: defaultState() })
    void get().flush()
  },

  importBackup: async (parsed, { upgrade }) => {
    let state: AppState = { ...parsed.state, meta: { ...parsed.state.meta, importedAt: new Date().toISOString() } }
    let changes: ProgramChange[] = []
    if (upgrade && parsed.legacy) ({ state, changes } = upgradeToResearchProgram(state))
    try {
      await clear(photoDb)
      for (const p of parsed.photos) await idbSet(p.id, p, photoDb)
    } catch {
      /* photos stay in memory */
    }
    applyTheme(state.prefs.theme)
    set({ hasData: true, state, photos: parsed.photos, lastImport: { changes } })
    await get().flush()
  },

  exportBackup: () => {
    const b = makeBackup(get().state, get().photos)
    get().update((s) => ({ ...s, meta: { ...s.meta, lastBackupAt: b.exportedAt } }))
    return b
  },

  resetAll: async () => {
    try {
      await clear(kv)
      await clear(photoDb)
    } catch {
      /* ignore */
    }
    set({ hasData: false, state: defaultState(), photos: [], lastFinish: null, lastImport: null })
  },

  startSession: (type) => {
    get().update((s) => {
      const today = todayISO()
      const t = type ?? s.nextWorkoutType
      const ctx = contextAt(today)
      const gap = gapSinceLastSession(s, today)
      let reentry = s.reentry
      if (!reentry && gap >= 7) reentry = reentryForGap(gap)
      let programPause = s.programPause
      if (programPause.active && programPause.startedAt) {
        programPause = {
          ...programPause,
          active: false,
          history: [...programPause.history, { startedAt: programPause.startedAt, endedAt: new Date().toISOString(), reason: programPause.reason, note: programPause.note }],
          startedAt: null,
          plannedEnd: null,
          reason: undefined,
          note: undefined,
        }
      }
      const base = { ...s, reentry, programPause }
      const active: ActiveWorkout = {
        id: uid(`workout-${t.toLowerCase()}`),
        type: t,
        date: today,
        startedAt: new Date().toISOString(),
        notes: '',
        timerEndAt: null,
        timer: null,
        exercises: s.templates[t].exercises.map((e) => buildExercise(e, today, base)),
        periodId: ctx.period?.id,
        week: ctx.week || undefined,
        deload: ctx.deload,
        reentry,
      }
      return { ...base, activeWorkout: active }
    })
  },

  updateSet: (ex, i, patch) =>
    get().update((s) =>
      withActive(s, (a) =>
        mapExercise(a, ex, (e) =>
          mapSet(e, i, (st) => {
            const next = { ...st, ...patch }
            if ('reps' in patch && !('cleanReps' in patch)) {
              const reps = patch.reps ?? null
              next.cleanReps = reps === null ? null : st.flags.includes('bad-technique') ? Math.max(0, reps - 1) : reps
            }
            return next
          }),
        ),
      ),
    ),

  completeSet: (ex, i, fallback) => {
    const a = get().state.activeWorkout
    if (!a) return
    const exercise = a.exercises[ex]
    const st = exercise?.sets[i]
    if (!st) return
    if (st.completed) {
      get().updateSet(ex, i, { completed: false })
      return
    }
    const reps = st.reps ?? fallback.reps
    if (!reps || reps <= 0) {
      get().notify('Indique le nombre de répétitions.', 'bad')
      return
    }
    const weight = exercise.unit === 'PDC' ? st.weight : (st.weight ?? fallback.weight)
    const clean = st.cleanReps ?? (st.flags.includes('bad-technique') ? Math.max(0, reps - 1) : reps)
    get().update((s) =>
      withActive(s, (w) => {
        let next = mapExercise(w, ex, (e) => mapSet(e, i, (x) => ({ ...x, reps, weight, cleanReps: Math.min(clean, reps), completed: true })))
        // Carry the load forward to the following empty set.
        next = mapExercise(next, ex, (e) => mapSet(e, i + 1, (x) => (x.completed || x.weight !== null ? x : { ...x, weight })))
        return next
      }),
    )
    const after = get().state.activeWorkout!
    const cur = after.exercises[ex]
    const lastSetOfExercise = i >= cur.sets.length - 1
    if (cur.supersetWithNext && after.exercises[ex + 1]) {
      get().notify(`Enchaîne : ${after.exercises[ex + 1].name}`)
      return
    }
    const rest = cur.prescription?.restSeconds ?? cur.target.restSeconds ?? 120
    const nextEx = lastSetOfExercise ? after.exercises.slice(ex + 1).find((e) => !e.skipped) : cur
    const pairedPrev = ex > 0 && after.exercises[ex - 1].supersetWithNext ? after.exercises[ex - 1] : null
    const label = pairedPrev ? `${pairedPrev.name} + ${cur.name}` : cur.name
    get().startRest(rest, label, nextEx ? (lastSetOfExercise ? nextEx.name : `Série ${i + 2} · ${cur.name}`) : undefined)
  },

  addSet: (ex) =>
    get().update((s) =>
      withActive(s, (a) =>
        mapExercise(a, ex, (e) => {
          const last = e.sets[e.sets.length - 1]
          return { ...e, sets: [...e.sets, emptySet(last?.weight ?? e.prescription?.weight ?? e.target.weight ?? null)] }
        }),
      ),
    ),

  removeSet: (ex, i) => get().update((s) => withActive(s, (a) => mapExercise(a, ex, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== i) })))),

  toggleFlag: (ex, i, flag) =>
    get().update((s) =>
      withActive(s, (a) =>
        mapExercise(a, ex, (e) =>
          mapSet(e, i, (st) => {
            const on = !st.flags.includes(flag)
            const flags = on ? [...st.flags, flag] : st.flags.filter((f) => f !== flag)
            const next = { ...st, flags }
            if (flag === 'bad-technique' && st.reps !== null) next.cleanReps = on ? Math.max(0, st.reps - 1) : st.reps
            if (flag === 'failure' && on) next.rir = 0
            return next
          }),
        ),
      ),
    ),

  skipExercise: (ex, skipped, reason) =>
    get().update((s) => withActive(s, (a) => mapExercise(a, ex, (e) => ({ ...e, skipped, skipReason: skipped ? (reason ?? '') : undefined })))),

  replaceExercise: (ex, newId) =>
    get().update((s) =>
      withActive(s, (a) =>
        mapExercise(a, ex, (e) => {
          const info = infoFor(newId)
          const prev = previousPerformance(s.workouts, newId)?.exercise
          const w = info.unit === 'PDC' ? null : (prev?.sets.find((x) => x.completed && typeof x.weight === 'number')?.weight ?? null)
          return {
            ...e,
            exerciseId: newId,
            name: info.name,
            muscle: info.muscle,
            unit: info.unit,
            role: info.role,
            bodyweight: info.unit === 'PDC' || undefined,
            technique: undefined,
            target: { ...e.target, weight: w },
            prescription: e.prescription ? { ...e.prescription, weight: w } : undefined,
            sets: e.sets.map((x) => (x.completed ? x : { ...x, weight: w })),
            replacement: e.replacement ?? { fromId: e.exerciseId, fromName: e.name },
          }
        }),
      ),
    ),

  setExerciseField: (ex, patch) => get().update((s) => withActive(s, (a) => mapExercise(a, ex, (e) => ({ ...e, ...patch })))),

  setSessionField: (patch) => get().update((s) => withActive(s, (a) => ({ ...a, ...patch }))),

  startRest: (seconds, label, next) =>
    get().update((s) =>
      withActive(s, (a) => ({ ...a, timer: { endAt: Date.now() + seconds * 1000, total: seconds, label, next }, timerEndAt: new Date(Date.now() + seconds * 1000).toISOString() })),
    ),

  adjustRest: (delta) =>
    get().update((s) =>
      withActive(s, (a) => {
        if (!a.timer) return a
        const endAt = Math.max(Date.now() + 1000, a.timer.endAt + delta * 1000)
        return { ...a, timer: { ...a.timer, endAt, total: Math.max(a.timer.total + delta, 5) }, timerEndAt: new Date(endAt).toISOString() }
      }),
    ),

  stopRest: () => get().update((s) => withActive(s, (a) => ({ ...a, timer: null, timerEndAt: null }))),

  finishSession: () => {
    const s = get().state
    const a = s.activeWorkout
    if (!a) return null
    const sessionNumber = Math.max(0, ...s.workouts.map((w) => w.sessionNumber)) + 1
    const workout: Workout = {
      id: a.id,
      sessionNumber,
      type: a.type,
      date: a.date,
      startedAt: a.startedAt,
      completedAt: new Date().toISOString(),
      notes: a.notes,
      exercises: a.exercises,
      periodId: a.periodId,
      week: a.week,
      deload: a.deload,
    }
    const result = finalizeWorkout(s.workouts, workout)
    const workouts = [...s.workouts, result.workout].sort((x, y) => (x.date === y.date ? x.sessionNumber - y.sessionNumber : x.date < y.date ? -1 : 1))
    const reentry = s.reentry ? (s.reentry.sessionsLeft > 1 ? { ...s.reentry, sessionsLeft: s.reentry.sessionsLeft - 1 } : null) : null
    get().update(() => ({
      ...s,
      workouts,
      completedSessions: workouts.length,
      nextWorkoutType: nextInRotation(a.type),
      lastCompletedWorkoutId: workout.id,
      activeWorkout: null,
      reentry,
    }))
    set({ lastFinish: { ...result, applied: [] } })
    return workout.id
  },

  discardSession: () => get().update((s) => ({ ...s, activeWorkout: null })),

  applyProgressions: (items) => {
    if (!items.length) return
    get().update((s) => {
      let templates = s.templates
      for (const it of items) templates = applyProgression(templates, it.exerciseId, it.weight)
      return {
        ...s,
        templates,
        appliedPlanUpdates: [
          ...s.appliedPlanUpdates,
          {
            updateId: `progression-${Date.now()}`,
            basedOnSession: s.workouts.length,
            summary: `Double progression : ${items.map((i) => i.name).join(', ')}.`,
            appliedAt: new Date().toISOString(),
            changeCount: items.length,
            source: 'progression',
          },
        ],
      }
    })
    const lf = get().lastFinish
    if (lf) set({ lastFinish: { ...lf, applied: [...lf.applied, ...items.map((i) => i.exerciseId)] } })
  },

  deleteWorkout: (id) =>
    get().update((s) => {
      const workouts = s.workouts.filter((w) => w.id !== id)
      return { ...s, workouts, completedSessions: workouts.length }
    }),

  saveBody: (entry) =>
    get().update((s) => {
      const existing = s.bodyEntries.find((b) => (entry.id ? b.id === entry.id : b.date === entry.date))
      const merged: BodyEntry = existing
        ? {
            ...existing,
            ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== null && v !== undefined)),
          }
        : { id: entry.id ?? uid('body'), ...entry }
      const bodyEntries = [...s.bodyEntries.filter((b) => b.id !== merged.id), merged].sort((a, b) => (a.date < b.date ? -1 : 1))
      return { ...s, bodyEntries }
    }),

  deleteBody: (id) => get().update((s) => ({ ...s, bodyEntries: s.bodyEntries.filter((b) => b.id !== id) })),

  setNutrition: (date, patch) =>
    get().update((s) => {
      const cur = s.nutritionEntries[date] ?? { date, calories: 0, protein: 0, creatine: 0 }
      return { ...s, nutritionEntries: { ...s.nutritionEntries, [date]: { ...cur, ...patch, date } } }
    }),

  setNutritionTargets: (patch) => get().update((s) => ({ ...s, nutritionTargets: { ...s.nutritionTargets, ...patch } })),

  startPause: ({ reason, plannedEnd, note }) =>
    get().update((s) => ({ ...s, programPause: { ...s.programPause, active: true, startedAt: new Date().toISOString(), reason, plannedEnd, note } })),

  endPause: () =>
    get().update((s) => {
      const p = s.programPause
      if (!p.active || !p.startedAt) return s
      const days = diffDays(isoFromTimestamp(p.startedAt), todayISO())
      const gap = Math.max(days, gapSinceLastSession(s))
      return {
        ...s,
        reentry: s.reentry ?? reentryForGap(gap),
        programPause: {
          ...p,
          active: false,
          startedAt: null,
          plannedEnd: null,
          reason: undefined,
          note: undefined,
          history: [...p.history, { startedAt: p.startedAt, endedAt: new Date().toISOString(), reason: p.reason, note: p.note }],
        },
      }
    }),

  setGoals: (patch) => get().update((s) => ({ ...s, goals: { ...s.goals, ...patch } })),

  setPrefs: (patch) => {
    get().update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
    if (patch.theme) applyTheme(patch.theme)
  },

  setSchedule: (dow, type) => get().update((s) => ({ ...s, schedule: { ...s.schedule, [dow]: type } })),

  editTemplateExercise: (type, index, patch) =>
    get().update((s) => {
      const tpl = s.templates[type]
      const exercises = tpl.exercises.map((e, i) => {
        if (i !== index) return e
        const next = { ...e, ...patch, target: { ...e.target, ...(patch.target ?? {}) } }
        return { ...next, nextTarget: patch.nextTarget ?? nextTargetText(next) }
      })
      return { ...s, templates: { ...s.templates, [type]: { ...tpl, exercises } } }
    }),

  addTemplateExercise: (type, exerciseId) =>
    get().update((s) => {
      const info = LIBRARY[exerciseId] ?? infoFor(exerciseId)
      const tpl: Template = s.templates[type]
      const ex: TemplateExercise = {
        exerciseId,
        name: info.name,
        muscle: info.muscle,
        unit: info.unit,
        role: info.role,
        target: { weight: null, sets: 3, minReps: info.role === 'compound' ? 8 : 10, maxReps: info.role === 'compound' ? 12 : 15, restSeconds: info.role === 'compound' ? 120 : 90, rir: info.role === 'compound' ? '1–2' : '0–1' },
      }
      ex.nextTarget = nextTargetText(ex)
      return { ...s, templates: { ...s.templates, [type]: { ...tpl, exercises: [...tpl.exercises, ex] } } }
    }),

  removeTemplateExercise: (type, index) =>
    get().update((s) => {
      const tpl = s.templates[type]
      return { ...s, templates: { ...s.templates, [type]: { ...tpl, exercises: tpl.exercises.filter((_, i) => i !== index) } } }
    }),

  moveTemplateExercise: (type, index, dir) =>
    get().update((s) => {
      const tpl = s.templates[type]
      const j = index + dir
      if (j < 0 || j >= tpl.exercises.length) return s
      const exercises = [...tpl.exercises]
      ;[exercises[index], exercises[j]] = [exercises[j], exercises[index]]
      return { ...s, templates: { ...s.templates, [type]: { ...tpl, exercises } } }
    }),

  setExerciseVideo: (exerciseId, url) =>
    get().update((s) => {
      const exerciseVideos = { ...s.exerciseVideos }
      if (url.trim()) exerciseVideos[exerciseId] = url.trim()
      else delete exerciseVideos[exerciseId]
      return { ...s, exerciseVideos }
    }),

  applyPlan: (u) => get().update((s) => applyPlanUpdate(s, u)),

  addPhoto: async (p) => {
    set((st) => ({ photos: [...st.photos, p].sort((a, b) => (a.date < b.date ? -1 : 1)) }))
    try {
      await idbSet(p.id, p, photoDb)
    } catch {
      get().notify('Photo gardée pour cette session seulement : stockage indisponible.', 'bad')
    }
  },

  deletePhoto: async (id) => {
    set((st) => ({ photos: st.photos.filter((p) => p.id !== id) }))
    try {
      await del(id, photoDb)
    } catch {
      /* ignore */
    }
  },
}))

export const useAppState = <T,>(selector: (s: AppState) => T): T => useStore((st) => selector(st.state))
