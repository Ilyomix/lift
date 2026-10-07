import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { setLang } from '../src/lib/i18n'
import { defaultState, normalizeState } from '../src/lib/backup'
import { localizeState } from '../src/lib/localize'
import { nextTargetText } from '../src/lib/program'
import { fmtLoad, fmtNum } from '../src/lib/format'
import { exerciseContextReason, workoutContextReason } from '../src/lib/comparability'
import { CONTEXT_MESSAGES, contextReasonLabel, comparisonDetailLabel, isGeneratedTarget, localizeComparison, localizeLoadHint, storedTrainingText, type ContextReason } from '../src/lib/trainingMessages'
import { headlineLabel, StatusTag, RecordTag } from '../src/components/Status'
import type { Comparison, Workout, WorkoutExercise } from '../src/lib/types'

setLang('fr')
afterEach(() => setLang('fr'))

function comparison(patch: Partial<Comparison> = {}): Comparison {
  return { status: 'down', headline: '−2 REPS VS DERNIÈRE FOIS', detail: 'Nette baisse : au-delà de la variation normale.', totalReps: 28, totalCleanReps: 28, volume: 1400, deltaCleanReps: -2, previousTotalCleanReps: 30, previousSetReps: [10, 10, 10], previousWeights: [50, 50, 50], chargeValidated: false, suggestion: null, isRecord: false, marked: true, ...patch }
}
function exercise(patch: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return { ...defaultState().templates.PUSH.exercises[2], sets: [{ weight: 20, reps: 10, cleanReps: 10, flags: [], note: 'Ma note, ne pas traduire', completed: true, rir: null }], notes: 'Même machine', skipped: false, validated: true, comparison: comparison(), ...patch }
}
function workout(ex: WorkoutExercise): Workout {
  return { id: 'synthetic-workout', sessionNumber: 1, type: 'PUSH', date: '2026-10-02', startedAt: '2026-10-02T15:00:00.000Z', completedAt: '2026-10-02T16:00:00.000Z', notes: 'Note personnelle', exercises: [ex], deload: false }
}

test('every new context reason has FR and EN, resolved after import and after serialization', () => {
  for (const key of Object.keys(CONTEXT_MESSAGES) as ContextReason[]) {
    const stored: ContextReason = JSON.parse(JSON.stringify(key))
    setLang('fr')
    const fr = contextReasonLabel(stored)
    setLang('en')
    const en = contextReasonLabel(stored)
    assert.equal(fr, CONTEXT_MESSAGES[key][0])
    assert.equal(en, CONTEXT_MESSAGES[key][1])
    assert.notEqual(fr, en)
    assert.equal(storedTrainingText(fr), en)
    setLang('fr')
    assert.equal(storedTrainingText(en), fr)
  }
})

test('business rules return language-independent IDs, not translated sentences', () => {
  const before = exercise()
  const pairs: [WorkoutExercise, ContextReason][] = [
    [{ ...before, unit: 'kg/main' }, 'unit-changed'],
    [{ ...before, comparisonContext: 'Other machine' }, 'conditions-changed'],
    [{ ...before, target: { ...before.target, maxReps: 25 } }, 'rep-range-changed'],
    [{ ...before, target: { ...before.target, restSeconds: 240 } }, 'rest-changed'],
  ]
  for (const language of ['fr', 'en', 'fr'] as const) {
    setLang(language)
    for (const [now, key] of pairs) assert.equal(exerciseContextReason(now, before), key)
    assert.equal(workoutContextReason({ ...workout(before), periodId: 'b1' }, before, workout(before), before), 'program-changed')
    const now = { ...workout(before), type: 'UPPER' as const }
    assert.equal(workoutContextReason(now, before, workout(before), before), 'workout-type-changed')
  }
  const source = readFileSync(new URL('../src/lib/comparability.ts', import.meta.url), 'utf8')
  assert.ok(!/nouvelle référence|Different unit|ne pas conclure|do not infer/u.test(source), 'user-facing wording belongs to the translation module')
})

test('known persisted comparison explanations and suggestions switch both ways', () => {
  const raw = comparison({ suggestion: 'PROCHAINE CIBLE : AUGMENTER LA CHARGE' })
  const unchanged = JSON.stringify(raw)
  setLang('en')
  const en = localizeComparison(JSON.parse(unchanged))
  assert.equal(en.headline, '−2 REPS VS LAST TIME')
  assert.equal(en.detail, 'Clear drop: beyond normal variation.')
  assert.equal(en.suggestion, 'NEXT TARGET: INCREASE THE LOAD')
  setLang('fr')
  assert.deepEqual(localizeComparison(en), { ...raw, headline: '−2 RÉPÉTITIONS VS DERNIÈRE FOIS' })
  assert.equal(JSON.stringify(raw), unchanged)
})

test('common-set suffixes preserve singular, plural and numeric context across languages', () => {
  for (const [now, prev] of [[3, 2], [2, 1]]) {
    const common = Math.min(now, prev)
    const raw = comparison({ detail: `Progression à charge égale. Sur ${common === 1 ? 'la série commune' : `les ${common} séries communes`} (${now} contre ${prev} la dernière fois).` })
    setLang('en')
    const en = comparisonDetailLabel(raw)
    assert.equal(en, `Progress at the same load. On the ${common === 1 ? 'set' : `${common} sets`} both workouts have (${now} vs ${prev} last time).`)
    setLang('fr')
    assert.equal(comparisonDetailLabel({ ...raw, detail: en }), raw.detail)
  }
})

test('stored volume messages format the numeric data using the current locale', () => {
  const raw = comparison({ detail: 'Volume propre : 1 400 contre 1 500 kg·reps.' })
  setLang('en')
  const en = comparisonDetailLabel(raw)
  assert.equal(en, `Clean volume: ${fmtNum(1400, 0)} vs ${fmtNum(1500, 0)} kg·reps.`)
  setLang('fr')
  assert.equal(comparisonDetailLabel({ ...raw, detail: en }), `Volume propre : ${fmtNum(1400, 0)} contre ${fmtNum(1500, 0)} kg·reps.`)
})

test('custom notes and unknown explanations are never replaced by a guessed translation', () => {
  setLang('en')
  const note = 'Repos différent après mon escalade, poulie B'
  assert.equal(localizeComparison(comparison({ detail: note }), note).detail, note)
  const sameAsApp = 'Niveau maintenu.'
  assert.equal(localizeComparison(comparison({ detail: sameAsApp }), sameAsApp).detail, sameAsApp)
  const unknown = 'Texte importé personnalisé. Sur les 2 séries communes (3 contre 2 la dernière fois).'
  assert.equal(comparisonDetailLabel(comparison({ detail: unknown })), unknown)
  assert.equal(storedTrainingText('Unrecognised future message'), 'Unrecognised future message')
})

test('generated targets follow the language; personalised targets stay unchanged', () => {
  const ex = exercise()
  ex.target = { ...ex.target, weight: 20 }
  const s = defaultState()
  s.templates.PUSH.exercises[2] = { ...ex, nextTarget: nextTargetText(ex) }
  s.templates.UPPER.exercises[0].nextTarget = 'Mon coach : garder cette charge cette semaine'
  const original = JSON.stringify(s)
  setLang('en')
  const en = localizeState(s)
  assert.ok(en.templates.PUSH.exercises[2].nextTarget?.includes('aim for'))
  assert.equal(en.templates.UPPER.exercises[0].nextTarget, s.templates.UPPER.exercises[0].nextTarget)
  setLang('fr')
  assert.equal(localizeState(en).templates.PUSH.exercises[2].nextTarget, s.templates.PUSH.exercises[2].nextTarget)
  assert.equal(JSON.stringify(s), original)
  assert.equal(isGeneratedTarget('20 kg : viser 10 / 10 avec la consigne de mon coach'), false)
  assert.equal(isGeneratedTarget('Trial session: find a load for 8–12 reps at RIR 3.'), true)
  assert.equal(isGeneratedTarget('Séance d’essai : trouve une charge pour 8–12 reps à RIR 3.'), true)
  const trial = { ...ex, target: { ...ex.target, weight: null } }
  for (const language of ['fr', 'en'] as const) {
    setLang(language)
    assert.equal(isGeneratedTarget(nextTargetText(trial)), true)
  }
})

test('persisted active-session load hints switch languages and retain their data', () => {
  const ex = exercise({ hint: { text: '18 reps à RIR 4 : 22,5 kg pour la suite', from: 20, to: 22.5, sets: [1, 2] } })
  const original = JSON.stringify(ex)
  setLang('en')
  const en = localizeLoadHint(ex)!
  assert.equal(en.text, `18 reps with 4 reps in reserve: ${fmtLoad(22.5, ex.unit)} for the next sets`)
  assert.deepEqual(en.sets, [1, 2])
  setLang('fr')
  assert.equal(localizeLoadHint({ ...ex, hint: en })?.text, `18 répétitions avec 4 répétitions en réserve : ${fmtLoad(22.5, ex.unit)} pour la suite`)
  assert.equal(JSON.stringify(ex), original)
  const custom = { ...ex, hint: { ...ex.hint!, text: 'Message externe : garder RIR 3, à vérifier' } }
  setLang('en')
  assert.equal(localizeLoadHint(custom)?.text, custom.hint.text)
})

test('a saved state switches FR to EN to FR without losing measurements or personal notes', () => {
  const ex = exercise({ hint: { text: '5 reps, sous 10 : 17,5 kg pour rester dans la fourchette', from: 20, to: 17.5, sets: [1] } })
  const s = defaultState()
  const w = workout(ex)
  s.workouts = [w]
  s.activeWorkout = { ...w, timer: null, timerEndAt: null }
  const stored = JSON.stringify(s)
  setLang('en')
  const en = localizeState(normalizeState(JSON.parse(stored)))
  assert.equal(en.workouts[0].exercises[0].comparison?.detail, 'Clear drop: beyond normal variation.')
  assert.match(en.activeWorkout!.exercises[0].hint!.text, /to stay in the range$/u)
  assert.deepEqual(en.workouts[0].exercises[0].sets, ex.sets)
  assert.equal(en.workouts[0].notes, w.notes)
  assert.equal(en.workouts[0].exercises[0].notes, ex.notes)
  setLang('fr')
  const fr = localizeState(en)
  assert.equal(fr.workouts[0].exercises[0].comparison?.detail, ex.comparison!.detail)
  assert.deepEqual(fr.workouts[0].exercises[0].sets, ex.sets)
  assert.equal(JSON.stringify(s), stored)
})

test('visible status labels render in the selected language, including older imported headlines', () => {
  const raw = comparison({ headline: 'COMPARAISON À VÉRIFIER', status: 'different-context' })
  setLang('en')
  assert.equal(headlineLabel(raw.headline), 'Comparison to check')
  assert.match(renderToStaticMarkup(createElement(StatusTag, { c: raw })), /Comparison to check/u)
  assert.match(renderToStaticMarkup(createElement(RecordTag)), /Personal best/u)
  setLang('fr')
  assert.match(renderToStaticMarkup(createElement(StatusTag, { c: raw })), /Comparaison à vérifier/u)
  assert.match(renderToStaticMarkup(createElement(RecordTag)), /Record/u)
})


test('wording aliases preserve legacy comparisons and round-trip updated labels', () => {
  const messages = [
    ['NOUVELLE BASELINE', 'NEW BASELINE', 'NOUVELLE RÉFÉRENCE', 'NEW BASELINE'],
    ['DÉCHARGE', 'DELOAD', 'SEMAINE ALLÉGÉE', 'DELOAD WEEK'],
    ['SEMAINE ALLÉGÉE', 'LIGHTER WEEK', 'SEMAINE ALLÉGÉE', 'DELOAD WEEK'],
    ['Semaine allégée : pas de comparaison.', 'Lighter week: no comparison.', 'Semaine allégée : pas de comparaison.', 'Deload week: no comparison.'],
    ['SÉANCE ALLÉGÉE', 'LIGHTER SESSION', 'SÉANCE ALLÉGÉE', 'LIGHTER WORKOUT'],
    ['APRÈS SÉANCE ALLÉGÉE', 'AFTER A LIGHTER SESSION', 'APRÈS SÉANCE ALLÉGÉE', 'AFTER A LIGHTER WORKOUT'],
    ['Première séance dans cette fourchette de reps.', 'First session in this rep range.', 'Première séance dans cette fourchette de répétitions.', 'First workout in this rep range.'],
    ['+1 REP', '+1 REP', '+1 RÉPÉTITION', '+1 REP'],
    ['−2 REPS VS DERNIÈRE FOIS', '−2 REPS VS LAST TIME', '−2 RÉPÉTITIONS VS DERNIÈRE FOIS', '−2 REPS VS LAST TIME'],
  ]
  for (const [oldFr, oldEn, fr, en] of messages) {
    for (const saved of [oldFr, oldEn, fr, en]) {
      setLang('en'); assert.equal(storedTrainingText(saved), en)
      setLang('fr'); assert.equal(storedTrainingText(saved), fr)
    }
    // A matching sentence explicitly supplied as a personal note stays untouched.
    setLang('en')
    assert.equal(localizeComparison(comparison({ detail: oldFr }), oldFr).detail, oldFr)
  }
  const legacy = comparison({ detail: 'No comparison with a lighter session. On the 2 sets both sessions have (3 vs 2 last time).' })
  setLang('fr')
  const fr = comparisonDetailLabel(legacy)
  assert.equal(fr, 'Pas de comparaison avec une séance allégée. Sur les 2 séries communes (3 contre 2 la dernière fois).')
  setLang('en')
  assert.equal(comparisonDetailLabel({ ...legacy, detail: fr }), 'No comparison with a lighter workout. On the 2 sets both workouts have (3 vs 2 last time).')
})

test('new and legacy target and load-hint wording preserve measurements and unknown notes', () => {
  for (const target of [
    'Séance d’essai : trouve une charge pour 8–12 répétitions avec 3 répétitions en réserve.',
    'Trial workout: find a load for 8–12 reps with 3 reps in reserve.',
    '20 kg · viser 3 × 8–12 répétitions propres, puis augmenter.',
    '20 kg · viser 3 × 8–12 propres, puis augmenter.',
  ]) assert.equal(isGeneratedTarget(target), true)
  assert.equal(isGeneratedTarget('Mon coach : 20 kg · viser 3 × 8–12 avec contrôle.'), false)
  for (const text of ['1 reps avec 1 reps en réserve : 22,5 kg pour la suite', '1 répétition avec 1 répétition en réserve : 22,5 kg pour la suite']) {
    const ex = exercise({ hint: { text, from: 20, to: 22.5, sets: [1, 2] } })
    const serialized = JSON.stringify(ex)
    setLang('en')
    const en = localizeLoadHint(ex)!
    assert.equal(en.text, `1 rep with 1 rep in reserve: ${fmtLoad(22.5, ex.unit)} for the next sets`)
    assert.deepEqual({ ...en, text }, ex.hint)
    setLang('fr')
    assert.equal(localizeLoadHint({ ...ex, hint: en })?.text, `1 répétition avec 1 répétition en réserve : ${fmtLoad(22.5, ex.unit)} pour la suite`)
    assert.equal(JSON.stringify(ex), serialized)
  }
})
