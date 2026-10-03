import { upgradeTrainingDiagnostics } from './trainingMigration'
import { create } from 'zustand'
import { clear, createStore, del, entries, get as idbGet, set as idbSet } from 'idb-keyval'
import { defaultState, makeBackup, normalizeState, upgradeToResearchProgram, type ParsedBackup, type ProgramChange } from './backup'
import { applyPlanUpdate, type PlanUpdate } from './coach'
import { addDays, diffDays, fmtDate, isoFromTimestamp, todayISO } from './date'
import { roundTo, uid } from './format'
import { gymOf, HOME_GYM, isGymBound, loadAt, loadElsewhere, newGymId } from './gyms'
import { infoFor, LIBRARY } from './library'
import {
  buildResearchTemplates, configurePlan, contextAt, DEFAULT_GOAL, gapSinceLastSession, scheduleFromDays, incrementFor, isValidGoal, nextTargetText, prescribeSession,
  reentryForGap, scheduledGap, takesLest, trainingDays,
} from './program'
import { cancelRestPush, scheduleRestPush } from './push'
import {
  appliedState, beforeCorrection, finishedState, intraSessionAdjust, knownLoads, previousPerformance, reopenedState, revertedState, withoutWorkout, type FinishResult,
} from './training'
import { L, resolveLang, setLang } from './i18n'
import { localizeState } from './localize'
import { maintenanceCalories, stateFromOnboarding, type OnboardingAnswers } from './onboarding'
import { weightStatus } from './stats'
import { clearSessionReplacement, normalizeSessionReplacements, replacePlanned, replaceTemplate, replacementTemplate, sessionExercises, validReplacementSlot, type ReplacementResult } from './exerciseReplacement'
import { goalApplied, lookInfo, tagPriorities, ZONES, zonesText } from './visual'
import type {
  ActiveWorkout, AppState, Backup, BodyEntry, Goals, ISODate, NutritionEntry, NutritionTargets, PauseReason, Photo, PlanUpdateRecord, Prefs, Prescription,
  Look, ReplacementScope, SetFlag, Template, TemplateExercise, TrainingSetup, WorkoutExercise, WorkoutSet, WorkoutType, Zone,
} from './types'

export const GOAL_PHOTO_ID = 'goal-reference'

let kv = createStore('golgoth', 'kv')
const photoDb = createStore('golgoth-photos', 'photos')

export interface Toast {
  id: number
  message: string
  tone: 'default' | 'good' | 'bad'
  action?: { label: string; run: () => void }
}

interface Store {
  ready: boolean
  hasData: boolean
  storage: 'idb' | 'memory'
  state: AppState
  photos: Photo[]
  /** What the session just finished led to (alerts, records): shown on its summary until the app is closed. Its changes stay with the session itself. */
  lastFinish: FinishResult | null
  lastImport: { changes: ProgramChange[] } | null
  toast: Toast | null

  init: () => Promise<void>
  update: (fn: (s: AppState) => AppState) => void
  flush: () => Promise<void>
  notify: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void

  startFresh: () => void
  /** First run: builds the whole state from the onboarding answers. */
  completeOnboarding: (a: OnboardingAnswers) => void
  /** Gym or home (and home equipment): the sessions are rebuilt, known loads kept. */
  setSetup: (setup: TrainingSetup) => void
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
  replaceExercise: (ex: number, newId: string, scope?: ReplacementScope) => boolean
  replacePlannedExercise: (type: WorkoutType, index: number, newId: string, scope: ReplacementScope) => boolean
  replaceTemplateExercise: (type: WorkoutType, index: number, newId: string) => boolean
  setExerciseField: (ex: number, patch: Partial<Pick<WorkoutExercise, 'notes' | 'comparisonContext'>>) => void
  setSessionField: (patch: Partial<Pick<ActiveWorkout, 'notes' | 'date'>>) => void
  setSessionGym: (gymId: string) => void
  startRest: (seconds: number, label: string, next?: string) => void
  adjustRest: (delta: number) => void
  stopRest: () => void
  finishSession: () => string | null
  discardSession: () => void
  /** Applies changes a session proposed, as long as the sheets still hold what they started from. */
  applyChanges: (ids: string[]) => void
  /** Undoes a change a session made, as long as the sheet still holds it. */
  revertChange: (id: string) => void
  bringDeloadForward: () => void
  cancelEarlyDeload: () => void
  /** Opens the last finished session again as the session in progress, to be corrected; finished, it takes the place of the original. */
  reopenWorkout: (id: string) => boolean
  /** Removes a session; the changes it made that the sheets still hold are undone. */
  deleteWorkout: (id: string) => void

  saveBody: (entry: Omit<BodyEntry, 'id'> & { id?: string }) => void
  deleteBody: (id: string) => void
  setNutrition: (date: ISODate, patch: Partial<NutritionEntry>) => void
  setNutritionTargets: (patch: Partial<NutritionTargets>) => void

  startPause: (p: { reason: PauseReason; plannedEnd: ISODate | null; note?: string }) => void
  endPause: () => void

  /** Sets the goal date; from maintenance mode, it also brings the dated plan back. */
  setGoalDate: (goal: ISODate) => void
  /**
   * Maintenance mode: no goal date. The look's cut and target weight are set aside (zones stay);
   * leaving a cut, calories go back to the estimated maintenance. Returns the new calories, if changed.
   */
  enterMaintenance: () => number | null
  applyVisualGoal: (
    g: { look: Look; zones: Zone[]; bodyFat: number | null; heightCm: number; sex: 'm' | 'f' },
    plan: { cutWeeks: number; target: [number, number]; goal?: ISODate },
  ) => void
  clearVisualGoal: () => void
  setGoalPhoto: (dataUrl: string | null) => Promise<void>
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
let saveInFlight: Promise<void> | null = null
const storageUnavailableMessages = [
  'Stockage indisponible : les données ne sont gardées que pendant cette session.',
  'Storage unavailable: your data is only kept for this session.',
] as const
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
function startingLoad(t: TemplateExercise, gymId: string, state: AppState, loadFactor: number, historyFallback = true): { weight: number | null; trial: WorkoutExercise['gymTrial'] } {
  const scale = (w: number) => {
    const inc = incrementFor(t)
    return loadFactor < 1 && inc > 0 ? Math.max(inc, roundTo(w * loadFactor, inc)) : w
  }
  // Bodyweight work: the added load, if any; never a trial session.
  if (t.unit === 'PDC') return { weight: takesLest(t) && t.target.weight ? scale(t.target.weight) : null, trial: undefined }
  const here = loadAt(t, gymId)
  if (here !== null) return { weight: scale(here), trial: undefined }
  // Replacements already selected a load by exact movement, unit and gym.
  // Do not reintroduce a different site's or legacy unit's load as a fallback.
  if (!historyFallback) return { weight: null, trial: undefined }
  const bound = isGymBound(t)
  const elsewhere = bound ? loadElsewhere(t, gymId, state.gyms) : null
  if (elsewhere) return { weight: scale(elsewhere.weight), trial: { fromGym: elsewhere.gym.name, weight: elsewhere.weight } }
  const compatible = state.workouts.filter(workout => !bound || gymOf(workout) === gymId)
    .map(workout => ({ ...workout, exercises: workout.exercises.filter(ex => ex.unit === t.unit) }))
  const prev = previousPerformance(compatible, t.exerciseId, undefined, bound ? gymId : undefined, t.target)?.exercise
  const last = prev?.sets.filter((s) => s.completed).map((s) => s.weight).find((w) => typeof w === 'number') ?? null
  return { weight: typeof last === 'number' ? scale(last) : null, trial: undefined }
}

const replacementError = (reason: ReplacementResult['reason']): string | undefined => {
  if (reason === 'completed') return L('Des séries sont déjà enregistrées : cet exercice ne peut plus être remplacé dans cette séance.', 'Sets are already recorded: this exercise can no longer be replaced in this session.')
  if (reason === 'duplicate') return L('Cet exercice figure déjà dans cette séance. Choisis une autre alternative.', 'This exercise is already in this session. Choose another alternative.')
  if (reason === 'conflict') return L('Le programme a changé depuis le début de cette séance. Modifie sa fiche séparément.', 'The program changed since this session started. Edit its sheet separately.')
  if (reason === 'reopened') return L('Une séance rouverte ne peut pas modifier le programme. Modifie sa fiche séparément.', 'A reopened session cannot change the program. Edit its sheet separately.')
  if (reason === 'invalid') return L('Cet exercice ou cet emplacement n’est plus disponible.', 'This exercise or slot is no longer available.')
}

function buildExercise(t: TemplateExercise, p: Prescription, state: AppState, gymId: string, historyFallback = true): WorkoutExercise {
  const start = startingLoad(t, gymId, state, p.loadFactor, historyFallback)
  return {
    ...t,
    target: { ...t.target, weight: t.unit === 'PDC' ? (takesLest(t) ? t.target.weight || null : null) : loadAt(t, gymId) },
    prescription: { ...p, weight: p.weight ?? start.weight },
    // The added load of a bodyweight exercise is shown as a suggestion, not filled in.
    sets: Array.from({ length: p.sets }, () => emptySet(t.unit === 'PDC' ? null : start.weight)),
    notes: '',
    skipped: false,
    validated: false,
    comparison: null,
    gymTrial: start.trial,
  }
}

const THEME_COLORS = { dark: '#060A13', light: '#F9FAFD' }

/** Theme, accent and language of the saved preferences. */
function applyPrefs(prefs: Prefs) {
  setLang(resolveLang(prefs.lang))
  applyTheme(prefs.theme, prefs.accent)
}

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

/** The plan (periods, deloads) follows the goal date — or maintenance mode — and an early deload stored in the state; the sets follow the training days. */
function syncPlan(s: AppState) {
  const vg = s.visualGoal
  configurePlan(s.settings.goalDate, s.manualDeload, vg?.cutWeeks, vg?.zones?.length ? zonesText(vg.zones) : null, {
    start: s.settings.programStart,
    foundation: s.settings.foundationStart ?? null,
    maintenance: !!s.settings.maintenance,
    days: trainingDays(s).length,
    keepVolume: s.prefs.keepWeeklyVolume !== false,
  })
}

/** Settings of a dated plan: the maintenance flag dropped. */
function withGoal(settings: AppState['settings'], goal?: ISODate): AppState['settings'] {
  const { maintenance: _m, ...rest } = settings
  return goal ? { ...rest, goalDate: goal } : rest
}

/** An entry of the update history, for a change of plan made in the app. */
function planRecord(summary: string, s: AppState): PlanUpdateRecord {
  return { updateId: `plan-${Date.now()}`, basedOnSession: s.workouts.length || null, summary, appliedAt: new Date().toISOString(), changeCount: 1, source: 'program' }
}

/** Maintenance calories from the profile and today's weight (Mifflin–St Jeor × activity), when both are known. */
function estimatedMaintenance(s: AppState): number | null {
  const weight = weightStatus(s).current
  if (!weight || !s.profile.heightCm) return null
  return maintenanceCalories({ weight, heightCm: s.profile.heightCm, age: s.profile.age, sex: s.profile.sex ?? 'm', days: trainingDays(s) })
}

/**
 * Calories once in maintenance mode: leaving a cut, the estimated maintenance; otherwise the
 * current target stays (it already aims at a stable weight) and this returns null.
 */
export function caloriesForMaintenance(s: AppState, today: ISODate = todayISO()): number | null {
  const phase = contextAt(today).phase?.id
  if (phase !== 'cut' && phase !== 'cut-end' && phase !== 'diet-break') return null
  const kcal = estimatedMaintenance(s)
  return kcal && kcal !== s.nutritionTargets.calories ? kcal : null
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
        const normalized = normalizeState(raw)
        applyPrefs(normalized.prefs)
        syncPlan(normalized)
        const state = localizeState(upgradeTrainingDiagnostics(normalized))
        syncPlan(state)
        set({ ready: true, hasData: true, state, photos, storage: 'idb' })
        if (state.progressRevision !== normalized.progressRevision) {
          void get().flush()
          get().notify(L('Comparaisons recalculées : mesures et charges conservées, réductions automatiques non justifiées annulées.', 'Comparisons recalculated: measurements and loads kept, unsupported automatic volume reductions removed.'), 'good')
        }
        // A newer revision of the program changed the sheets: stored at once (the change is recorded once), and said.
        if (typeof raw.programRevision === 'number' && raw.programRevision < normalized.programRevision) {
          void get().flush()
          get().notify(L('Programme mis à jour : abdos, mollets et deltoïdes postérieurs à 10 séries par semaine, sans exercice à cinq séries.', 'Program updated: abs, calves and rear delts at 10 sets a week, with no exercise at five sets.'), 'good')
        }
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
    if (!get().hasData) return
    if (saveInFlight) return saveInFlight
    // WebKit can close IndexedDB while the app is suspended. Retry with a fresh
    // connection, and keep later saves possible even if both attempts fail.
    saveInFlight = (async () => {
      while (get().hasData) {
        let savedState = get().state
        let saved = false
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!get().hasData) return
          savedState = get().state
          try {
            await idbSet('state', savedState, kv)
            saved = true
            break
          } catch (error) {
            // Reopening cannot fix quota exhaustion or non-cloneable values.
            const name = error && typeof error === 'object' && 'name' in error ? error.name : undefined
            if (error != null && !['AbortError', 'InvalidStateError', 'UnknownError'].includes(String(name))) break
            kv = createStore('golgoth', 'kv')
          }
        }
        if (!saved) {
          set({ storage: 'memory' })
          get().notify(L(...storageUnavailableMessages), 'bad')
          return
        }
        const storageWarning = storageUnavailableMessages.some(message => message === get().toast?.message)
        set({ storage: 'idb', ...(storageWarning ? { toast: null } : {}) })
        // An edit made during the write must be saved before callers resolve.
        if (get().state === savedState) return
      }
    })().finally(() => { saveInFlight = null })
    return saveInFlight
  },

  notify: (message, tone = 'default', action) => set({ toast: { id: ++toastSeq, message, tone, action } }),

  startFresh: () => {
    const fresh = defaultState()
    applyPrefs(fresh.prefs)
    const state = localizeState(fresh)
    syncPlan(state)
    set({ hasData: true, state })
    void get().flush()
  },

  completeOnboarding: (a) => {
    setLang(a.lang)
    const state = localizeState(stateFromOnboarding(a))
    applyPrefs(state.prefs)
    syncPlan(state)
    set({ hasData: true, state, photos: [] })
    void get().flush()
  },

  setSetup: (setup) => {
    get().update((s) => {
      const place = s.settings.setup?.place ?? 'gym'
      const archive = { ...(s.archive ?? {}), templatesBySetup: { ...(s.archive?.templatesBySetup ?? {}), [place]: s.templates } }
      // Back to the gym: its sessions as they were. At home: rebuilt for the equipment, loads carried over.
      const saved = setup.place === 'gym' ? archive.templatesBySetup.gym : undefined
      const base = saved ?? buildResearchTemplates({ ...(archive.templatesBySetup.home ?? {}), ...s.templates }, s.workouts, setup)
      const templates = tagPriorities(base, goalApplied(s.visualGoal) ? s.visualGoal.zones : [])
      return localizeState({ ...s, archive, templates, settings: { ...s.settings, setup } })
    })
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
    applyPrefs(state.prefs)
    syncPlan(state)
    state = localizeState(upgradeTrainingDiagnostics(state))
    syncPlan(state)
    set({ hasData: true, state, photos: parsed.photos, lastImport: { changes } })
    await get().flush()
  },

  exportBackup: () => makeBackup(get().state, get().photos),

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
      if (s.activeWorkout) return s
      const today = todayISO()
      const t = type ?? s.nextWorkoutType
      if (!s.templates[t]) return s
      const ctx = contextAt(today)
      const gap = gapSinceLastSession(s, today)
      let reentry = s.reentry
      // A week without training is a break. With a single session a week, a missed one is (two weeks).
      if (!reentry && gap >= (scheduledGap(s) >= 7 ? 14 : 7)) reentry = reentryForGap(gap)
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
      const planned = sessionExercises(s, t)
      const base = { ...clearSessionReplacement(s, t), reentry, programPause }
      // The whole session at once: with fewer than five days its sets are scaled together.
      const rx = prescribeSession(planned, today, reentry, gymId, s.workouts)
      const active: ActiveWorkout = {
        id: uid(`workout-${t.toLowerCase()}`),
        type: t,
        date: today,
        startedAt: new Date().toISOString(),
        notes: '',
        timerEndAt: null,
        timer: null,
        exercises: planned.map((e, i) => {
          const original = s.templates[t].exercises[i]
          const exercise = buildExercise(e, rx[i], base, gymId, e.exerciseId === original.exerciseId)
          return e.exerciseId === original.exerciseId ? exercise : { ...exercise, replacement: { fromId: original.exerciseId, fromName: original.name } }
        }),
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
            // An explicit correction of RIR also clears a contradictory failure flag.
            if ('rir' in patch && typeof patch.rir === 'number' && patch.rir > 0) next.flags = next.flags.filter((f) => f !== 'failure')
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
      get().notify(L('Indique le nombre de répétitions.', 'Enter the number of reps.'), 'bad')
      return
    }
    // Added load on bodyweight work is typed, never assumed: an empty field is body weight alone.
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
          const adj = intraSessionAdjust(cur, i, knownLoads([...s.workouts, next], cur.exerciseId, isGymBound(cur) ? (next.gymId ?? HOME_GYM) : undefined))
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
    // Correcting a finished session: nothing is being lifted, no rest to time.
    if (after.reopened) return
    const cur = after.exercises[ex]
    const lastSetOfExercise = i >= cur.sets.length - 1
    if (cur.supersetWithNext && after.exercises[ex + 1]) {
      get().notify(L(`Enchaîne : ${after.exercises[ex + 1].name}`, `Straight into: ${after.exercises[ex + 1].name}`))
      return
    }
    const rest = cur.prescription?.restSeconds ?? cur.target.restSeconds ?? 120
    const nextEx = lastSetOfExercise ? after.exercises.slice(ex + 1).find((e) => !e.skipped) : cur
    const pairedPrev = ex > 0 && after.exercises[ex - 1].supersetWithNext ? after.exercises[ex - 1] : null
    const label = pairedPrev ? `${pairedPrev.name} + ${cur.name}` : cur.name
    const nextText = nextEx ? (lastSetOfExercise ? nextEx.name : L(`Série ${i + 2}/${cur.sets.length} · ${cur.name}`, `Set ${i + 2}/${cur.sets.length} · ${cur.name}`)) : undefined
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
          return { ...e, sets: [...e.sets, emptySet(e.unit === 'PDC' ? (last?.weight ?? null) : (last?.weight ?? e.prescription?.weight ?? e.target.weight ?? null))] }
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

  replacePlannedExercise: (type, index, newId, scope) => {
    const state = get().state
    const result = replacePlanned(state, type, index, newId, scope)
    if (result.state === state) {
      const message = replacementError(result.reason)
      if (message) get().notify(message)
      return false
    }
    get().update(() => result.state)
    return true
  },

  replaceTemplateExercise: (type, index, newId) => {
    const state = get().state
    const result = replaceTemplate(state, type, index, newId)
    if (result.state === state) {
      const message = replacementError(result.reason)
      if (message) get().notify(message)
      return false
    }
    get().update(() => result.state)
    return true
  },

  replaceExercise: (index, newId, scope = 'session') => {
    const state = get().state, active = state.activeWorkout
    const reject = (reason: ReplacementResult['reason']) => {
      const message = replacementError(reason)
      if (message) get().notify(message)
      return false
    }
    if (!active || !Number.isInteger(index) || index < 0 || !active.exercises[index] ||
        !Object.hasOwn(LIBRARY, newId) || (scope !== 'session' && scope !== 'program')) return reject('invalid')
    const old = active.exercises[index]
    if (old.exerciseId === newId) return false
    if (old.sets.some(set => set.completed)) return reject('completed')
    if (active.exercises.some((ex, i) => i !== index && ex.exerciseId === newId)) return reject('duplicate')
    let next = state
    if (scope === 'program') {
      if (active.reopened) return reject('reopened')
      if (!validReplacementSlot(state, active.type, index)) return reject('conflict')
      const templateId = state.templates[active.type].exercises[index].exerciseId
      if (![old.exerciseId, old.replacement?.fromId, newId].includes(templateId)) return reject('conflict')
      const result = replaceTemplate(state, active.type, index, newId)
      if (result.reason) return reject(result.reason)
      next = clearSessionReplacement(result.state, active.type, index)
    }
    const gym = active.gymId ?? HOME_GYM
    const template = replacementTemplate(state, old, newId, gym)
    const prescription: Prescription = old.prescription
      ? { ...old.prescription, sets: old.sets.length, weight: null, notes: [] }
      : { ...template.target, weight: null, sets: old.sets.length, rir: template.target.rir ?? '', loadFactor: 1, notes: [] }
    const exercise = buildExercise(template, prescription, state, gym, false)
    exercise.replacement = old.replacement ?? { fromId: old.exerciseId, fromName: old.name }
    // Changing back to the original movement restores normal comparison rules.
    if (scope === 'program' || exercise.replacement.fromId === newId) delete exercise.replacement
    get().update(() => ({ ...next, activeWorkout: mapExercise(active, index, () => exercise) }))
    return true
  },

  setExerciseField: (ex, patch) => get().update((s) => withActive(s, (a) => mapExercise(a, ex, (e) => ({ ...e, ...patch })))),

  setSessionField: (patch) => get().update((s) => withActive(s, (a) => ({ ...a, ...patch }))),

  setSessionGym: (gymId) =>
    get().update((s) => {
      if (!s.activeWorkout || !s.gyms.some((g) => g.id === gymId)) return s
      const a = s.activeWorkout
      // The gym it already has: nothing to rebuild.
      if (gymId === (a.gymId ?? HOME_GYM)) return a.reopened ? s : { ...s, gymId }
      // A finished session being corrected reads the sheets as they stood before its own changes, and is not its own history.
      const original = a.reopened ? s.workouts.find((w) => w.id === a.id) : undefined
      const from = original ? { ...s, templates: beforeCorrection(s, original).templates, workouts: s.workouts.filter((w) => w.id !== a.id) } : s
      const tpl = from.templates[a.type]
      const exercises = a.exercises.map((e) => {
        if (!isGymBound(e) || e.replacement) return e
        const t = tpl.exercises.find((x) => x.exerciseId === e.exerciseId)
        if (!t) return e
        const start = startingLoad(t, gymId, from, e.prescription?.loadFactor ?? 1)
        const { gymTrial: _t, hint: _h, ...rest } = e
        return {
          ...rest,
          target: { ...e.target, weight: loadAt(t, gymId) },
          prescription: e.prescription ? { ...e.prescription, weight: start.weight } : undefined,
          sets: e.sets.map((x) => (x.completed ? x : { ...x, weight: start.weight })),
          gymTrial: start.trial,
        }
      })
      // The gym of a corrected session is that session's: the gym chosen for the next ones does not move.
      return { ...s, gymId: a.reopened ? s.gymId : gymId, activeWorkout: { ...a, gymId, exercises } }
    }),

  startRest: (seconds, label, next) => {
    const endAt = Date.now() + seconds * 1000
    get().update((s) => withActive(s, (a) => ({ ...a, timer: { endAt, total: seconds, label, next }, timerEndAt: new Date(endAt).toISOString() })))
    if (get().state.prefs.push) scheduleRestPush(endAt, L('Repos terminé', 'Rest over'), next ? L(`Ensuite : ${next}`, `Next: ${next}`) : L('Série suivante.', 'Next set.'))
  },

  adjustRest: (delta) => {
    get().update((s) =>
      withActive(s, (a) => {
        if (!a.timer) return a
        const now = Date.now()
        // A rest already over starts again from now: the time added is the time left, not a later end to a past deadline.
        const over = a.timer.endAt <= now
        const endAt = Math.max(now + 1000, (over ? now : a.timer.endAt) + delta * 1000)
        return { ...a, timer: { ...a.timer, endAt, total: Math.max(over ? delta : a.timer.total + delta, 5) }, timerEndAt: new Date(endAt).toISOString() }
      }),
    )
    const t = get().state.activeWorkout?.timer
    if (t && get().state.prefs.push) scheduleRestPush(t.endAt, L('Repos terminé', 'Rest over'), t.next ? L(`Ensuite : ${t.next}`, `Next: ${t.next}`) : L('Série suivante.', 'Next set.'))
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
    const done = finishedState(s)
    if (!done) return null
    get().update(() => done.state)
    set({ lastFinish: done.result })
    return done.result.workout.id
  },

  discardSession: () => {
    const running = get().state.activeWorkout?.timer
    if (running && running.endAt > Date.now() && get().state.prefs.push) cancelRestPush()
    get().update((s) => ({ ...s, activeWorkout: null }))
  },

  applyChanges: (ids) => get().update((s) => appliedState(s, ids)),

  revertChange: (id) => get().update((s) => revertedState(s, id)),

  bringDeloadForward: () => {
    const start = addDays(todayISO(), 1)
    get().update((s) => ({ ...s, manualDeload: { start, end: addDays(start, 6) } }))
  },

  cancelEarlyDeload: () => get().update((s) => ({ ...s, manualDeload: null })),

  reopenWorkout: (id) => {
    const next = reopenedState(get().state, id)
    if (!next) return false
    get().update(() => next)
    set({ lastFinish: null })
    void get().flush()
    return true
  },

  deleteWorkout: (id) => {
    // A correction in progress on that session goes with it.
    get().update((s) => {
      const next = withoutWorkout(s, id)
      return next.activeWorkout?.reopened && next.activeWorkout.id === id ? { ...next, activeWorkout: null } : next
    })
    if (get().lastFinish?.workout.id === id) set({ lastFinish: null })
  },

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
    const wasMaintenance = !!get().state.settings.maintenance
    get().update((s) => ({
      ...s,
      settings: withGoal(s.settings, goal),
      appliedPlanUpdates: wasMaintenance
        ? [...s.appliedPlanUpdates, planRecord(L(`Fin du mode entretien : objectif le ${fmtDate(goal, { long: true, year: true })}.`, `Maintenance mode ended: goal on ${fmtDate(goal, { long: true, year: true })}.`), s)]
        : s.appliedPlanUpdates,
    }))
    void get().flush()
  },

  enterMaintenance: () => {
    const s0 = get().state
    if (s0.settings.maintenance) return null
    const calories = caloriesForMaintenance(s0)
    const hadLook = goalApplied(s0.visualGoal)
    get().update((s) => {
      const vg = s.visualGoal
      return {
        ...s,
        settings: { ...s.settings, maintenance: true },
        // The look's cut and target weight belong to a dated plan; its zones still set the priority sets.
        visualGoal: hadLook && vg ? { look: vg.look, zones: vg.zones, bodyFat: vg.bodyFat, photoId: vg.photoId } : vg,
        goals: hadLook ? { ...s.goals, targetWeightMin: 0, targetWeightMax: 0 } : s.goals,
        nutritionTargets: calories ? { ...s.nutritionTargets, calories, caloriesChangedAt: todayISO() } : s.nutritionTargets,
        appliedPlanUpdates: [
          ...s.appliedPlanUpdates,
          planRecord(
            L(
              `Mode entretien : plus de date objectif, blocs de 5 semaines + décharge en continu${calories ? `, calories à ${calories} kcal (maintenance estimée)` : ''}.`,
              `Maintenance mode: no goal date, 5-week blocks + deload with no end${calories ? `, calories at ${calories} kcal (estimated maintenance)` : ''}.`,
            ),
            s,
          ),
        ],
      }
    })
    void get().flush()
    return calories
  },

  applyVisualGoal: (g, plan) => {
    const round = (x: number) => Math.round(x * 2) / 2
    const look = lookInfo(g.look).label
    const lo = round(plan.target[0]).toString()
    const hi = round(plan.target[1]).toString()
    const zones = g.zones.map((z) => ZONES.find((x) => x.id === z)?.label.toLowerCase()).join(', ')
    const summary = L(
      `Objectif visuel « ${look} » : ${lo.replace('.', ',')}–${hi.replace('.', ',')} kg, sèche de ${plan.cutWeeks} semaines${g.zones.length ? `, priorités : ${zones}` : ''}.`,
      `Visual goal “${look}”: ${lo}–${hi} kg, ${plan.cutWeeks}-week cut${g.zones.length ? `, priorities: ${zones}` : ''}.`,
    )
    get().update((s) => ({
      ...s,
      profile: { ...s.profile, heightCm: g.heightCm, sex: g.sex },
      visualGoal: { look: g.look, zones: g.zones, bodyFat: g.bodyFat, photoId: s.visualGoal?.photoId, cutWeeks: plan.cutWeeks },
      goals: { ...s.goals, targetWeightMin: round(plan.target[0]), targetWeightMax: round(plan.target[1]) },
      templates: tagPriorities(s.templates, g.zones),
      // A look is a dated plan: applying one leaves maintenance mode.
      settings: withGoal(s.settings, plan.goal && isValidGoal(plan.goal) ? plan.goal : undefined),
      appliedPlanUpdates: [
        ...s.appliedPlanUpdates,
        {
          updateId: `visual-${Date.now()}`,
          basedOnSession: s.workouts.length || null,
          summary,
          appliedAt: new Date().toISOString(),
          changeCount: 1,
          source: 'program',
        },
      ],
    }))
    void get().flush()
  },

  clearVisualGoal: () => {
    // Without a look the plan returns to the report's 23-week cut and V-shape priorities.
    get().update((s) => ({
      ...s,
      visualGoal: s.visualGoal?.photoId ? { look: s.visualGoal.look, zones: [], bodyFat: null, photoId: s.visualGoal.photoId } : null,
      goals: { ...s.goals, targetWeightMin: 0, targetWeightMax: 0 },
      templates: tagPriorities(s.templates, []),
    }))
    void get().flush()
  },

  setGoalPhoto: async (dataUrl) => {
    if (!dataUrl) {
      await get().deletePhoto(GOAL_PHOTO_ID)
      get().update((s) => (s.visualGoal ? { ...s, visualGoal: { ...s.visualGoal, photoId: undefined } } : s))
      return
    }
    await get().addPhoto({ id: GOAL_PHOTO_ID, date: todayISO(), dataUrl, name: 'objectif' })
    get().update((s) => ({ ...s, visualGoal: s.visualGoal ? { ...s.visualGoal, photoId: GOAL_PHOTO_ID } : { look: 'taille', zones: [], bodyFat: null, photoId: GOAL_PHOTO_ID } }))
  },

  setGoals: (patch) => get().update((s) => ({ ...s, goals: { ...s.goals, ...patch } })),

  setPrefs: (patch) => {
    // The language switches before the update so the remounted tree renders in it.
    if (patch.lang) setLang(resolveLang(patch.lang))
    get().update((s) => {
      const next = { ...s, prefs: { ...s.prefs, ...patch } }
      return patch.lang ? localizeState(next) : next
    })
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
    get().update((s) => ({ ...s, gyms: [...s.gyms, { id, name: name.trim() || L('Nouvelle salle', 'New gym') }] }))
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
      const templates = { ...s.templates, [type]: { ...tpl, exercises } }
      return { ...s, templates, sessionReplacements: normalizeSessionReplacements(s.sessionReplacements, templates) }
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
      const templates = { ...s.templates, [type]: { ...tpl, exercises: tpl.exercises.filter((_, i) => i !== index) } }
      return { ...s, templates, sessionReplacements: normalizeSessionReplacements(s.sessionReplacements, templates) }
    }),

  moveTemplateExercise: (type, index, dir) =>
    get().update((s) => {
      const tpl = s.templates[type]
      const j = index + dir
      if (j < 0 || j >= tpl.exercises.length) return s
      const exercises = [...tpl.exercises]
      ;[exercises[index], exercises[j]] = [exercises[j], exercises[index]]
      const templates = { ...s.templates, [type]: { ...tpl, exercises } }
      return { ...s, templates, sessionReplacements: normalizeSessionReplacements(s.sessionReplacements, templates) }
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
    set((st) => ({ photos: [...st.photos.filter((x) => x.id !== p.id), p].sort((a, b) => (a.date < b.date ? -1 : 1)) }))
    try {
      await idbSet(p.id, p, photoDb)
    } catch {
      get().notify(L('Photo gardée pour cette session seulement : stockage indisponible.', 'Photo kept for this session only: storage unavailable.'), 'bad')
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
