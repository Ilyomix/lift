import { create } from 'zustand'
import { clear, createStore, del, entries, get as idbGet, set as idbSet } from 'idb-keyval'
import { defaultState, makeBackup, normalizeState, upgradeToResearchProgram, type ParsedBackup, type ProgramChange } from './backup'
import { applyPlanUpdate, type PlanUpdate } from './coach'
import { addDays, diffDays, isoFromTimestamp, todayISO } from './date'
import { fmtLoad, roundTo, uid } from './format'
import { HOME_GYM, isGymBound, loadAt, loadElsewhere, newGymId } from './gyms'
import { infoFor, LIBRARY } from './library'
import {
  configurePlan, contextAt, DEFAULT_GOAL, gapSinceLastSession, incrementFor, isValidGoal, nextInRotation, nextTargetText, prescribe,
  reentryForGap, ROTATION,
} from './program'
import { cancelRestPush, scheduleRestPush } from './push'
import { applyChange, finalizeWorkout, intraSessionAdjust, previousPerformance, type AutoChange, type FinishResult } from './training'
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
  action?: { label: string; run: () => void }
}

export interface LastFinish extends FinishResult {
  /** Ids of the automatic changes currently applied (the others were undone, or wait for a tap). */
  applied: string[]
}

interface Store {
  ready: boolean
  hasData: boolean
  storage: 'idb' | 'memory'
  state: AppState
  photos: Photo[]
  lastFinish: LastFinish | null
  lastImport: { changes: ProgramChange[] } | null
  toast: Toast | null

  init: () => Promise<void>
  update: (fn: (s: AppState) => AppState) => void
  flush: () => Promise<void>
  notify: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void

  startFresh: () => void
  importBackup: (parsed: ParsedBackup, opts: { upgrade: boolean }) => Promise<void>
  exportBackup: () => Backup
  resetAll: () => Promise<void>

  startSession: (type?: WorkoutType) => void
  updateSet: (ex: number, set: number, patch: Partial<WorkoutSet>) => void
  completeSet: (ex: number, set: number, fallback: { weight: number | null; reps: number | null }) => void
  undoHint: (ex: number) => void
  addSet: (ex: number) => void
  removeSet: (ex: number, set: number) => void
  toggleFlag: (ex: number, set: number, flag: SetFlag) => void
  skipExercise: (ex: number, skipped: boolean, reason?: string) => void
  replaceExercise: (ex: number, newId: string) => void
  setExerciseField: (ex: number, patch: Partial<Pick<WorkoutExercise, 'notes' | 'comparisonContext'>>) => void
  setSessionField: (patch: Partial<Pick<ActiveWorkout, 'notes' | 'date'>>) => void
  setSessionGym: (gymId: string) => void
  startRest: (seconds: number, label: string, next?: string) => void
  adjustRest: (delta: number) => void
  stopRest: () => void
  finishSession: () => string | null
  discardSession: () => void
  applyChanges: (ids: string[]) => void
  revertChange: (id: string) => void
  bringDeloadForward: () => void
  cancelEarlyDeload: () => void
  deleteWorkout: (id: string) => void

  saveBody: (entry: Omit<BodyEntry, 'id'> & { id?: string }) => void
  deleteBody: (id: string) => void
  setNutrition: (date: ISODate, patch: Partial<NutritionEntry>) => void
  setNutritionTargets: (patch: Partial<NutritionTargets>) => void

  startPause: (p: { reason: PauseReason; plannedEnd: ISODate | null; note?: string }) => void
  endPause: () => void

  setGoalDate: (goal: ISODate) => void
  setGoals: (patch: Partial<Goals>) => void
  setPrefs: (patch: Partial<Prefs>) => void
  setSchedule: (dow: number, type: WorkoutType | null) => void
  toggleTrainingDay: (dow: number) => void
  addGym: (name: string) => string
  renameGym: (id: string, name: string) => void
  removeGym: (id: string) => void
  selectGym: (id: string) => void
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

/** Starting load of an exercise at a gym, with the deload / re-entry factor. */
function startingLoad(t: TemplateExercise, gymId: string, state: AppState, loadFactor: number): { weight: number | null; trial: WorkoutExercise['gymTrial'] } {
  if (t.unit === 'PDC') return { weight: null, trial: undefined }
  const here = loadAt(t, gymId)
  const scale = (w: number) => {
    const inc = incrementFor(t)
    return loadFactor < 1 && inc > 0 ? Math.max(inc, roundTo(w * loadFactor, inc)) : w
  }
  if (here !== null) return { weight: scale(here), trial: undefined }
  const bound = isGymBound(t)
  const elsewhere = bound ? loadElsewhere(t, gymId, state.gyms) : null
  if (elsewhere) return { weight: scale(elsewhere.weight), trial: { fromGym: elsewhere.gym.name, weight: elsewhere.weight } }
  const prev = previousPerformance(state.workouts, t.exerciseId, undefined, bound ? gymId : undefined)?.exercise
  const last = prev?.sets.filter((s) => s.completed).map((s) => s.weight).find((w) => typeof w === 'number') ?? null
  return { weight: last, trial: undefined }
}

function buildExercise(t: TemplateExercise, date: ISODate, state: AppState, gymId: string): WorkoutExercise {
  const p = prescribe(t, date, state.reentry, gymId)
  const start = startingLoad(t, gymId, state, p.loadFactor)
  return {
    ...t,
    target: { ...t.target, weight: t.unit === 'PDC' ? null : loadAt(t, gymId) },
    prescription: { ...p, weight: p.weight ?? start.weight },
    sets: Array.from({ length: p.sets }, () => emptySet(start.weight)),
    notes: '',
    skipped: false,
    validated: false,
    comparison: null,
    gymTrial: start.trial,
  }
}

const THEME_COLORS = { dark: '#060A13', light: '#F9FAFD' }

function applyTheme(theme: Prefs['theme'], accent: Prefs['accent']) {
  try {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-accent', accent)
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
    localStorage.setItem('golgoth-theme', theme)
    localStorage.setItem('golgoth-accent', accent)
  } catch {
    /* storage unavailable: theme still applies for this session */
  }
}

/** The plan (periods, deloads) follows the goal date and an early deload stored in the state. */
function syncPlan(s: AppState) {
  configurePlan(s.settings.goalDate, s.manualDeload)
}

/** Types laid on the training days in rotation order, Monday first (display and calendar reminders). */
function scheduleFromDays(days: number[]): Record<number, WorkoutType | null> {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d))
  const out: Record<number, WorkoutType | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  order.forEach((d, i) => (out[d] = ROTATION[i % ROTATION.length]))
  return out
}

function describeChanges(changes: AutoChange[]): string {
  return changes
    .map((c) => (c.kind === 'sets' ? `${c.name} −1 série` : `${c.name} ${c.from !== null ? `${fmtLoad(c.from, 'kg').replace(' kg', '')} → ` : ''}${fmtLoad(c.to, 'kg')}`))
    .join(', ')
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
        syncPlan(state)
        applyTheme(state.prefs.theme, state.prefs.accent)
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
    const next = fn(get().state)
    syncPlan(next)
    set({ state: next })
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

  notify: (message, tone = 'default', action) => set({ toast: { id: ++toastSeq, message, tone, action } }),

  startFresh: () => {
    const state = defaultState()
    syncPlan(state)
    applyTheme(state.prefs.theme, state.prefs.accent)
    set({ hasData: true, state })
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
    syncPlan(state)
    applyTheme(state.prefs.theme, state.prefs.accent)
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
    const state = defaultState()
    syncPlan(state)
    set({ hasData: false, state, photos: [], lastFinish: null, lastImport: null })
  },

  // ───────────────────────── Session ─────────────────────────

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
      const gymId = s.gyms.some((g) => g.id === s.gymId) ? s.gymId : HOME_GYM
      const base = { ...s, reentry, programPause }
      const active: ActiveWorkout = {
        id: uid(`workout-${t.toLowerCase()}`),
        type: t,
        date: today,
        startedAt: new Date().toISOString(),
        notes: '',
        timerEndAt: null,
        timer: null,
        exercises: s.templates[t].exercises.map((e) => buildExercise(e, today, base, gymId)),
        periodId: ctx.period?.id,
        week: ctx.week || undefined,
        deload: ctx.deload,
        reentry,
        gymId,
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
        // Loads follow the set just done: far above the range → heavier, far below → lighter.
        if (s.prefs.autoLoad) {
          const cur = next.exercises[ex]
          const adj = intraSessionAdjust(cur, i)
          if (adj && typeof weight === 'number') {
            const idx = cur.sets.map((x, j) => (j > i && !x.completed && (x.weight === weight || x.weight === null) ? j : -1)).filter((j) => j >= 0)
            if (idx.length) {
              next = mapExercise(next, ex, (e) => ({
                ...e,
                sets: e.sets.map((x, j) => (idx.includes(j) ? { ...x, weight: adj.weight } : x)),
                hint: { text: adj.text, from: weight, to: adj.weight, sets: idx },
              }))
            }
          }
        }
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
    const nextText = nextEx ? (lastSetOfExercise ? nextEx.name : `Série ${i + 2}/${cur.sets.length} · ${cur.name}`) : undefined
    get().startRest(rest, label, nextText)
  },

  undoHint: (ex) =>
    get().update((s) =>
      withActive(s, (a) =>
        mapExercise(a, ex, (e) => {
          const h = e.hint
          if (!h) return e
          const { hint: _h, ...rest } = e
          return { ...rest, sets: e.sets.map((x, j) => (h.sets.includes(j) && !x.completed && x.weight === h.to ? { ...x, weight: h.from } : x)) }
        }),
      ),
    ),

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
          const gym = a.gymId ?? HOME_GYM
          const bound = isGymBound({ exerciseId: newId, unit: info.unit })
          const prev = previousPerformance(s.workouts, newId, undefined, bound ? gym : undefined)?.exercise
          const w = info.unit === 'PDC' ? null : (prev?.sets.find((x) => x.completed && typeof x.weight === 'number')?.weight ?? null)
          const { gymTrial: _t, hint: _h, ...rest } = e
          return {
            ...rest,
            exerciseId: newId,
            name: info.name,
            muscle: info.muscle,
            unit: info.unit,
            role: info.role,
            bodyweight: info.unit === 'PDC' || undefined,
            technique: undefined,
            gymLoads: undefined,
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

  setSessionGym: (gymId) =>
    get().update((s) => {
      if (!s.activeWorkout || !s.gyms.some((g) => g.id === gymId)) return s
      const a = s.activeWorkout
      const tpl = s.templates[a.type]
      const exercises = a.exercises.map((e) => {
        if (!isGymBound(e) || e.replacement) return e
        const t = tpl.exercises.find((x) => x.exerciseId === e.exerciseId)
        if (!t) return e
        const start = startingLoad(t, gymId, s, e.prescription?.loadFactor ?? 1)
        const { gymTrial: _t, hint: _h, ...rest } = e
        return {
          ...rest,
          target: { ...e.target, weight: loadAt(t, gymId) },
          prescription: e.prescription ? { ...e.prescription, weight: start.weight } : undefined,
          sets: e.sets.map((x) => (x.completed ? x : { ...x, weight: start.weight })),
          gymTrial: start.trial,
        }
      })
      return { ...s, gymId, activeWorkout: { ...a, gymId, exercises } }
    }),

  startRest: (seconds, label, next) => {
    const endAt = Date.now() + seconds * 1000
    get().update((s) => withActive(s, (a) => ({ ...a, timer: { endAt, total: seconds, label, next }, timerEndAt: new Date(endAt).toISOString() })))
    if (get().state.prefs.push) scheduleRestPush(endAt, 'Repos terminé', next ? `Ensuite : ${next}` : 'Série suivante.')
  },

  adjustRest: (delta) => {
    get().update((s) =>
      withActive(s, (a) => {
        if (!a.timer) return a
        const endAt = Math.max(Date.now() + 1000, a.timer.endAt + delta * 1000)
        return { ...a, timer: { ...a.timer, endAt, total: Math.max(a.timer.total + delta, 5) }, timerEndAt: new Date(endAt).toISOString() }
      }),
    )
    const t = get().state.activeWorkout?.timer
    if (t && get().state.prefs.push) scheduleRestPush(t.endAt, 'Repos terminé', t.next ? `Ensuite : ${t.next}` : 'Série suivante.')
  },

  stopRest: () => {
    const running = get().state.activeWorkout?.timer
    get().update((s) => withActive(s, (a) => ({ ...a, timer: null, timerEndAt: null })))
    if (running && running.endAt > Date.now() && get().state.prefs.push) cancelRestPush()
  },

  finishSession: () => {
    const s = get().state
    const a = s.activeWorkout
    if (!a) return null
    if (a.timer && a.timer.endAt > Date.now() && s.prefs.push) cancelRestPush()
    const sessionNumber = Math.max(0, ...s.workouts.map((w) => w.sessionNumber)) + 1
    const workout: Workout = {
      id: a.id,
      sessionNumber,
      type: a.type,
      date: a.date,
      startedAt: a.startedAt,
      completedAt: new Date().toISOString(),
      notes: a.notes,
      exercises: a.exercises.map(({ hint: _h, ...e }) => e),
      periodId: a.periodId,
      week: a.week,
      deload: a.deload,
      gymId: a.gymId && a.gymId !== HOME_GYM ? a.gymId : undefined,
    }
    const result = finalizeWorkout(s.workouts, workout, s.templates)
    const workouts = [...s.workouts, result.workout].sort((x, y) => (x.date === y.date ? x.sessionNumber - y.sessionNumber : x.date < y.date ? -1 : 1))
    const reentry = s.reentry ? (s.reentry.sessionsLeft > 1 ? { ...s.reentry, sessionsLeft: s.reentry.sessionsLeft - 1 } : null) : null
    const auto = s.prefs.autoLoad ? result.changes : []
    let templates = s.templates
    for (const c of auto) templates = applyChange(templates, c)
    get().update(() => ({
      ...s,
      workouts,
      templates,
      completedSessions: workouts.length,
      nextWorkoutType: nextInRotation(a.type),
      lastCompletedWorkoutId: workout.id,
      activeWorkout: null,
      reentry,
      appliedPlanUpdates: auto.length
        ? [
            ...s.appliedPlanUpdates,
            {
              updateId: `auto-${workout.id}`,
              basedOnSession: sessionNumber,
              summary: `Ajustement automatique : ${describeChanges(auto)}.`,
              appliedAt: new Date().toISOString(),
              changeCount: auto.length,
              source: 'progression' as const,
            },
          ]
        : s.appliedPlanUpdates,
    }))
    set({ lastFinish: { ...result, applied: auto.map((c) => c.id) } })
    return workout.id
  },

  discardSession: () => {
    const running = get().state.activeWorkout?.timer
    if (running && running.endAt > Date.now() && get().state.prefs.push) cancelRestPush()
    get().update((s) => ({ ...s, activeWorkout: null }))
  },

  applyChanges: (ids) => {
    const lf = get().lastFinish
    if (!lf) return
    const todo = lf.changes.filter((c) => ids.includes(c.id) && !lf.applied.includes(c.id))
    if (!todo.length) return
    get().update((s) => {
      let templates = s.templates
      for (const c of todo) templates = applyChange(templates, c)
      return {
        ...s,
        templates,
        appliedPlanUpdates: [
          ...s.appliedPlanUpdates,
          { updateId: `manual-${Date.now()}`, basedOnSession: s.workouts.length, summary: `Charges mises à jour : ${describeChanges(todo)}.`, appliedAt: new Date().toISOString(), changeCount: todo.length, source: 'progression' },
        ],
      }
    })
    set({ lastFinish: { ...lf, applied: [...lf.applied, ...todo.map((c) => c.id)] } })
  },

  revertChange: (id) => {
    const lf = get().lastFinish
    const c = lf?.changes.find((x) => x.id === id)
    if (!lf || !c || !lf.applied.includes(id)) return
    get().update((s) => ({ ...s, templates: applyChange(s.templates, c, true) }))
    set({ lastFinish: { ...lf, applied: lf.applied.filter((x) => x !== id) } })
  },

  bringDeloadForward: () => {
    const start = addDays(todayISO(), 1)
    get().update((s) => ({ ...s, manualDeload: { start, end: addDays(start, 6) } }))
  },

  cancelEarlyDeload: () => get().update((s) => ({ ...s, manualDeload: null })),

  deleteWorkout: (id) =>
    get().update((s) => {
      const workouts = s.workouts.filter((w) => w.id !== id)
      return { ...s, workouts, completedSessions: workouts.length }
    }),

  // ───────────────────────── Body & nutrition ─────────────────────────

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

  setNutritionTargets: (patch) =>
    get().update((s) => ({
      ...s,
      nutritionTargets: {
        ...s.nutritionTargets,
        ...patch,
        ...(patch.calories !== undefined && patch.calories !== s.nutritionTargets.calories ? { caloriesChangedAt: todayISO() } : {}),
      },
    })),

  // ───────────────────────── Pause ─────────────────────────

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

  // ───────────────────────── Settings ─────────────────────────

  setGoalDate: (goal) => {
    if (!isValidGoal(goal)) return
    get().update((s) => ({ ...s, settings: { ...s.settings, goalDate: goal } }))
    void get().flush()
  },

  setGoals: (patch) => get().update((s) => ({ ...s, goals: { ...s.goals, ...patch } })),

  setPrefs: (patch) => {
    get().update((s) => ({ ...s, prefs: { ...s.prefs, ...patch } }))
    if (patch.theme || patch.accent) applyTheme(get().state.prefs.theme, get().state.prefs.accent)
    void get().flush()
  },

  setSchedule: (dow, type) =>
    get().update((s) => {
      const schedule = { ...s.schedule, [dow]: type }
      return { ...s, schedule, goals: { ...s.goals, sessionsPerWeek: Object.values(schedule).filter(Boolean).length } }
    }),

  toggleTrainingDay: (dow) =>
    get().update((s) => {
      const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => !!s.schedule[d])
      const next = days.includes(dow) ? days.filter((d) => d !== dow) : [...days, dow]
      if (next.length < 2) return s
      return { ...s, schedule: scheduleFromDays(next), goals: { ...s.goals, sessionsPerWeek: next.length } }
    }),

  addGym: (name) => {
    const id = newGymId(name)
    get().update((s) => ({ ...s, gyms: [...s.gyms, { id, name: name.trim() || 'Nouvelle salle' }] }))
    return id
  },

  renameGym: (id, name) => get().update((s) => ({ ...s, gyms: s.gyms.map((g) => (g.id === id ? { ...g, name: name.trim() || g.name } : g)) })),

  removeGym: (id) =>
    get().update((s) => {
      if (id === HOME_GYM) return s
      const drop = (e: TemplateExercise): TemplateExercise => {
        if (!e.gymLoads || !(id in e.gymLoads)) return e
        const { [id]: _x, ...gymLoads } = e.gymLoads
        return { ...e, gymLoads }
      }
      const templates = Object.fromEntries(Object.entries(s.templates).map(([k, t]) => [k, { ...t, exercises: t.exercises.map(drop) }])) as Record<WorkoutType, Template>
      return { ...s, templates, gyms: s.gyms.filter((g) => g.id !== id), gymId: s.gymId === id ? HOME_GYM : s.gymId }
    }),

  selectGym: (id) => get().update((s) => (s.gyms.some((g) => g.id === id) ? { ...s, gymId: id } : s)),

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

export { DEFAULT_GOAL }
