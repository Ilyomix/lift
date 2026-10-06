import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionScreen } from '../src/screens/Session'
import { defaultState } from '../src/lib/backup'
import { lang, setLang, type Lang } from '../src/lib/i18n'
import { LIBRARY } from '../src/lib/library'
import { workoutActivityState } from '../src/lib/native/snapshot'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { useStore } from '../src/lib/store'

const initial = useStore.getInitialState()
const originalStore = useStore.getState()
const originalState = initial.state
const originalLanguage = lang()
const actions = () => useStore.getState()
const active = () => actions().state.activeWorkout!

beforeEach(() => {
  setLang('en')
  configurePlan(DEFAULT_GOAL)
  // Store actions run normally, but this fixture never writes browser storage.
  useStore.setState({ state: defaultState(), ready: true, hasData: false, storage: 'memory' })
  actions().startSession('PUSH')
  const state = actions().state
  const exercises = active().exercises.slice(0, 3).map((exercise, index) => ({
    ...exercise, name: `Exercise ${index + 1}`, supersetWithNext: false,
    target: { ...exercise.target, sets: 2, weight: 20, minReps: 10, maxReps: 15, restSeconds: 90, rir: '3' },
    prescription: undefined,
    sets: exercise.sets.slice(0, 2).map(set => ({ ...set, weight: 20, reps: null, cleanReps: null, completed: false })),
  }))
  assert.equal(exercises.length, 3)
  assert.ok(exercises.every(exercise => exercise.sets.length === 2))
  useStore.setState({ state: { ...state, prefs: { ...state.prefs, autoLoad: false }, activeWorkout: { ...active(), exercises } } })
})

afterEach(async () => {
  await actions().flush() // Clears the action's pending save timer; hasData is false.
  initial.state = originalState
  useStore.setState({ ...originalStore, state: originalState }, true)
  setLang(originalLanguage)
  configurePlan(DEFAULT_GOAL)
})

const complete = (exercise: number, set: number) => actions().completeSet(exercise, set, { weight: 20, reps: 12 })

/** Inspect the server-rendered DOM, honoring hidden ancestors rather than
 * counting retained sheet hosts as visible exercise cards. No component source
 * or browser globals are inspected or mocked. */
function visibleMarkup(markup: string) {
  const stack: { tag: string; hidden: boolean }[] = []
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  let visible = ''
  for (const token of markup.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g) ?? []) {
    const close = token.match(/^<\/([\w-]+)/)
    if (close) {
      if (!stack.at(-1)?.hidden) visible += token
      assert.equal(stack.pop()?.tag, close[1], 'rendered markup remains well nested')
      continue
    }
    const open = token.match(/^<([\w-]+)\b([\s\S]*)>$/)
    if (open) {
      const hidden = !!stack.at(-1)?.hidden || /(?:^|\s)hidden(?:=|\s|\/|$)/.test(open[2])
      if (!hidden) visible += token
      if (!voidTags.has(open[1]) && !token.endsWith('/>')) stack.push({ tag: open[1], hidden })
    } else if (!stack.at(-1)?.hidden) visible += token
  }
  assert.equal(stack.length, 0)
  return visible
}

function render() {
  // Zustand SSR reads getInitialState; point that snapshot at the state produced
  // by the real actions before each fresh server render.
  initial.state = actions().state
  const markup = renderToStaticMarkup(createElement(SessionScreen))
  const html = visibleMarkup(markup)
  return {
    html,
    // Count across the full DOM: a hidden logger must not retain its own model.
    models: [...markup.matchAll(/<canvas\b[^>]*aria-roledescription="(?:Modèle 3D interactif|Interactive 3D model)"[^>]*>/g)].map(match => match[0]),
    cards: [...html.matchAll(/\bid="exercise-(\d+)"/g)].map(match => Number(match[1])),
  }
}

function expectCard(index: number) {
  const result = render()
  assert.deepEqual(result.cards, [index], 'exactly the selected exercise is visible')
  assert.equal(result.models.length, 1, 'only the displayed exercise mounts an interactive 3D model')
  assert.ok(result.html.includes(active().exercises[index].name))
  assert.equal(workoutActivityState(active(), 'en')!.exercise, active().exercises[index].name)
  return result.html
}

const disabled = (attributes: string) => /(?:^|\s)disabled(?:=|\s|$)/.test(attributes)
const textOf = (html: string) => html.replace(/<[^>]*>/g, '')
const buttonsIn = (html: string) => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => ({
  attributes: match[1], name: match[1].match(/aria-label="([^"]+)"/)?.[1] ?? textOf(match[2]),
}))
function exerciseActions(html: string) {
  const group = html.match(/<div\b[^>]*role="group"[^>]*aria-label="(?:Actions de l’exercice|Exercise actions)"[^>]*>([\s\S]*?)<\/div>/)
  assert.ok(group, 'exercise controls have one named accessible group')
  return buttonsIn(group[1])
}

function exerciseNavigation(html: string, index: number, locale: Lang) {
  const group = html.match(/<div\b[^>]*role="group"[^>]*aria-label="(?:Parcourir les exercices|Browse exercises)"[^>]*>([\s\S]*?)<\/div>/)
  assert.ok(group, 'previous and next remain in their own named navigation group')
  const controls = buttonsIn(group[1])
  assert.deepEqual(controls.map(control => control.name), locale === 'fr'
    ? ['Exercice précédent', 'Exercice suivant']
    : ['Previous exercise', 'Next exercise'])
  assert.deepEqual(controls.map(control => disabled(control.attributes)), [index === 0, index < 0 || index === active().exercises.length - 1])
}

function expectLoggingTarget(html: string, index: number, locale: Lang) {
  const controls = exerciseActions(html)
  assert.deepEqual(controls.map(control => control.name), locale === 'fr'
    ? ['Choisir un exercice', 'Saisir les séries']
    : ['Choose an exercise', 'Log sets'])
  assert.deepEqual(controls.map(control => disabled(control.attributes)), [false, false])
  assert.match(controls[0].attributes, /aria-haspopup="dialog"/, 'the picker announces its sheet')
  assert.ok(controls[1].attributes.includes(`aria-controls="sets-${index}"`))
  exerciseNavigation(html, index, locale)
  const card = html.match(new RegExp(`<article\\b[^>]*id="exercise-${index}"[^>]*>([\\s\\S]*?)</article>`))
  assert.ok(card)
  const options = buttonsIn(card[1]).find(button => button.name === (locale === 'fr'
    ? `Options : ${active().exercises[index].name}`
    : `Options: ${active().exercises[index].name}`))
  assert.ok(options && !disabled(options.attributes), 'exercise options remain reachable inside the displayed card')
  assert.match(options.attributes, /aria-haspopup="dialog"/)
  const targets = [...html.matchAll(/<div\b[^>]*id="sets-(\d+)"[^>]*>/g)]
  assert.deepEqual(targets.map(target => Number(target[1])), [index], 'logging points to the sole visible set group')
  assert.match(targets[0][0], /role="group"/)
  assert.match(targets[0][0], /tabindex="-1"/, 'logging can focus the group without opening an input keyboard')
  assert.ok(targets[0][0].includes(`aria-label="${locale === 'fr' ? 'Séries : ' : 'Sets: '}${active().exercises[index].name}"`))
}

test('two exercise actions, separate navigation and card options remain reachable at every position in both languages', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    for (const index of [0, 1, 2]) {
      actions().focusExercise(index)
      expectLoggingTarget(expectCard(index), index, locale)
    }
  }
})

test('one visible card follows explicit focus and keeps reps and reserve labels in both languages', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    actions().focusExercise(2)
    const html = expectCard(2)
    assert.match(html, locale === 'fr' ? />Répét\.</ : />Reps</)
    assert.match(html, locale === 'fr' ? />En réserve</ : />In reserve</)
    const reserveInputs = [...html.matchAll(/<select\b[^>]*aria-label="([^"]+)"/g)]
    assert.deepEqual(reserveInputs.map(input => input[1]), locale === 'fr'
      ? ['Répétitions en réserve, série 1', 'Répétitions en réserve, série 2']
      : ['Reps in reserve, set 1', 'Reps in reserve, set 2'])
  }
})

const escapedText = (value: string) => renderToStaticMarkup(createElement('span', null, value)).slice(6, -7)
function techniqueCues(html: string, index: number) {
  const section = html.match(new RegExp(`<section\\b[^>]*aria-labelledby="technique-${index}"[^>]*>([\\s\\S]*?)</section>`))
  return [...(section?.[1] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1])
}

test('the displayed model and real technique cues follow exercise focus in French and English', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    const ids = ['chest-press', 'lat-pulldown']
    const state = actions().state
    const exercises = active().exercises.map((exercise, index) => index < ids.length
      ? { ...exercise, exerciseId: ids[index], name: LIBRARY[ids[index]].name, technique: undefined }
      : exercise)
    useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })

    for (const index of [0, 1, 0]) {
      actions().focusExercise(index)
      const { html, models } = render()
      expectCard(index)
      const name = LIBRARY[ids[index]].name
      assert.ok(models[0].includes(`aria-label="${escapedText(locale === 'fr' ? `${name} : démonstration 3D` : `${name}: 3D demonstration`)}"`))
      assert.deepEqual(techniqueCues(html, index), LIBRARY[ids[index]].cues.map(escapedText), 'all instructions come from the currently selected library exercise')
      assert.deepEqual(techniqueCues(html, 1 - index), [], 'the previous exercise instructions are no longer visible')
      assert.ok(!html.includes(escapedText(LIBRARY[ids[1 - index]].cues[0])))
    }
  }
})

test('a custom exercise keeps its anatomy fallback without invented cues, and preserves personal technique', () => {
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    const state = actions().state
    const exercises = [...active().exercises]
    exercises[2] = { ...exercises[2], exerciseId: 'qa-personal-exercise', name: 'My personal exercise', technique: undefined }
    useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
    actions().focusExercise(2)
    const html = expectCard(2)
    assert.deepEqual(techniqueCues(html, 2), [])
    assert.doesNotMatch(html, /aria-labelledby="technique-2"/, 'an unknown exercise does not acquire a generic technique section')
    assert.match(html, locale === 'fr' ? /Vue anatomique uniquement/ : /Anatomy view only/)
    for (const id of ['chest-press', 'lat-pulldown']) {
      assert.ok(!html.includes(escapedText(LIBRARY[id].cues[0])), 'library instructions are not reused for a personal exercise')
    }

    // Personal technique can arrive through a saved template/imported workout.
    const withPersonalTechnique = active().exercises.map((exercise, index) => index === 2
      ? { ...exercise, technique: 'My own technique note <keep exactly>' }
      : exercise)
    useStore.setState({ state: { ...actions().state, activeWorkout: { ...active(), exercises: withPersonalTechnique } } })
    const withNote = expectCard(2)
    assert.ok(withNote.includes(escapedText('My own technique note <keep exactly>')))
    assert.deepEqual(techniqueCues(withNote, 2), [], 'personal text remains personal text, without generated steps')
  }
})

test('logging the last row first keeps the card, then completing every set advances and wraps', () => {
  expectCard(0)
  actions().focusExercise(2)
  complete(2, 1)
  expectCard(2)
  assert.equal(active().timer!.next, 'Set 1/2 · Exercise 3')
  complete(2, 0)
  expectCard(0)
  assert.equal(active().timer!.next, 'Exercise 1')
  complete(0, 0)
  expectCard(0)
  complete(0, 1)
  expectCard(1)
})

test('supersets render the pending partner immediately, then return to the first exercise after rest', () => {
  const state = actions().state
  const exercises = active().exercises.map((exercise, index) => index === 1 ? { ...exercise, supersetWithNext: true } : exercise)
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
  actions().focusExercise(1)
  expectCard(1)
  complete(1, 0)
  assert.equal(active().timer, null)
  expectCard(2)
  complete(2, 0)
  expectCard(1)
  assert.equal(active().timer!.label, 'Exercise 2 + Exercise 3')
  actions().stopRest()
  expectCard(1)
  complete(1, 1)
  expectCard(2)
  complete(2, 1)
  expectCard(0)
})

test('undoing completed work returns its card; skipped cards do not retain the active view', () => {
  complete(2, 0); complete(2, 1)
  expectCard(0)
  complete(2, 1) // The same real store action undoes a checked set.
  expectCard(2)
  const deadline = active().timer!.endAt
  actions().skipExercise(2, true)
  const html = expectCard(0)
  assert.match(html, /4\ssets left/, 'skipped work does not reduce the count of remaining sets in other exercises')
  assert.equal(workoutActivityState(active(), 'en')!.completedSets, 0)
  assert.equal(active().timer!.endAt, deadline)
})

test('repeated exercise identities still display only the selected occurrence', () => {
  const state = actions().state
  const exercises = [...active().exercises]
  exercises[2] = { ...exercises[0], sets: exercises[0].sets.map(set => ({ ...set, weight: 42 })) }
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), exercises } } })
  actions().focusExercise(2)
  expectCard(2)
  assert.match(workoutActivityState(active(), 'en')!.detail, /^42 /)
  complete(2, 0)
  expectCard(2)
  assert.equal(active().exercises[0].sets[0].completed, false)
})

test('reopening and undoing a set keeps correction controls linked to the displayed exercise', () => {
  for (let exercise = 0; exercise < 3; exercise++) for (let set = 0; set < 2; set++) complete(exercise, set)
  const state = actions().state
  useStore.setState({ state: { ...state, activeWorkout: { ...active(), reopened: { completedAt: '2026-10-03T10:00:00Z' } } } })
  complete(1, 1)
  for (const locale of ['fr', 'en'] as Lang[]) {
    setLang(locale)
    const { html, cards } = render()
    assert.deepEqual(cards, [1])
    expectLoggingTarget(html, 1, locale)
    const names = buttonsIn(html).map(button => button.name)
    assert.ok(names.includes(locale === 'fr' ? 'Annuler la série 1' : 'Undo set 1'))
    assert.ok(names.includes(locale === 'fr' ? 'Valider la série 2' : 'Log set 2'))
  }
})

test('all completed work keeps the exercise picker and finish action accessible, including reopened history', () => {
  for (let exercise = 0; exercise < 3; exercise++) for (let set = 0; set < 2; set++) complete(exercise, set)
  for (const reopened of [false, true]) {
    if (reopened) {
      const state = actions().state
      useStore.setState({ state: { ...state, activeWorkout: { ...active(), reopened: { completedAt: '2026-10-03T10:00:00Z' } } } })
    }
    for (const locale of ['fr', 'en'] as Lang[]) {
      setLang(locale)
      const { html, cards, models } = render()
      assert.deepEqual(cards, [], 'there is no phantom active exercise after every set is logged')
      assert.deepEqual(models, [], 'completed work does not leave a hidden exercise model mounted')
      assert.match(html, locale === 'fr' ? /Toutes les séries sont faites/ : /All sets done/)
      const controls = exerciseActions(html)
      assert.deepEqual(controls.map(control => control.name), locale === 'fr'
        ? ['Choisir un exercice', 'Voir les séries']
        : ['Choose an exercise', 'Review sets'])
      assert.deepEqual(controls.map(control => disabled(control.attributes)), [false, true], 'completed exercises remain selectable, while reviewing sets requires a displayed exercise')
      assert.match(controls[0].attributes, /aria-haspopup="dialog"/)
      assert.doesNotMatch(controls[1].attributes, /aria-controls=/, 'no logging action points to a hidden or missing set group')
      exerciseNavigation(html, -1, locale)
      assert.ok(!buttonsIn(html).some(button => /^(?:Options : Exercise|Options: Exercise)/.test(button.name)), 'no hidden exercise options are exposed')
      const finish = buttonsIn(html).find(button => button.name === (locale === 'fr' ? 'Terminer la séance' : 'Finish workout'))
      assert.ok(finish && !disabled(finish.attributes), 'finishing remains available')
    }
  }
})
