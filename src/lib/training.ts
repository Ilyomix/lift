import { addDays, mondayOf } from './date'
import { fmtLoad, fmtNum, roundTo } from './format'
import { infoFor, MUSCLES, type MuscleGroup } from './library'
import { incrementFor, nextTargetText } from './program'
import type {
  Comparison, ISODate, Template, TemplateExercise, Unit, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
} from './types'

/** Epley estimate; clean reps only. */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0) return 0
  return weight * (1 + Math.min(reps, 20) / 30)
}

export function doneSets(ex: Pick<WorkoutExercise, 'sets'>): WorkoutSet[] {
  return ex.sets.filter((s) => s.completed && (s.reps ?? 0) > 0)
}

export function cleanOf(s: WorkoutSet): number {
  return s.cleanReps ?? s.reps ?? 0
}

/** Score of a set: estimated 1RM for loaded work, clean reps for bodyweight work. */
export function setScore(s: WorkoutSet, unit: Unit): number {
  if (unit === 'PDC' || s.weight === null || s.weight === undefined) return cleanOf(s)
  return e1rm(s.weight, cleanOf(s))
}

export interface HistoryPoint {
  date: ISODate
  workoutId: string
  sessionNumber: number
  type: WorkoutType
  unit: Unit
  sets: WorkoutSet[]
  best: number
  bestSet: WorkoutSet | null
  totalClean: number
  volume: number
  topWeight: number | null
  comparison: Comparison | null
}

export function exerciseHistory(workouts: Workout[], exerciseId: string): HistoryPoint[] {
  const out: HistoryPoint[] = []
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId || ex.skipped) continue
      const sets = doneSets(ex)
      if (!sets.length) continue
      let best = 0
      let bestSet: WorkoutSet | null = null
      for (const s of sets) {
        const sc = setScore(s, ex.unit)
        if (sc > best) {
          best = sc
          bestSet = s
        }
      }
      const weights = sets.map((s) => s.weight).filter((x): x is number => typeof x === 'number')
      out.push({
        date: w.date,
        workoutId: w.id,
        sessionNumber: w.sessionNumber,
        type: w.type,
        unit: ex.unit,
        sets,
        best,
        bestSet,
        totalClean: sets.reduce((a, s) => a + cleanOf(s), 0),
        volume: sets.reduce((a, s) => a + (s.weight ?? 0) * cleanOf(s), 0),
        topWeight: weights.length ? Math.max(...weights) : null,
        comparison: ex.comparison,
      })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.sessionNumber - b.sessionNumber : a.date < b.date ? -1 : 1))
}

export function previousPerformance(workouts: Workout[], exerciseId: string, excludeId?: string): { workout: Workout; exercise: WorkoutExercise } | null {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i]
    if (w.id === excludeId) continue
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId && !e.skipped && doneSets(e).length > 0)
    if (ex) return { workout: w, exercise: ex }
  }
  return null
}

export function setsSummary(sets: WorkoutSet[], unit: Unit): string {
  const done = sets.filter((s) => s.completed)
  if (!done.length) return '—'
  const sameWeight = done.every((s) => s.weight === done[0].weight)
  if (sameWeight) {
    const w = unit === 'PDC' ? (done[0].weight ? `PDC+${fmtNum(done[0].weight)}` : 'PDC') : fmtNum(done[0].weight)
    return `${w} × ${done.map((s) => cleanOf(s)).join(' · ')}`
  }
  return done.map((s) => `${unit === 'PDC' ? 'PDC' : fmtNum(s.weight)}×${cleanOf(s)}`).join(' · ')
}

/** Double progression: all prescribed sets reached the top of the range, clean, without pain. */
export function progressionFor(ex: WorkoutExercise): { weight: number; text: string } | null {
  if (ex.unit === 'PDC' || ex.skipped) return null
  const sets = doneSets(ex)
  const needed = ex.prescription?.sets ?? ex.target.sets
  const weight = ex.target.weight
  if (weight === null || weight === undefined || sets.length < needed) return null
  if (ex.prescription && ex.prescription.loadFactor < 1) return null
  const ok = sets.slice(0, needed).every((s) => (s.weight ?? 0) >= weight && cleanOf(s) >= ex.target.maxReps && !s.flags.includes('pain'))
  if (!ok) return null
  const inc = incrementFor(ex)
  const next = roundTo(weight + Math.max(inc, weight * 0.025), inc)
  return { weight: next, text: `${fmtLoad(next, ex.unit)} la prochaine fois` }
}

export function compareExercise(ex: WorkoutExercise, prev: WorkoutExercise | null, history: HistoryPoint[], deload: boolean): Comparison {
  const sets = doneSets(ex)
  const totalReps = sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  const totalCleanReps = sets.reduce((a, s) => a + cleanOf(s), 0)
  const volume = sets.reduce((a, s) => a + (s.weight ?? 0) * cleanOf(s), 0)
  const prog = progressionFor(ex)
  const base: Comparison = {
    status: 'stable', headline: '', detail: '', totalReps, totalCleanReps, volume,
    deltaCleanReps: null, previousTotalCleanReps: null, previousSetReps: null, previousWeights: null,
    chargeValidated: !!prog, suggestion: prog ? 'PROCHAINE CIBLE : AUGMENTER LA CHARGE' : null, isRecord: false,
  }
  if (ex.skipped || sets.length === 0) {
    return { ...base, status: 'skipped', headline: 'NON RÉALISÉ', detail: ex.skipReason || 'Aucune série comptabilisée', chargeValidated: false, suggestion: null }
  }
  const bestNow = Math.max(...sets.map((s) => setScore(s, ex.unit)))
  const bestBefore = history.length ? Math.max(...history.map((h) => h.best)) : 0
  base.isRecord = history.length > 0 && bestNow > bestBefore + 1e-9
  if (!prev) return { ...base, status: 'new-baseline', headline: 'NOUVELLE BASELINE', detail: 'Première performance enregistrée' }
  const prevSets = doneSets(prev)
  base.previousTotalCleanReps = prevSets.reduce((a, s) => a + cleanOf(s), 0)
  base.previousSetReps = prevSets.map(cleanOf)
  base.previousWeights = prevSets.map((s) => s.weight)
  if (deload) return { ...base, status: 'deload', headline: 'DÉCHARGE', detail: 'Semaine allégée : pas de comparaison.' }
  if (ex.comparisonContext?.trim()) return { ...base, status: 'different-context', headline: 'CONDITIONS DIFFÉRENTES', detail: ex.comparisonContext.trim() }
  if (prevSets.length !== sets.length) {
    return { ...base, status: 'different-sets', headline: 'NOMBRE DE SÉRIES DIFFÉRENT', detail: `${sets.length} série${sets.length > 1 ? 's' : ''} contre ${prevSets.length} la dernière fois.` }
  }
  const sameLoads = sets.every((s, i) => (s.weight ?? 0) === (prevSets[i].weight ?? 0))
  if (!sameLoads) {
    const heavier = sets.every((s, i) => (s.weight ?? 0) >= (prevSets[i].weight ?? 0))
    const prevVol = prevSets.reduce((a, s) => a + (s.weight ?? 0) * cleanOf(s), 0)
    return {
      ...base,
      status: 'load-change',
      headline: heavier ? 'CHARGE SUPÉRIEURE' : 'RÉPARTITION DES CHARGES MODIFIÉE',
      detail: `Volume propre : ${fmtNum(volume, 0)} contre ${fmtNum(prevVol, 0)} kg·reps.`,
    }
  }
  const delta = totalCleanReps - (base.previousTotalCleanReps ?? 0)
  base.deltaCleanReps = delta
  if (delta > 0) return { ...base, status: 'progress', headline: `+${delta} REP${delta > 1 ? 'S' : ''}`, detail: 'Progression à charge égale.' }
  if (delta === 0) return { ...base, status: 'stable', headline: 'PERFORMANCE ÉGALE', detail: 'Niveau maintenu.' }
  return { ...base, status: 'down', headline: `−${-delta} REP${-delta > 1 ? 'S' : ''} VS DERNIÈRE FOIS`, detail: 'Variation ponctuelle.' }
}

/** Report rule: performance down two sessions in a row → remove one set for that muscle. */
export function dropAlert(workouts: Workout[], exerciseId: string): string | null {
  const hist = exerciseHistory(workouts, exerciseId).slice(-2)
  if (hist.length < 2) return null
  if (hist.every((h) => h.comparison?.status === 'down')) {
    const info = infoFor(exerciseId)
    return `${info.name} : performance en baisse 2 fois de suite. Retire 1 série à ce muscle. Si la baisse est générale, avance la décharge.`
  }
  return null
}

export interface FinishResult {
  workout: Workout
  progressions: { exerciseId: string; name: string; weight: number; text: string }[]
  alerts: string[]
  records: string[]
}

export function finalizeWorkout(workouts: Workout[], w: Workout): FinishResult {
  const progressions: FinishResult['progressions'] = []
  const records: string[] = []
  const exercises = w.exercises.map((ex) => {
    const completedOnly = { ...ex, sets: ex.sets.filter((s) => s.completed) }
    const prev = previousPerformance(workouts, ex.exerciseId, w.id)?.exercise ?? null
    const history = exerciseHistory(workouts.filter((x) => x.id !== w.id), ex.exerciseId)
    const comparison = compareExercise(completedOnly, prev, history, !!w.deload)
    const prog = progressionFor(completedOnly)
    if (prog) progressions.push({ exerciseId: ex.exerciseId, name: ex.name, ...prog })
    if (comparison.isRecord) records.push(ex.name)
    return { ...completedOnly, comparison, validated: doneSets(completedOnly).length > 0, skipped: ex.skipped || doneSets(completedOnly).length === 0 }
  })
  const workout = { ...w, exercises }
  const all = [...workouts.filter((x) => x.id !== w.id), workout]
  const alerts = exercises.map((ex) => dropAlert(all, ex.exerciseId)).filter((x): x is string => !!x)
  return { workout, progressions, alerts, records }
}

export function applyProgression(templates: Record<WorkoutType, Template>, exerciseId: string, weight: number): Record<WorkoutType, Template> {
  const out = { ...templates }
  for (const t of Object.keys(out) as WorkoutType[]) {
    const tpl = out[t]
    if (!tpl.exercises.some((e) => e.exerciseId === exerciseId)) continue
    out[t] = {
      ...tpl,
      exercises: tpl.exercises.map((e) => {
        if (e.exerciseId !== exerciseId || (e.target.weight ?? 0) >= weight) return e
        const next: TemplateExercise = { ...e, target: { ...e.target, weight } }
        return { ...next, nextTarget: nextTargetText(next) }
      }),
    }
  }
  return out
}

// ───────────────────────── Volume per muscle ─────────────────────────

export type MuscleVolume = Record<MuscleGroup, number>

export function emptyVolume(): MuscleVolume {
  return Object.fromEntries(MUSCLES.map((m) => [m.id, 0])) as MuscleVolume
}

export function workoutVolume(w: Workout, into: MuscleVolume = emptyVolume()): MuscleVolume {
  for (const ex of w.exercises) {
    const n = doneSets(ex).length
    if (!n) continue
    const groups = infoFor(ex.exerciseId, ex).groups
    for (const [g, f] of Object.entries(groups)) into[g as MuscleGroup] += n * (f ?? 0)
  }
  return into
}

export function weekVolume(workouts: Workout[], monday: ISODate): MuscleVolume {
  const end = addDays(monday, 6)
  const v = emptyVolume()
  for (const w of workouts) if (w.date >= monday && w.date <= end) workoutVolume(w, v)
  return v
}

export function plannedVolume(templates: Record<WorkoutType, Template>): MuscleVolume {
  const v = emptyVolume()
  for (const t of Object.values(templates)) {
    for (const ex of t.exercises) {
      const groups = infoFor(ex.exerciseId, ex).groups
      for (const [g, f] of Object.entries(groups)) v[g as MuscleGroup] += ex.target.sets * (f ?? 0)
    }
  }
  return v
}

export function weeklySessionCounts(workouts: Workout[], weeks: number, today: ISODate): { monday: ISODate; count: number }[] {
  const thisMonday = mondayOf(today)
  const out: { monday: ISODate; count: number }[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = addDays(thisMonday, -7 * i)
    const end = addDays(monday, 6)
    out.push({ monday, count: workouts.filter((w) => w.date >= monday && w.date <= end).length })
  }
  return out
}

/** Mean change of estimated 1RM on the program's loaded compound lifts, first session vs best of the last two. */
export function strengthSummary(workouts: Workout[], templates: Record<WorkoutType, Template>, recordsSince?: ISODate) {
  const ids = new Set(
    Object.values(templates).flatMap((t) =>
      t.exercises.filter((e) => (e.role ?? infoFor(e.exerciseId, e).role) === 'compound' && e.unit !== 'PDC').map((e) => e.exerciseId),
    ),
  )
  const changes: number[] = []
  for (const id of ids) {
    const h = exerciseHistory(workouts, id)
    if (h.length < 2 || h[0].best <= 0) continue
    const recent = Math.max(...h.slice(-2).map((x) => x.best))
    changes.push((recent - h[0].best) / h[0].best)
  }
  const records = workouts
    .filter((w) => !recordsSince || w.date >= recordsSince)
    .flatMap((w) => w.exercises)
    .filter((e) => e.comparison?.isRecord).length
  return { avg: changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : null, lifts: changes.length, records }
}

export function averageRir(w: Workout): number | null {
  const rirs = w.exercises.flatMap((e) => e.sets).filter((s) => s.completed && typeof s.rir === 'number').map((s) => s.rir as number)
  return rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null
}

export function sessionSetCount(w: Workout): number {
  return w.exercises.reduce((a, e) => a + doneSets(e).length, 0)
}

export function sessionDurationMin(w: Workout): number | null {
  if (!w.completedAt) return null
  const ms = new Date(w.completedAt).getTime() - new Date(w.startedAt).getTime()
  if (!(ms > 0) || ms > 4 * 3600_000) return null
  return Math.round(ms / 60_000)
}
