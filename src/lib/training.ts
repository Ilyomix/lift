import { effortBounds, effortTarget, progressionSets, prescribedSets, recordedRir } from './effort'
import { chronological, comparisonContext, exerciseContextReason, previousComparablePerformance, workoutContextReason, workoutsBefore } from './comparability'
import { contextReasonLabel, type ContextReason } from './trainingMessages'
import { addDays, diffDays, mondayOf, todayISO } from './date'
import { bodyweightLabel, fmtLoad, fmtNum, roundTo } from './format'
import { gymOf, HOME_GYM, isGymBound, loadAt } from './gyms'
import { L, lang } from './i18n'
import { infoFor, MUSCLES, type MuscleGroup } from './library'
import { autoAdjustActive, contextAt, daysFactorFor, incrementFor, isRestDay, nextInRotation, nextTargetText, PLAN_DAYS, scaledSession, SESSION_OVERHEAD_MIN, sessionSlots, SET_DROP_REASON, takesLest } from './program'
import type {
  ActiveWorkout, AppState, AutoChange, Comparison, ISODate, Template, TemplateExercise, Unit, Workout, WorkoutExercise, WorkoutSet, WorkoutType,
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

/** Body weight assumed when added load has to be weighed against reps: only the order of magnitude matters. */
const NOMINAL_BODYWEIGHT = 75

/**
 * Score of a set: estimated 1RM for loaded work, clean reps for bodyweight work. Added load
 * on a bodyweight exercise counts as the reps it is worth without it (Epley), so that
 * +2.5 kg for one rep less still reads as progress.
 */
export function setScore(s: WorkoutSet, unit: Unit): number {
  const reps = cleanOf(s)
  if (unit === 'PDC') return s.weight && s.weight > 0 ? 30 * ((1 + s.weight / NOMINAL_BODYWEIGHT) * (1 + reps / 30) - 1) : reps
  if (typeof s.weight !== 'number' || !Number.isFinite(s.weight)) return 0
  return e1rm(s.weight, reps)
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
  comparisonContext: string
  gymId: string
}

/**
 * Rep range an exercise is done in. The program has some exercises in two sessions with two
 * ranges (heavy in one, lighter in the other): two prescriptions, each followed on its own.
 */
export type RepRange = { minReps: number; maxReps: number }

const sameRange = (a: RepRange, b: RepRange): boolean => a.minReps === b.minReps && a.maxReps === b.maxReps

/**
 * Every session of an exercise. With a gym, machine and cable work is limited to
 * that gym (a machine elsewhere is another machine); free weights ignore the filter.
 * With a rep range (`like`), only the sessions where it was done in that range.
 */
export function exerciseHistory(workouts: Workout[], exerciseId: string, gymId?: string, like?: RepRange): HistoryPoint[] {
  const out: HistoryPoint[] = []
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId || ex.skipped) continue
      if (gymId !== undefined && isGymBound(ex) && gymOf(w) !== gymId) continue
      if (like && !sameRange(ex.target, like)) continue
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
        comparisonContext: comparisonContext(ex),
        gymId: gymOf(w),
      })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.sessionNumber - b.sessionNumber : a.date < b.date ? -1 : 1))
}

/**
 * Last performance of an exercise. With a rep range (`like`), the last one done in that range
 * comes first, so that an exercise the program has in two sessions with two ranges is followed
 * like for like; without any in that range, the last one anywhere. When supplied, prefer the
 * same split within the range so programmed reminders keep their own reference.
 */
export function previousPerformance(workouts: Workout[], exerciseId: string, excludeId?: string, gymId?: string, like?: RepRange, preferredType?: WorkoutType): { workout: Workout; exercise: WorkoutExercise } | null {
  return previousComparablePerformance(workouts, exerciseId, excludeId, like,
    (w, ex) => gymId === undefined || !isGymBound(ex) || gymOf(w) === gymId, preferredType)
}

export function setsSummary(sets: WorkoutSet[], unit: Unit): string {
  const done = sets.filter((s) => s.completed)
  if (!done.length) return '—'
  const sameWeight = done.every((s) => s.weight === done[0].weight)
  if (sameWeight) {
    const w = unit === 'PDC' ? (done[0].weight ? `${bodyweightLabel()}+${fmtNum(done[0].weight)}` : bodyweightLabel()) : fmtNum(done[0].weight)
    return `${w} × ${done.map((s) => cleanOf(s)).join(' · ')}`
  }
  return done.map((s) => `${unit === 'PDC' ? (s.weight ? `${bodyweightLabel()}+${fmtNum(s.weight)}` : bodyweightLabel()) : fmtNum(s.weight)}×${cleanOf(s)}`).join(' · ')
}

// ───────────── Loads ─────────────

/** Load of a set as a number: for a bodyweight exercise, the added weight (0 without any). */
function loadOf(ex: { unit: Unit }, s: WorkoutSet): number | null {
  return typeof s.weight === 'number' ? s.weight : ex.unit === 'PDC' ? 0 : null
}

/** Target load as a number: null before a trial session, and for bodyweight work that takes no added load. */
function targetLoad(ex: Pick<WorkoutExercise, 'exerciseId' | 'unit' | 'target'>): number | null {
  if (ex.unit === 'PDC') return takesLest(ex) ? (ex.target.weight ?? 0) : null
  return ex.target.weight ?? null
}

/**
 * Loads already used on a piece of equipment, lightest first. With a gym, machine and
 * cable work is limited to that gym (a machine elsewhere is another machine).
 */
export function knownLoads(workouts: Pick<Workout, 'exercises' | 'gymId'>[], exerciseId: string, gymId?: string, like?: Pick<WorkoutExercise, 'unit' | 'comparisonContext'>): number[] {
  const seen = new Map<number, number>()
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId || ex.skipped) continue
      if (gymId !== undefined && isGymBound(ex) && gymOf(w) !== gymId) continue
      if (like && (ex.unit !== like.unit || comparisonContext(ex) !== comparisonContext(like))) continue
      for (const s of ex.sets) if (s.completed && typeof s.weight === 'number' && s.weight > 0) seen.set(s.weight, (seen.get(s.weight) ?? 0) + 1)
    }
  }
  // A load of the equipment comes back; a load seen on a single set can be a typing mistake.
  return [...seen].filter(([, sets]) => sets >= 2).map(([load]) => load).sort((a, b) => a - b)
}

/** The loads to move to from a given one, on a given piece of equipment. */
export interface Steps {
  /** `times` steps heavier (one by default). */
  up: (from: number, times?: number) => number
  /** `times` steps lighter (one by default). */
  down: (from: number, times?: number) => number
  /** The heaviest load of the equipment that does not exceed `x`. */
  below: (x: number) => number
}

/**
 * Standard equipment moves by its increment (2.5 kg, 2 kg per dumbbell…). A machine whose
 * logged loads fall off that grid has steps of its own: the loads already used on it are
 * proposed again, rather than figures it does not have. A known load counts as a step when it
 * is within reach (two increments, or 12 %) and at least a quarter of an increment away;
 * beyond the known loads, the standard arithmetic takes over.
 */
export function stepsFor(ex: { exerciseId: string; unit: Unit }, known: number[] = []): Steps {
  const inc = incrementFor(ex)
  if (inc <= 0) return { up: (w) => w, down: (w) => w, below: (x) => x }
  const offGrid = (x: number) => Math.abs(x / inc - Math.round(x / inc)) > 1e-6
  const own = known.some(offGrid) ? known : []
  const reach = (w: number) => Math.max(2 * inc, 0.12 * w) + 1e-9
  const apart = inc / 4 - 1e-9
  // Added load on a bodyweight exercise can go back to none; any other load keeps at least one step.
  const floor = ex.unit === 'PDC' ? 0 : inc
  return {
    up: (from, times = 1) => {
      let w = from
      for (let left = times; left > 0; left--) {
        const next = own.find((l) => l >= w + apart)
        if (next === undefined || next > w + reach(w)) return roundTo(w + left * Math.max(inc, w * 0.025), inc)
        w = next
      }
      return w
    },
    down: (from, times = 1) => {
      let w = from
      for (let left = times; left > 0; left--) {
        const prev = own.filter((l) => l <= w - apart).pop()
        if (prev === undefined || prev < w - reach(w)) return Math.min(w, Math.max(floor, roundTo(w - left * Math.max(inc, w * 0.05), inc)))
        w = prev
      }
      return w
    },
    below: (x) => own.filter((l) => l <= x + 1e-9).pop() ?? Math.floor(x / inc + 1e-9) * inc,
  }
}

// ───────────── Effort ─────────────
// The report's rule moves a load when the range is reached "at the target RIR". A set
// pushed further than planned says less about the load than its reps suggest: its reps
// are counted as if it had stopped at the planned effort.

const rirBounds = effortBounds

/** Upper bound of an effort target such as "1–2" or "3". */
export function rirUpper(rir: string | undefined): number | null {
  const n = rirBounds(rir)
  return n.length ? Math.max(...n) : null
}

/** Lower bound of an effort target: the hardest effort the plan asks for. */
function rirLower(rir: string | undefined): number | null {
  const n = rirBounds(rir)
  return n.length ? Math.min(...n) : null
}

/** Effort logged on a set: its RIR, or 0 for a set flagged as a failure. Null when nothing was logged. */
function setRir(s: WorkoutSet): number | null {
  return recordedRir(s)
}

/** A RIR is an estimate: one rep short of the plan still counts as on plan. */
const EFFORT_TOLERANCE = 1

type Planned = Pick<WorkoutExercise, 'prescription' | 'target'>

/** Hardest effort (lowest RIR) that still counts as the planned one for this exercise. */
function allowedRir(ex: Planned): number | null {
  const planned = rirLower(effortTarget(ex))
  return planned === null ? null : Math.max(0, planned - EFFORT_TOLERANCE)
}

/** Reps in reserve a set went past the planned effort (0 when on plan, or when no effort was logged). */
function effortOvershoot(ex: Planned, s: WorkoutSet): number {
  const allowed = allowedRir(ex)
  const done = setRir(s)
  return allowed === null || done === null ? 0 : Math.max(0, allowed - done)
}

/** Clean reps of a set at the planned effort: pushed further than planned, it would have stopped earlier. */
function repsAtPlannedEffort(ex: Planned, s: WorkoutSet): number {
  return Math.max(0, cleanOf(s) - effortOvershoot(ex, s))
}

/**
 * Heaviest load that should hold the bottom of the range at the planned effort, estimated
 * (Epley) from the weakest of the sets that only held it by going further.
 * Null when every set held the range at the planned effort.
 */
function effortCap(ex: WorkoutExercise, sets: WorkoutSet[], steps: Steps): { weight: number; rir: number } | null {
  const lo = ex.target.minReps
  const pushed = sets.filter((s) => repsAtPlannedEffort(ex, s) < lo)
  const allowed = allowedRir(ex)
  if (!pushed.length || allowed === null) return null
  const rir = Math.min(...pushed.map((s) => setRir(s) ?? 0))
  // Added load is a small share of what a bodyweight exercise lifts: no estimate, the heavier load is simply not adopted.
  if (ex.unit === 'PDC') return { weight: Number.NEGATIVE_INFINITY, rir }
  const loads = pushed.map((s) => e1rm(s.weight as number, cleanOf(s) + (setRir(s) ?? 0)) / (1 + (lo + allowed) / 30))
  return { weight: steps.below(Math.min(...loads)), rir }
}

/** Sets of a session pushed further than the planned effort, among those with a logged effort. */
export function sessionEffort(w: Workout): { pushed: number; logged: number; planned: string | null } {
  let pushed = 0
  let logged = 0
  const plans = new Set<string>()
  for (const ex of w.exercises) {
    if (ex.skipped) continue
    for (const s of doneSets(ex)) {
      if (setRir(s) === null) continue
      logged++
      if (effortOvershoot(ex, s) > 0) {
        pushed++
        plans.add(effortTarget(ex) ?? '')
      }
    }
  }
  return { pushed, logged, planned: plans.size === 1 ? [...plans][0] : null }
}

// ───────────── Load decisions ─────────────

/**
 * Sets the double progression is judged on: the session's sets, or the plan's sets at five days
 * when the session has more (fewer training days). The sets added to keep the weekly volume
 * come after them, with fewer reps: asking them all for the top of the range would hold the load back.
 */
function setsToMaster(ex: WorkoutExercise): number {
  return progressionSets(ex)
}

/**
 * Double progression test: every set the plan asks for (setsToMaster), at the target load or
 * heavier, reached the top of the range without pain (`repsOf` says which reps count). Gives the
 * lightest load used on those sets, which the progression starts from, or null.
 */
function topBase(ex: WorkoutExercise, repsOf: (s: WorkoutSet) => number): number | null {
  if (ex.skipped) return null
  const W = targetLoad(ex)
  if (W === null) return null
  if (ex.prescription && ex.prescription.loadFactor < 1) return null
  const needed = setsToMaster(ex)
  const sets = doneSets(ex)
  if (sets.length < needed || sets.some((s) => s.flags.includes('pain'))) return null
  let base = Infinity
  for (const s of sets.slice(0, needed)) {
    const load = loadOf(ex, s)
    if (load === null || load < W || repsOf(s) < ex.target.maxReps || s.flags.includes('pain')) return null
    base = Math.min(base, load)
  }
  return base
}

/**
 * Double progression: all prescribed sets reached the top of the range at the planned effort,
 * clean, without pain. The next load is one step above the load really used, on the equipment's own steps.
 */
export function progressionFor(ex: WorkoutExercise, known: number[] = []): { weight: number; text: string } | null {
  const base = topBase(ex, (s) => repsAtPlannedEffort(ex, s))
  if (base === null) return null
  const next = stepsFor(ex, known).up(base)
  if (next <= base) return null
  return { weight: next, text: L(`${fmtLoad(next, ex.unit)} la prochaine fois`, `${fmtLoad(next, ex.unit)} next time`) }
}

/**
 * The top of the range was reached at the target load, but only by going past the planned
 * effort: the load stays where it is. (At a heavier load, rule 2 of loadDecision decides.)
 */
export function heldByEffort(ex: WorkoutExercise): boolean {
  return topBase(ex, cleanOf) === targetLoad(ex) && targetLoad(ex) !== null && topBase(ex, (s) => repsAtPlannedEffort(ex, s)) === null
}

/**
 * Bodyweight work that takes no added load (bands, floor work) at the top of its range:
 * no load to raise, the next step is a harder variation.
 */
export function toppedOut(ex: WorkoutExercise): boolean {
  if (ex.unit !== 'PDC' || takesLest(ex) || ex.skipped) return false
  if (ex.prescription && ex.prescription.loadFactor < 1) return false
  const needed = setsToMaster(ex)
  const sets = doneSets(ex)
  return sets.length >= needed && sets.slice(0, needed).every((s) => repsAtPlannedEffort(ex, s) >= ex.target.maxReps && !s.flags.includes('pain'))
}

export interface LoadDecision {
  weight: number
  kind: 'up' | 'down' | 'baseline'
  text: string
}

/**
 * Next load after a session, from the performance only (the body-weight trend never
 * moves loads: keeping them during the cut is the signal that muscle is preserved).
 * 1. Every prescribed set at the top of the range → one step above the load used (double progression).
 * 2. The load was changed during the session and held the range → it becomes the target.
 *    When both apply, the heavier target wins.
 * 3. Every set at the target under the bottom of the range → lighter.
 * Deload and re-entry weeks never move the target; pain on a set holds the load.
 * Effort only holds a load back: reps count at the planned effort for rules 1 and 2
 * (a heavier load held by going further is brought down to what that effort allows),
 * and never make a load lighter.
 * With fewer than five training days, the three rules read the plan's sets (setsToMaster),
 * not the sets added to keep the weekly volume.
 * `known` lists the loads already used on the equipment (see stepsFor).
 */
export function loadDecision(ex: WorkoutExercise, known: number[] = []): LoadDecision | null {
  if (ex.skipped) return null
  if (ex.prescription && ex.prescription.loadFactor < 1) return null
  const W = targetLoad(ex)
  if (W === null) return null
  const done = doneSets(ex).filter((s) => loadOf(ex, s) !== null)
  if (!done.length) return null
  const load = (s: WorkoutSet) => loadOf(ex, s) as number
  const needed = setsToMaster(ex)
  // With sets added to keep the weekly volume, the load is judged on the plan's sets only: the
  // added ones come after, with fewer reps or a load the app corrected on the way.
  const sets = done.slice(0, needed)
  const { minReps: lo, maxReps: hi } = ex.target
  const steps = stepsFor(ex, known)
  // Pain on any set of the exercise, added ones included: its load does not go up this time.
  const hurt = done.some((s) => s.flags.includes('pain'))

  const top = progressionFor(ex, known)
  // The range is mastered at the target, but it hurt: the load stays where it is.
  if (top && hurt) return null
  const up: LoadDecision | null = top && { weight: top.weight, kind: 'up', text: L(`${needed} × ${hi} atteint : ${fmtLoad(top.weight, ex.unit)} la prochaine fois`, `${needed} × ${hi} reached: ${fmtLoad(top.weight, ex.unit)} next time`) }

  let moved: LoadDecision | null = null
  const last = load(sets[sets.length - 1])
  const atLast = sets.filter((s) => load(s) === last)
  if (last !== W && !(hurt && last > W) && atLast.length >= Math.min(2, needed) && atLast.every((s) => cleanOf(s) >= lo && !s.flags.includes('pain'))) {
    const cap = last > W ? effortCap(ex, atLast, steps) : null
    // A lighter load taken to the top of the range, one step under the target: the target is already the next step.
    const failedAtTarget = sets.filter((s) => load(s) >= W).some((s) => cleanOf(s) < lo)
    const oneStepUnder = last < W && !failedAtTarget && steps.up(last) >= W && atLast.every((s) => repsAtPlannedEffort(ex, s) >= hi)
    if (oneStepUnder) {
      moved = null
    } else if (!cap) {
      moved = { weight: last, kind: last > W ? 'up' : 'down', text: L(`Charge ajustée pendant la séance : ${fmtLoad(last, ex.unit)} devient la cible`, `Load adjusted during the workout: ${fmtLoad(last, ex.unit)} becomes the target`) }
    } else if (cap.weight > W) {
      // Held only by going further than planned: the target is what the planned effort allows, if that is still heavier.
      const planned = effortTarget(ex)
      moved = {
        weight: cap.weight, kind: 'up',
        text: L(
          `${fmtLoad(last, ex.unit)} avec ${cap.rir} répétitions en réserve pour ${planned} prévues : ${fmtLoad(cap.weight, ex.unit)} la prochaine fois`,
          `${fmtLoad(last, ex.unit)} with ${cap.rir} reps in reserve instead of the planned ${planned}: ${fmtLoad(cap.weight, ex.unit)} next time`,
        ),
      }
    }
  }
  if (up && (!moved || moved.weight <= up.weight)) return up
  if (moved) return moved

  const atW = sets.filter((s) => load(s) >= W)
  if (atW.length >= Math.min(2, needed) && atW.every((s) => cleanOf(s) < lo)) {
    const next = steps.down(W)
    if (next < W) return { weight: next, kind: 'down', text: L(`Toutes les séries sous ${lo} répétitions : ${fmtLoad(next, ex.unit)} la prochaine fois`, `Every set under ${lo} reps: ${fmtLoad(next, ex.unit)} next time`) }
  }
  return null
}

/** Trial session (no target yet): the heaviest load that held the range at the planned effort becomes the starting load. */
export function baselineFor(ex: WorkoutExercise): LoadDecision | null {
  if (ex.unit === 'PDC' || ex.skipped) return null
  if (ex.target.weight !== null && ex.target.weight !== undefined) return null
  if (doneSets(ex).some((s) => s.flags.includes('pain'))) return null
  const sets = doneSets(ex).slice(0, setsToMaster(ex)).filter((s) => typeof s.weight === 'number' && (s.weight as number) > 0)
  if (!sets.length) return null
  const inc = incrementFor(ex)
  const inRange = sets.filter((s) => repsAtPlannedEffort(ex, s) >= ex.target.minReps)
  let weight: number
  if (inRange.length) {
    const best = Math.max(...inRange.map((s) => s.weight as number))
    const topHit = inRange.filter((s) => s.weight === best).every((s) => repsAtPlannedEffort(ex, s) >= ex.target.maxReps)
    weight = topHit && inc > 0 ? roundTo(best + inc, inc) : best
  } else {
    const lightest = Math.min(...sets.map((s) => s.weight as number))
    weight = inc > 0 ? Math.min(lightest, Math.max(inc, roundTo(lightest - inc, inc))) : lightest
  }
  return { weight, kind: 'baseline', text: L(`Charge de départ : ${fmtLoad(weight, ex.unit)}`, `Starting load: ${fmtLoad(weight, ex.unit)}`) }
}

/**
 * In-session correction after a completed set, applied to the following sets:
 * far above the range (or clearly easier than the effort target) → heavier;
 * far below the range → lighter. Deload weeks keep their fixed loads.
 */
export function intraSessionAdjust(ex: WorkoutExercise, setIndex: number, known: number[] = []): { weight: number; text: string } | null {
  if (ex.unit === 'PDC' || ex.skipped) return null
  if (ex.prescription && ex.prescription.loadFactor < 1) return null
  const s = ex.sets[setIndex]
  if (!s?.completed || typeof s.weight !== 'number' || s.flags.includes('pain')) return null
  if (!ex.sets.slice(setIndex + 1).some((x) => !x.completed)) return null
  if (incrementFor(ex) <= 0) return null
  const steps = stepsFor(ex, known)
  const r = cleanOf(s)
  const { minReps: lo, maxReps: hi } = ex.target
  const target = rirUpper(effortTarget(ex))
  const rir = setRir(s)
  const easy = effortOvershoot(ex, s) === 0 && (r >= hi + 3 || (r >= hi && rir !== null && target !== null && rir >= target + 3))
  if (easy) {
    const weight = steps.up(s.weight, r >= hi + 6 ? 2 : 1)
    return {
      weight,
      text: L(
        `${r} répétitions${typeof s.rir === 'number' ? ` avec ${s.rir} répétitions en réserve` : ''} : ${fmtLoad(weight, ex.unit)} pour la suite`,
        `${r} reps${typeof s.rir === 'number' ? ` with ${s.rir} reps in reserve` : ''}: ${fmtLoad(weight, ex.unit)} for the next sets`,
      ),
    }
  }
  if (r <= lo - 3) {
    const weight = steps.down(s.weight, r <= lo - 5 ? 2 : 1)
    if (weight < s.weight) return { weight, text: L(`${r} répétitions, sous ${lo} : ${fmtLoad(weight, ex.unit)} pour rester dans la fourchette`, `${r} reps, under ${lo}: ${fmtLoad(weight, ex.unit)} to stay in the range`) }
  }
  return null
}

/**
 * Below this change of estimated level between two sessions at different loads, the level is
 * the same: about two reps. Reps turn into a level through a formula (Epley) that fits each
 * lifter and each exercise only roughly, so a verdict across loads needs a clear gap.
 */
const LEVEL_TOLERANCE = 0.05

/**
 * Normal variation between two sessions, in clean reps over the sets they share. At a fixed
 * load, the reps of a set move by 0.7 to 1.1 from one week to the next with no change of level
 * (typical error; Mitter et al. 2022, trained lifters), and a change in one person is likely
 * real only beyond 1.5 to 2 times that error (Hopkins 2000). A drop therefore counts from one
 * rep per set on average, and from two reps in all; under that, it says nothing.
 */
export function dropMargin(sets: number): number {
  return Math.max(2, sets)
}

/** A stretch of this many days without any session, since an exercise was last done, makes that session no reference for it. */
const BREAK_DAYS = 14

/** A session whose loads the program lightened (deload, return after a break): neither a measure nor a reference. */
const lightened = (ex: WorkoutExercise | null): boolean => !!ex?.prescription && ex.prescription.loadFactor < 1

/**
 * Compares a session of an exercise with the previous one, on the sets both have: a set added
 * or removed since does not hide the trend. At the same loads, clean reps are counted; at
 * different loads, the estimated level (setScore) says whether the performance dropped, so
 * that the fatigue signal (dropAlert) still works when a load moved.
 * A drop is only called when nothing else explains it:
 * - a lightened session (deload, return after a break) is not compared, nor the one after it,
 *   nor a session separated from the previous one by two weeks or more without training
 *   (`breakDays`: the longest stretch without any session between the two);
 * - every set heavier than last time and still in the range is a progression step: fewer reps
 *   are expected;
 * - reps kept in reserve beyond last time's (RIR logged on both sides, else what the two plans
 *   asked for) are added back. They excuse a drop and never create one.
 * A drop is `marked` when it is beyond normal variation (dropMargin at the same loads; at
 * different loads the level tolerance already is): only those count for the fatigue signal.
 * `prev` is the last performance in the same rep range when there is one (previousPerformance):
 * at other loads in another range, the session is the baseline of its own range.
 */
export function compareExercise(ex: WorkoutExercise, prev: WorkoutExercise | null, history: HistoryPoint[], deload: boolean, prevDeload = false, breakDays = 0, contextReason?: ContextReason | null): Comparison {
  const sets = doneSets(ex)
  const totalReps = sets.reduce((a, s) => a + (s.reps ?? 0), 0)
  const totalCleanReps = sets.reduce((a, s) => a + cleanOf(s), 0)
  const volume = sets.reduce((a, s) => a + (s.weight ?? 0) * cleanOf(s), 0)
  const prog = progressionFor(ex)
  const base: Comparison = {
    status: 'stable', headline: '', detail: '', totalReps, totalCleanReps, volume,
    deltaCleanReps: null, previousTotalCleanReps: null, previousSetReps: null, previousWeights: null,
    chargeValidated: !!prog, suggestion: prog ? L('PROCHAINE CIBLE : AUGMENTER LA CHARGE', 'NEXT TARGET: INCREASE THE LOAD') : null, isRecord: false,
  }
  if (ex.skipped || sets.length === 0) {
    return { ...base, status: 'skipped', headline: L('NON RÉALISÉ', 'NOT DONE'), detail: ex.skipReason || L('Aucune série comptabilisée', 'No sets logged'), chargeValidated: false, suggestion: null }
  }
  const missingLoad = (exercise: WorkoutExercise) => exercise.unit !== 'PDC'
    && doneSets(exercise).some(s => typeof s.weight !== 'number' || !Number.isFinite(s.weight))
  const reason = prev ? contextReason ?? exerciseContextReason(ex, prev) : null
  if (!reason && (missingLoad(ex) || (prev && missingLoad(prev)))) return {
    ...base, status: 'new-baseline', headline: L('COMPARAISON INDISPONIBLE', 'COMPARISON UNAVAILABLE'),
    detail: L('Charge manquante sur une série de cette séance ou de la précédente.', 'A load is missing from a set in this workout or the previous one.'),
    marked: false, chargeValidated: false, suggestion: null,
  }
  const bestNow = Math.max(...sets.map((s) => setScore(s, ex.unit)))
  const recordHistory = history.filter(h => h.best > 0 && h.unit === ex.unit && h.comparisonContext === comparisonContext(ex))
  const bestBefore = recordHistory.length ? Math.max(...recordHistory.map((h) => h.best)) : 0
  base.isRecord = recordHistory.length > 0 && bestNow > bestBefore + 1e-9
  if (!prev || !doneSets(prev).length) return { ...base, status: 'new-baseline', headline: L('NOUVELLE RÉFÉRENCE', 'NEW BASELINE'), detail: L('Première performance enregistrée', 'First performance logged') }
  const prevSets = doneSets(prev)
  base.previousTotalCleanReps = prevSets.reduce((a, s) => a + cleanOf(s), 0)
  base.previousSetReps = prevSets.map(cleanOf)
  base.previousWeights = prevSets.map((s) => s.weight)
  if (deload) return { ...base, status: 'deload', headline: L('SEMAINE ALLÉGÉE', 'DELOAD WEEK'), detail: L('Semaine allégée : pas de comparaison.', 'Deload week: no comparison.') }
  if (reason) {
    const newBaseline = reason === 'rep-range-changed' || reason === 'workout-type-changed'
    return { ...base, status: newBaseline ? 'new-baseline' : 'different-context', headline: newBaseline ? L('NOUVELLE RÉFÉRENCE', 'NEW BASELINE') : L('CONDITIONS DIFFÉRENTES', 'DIFFERENT CONDITIONS'), detail: contextReasonLabel(reason), contextReason: reason, marked: false, isRecord: false, chargeValidated: false, suggestion: null }
  }
  if (lightened(ex)) return { ...base, status: 'deload', headline: L('SÉANCE ALLÉGÉE', 'LIGHTER WORKOUT'), detail: L('Charges allégées par le programme : pas de comparaison.', 'Loads lightened by the program: no comparison.') }
  if (prevDeload || lightened(prev)) return { ...base, status: 'deload', headline: L('APRÈS SÉANCE ALLÉGÉE', 'AFTER A LIGHTER WORKOUT'), detail: L('Pas de comparaison avec une séance allégée.', 'No comparison with a lighter workout.') }
  if (breakDays >= BREAK_DAYS) return { ...base, status: 'deload', headline: L('APRÈS UNE PAUSE', 'AFTER A BREAK'), detail: L('Deux semaines ou plus sans séance depuis : pas de comparaison.', 'Two weeks or more without a workout since: no comparison.') }

  const k = Math.min(sets.length, prevSets.length, prescribedSets(ex), prescribedSets(prev))
  base.comparedSets = k
  const now = sets.slice(0, k)
  const before = prevSets.slice(0, k)
  const common = sets.length === prevSets.length && k === sets.length
    ? ''
    : L(
        ` Sur ${k === 1 ? 'la série commune' : `les ${k} séries communes`} (${sets.length} contre ${prevSets.length} la dernière fois).`,
        ` On the ${k === 1 ? 'set' : `${k} sets`} both workouts have (${sets.length} vs ${prevSets.length} last time).`,
      )
  // Reserve is compared like with like: logged against logged; otherwise what the plans asked for,
  // which only counts when the plan asks for more reserve today than it did last time (`eased`).
  const planBefore = rirBounds(effortTarget(prev))
  const planNow = rirBounds(effortTarget(ex))
  const eased = planNow.length && planBefore.length ? Math.max(0, Math.min(...planNow) - Math.min(...planBefore), Math.max(...planNow) - Math.max(...planBefore)) : 0
  const spared = (s: WorkoutSet, i: number): number => {
    const today = setRir(s)
    const then = setRir(before[i])
    if (today !== null && then !== null) return Math.max(0, today - then)
    // One side only: the logged effort can deny the excuse of an eased plan, never widen it.
    if (!eased) return 0
    if (today !== null) return Math.min(eased, Math.max(0, today - Math.min(...planBefore)))
    if (then !== null) return Math.min(eased, Math.max(0, Math.max(...planNow) - then))
    return eased
  }
  const sameLoads = now.every((s, i) => (s.weight ?? 0) === (before[i].weight ?? 0))
  if (!sameLoads) {
    // Another rep range at other loads (the exercise as another session has it, or a sheet just edited): no verdict between two prescriptions.
    if (!sameRange(ex.target, prev.target)) {
      return { ...base, status: 'new-baseline', headline: L('NOUVELLE RÉFÉRENCE', 'NEW BASELINE'), detail: L('Première séance dans cette fourchette de répétitions.', 'First workout in this rep range.') }
    }
    const level = (xs: WorkoutSet[], extra: (s: WorkoutSet, i: number) => number) => xs.reduce((a, s, i) => a + setScore({ ...s, cleanReps: cleanOf(s) + extra(s, i) }, ex.unit), 0) / k
    const was = level(before, () => 0)
    const change = was > 0 ? level(now, spared) / was - 1 : 0
    // Every set heavier and still in the range: a progression step, where fewer reps are expected.
    const step = now.every((s, i) => (s.weight ?? 0) > (before[i].weight ?? 0) && cleanOf(s) >= ex.target.minReps)
    if (!step && change < -LEVEL_TOLERANCE) {
      return {
        ...base, status: 'down', marked: true, headline: L(`NIVEAU ESTIMÉ −${Math.max(1, Math.round(-change * 100))} %`, `ESTIMATED LEVEL −${Math.max(1, Math.round(-change * 100))}%`),
        detail: L('Charges différentes : comparé sur le niveau estimé.', 'Different loads: compared on the estimated level.') + common,
      }
    }
    const heavier = now.every((s, i) => (s.weight ?? 0) >= (before[i].weight ?? 0))
    const prevVol = prevSets.reduce((a, s) => a + (s.weight ?? 0) * cleanOf(s), 0)
    return {
      ...base,
      status: 'load-change',
      headline: heavier ? L('CHARGE SUPÉRIEURE', 'HEAVIER LOAD') : L('RÉPARTITION DES CHARGES MODIFIÉE', 'LOAD PATTERN CHANGED'),
      // Body weight is not in the volume: for bodyweight work, only the added load can be named.
      detail: ex.unit === 'PDC'
        ? L('Lest différent de la dernière fois.', 'Added load differs from last time.')
        : L(`Volume propre : ${fmtNum(volume, 0)} contre ${fmtNum(prevVol, 0)} kg·reps.`, `Clean volume: ${fmtNum(volume, 0)} vs ${fmtNum(prevVol, 0)} kg·reps.`),
    }
  }
  const delta = now.reduce((a, s) => a + cleanOf(s), 0) - before.reduce((a, s) => a + cleanOf(s), 0)
  base.deltaCleanReps = delta
  if (delta > 0) return { ...base, status: 'progress', headline: L(`+${delta} RÉPÉTITION${delta > 1 ? 'S' : ''}`, `+${delta} REP${delta > 1 ? 'S' : ''}`), detail: L('Progression à charge égale.', 'Progress at the same load.') + common }
  if (delta === 0) return { ...base, status: 'stable', headline: L('PERFORMANCE ÉGALE', 'SAME PERFORMANCE'), detail: L('Niveau maintenu.', 'Level maintained.') + common }
  // Reps lost once the reserve kept is counted.
  const kept = now.reduce((a, s, i) => a + spared(s, i), 0)
  const lost = -(delta + kept)
  if (lost <= 0) {
    return { ...base, status: 'stable', headline: L('MOINS DE RÉPÉTITIONS, PLUS DE MARGE', 'FEWER REPS, MORE IN RESERVE'), detail: L('Plus de marge gardée que la dernière fois : pas une baisse.', 'More kept in reserve than last time: not a drop.') + common }
  }
  const marked = lost >= dropMargin(k)
  const detail = marked
    ? L('Nette baisse : au-delà de la variation normale.', 'Clear drop: beyond normal variation.')
    : kept > 0
      ? L('Plus de marge gardée que la dernière fois : le reste est une variation normale.', 'More kept in reserve than last time: the rest is normal variation.')
      : L('Variation normale d’une séance à l’autre.', 'Normal variation from one workout to the next.')
  return { ...base, status: 'down', marked, headline: L(`−${-delta} RÉPÉTITION${-delta > 1 ? 'S' : ''} VS DERNIÈRE FOIS`, `−${-delta} REP${-delta > 1 ? 'S' : ''} VS LAST TIME`), detail: detail + common }
}

/**
 * A drop that counts for the fatigue signal: beyond normal variation. Comparisons stored before
 * the margin existed carry no verdict: at the same loads the reps lost are measured again; at
 * different loads the drop may have been read against the exercise's other rep range, so it
 * does not count.
 */
export function countedDrop(h: Pick<HistoryPoint, 'sets' | 'comparison'>): boolean {
  const c = h.comparison
  if (c?.status !== 'down') return false
  if (c.marked !== undefined) return c.marked
  if (c.deltaCleanReps === null) return false
  const shared = Math.min(h.sets.length, c.previousSetReps?.length ?? h.sets.length)
  return -c.deltaCleanReps >= dropMargin(shared)
}

/**
 * Report rule: performance down two sessions in a row → remove one set for that muscle.
 * Both drops have to be beyond normal variation (countedDrop): a rep lost here and there is not fatigue.
 * With a rep range (`like`), the two sessions are the last two in that range and split.
 * Without a requested split, use the latest matching workout's type.
 */
export function dropAlert(workouts: Workout[], exerciseId: string, gymId?: string, like?: RepRange, preferredType?: WorkoutType): string | null {
  const history = exerciseHistory(workouts, exerciseId, gymId, like)
  const type = preferredType ?? history[history.length - 1]?.type
  const hist = history.filter(h => h.type === type).slice(-2)
  if (hist.length < 2 || !hist.every(countedDrop)) return null
  for (const h of hist) {
    const source = workouts.find((w) => w.id === h.workoutId)
    const ex = source?.exercises.find((e) => e.exerciseId === exerciseId)
    if (!source || !ex) return null
    const before = previousPerformance(workoutsBefore(workouts, source), exerciseId, undefined, gymId, ex.prescription ?? ex.target, source.type)
    if (!before || workoutContextReason(source, ex, before.workout, before.exercise)) return null
  }
  const info = infoFor(exerciseId)
  return L(
    `${info.name} : nette baisse 2 séances de suite. Retire 1 série à ce muscle. Si la baisse est générale, avance la semaine allégée.`,
    `${info.name}: clear drop 2 workouts in a row. Remove 1 set for this muscle. If the drop is general, bring the deload forward.`,
  )
}

/** Sessions in a row without any progress on an exercise before it is called a plateau. */
export const PLATEAU_SESSIONS = 4

const isHeavier = (c: Comparison) => c.status === 'load-change' && /^(CHARGE SUP|HEAVIER LOAD)/.test(c.headline)

/** A session that neither progressed nor could be read otherwise: equal, down, or a reshuffle of the loads. */
const stalled = (c: Comparison | null): boolean =>
  !!c && !c.isRecord && !c.chargeValidated && (c.status === 'stable' || c.status === 'down' || (c.status === 'load-change' && !isHeavier(c)))

/**
 * What a session says beyond the loads, as exercise names: pain flagged on a set (and whether
 * it was already there last time), and exercises without progress for several sessions.
 * Nothing changes in the plan: these are the cases where a human look is worth it.
 * A plateau is not looked for during a cut (holding the loads is the goal there), on a deload,
 * or where two drops in a row already removed a set. It is read on the sessions done in the
 * same rep range and workout type.
 */
export function sessionNotes(workouts: Workout[], w: Workout): { pain: string[]; painAgain: string[]; plateau: string[] } {
  const gym = gymOf(w)
  const past = workoutsBefore(workouts, w)
  const all = [...past, w]
  const hurts = (ex: WorkoutExercise | null | undefined) => !!ex && doneSets(ex).some((s) => s.flags.includes('pain'))
  const phase = contextAt(w.date).phase?.id
  const building = !w.deload && phase !== 'cut' && phase !== 'cut-end' && phase !== 'diet-break' && phase !== 'stabilization'
  const out = { pain: [] as string[], painAgain: [] as string[], plateau: [] as string[] }
  for (const ex of w.exercises) {
    if (ex.skipped || !doneSets(ex).length) continue
    const g = isGymBound(ex) ? gym : undefined
    if (hurts(ex)) {
      out.pain.push(ex.name)
      if (hurts(previousPerformance(past, ex.exerciseId, undefined, g)?.exercise)) out.painAgain.push(ex.name)
    }
    if (!building) continue
    // Sessions without a verdict (deload, lightened) are skipped, unless they showed progress themselves.
    const judged = (c: Comparison | null) => c?.status !== 'deload' || c.isRecord || c.chargeValidated
    const recent = exerciseHistory(all, ex.exerciseId, g, ex.target).filter((h) => h.type === w.type && judged(h.comparison)).slice(-PLATEAU_SESSIONS)
    const dropping = recent.length >= 2 && recent.slice(-2).every(countedDrop)
    const flat = recent.length === PLATEAU_SESSIONS && recent[recent.length - 1].best <= recent[0].best + 1e-9
    if (flat && !dropping && recent.every((h) => stalled(h.comparison))) out.plateau.push(ex.name)
  }
  return out
}

export type { AutoChange } from './types'

export interface FinishResult {
  workout: Workout
  changes: AutoChange[]
  alerts: string[]
  records: string[]
  /** Several exercises down two sessions in a row: the deload can come early. */
  generalDrop: boolean
  /** Immediate post-workout prompt only; never kept in workout history. */
  trainedOnRestDay?: boolean
}

/** Longest stretch without any session between two dates: a sparse schedule is not a break, two empty weeks are. */
function longestBreak(workouts: Workout[], from: ISODate, to: ISODate): number {
  const days = [from, ...workouts.map((x) => x.date).filter((d) => d > from && d < to), to].sort()
  return days.reduce((max, d, i) => (i === 0 ? 0 : Math.max(max, diffDays(days[i - 1], d))), 0)
}

/** A load stored as "none" is null: added load back to nothing, or a sheet not set yet. */
const noLoad = (x: number | null | undefined): number | null => x || null

/**
 * Other sessions whose sheet has the exercise in the same rep range and at the same load (at that
 * gym): one exercise in one range has one load, so they follow the change. A sheet with another
 * range (heavy in one session, lighter in the other) or another load keeps its own.
 */
function twinSheets(templates: Record<WorkoutType, Template> | undefined, type: WorkoutType, ex: WorkoutExercise, gymId: string, from: number | null): WorkoutType[] {
  if (!templates) return []
  return (Object.keys(templates) as WorkoutType[]).filter(
    (t) => t !== type && templates[t].exercises.some((e) => e.exerciseId === ex.exerciseId && sameRange(e.target, ex.target) && noLoad(loadAt(e, gymId)) === noLoad(from)),
  )
}

export function finalizeWorkout(workouts: Workout[], w: Workout, templates?: Record<WorkoutType, Template>): FinishResult {
  const gym = gymOf(w)
  const changes: AutoChange[] = []
  const records: string[] = []
  const tpl = templates?.[w.type]
  const others = workoutsBefore(workouts, w)
  const inTemplate = (id: string) => !tpl || tpl.exercises.some((e) => e.exerciseId === id)
  const exercises = w.exercises.map((ex) => {
    const completedOnly = { ...ex, sets: ex.sets.filter((s) => s.completed) }
    const g = isGymBound(ex) ? gym : undefined
    // A reminder follows the same split's last performance, not the heavier slot between them.
    const before = previousPerformance(others, ex.exerciseId, undefined, g, ex.prescription ?? ex.target, w.type)
    const prev = before?.exercise ?? null
    const history = exerciseHistory(others, ex.exerciseId, g)
    let comparison = compareExercise(completedOnly, prev, history, !!w.deload, !!before?.workout.deload, before ? longestBreak(others, before.workout.date, w.date) : 0, before ? workoutContextReason(w, ex, before.workout, before.exercise) : null)
    if (ex.gymTrial && comparison.status === 'new-baseline') comparison = { ...comparison, detail: L('Première séance sur cette machine dans cette salle.', 'First workout on this machine at this gym.') }
    const changedEquipment = comparison.contextReason === 'unit-changed' || comparison.contextReason === 'conditions-changed'
    const replaced = ex.replacement && ex.replacement.fromId !== ex.exerciseId
    const decision = !changedEquipment && !replaced && inTemplate(ex.exerciseId) ? (loadDecision(completedOnly, knownLoads([...others, w], ex.exerciseId, g, ex)) ?? baselineFor(completedOnly)) : null
    if (decision) {
      const from = completedOnly.target.weight ?? null
      const also = twinSheets(templates, w.type, ex, g ?? HOME_GYM, from)
      changes.push({
        id: `${w.id}-${ex.exerciseId}-load`, type: w.type, exerciseId: ex.exerciseId, name: ex.name, gymId: g ?? HOME_GYM, date: w.date,
        kind: decision.kind, from, to: decision.weight, text: decision.text, lang: lang(), ...(also.length ? { also } : {}),
      })
    }
    if (comparison.isRecord) records.push(ex.name)
    return { ...completedOnly, comparison, validated: doneSets(completedOnly).length > 0, skipped: ex.skipped || doneSets(completedOnly).length === 0 }
  })
  const workout = { ...w, exercises }
  const all = [...others, workout]
  const alerts: string[] = []
  for (const ex of exercises) {
    // The signal belongs to the session in which the second drop happens: an exercise left out today says nothing new.
    if (ex.skipped) continue
    const alert = dropAlert(all, ex.exerciseId, isGymBound(ex) ? gym : undefined, ex.target, w.type)
    if (!alert) continue
    alerts.push(alert)
    const t = tpl?.exercises.find((e) => e.exerciseId === ex.exerciseId)
    if (t && t.target.sets > 1 && !autoAdjustActive(t, w.date)) {
      changes.push({
        id: `${w.id}-${ex.exerciseId}-sets`, type: w.type, exerciseId: ex.exerciseId, name: ex.name, gymId: HOME_GYM, date: w.date,
        kind: 'sets', from: t.target.sets, to: t.target.sets - 1,
        text: L('Nette baisse 2 séances de suite : 1 série de moins jusqu’à la fin du bloc', 'Clear drop 2 workouts in a row: 1 set fewer until the end of the block'), lang: lang(),
      })
    }
  }
  // The changes stay with the session: they can still be undone or applied once the app was closed.
  // An empty list says the session changed nothing; no list at all, that it was logged before they were kept.
  return { workout: { ...workout, changes }, changes, alerts, records, generalDrop: alerts.length >= 2 }
}

/** A change in a few words, from its figures: shown when its sentence was written in another language. */
export function changeLabel(c: AutoChange, unit: Unit = 'kg'): string {
  if (c.kind === 'sets') return L('1 série de moins jusqu’à la fin du bloc', '1 set fewer until the end of the block')
  // Bodyweight work has a load to start from with nothing added: a first added load is a raise, not a starting load.
  if (c.kind === 'baseline' || (c.from === null && unit !== 'PDC')) return L(`Charge de départ : ${fmtLoad(c.to, unit)}`, `Starting load: ${fmtLoad(c.to, unit)}`)
  return L(`${fmtLoad(c.from, unit)} → ${fmtLoad(c.to, unit)} la prochaine fois`, `${fmtLoad(c.from, unit)} → ${fmtLoad(c.to, unit)} next time`)
}

/**
 * The changes a session made to the plan. A session logged before they were kept has none stored:
 * its load changes are worked out again from its sets, on its own sheet only (one set less cannot
 * be: it depends on sheets that have moved since).
 */
export function changesOf(s: Pick<AppState, 'workouts' | 'templates'>, w: Workout): AutoChange[] {
  if (w.changes) return w.changes
  return finalizeWorkout(s.workouts, w, s.templates).changes.filter((c) => c.kind !== 'sets').map(({ also: _a, ...c }) => c)
}

/**
 * Where a change made after a session stands today, read on the sheet itself:
 * - `applied`: the sheet holds what the change set, so it can be undone;
 * - `open`: the sheet still holds what the change started from, so it can be applied;
 * - `gone`: the sheet moved on (edited since, exercise removed, block over for one set less), or a
 *   later session on a sheet this change moved did the exercise again in that rep range and gym.
 * `source` is the session the change comes from.
 */
export function changeState(templates: Record<WorkoutType, Template>, c: AutoChange, source: Pick<Workout, 'id' | 'date' | 'sessionNumber' | 'exercises'>, workouts: Workout[], today: ISODate = todayISO()): 'applied' | 'open' | 'gone' {
  const e = templates[c.type]?.exercises.find((x) => x.exerciseId === c.exerciseId)
  if (!e) return 'gone'
  if (c.kind === 'sets') {
    if (e.autoAdjust) return e.autoAdjust.since === c.date && autoAdjustActive(e, today) ? 'applied' : 'gone'
    // One set less lasts until the end of the block it was decided in.
    return autoAdjustActive({ autoAdjust: { sets: -1, since: c.date, reason: '' } }, today) ? 'open' : 'gone'
  }
  const done = source.exercises.find((x) => x.exerciseId === c.exerciseId)
  const later = (w: Workout) => w.id !== source.id && (w.date > source.date || (w.date === source.date && w.sessionNumber > source.sessionNumber))
  const again = workouts.some((w) => later(w) && (w.type === c.type || c.also?.includes(w.type)) && (!isGymBound(e) || gymOf(w) === c.gymId) && w.exercises.some((x) => x.exerciseId === c.exerciseId && !x.skipped && doneSets(x).length > 0 && (!done || sameRange(x.target, done.target))))
  if (again) return 'gone'
  const now = noLoad(loadAt(e, c.gymId))
  return now === noLoad(c.to) ? 'applied' : now === noLoad(c.from) ? 'open' : 'gone'
}

// ───────────── After the fact ─────────────
// A finished session can still be put right: its changes undone or applied, the session itself
// corrected (the last one) or deleted. All of it is read from what the session and the sheets hold.

/** The session finished last (the highest number), whatever its date. */
export function lastFinished(workouts: Workout[]): Workout | null {
  return workouts.reduce<Workout | null>((best, w) => (!best || w.sessionNumber > best.sessionNumber ? w : best), null)
}

/** A change made by a finished session, with the session it comes from. */
export function findChange(workouts: Workout[], id: string): { change: AutoChange; source: Workout } | null {
  for (const w of workouts) {
    const change = w.changes?.find((c) => c.id === id)
    if (change) return { change, source: w }
  }
  return null
}

/** Recalculate derived history after an edit; keep observations and load targets unchanged. */
export function regradeTrainingDiagnostics(state: AppState): AppState {
  const automaticReasons = new Set(['nette baisse 2 séances de suite', 'clear drop 2 sessions in a row', 'baisse 2 séances de suite', 'down 2 sessions in a row'])
  const history: Workout[] = []
  for (const w of chronological(state.workouts)) {
    const result = finalizeWorkout(history, w)
    history.push({ ...w, exercises: w.exercises.map((ex, i) => ({ ...ex, comparison: result.workout.exercises[i].comparison })) })
  }
  const supported = (w: Workout, exerciseId: string) => {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId)
    if (!ex) return false
    const past = history.filter((x) => x.date < w.date || (x.date === w.date && x.sessionNumber <= w.sessionNumber))
    return !!dropAlert(past, exerciseId, isGymBound(ex) ? gymOf(w) : undefined, ex.prescription ?? ex.target, w.type)
  }
  const templates = { ...state.templates }
  for (const [type, template] of Object.entries(templates) as [WorkoutType, Template][]) {
    templates[type] = { ...template, exercises: template.exercises.map((ex) => {
      const adjust = ex.autoAdjust
      if (!adjust || adjust.sets !== -1 || !automaticReasons.has(adjust.reason)
        || history.some(w => w.date === adjust.since && w.type === type && supported(w, ex.exerciseId))) return ex
      const { autoAdjust: _removed, ...kept } = ex
      return kept
    }) }
  }
  const byId = new Map(history.map((w) => [w.id, w]))
  return {
    ...state, templates,
    // Preserve the user's stored order, even when imports were out of order.
    workouts: state.workouts.map((w) => {
      const graded = byId.get(w.id)!
      return w.changes ? { ...graded, changes: w.changes.filter((c) => c.kind !== 'sets' || (c.type === graded.type && supported(graded, c.exerciseId))) } : graded
    }),
  }
}

/**
 * The state without a finished session, as if it had not taken place: the changes it made that
 * the sheets still hold are undone; if it was the last one finished, the rotation and the return
 * after a break go back to where they stood.
 */
export function withoutWorkout(s: AppState, id: string, today: ISODate = todayISO()): AppState {
  const w = s.workouts.find((x) => x.id === id)
  if (!w) return s
  let templates = s.templates
  for (const c of changesOf(s, w)) if (changeState(templates, c, w, s.workouts, today) === 'applied') templates = applyChange(templates, c, true)
  const workouts = s.workouts.filter((x) => x.id !== id)
  const wasLast = lastFinished(s.workouts)?.id === id
  return regradeTrainingDiagnostics({
    ...s,
    workouts,
    templates,
    completedSessions: workouts.length,
    lastCompletedWorkoutId: s.lastCompletedWorkoutId === id ? (lastFinished(workouts)?.id ?? null) : s.lastCompletedWorkoutId,
    ...(wasLast
      ? { nextWorkoutType: s.nextWorkoutType === nextInRotation(w.type) ? w.type : s.nextWorkoutType, reentry: w.reentry !== undefined ? w.reentry : s.reentry }
      : {}),
    appliedPlanUpdates: s.appliedPlanUpdates.filter((u) => u.updateId !== `auto-${id}`),
  })
}

/**
 * The last finished session opened again as the session in progress, to be corrected: its sets
 * come back as logged. The session itself stays where it is until the corrected one is finished
 * and takes its place (finishedState), so dropping the correction loses nothing. Only the
 * last one can be reopened: the sessions after it were compared with it. Null when it cannot be
 * done (another session in progress, or not the last one).
 */
export function reopenedState(s: AppState, id: string): AppState | null {
  const w = s.workouts.find((x) => x.id === id)
  if (!w || s.activeWorkout || lastFinished(s.workouts)?.id !== id) return null
  const active: ActiveWorkout = {
    id: w.id,
    type: w.type,
    date: w.date,
    startedAt: w.startedAt,
    notes: w.notes,
    timerEndAt: null,
    timer: null,
    // The verdicts are worked out again when the session is finished.
    exercises: w.exercises.map((e) => ({ ...e, comparison: null, validated: false })),
    periodId: w.periodId,
    week: w.week,
    deload: w.deload,
    reentry: w.reentry ?? null,
    gymId: gymOf(w),
    reopened: { completedAt: w.completedAt },
  }
  return { ...s, activeWorkout: active }
}

/**
 * A corrected session takes the place of the one it was reopened from: what that one changed and
 * the sheets still hold is undone first, so that the corrected sets are judged on the sheets as
 * they stood. Gives those sheets, the load each undone change had set (`inPlace`) with the twin
 * sheets put back along with it (`back`), and the load of each change that was waiting or had been
 * undone by hand (`open`).
 */
export function beforeCorrection(
  s: Pick<AppState, 'templates' | 'workouts'>, original: Workout, today: ISODate = todayISO(),
): { templates: Record<WorkoutType, Template>; inPlace: Map<string, number | null>; open: Map<string, number | null>; back: Map<string, WorkoutType[]> } {
  let templates = s.templates
  const inPlace = new Map<string, number | null>()
  const open = new Map<string, number | null>()
  const back = new Map<string, WorkoutType[]>()
  for (const c of changesOf(s, original)) {
    const state = changeState(templates, c, original, s.workouts, today)
    if (state === 'open') open.set(c.id, c.to)
    if (state !== 'applied') continue
    back.set(c.id, twinsToMove(templates, c, true))
    templates = applyChange(templates, c, true)
    inPlace.set(c.id, c.to)
  }
  return { templates, inPlace, open, back }
}

/** « Presse à cuisses 100 → 105 kg, Leg curl −1 série »: the changes of a session in one line, for the history of the plan. */
export function describeChanges(changes: AutoChange[]): string {
  return changes
    .map((c) => (c.kind === 'sets' ? L(`${c.name} −1 série`, `${c.name} −1 set`) : `${c.name} ${c.from !== null ? `${fmtNum(c.from)} → ` : ''}${fmtLoad(c.to, 'kg')}`))
    .join(', ')
}

/**
 * The state once the session in progress is finished: the session joins the history with its
 * verdicts and its changes, the automatic ones are applied to the sheets, the rotation moves on
 * and a return after a break counts one session down.
 * A session reopened to be corrected takes the place of the one it comes from: same number, same
 * end time, the rotation and the return after a break are left alone (they moved the first time),
 * and what the original changed is undone before the corrected sets are judged. Finished without
 * a change, it leaves the sheets as they were; the session keeps the changes that are still
 * current (one whose exercise left the sheet, or whose block is over, is no longer listed).
 */
export function finishedState(s: AppState, now: string = new Date().toISOString(), today: ISODate = todayISO()): { state: AppState; result: FinishResult } | null {
  const a = s.activeWorkout
  if (!a) return null
  const trainedOnRestDay = !a.reopened && isRestDay({ ...s, activeWorkout: null }, a.date, a.date)
  const original = a.reopened ? (s.workouts.find((w) => w.id === a.id) ?? null) : null
  const sessionNumber = original?.sessionNumber ?? Math.max(0, ...s.workouts.map((w) => w.sessionNumber)) + 1
  const workout: Workout = {
    id: a.id,
    sessionNumber,
    type: a.type,
    date: a.date,
    startedAt: a.startedAt,
    completedAt: a.reopened?.completedAt ?? now,
    notes: a.notes,
    exercises: a.exercises.map(({ hint: _h, ...e }) => e),
    periodId: a.periodId,
    week: a.week,
    deload: a.deload,
    gymId: a.gymId && a.gymId !== HOME_GYM ? a.gymId : undefined,
    // The return after a break as it stood before this session: restored if the session is deleted.
    reentry: original ? original.reentry : s.reentry,
  }
  const none = new Map<string, number | null>()
  const before = original ? beforeCorrection(s, original, today) : { templates: s.templates, inPlace: none, open: none, back: new Map<string, WorkoutType[]>() }
  const judged = finalizeWorkout(s.workouts, workout, before.templates)
  // The change the corrected session asks for is the one the session made the first time: same exercise, gym and loads.
  const first = new Map((original ? changesOf(s, original) : []).map((c) => [c.id, c]))
  const asFirst = (c: AutoChange) => {
    const was = first.get(c.id)
    return !!was && was.kind === c.kind && was.gymId === c.gymId && noLoad(was.from) === noLoad(c.from) && noLoad(was.to) === noLoad(c.to)
  }
  // Such a change moves the twin sheets it had moved, not those of today: the ones just put back with
  // it, or the ones it named if it was not in place. A twin put back by hand in between stays out of it.
  const changes = judged.changes.map((c) => {
    if (!asFirst(c)) return c
    const twins = before.back.get(c.id) ?? first.get(c.id)?.also ?? []
    const { also: _a, ...bare } = c
    return twins.length ? { ...bare, also: twins } : bare
  })
  const result: FinishResult = { ...judged, changes, workout: { ...judged.workout, changes }, trainedOnRestDay }
  const workouts = [...s.workouts.filter((x) => x.id !== workout.id), result.workout].sort((x, y) => (x.date === y.date ? x.sessionNumber - y.sessionNumber : x.date < y.date ? -1 : 1))
  const reentry = original ? s.reentry : s.reentry ? (s.reentry.sessionsLeft > 1 ? { ...s.reentry, sessionsLeft: s.reentry.sessionsLeft - 1 } : null) : null
  // What the lifter had decided stands when the corrected session asks for the same change: one undone
  // stays undone (automatic loads), one applied by hand stays applied (without them).
  const same = (was: Map<string, number | null>, c: AutoChange) => was.has(c.id) && asFirst(c)
  // A session logged before its changes were kept says nothing of a set removal the lifter had refused:
  // the sheet without it is the only trace, so the corrected session offers the removal and does not apply it.
  const refusable = (c: AutoChange) => !!original && !original.changes && c.kind === 'sets'
  const wanted = result.changes.filter((c) => !refusable(c) && (s.prefs.autoLoad ? !same(before.open, c) : same(before.inPlace, c)))
  // A corrected session only moves a sheet that still holds what the session started from: a load typed since stays.
  const auto = original ? wanted.filter((c) => changeState(before.templates, c, result.workout, s.workouts, today) === 'open') : wanted
  let templates = before.templates
  for (const c of auto) templates = applyChange(templates, c)
  // A correction that puts back exactly what was in place has not changed the plan: its history stays as written.
  const asBefore = !!original && auto.length === before.inPlace.size && auto.every((c) => before.inPlace.has(c.id) && asFirst(c))
  const updates = s.appliedPlanUpdates.filter((u) => u.updateId !== `auto-${workout.id}`)
  const next: AppState = {
    ...s,
    workouts,
    templates,
    completedSessions: workouts.length,
    nextWorkoutType: original ? s.nextWorkoutType : nextInRotation(a.type),
    lastCompletedWorkoutId: workout.id,
    activeWorkout: null,
    reentry,
    appliedPlanUpdates: asBefore
      ? s.appliedPlanUpdates
      : auto.length
      ? [
          ...updates,
          {
            updateId: `auto-${workout.id}`,
            basedOnSession: sessionNumber,
            summary: L(`Ajustement automatique : ${describeChanges(auto)}.`, `Automatic adjustment: ${describeChanges(auto)}.`),
            appliedAt: now,
            changeCount: auto.length,
            source: 'progression' as const,
          },
        ]
      : updates,
  }
  // A backdated addition or correction can change the references of later workouts.
  const state = original || workouts[workouts.length - 1]?.id !== workout.id ? regradeTrainingDiagnostics(next) : next
  const graded = state.workouts.find(w => w.id === workout.id)!
  return { state, result: { ...result, workout: graded, changes: graded.changes ?? [] } }
}

/** Load of an exercise at a gym, written in the template (the first gym uses the main target). */
export function withLoadAt(ex: TemplateExercise, gymId: string, weight: number | null): TemplateExercise {
  if (!isGymBound(ex) || gymId === HOME_GYM) {
    // Bodyweight work: added load back to nothing is stored as no load.
    const next: TemplateExercise = { ...ex, target: { ...ex.target, weight: ex.unit === 'PDC' && !weight ? null : weight } }
    return { ...next, nextTarget: nextTargetText(next) }
  }
  return { ...ex, gymLoads: { ...(ex.gymLoads ?? {}), [gymId]: weight } }
}

/**
 * The other sheets a load change moves with the session's own, when it is applied (or put back,
 * when it is undone): those it names (`also`) that have the exercise in the same rep range as that
 * sheet and still hold the load the move starts from.
 */
export function twinsToMove(templates: Record<WorkoutType, Template>, c: AutoChange, revert = false): WorkoutType[] {
  const own = templates[c.type]?.exercises.find((e) => e.exerciseId === c.exerciseId)
  if (!own || c.kind === 'sets') return []
  const start = noLoad(revert ? c.to : c.from)
  return (c.also ?? []).filter((t) => t !== c.type && !!templates[t]?.exercises.some((e) => e.exerciseId === c.exerciseId && sameRange(e.target, own.target) && noLoad(loadAt(e, c.gymId)) === start))
}

/**
 * Applies (or reverts) an automatic change on the template of the session type. A load also moves
 * in the other sessions that have the exercise in the same rep range (twinsToMove), as long as
 * their sheet still holds the load the change starts from. One set less stays in the session it came from.
 */
export function applyChange(templates: Record<WorkoutType, Template>, c: AutoChange, revert = false): Record<WorkoutType, Template> {
  if (!templates[c.type]) return templates
  const out = { ...templates }
  for (const type of [c.type, ...twinsToMove(templates, c, revert)]) {
    const tpl = out[type]
    const exercises = tpl.exercises.map((e) => {
      if (e.exerciseId !== c.exerciseId) return e
      if (c.kind === 'sets') {
        if (revert) {
          const { autoAdjust: _a, ...rest } = e
          return rest
        }
        return { ...e, autoAdjust: { sets: (c.to ?? e.target.sets) - (c.from ?? e.target.sets), since: c.date, reason: L(...SET_DROP_REASON) } }
      }
      return withLoadAt(e, c.gymId, revert ? c.from : c.to)
    })
    out[type] = { ...tpl, exercises }
  }
  return out
}

/**
 * The state once changes a session proposed are applied by hand: only those the sheets are still
 * open to. The change keeps the twin sheets it really moved, so that undoing it later puts back
 * those and no other (a twin typed by hand in between is not one of them).
 */
export function appliedState(s: AppState, ids: string[], now: string = new Date().toISOString(), today: ISODate = todayISO()): AppState {
  let templates = s.templates
  let workouts = s.workouts
  const done: AutoChange[] = []
  for (const id of ids) {
    const found = findChange(workouts, id)
    if (!found || changeState(templates, found.change, found.source, workouts, today) !== 'open') continue
    const moved = twinsToMove(templates, found.change)
    const { also: _a, ...bare } = found.change
    const change: AutoChange = moved.length ? { ...bare, also: moved } : bare
    templates = applyChange(templates, change)
    workouts = workouts.map((w) => (w.id === found.source.id ? { ...w, changes: w.changes?.map((c) => (c.id === id ? change : c)) } : w))
    done.push(change)
  }
  if (!done.length) return s
  return {
    ...s,
    templates,
    workouts,
    appliedPlanUpdates: [
      ...s.appliedPlanUpdates,
      { updateId: `manual-${Date.parse(now)}`, basedOnSession: s.workouts.length, summary: L(`Charges mises à jour : ${describeChanges(done)}.`, `Loads updated: ${describeChanges(done)}.`), appliedAt: now, changeCount: done.length, source: 'progression' },
    ],
  }
}

/** The state once a change a session made is undone: only while the sheet still holds it. */
export function revertedState(s: AppState, id: string, today: ISODate = todayISO()): AppState {
  const found = findChange(s.workouts, id)
  if (!found || changeState(s.templates, found.change, found.source, s.workouts, today) !== 'applied') return s
  return { ...s, templates: applyChange(s.templates, found.change, true) }
}

/** Legacy helper kept for the coach flow: raises the load everywhere the exercise appears. */
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

/**
 * Hard sets per muscle the program plans for a week of `days` sessions: the five sessions of the
 * rotation come round every 5/days weeks, each with its sets scaled when the week keeps its volume.
 * An average over a turn of the rotation: a given week holds the sessions that fall in it.
 */
export function plannedVolume(templates: Record<WorkoutType, Template>, days: number = PLAN_DAYS, keep = true): MuscleVolume {
  const v = emptyVolume()
  const factor = daysFactorFor(days, keep)
  for (const t of Object.values(templates)) {
    const scaled = scaledSession(sessionSlots(t.exercises), factor)
    t.exercises.forEach((ex, i) => {
      const groups = infoFor(ex.exerciseId, ex).groups
      const sets = (scaled[i] * days) / PLAN_DAYS
      for (const [g, f] of Object.entries(groups)) v[g as MuscleGroup] += sets * (f ?? 0)
    })
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

/**
 * Mean change of estimated 1RM on the program's loaded compound lifts, first session
 * vs best of the last two. Machines are compared within one gym only.
 */
export function strengthSummary(workouts: Workout[], templates: Record<WorkoutType, Template>, recordsSince?: ISODate) {
  const ids = new Set(
    Object.values(templates).flatMap((t) =>
      t.exercises.filter((e) => (e.role ?? infoFor(e.exerciseId, e).role) === 'compound' && e.unit !== 'PDC').map((e) => e.exerciseId),
    ),
  )
  const changes: number[] = []
  for (const id of ids) {
    const all = exerciseHistory(workouts, id)
    const groups = new Map<string, HistoryPoint[]>()
    for (const h of all) {
      if (h.best <= 0) continue
      const gym = isGymBound({ exerciseId: id, unit: h.unit }) ? h.gymId : '*'
      const key = JSON.stringify([gym, h.unit, h.comparisonContext])
      groups.set(key, [...(groups.get(key) ?? []), h])
    }
    const h = [...groups.values()].sort((a, b) => b.length - a.length)[0]
    if (!h || h.length < 2 || h[0].best <= 0) continue
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
  const rirs = w.exercises.filter(e => !e.skipped).flatMap(doneSets).map(recordedRir).filter((rir): rir is number => rir !== null)
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

/** Sessions the pace is read from, how many it takes to trust it, and how many of one type speak for that type. */
const PACE_SESSIONS = 10
export const PACE_MIN_SESSIONS = 5
const PACE_TYPE_SESSIONS = 3

/**
 * The lifter's real pace: minutes per set once the warm-up is taken off, as the median of the
 * last sessions whose length is known (a real session: 20 minutes and six sets at least). The
 * sessions of the same type speak first when there are three of them. Null until five sessions
 * are known: the report's lengths stand until then.
 */
export function sessionPace(workouts: Workout[], type?: WorkoutType): number | null {
  const usable = workouts
    .map((w) => ({ w, minutes: sessionDurationMin(w), sets: sessionSetCount(w) }))
    .filter((x): x is { w: Workout; minutes: number; sets: number } => x.minutes !== null && x.minutes >= 20 && x.sets >= 6)
    .sort((a, b) => (a.w.startedAt < b.w.startedAt ? -1 : 1))
  if (usable.length < PACE_MIN_SESSIONS) return null
  const same = type ? usable.filter((x) => x.w.type === type).slice(-PACE_TYPE_SESSIONS - 1) : []
  const sample = same.length >= PACE_TYPE_SESSIONS ? same : usable.slice(-PACE_SESSIONS)
  const paces = sample.map((x) => Math.max(0.5, (x.minutes - SESSION_OVERHEAD_MIN) / x.sets)).sort((a, b) => a - b)
  const mid = paces.length >> 1
  return paces.length % 2 ? paces[mid] : (paces[mid - 1] + paces[mid]) / 2
}
