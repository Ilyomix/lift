import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { defaultState } from '../src/lib/backup'
import { globalPrompt } from '../src/lib/coach'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { finishedState, loadOutcome } from '../src/lib/training'
import type { AppState, WorkoutExercise, WorkoutSet } from '../src/lib/types'

const originalLanguage = lang()
beforeEach(() => { setLang('fr'); configurePlan(DEFAULT_GOAL) })
afterEach(() => { setLang(originalLanguage); configurePlan(DEFAULT_GOAL) })

// Loads are formatted with non-breaking spaces; compare the words.
const plain = (text: string | undefined) => text?.replace(/[\u00a0\u202f]/g, ' ')
const set = (weight: number | null, reps: number, extra: Partial<WorkoutSet> = {}): WorkoutSet =>
  ({ weight, reps, cleanReps: reps, rir: null, flags: [], note: '', completed: true, ...extra })
const exo = (sets: WorkoutSet[], over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  exerciseId: 'chest-press', name: 'Chest press machine', muscle: '', unit: 'kg',
  target: { weight: 80, sets: 3, minReps: 6, maxReps: 10, restSeconds: 150, rir: '1–2' },
  prescription: { sets: 3, minReps: 6, maxReps: 10, rir: '2', restSeconds: 150, weight: 80, loadFactor: 1, notes: [] },
  sets, notes: '', skipped: false, validated: true, comparison: null, ...over,
})

test('every finished exercise says what it did to its load, and what takes it up', () => {
  // Kept: how many sets reached the top, how many it takes, and the next load.
  assert.equal(plain(loadOutcome(exo([set(80, 6), set(80, 6), set(80, 6)]))?.text), 'Reste à 80 kg : 0/3 séries à 10 répétitions, il en faut 3 pour passer à 82,5 kg.')
  assert.equal(loadOutcome(exo([set(80, 10), set(80, 10), set(80, 9)]))?.kind, 'kept')
  // Reached, but closer to failure than planned: held, and said so.
  const pushed = loadOutcome(exo([set(80, 10, { rir: 0 }), set(80, 10, { rir: 0 }), set(80, 10, { rir: 0 })], { prescription: { sets: 3, minReps: 6, maxReps: 10, rir: '3', restSeconds: 150, weight: 80, loadFactor: 1, notes: [] } }))
  assert.match(plain(pushed!.text)!, /^Reste à 80 kg : 3 × 10 atteint, mais plus près de l’échec que prévu \(3 répétitions en réserve\)/)
  // The session's change speaks for itself.
  const change = { id: 'w-chest-press-load', type: 'UPPER' as const, exerciseId: 'chest-press', name: 'Chest press machine', gymId: 'main', date: '2026-10-07', kind: 'up' as const, from: 80, to: 82.5, text: '3 × 10 atteint : 82,5 kg la prochaine fois', lang: 'fr' as const }
  assert.deepEqual(loadOutcome(exo([set(80, 10), set(80, 10), set(80, 10)]), [change]), { kind: 'up', text: change.text })
  // Loads do not move on an alternative for the day, a deload or a return week, nor up with pain.
  assert.equal(loadOutcome(exo([set(80, 10)], { replacement: { fromId: 'pec-deck', fromName: 'Pec deck' } }))?.kind, 'info')
  assert.equal(loadOutcome(exo([set(72.5, 10)], { prescription: { sets: 2, minReps: 6, maxReps: 10, rir: '3–4', restSeconds: 150, weight: 72.5, loadFactor: 0.9, notes: [] } }))?.kind, 'info')
  assert.match(loadOutcome(exo([set(80, 10, { flags: ['pain'] }), set(80, 10), set(80, 10)]))!.text, /Douleur/)
  // Body weight with added load starts from none; without added load, a harder variation follows.
  assert.match(plain(loadOutcome(exo([set(null, 8), set(null, 8)], { exerciseId: 'dips', unit: 'PDC', target: { weight: null, sets: 2, minReps: 8, maxReps: 12, restSeconds: 90 }, prescription: undefined }))!.text)!, /^Reste au poids du corps : 0\/2 séries à 12 répétitions, il en faut 2 pour passer à PDC \+2,5 kg/)
  assert.match(loadOutcome(exo([set(null, 15), set(null, 16)], { exerciseId: 'crunch', unit: 'PDC', target: { weight: null, sets: 2, minReps: 10, maxReps: 15, restSeconds: 60 }, prescription: undefined }))!.text, /variante plus difficile/)
  assert.equal(loadOutcome(exo([], { skipped: true })), null)
  setLang('en')
  assert.equal(plain(loadOutcome(exo([set(80, 6), set(80, 6), set(80, 6)]))?.text), 'Stays at 80 kg: 0/3 sets at 10 reps; all 3 take it to 82.5 kg.')
})

test('the coach brief shows each recent exercise planned, done and decided, and the step of every load', () => {
  let s: AppState = defaultState()
  s.templates.LOWER.exercises = s.templates.LOWER.exercises.map(e => e.exerciseId === 'hip-thrust' ? { ...e, target: { ...e.target, weight: 20 } } : e)
  const date = '2026-10-09'
  const sheet = s.templates.LOWER.exercises
  const hip = sheet.find(e => e.exerciseId === 'hip-thrust')!
  const press = sheet.find(e => e.exerciseId === 'leg-press')!
  const done = (e: typeof hip, sets: WorkoutSet[], over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
    ...e, notes: '', skipped: false, validated: false, comparison: null, sets, ...over,
    prescription: { ...e.target, rir: '2', weight: e.target.weight ?? null, loadFactor: 1, notes: [] },
  })
  s = finishedState({ ...s, activeWorkout: {
    id: 'lower', type: 'LOWER', date, startedAt: `${date}T10:00:00Z`, notes: '', timer: null, timerEndAt: null,
    exercises: [
      done(hip, [set(20, 12), set(20, 12), set(20, 12, { rir: 1 })]),
      done({ ...press, exerciseId: 'hack-squat', name: 'Hack squat' }, [set(60, 10), set(60, 10)], { replacement: { fromId: 'leg-press', fromName: 'Presse à cuisses' } }),
      done(sheet.find(e => e.exerciseId === 'leg-curl')!, [], { skipped: true, skipReason: 'Reporté à la prochaine séance' }),
    ],
  } }, `${date}T11:00:00Z`, date)!.state
  const brief = plain(globalPrompt(s))!
  assert.match(brief, /Hip thrust \[hip-thrust\] 3 × 8–12, 1–2 reps en réserve, 22,5 kg \(palier 2,5 kg\)/)
  assert.match(brief, /Dernières séances \(cible du jour · fait · décision de l’app sur la charge\) :\n9 oct\. · LOWER/)
  assert.match(brief, /  - Hip thrust : cible 3 × 8–12, 2 en réserve à 20 kg · fait 20 kg × 12 · 12 · 12 \(en réserve : – · – · 1\) → 3 × 12 atteint : 22,5 kg la prochaine fois/)
  assert.match(brief, /  - Hack squat \(alternative à Presse à cuisses\) : .* → Alternative du jour : la charge du programme ne bouge pas\./)
  assert.match(brief, /  - Leg curl assis : non réalisé \(Reporté à la prochaine séance\)/)
  assert.match(brief, /semaine 1 du bloc 3, semaine 2 : 2, puis celles de la fiche/)
  assert.doesNotMatch(brief, /S1 du bloc 3, S2 2/)
})
