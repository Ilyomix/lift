import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { PlanModePicker } from '../src/components/PlanMode'
import { ZonePicker } from '../src/components/ZonePicker'
import { lang, setLang } from '../src/lib/i18n'
import { configurePlan, DEFAULT_GOAL } from '../src/lib/program'
import { Onboarding } from '../src/screens/Onboarding'

type Element = ReactElement<Record<string, any>>
const originalLanguage = lang()

// Exercise real onboarding drafts and controls; nested views render through React.
function mount() {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useMemo: (callback: () => unknown) => callback(),
      useEffect() {},
      useRef: (current: unknown) => ({ current }),
      useState(value: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof value === 'function' ? value() : value
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
    }
    try { return Onboarding() } finally { internals.H = previous }
  }
}
function find(node: ReactNode, match: (element: Element) => boolean): Element | undefined {
  for (const element of React.Children.toArray(node)) {
    if (!isValidElement<Record<string, any>>(element)) continue
    if (match(element)) return element
    const child = find(element.props.children, match)
    if (child) return child
  }
}
const next = (tree: ReactNode) => {
  const button = find(tree, element => element.props.children === 'Continuer' && element.props.onClick)!
  assert.equal(button.props.disabled, false)
  button.props.onClick()
}
const step = (tree: ReactNode) => find(tree, element => element.props.d && element.props.patch)!
const contents = (element: Element) => (element.type as (props: any) => ReactNode)(element.props)

beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-08T12:00:00Z') })
  setLang('fr')
  configurePlan(DEFAULT_GOAL)
})
afterEach(() => { setLang(originalLanguage); configurePlan(DEFAULT_GOAL) })

test('onboarding keeps physique and priority controls in both modes and shows a date only with a deadline', () => {
  const render = mount()
  render().props.onStart()
  next(render()); next(render())
  const body = contents(step(render()))
  find(body, element => element.type === 'input' && element.props.placeholder === '30')!.props.onChange({ target: { value: '30' } })
  for (const [label, value] of [['Taille', '178'], ['Poids actuel', '78.5'], ['Tour de taille', '90']]) {
    const picker = find(body, element => element.type === MeasurementPicker && element.props.label === label)!
    assert.ok(picker, `${label} has wheel and manual entry through the shared picker`)
    picker.props.onChange(value)
  }
  next(render())
  let goal = contents(step(render()))
  assert.match(renderToStaticMarkup(goal), /aria-label="Date objectif/)
  find(goal, element => element.type === PlanModePicker)!.props.onChange('maintenance')
  goal = contents(step(render()))
  const withoutDate = renderToStaticMarkup(goal)
  assert.doesNotMatch(withoutDate, /aria-label="Date objectif/)
  assert.match(withoutDate, /aria-label="Repère physique"/)
  assert.match(withoutDate, /Personnaliser les zones prioritaires/)
  find(goal, element => element.type === ZonePicker)!.props.onChange(['jambes', 'bras'])
  const physique = find(goal, element => element.props.role === 'group' && element.props['aria-label'] === 'Repère physique')!
  const choices = React.Children.toArray(physique.props.children).filter(isValidElement) as Element[]
  choices[0].props.onClick()

  goal = contents(step(render()))
  find(goal, element => element.type === PlanModePicker)!.props.onChange('goal')
  assert.match(renderToStaticMarkup(contents(step(render()))), /aria-label="Date objectif/)
  find(contents(step(render())), element => element.type === PlanModePicker)!.props.onChange('maintenance')
  const draft = step(render()).props.d
  assert.equal(draft.look, 'athletique')
  assert.deepEqual(draft.zones, ['jambes', 'bras'])
  next(render())
  const summary = renderToStaticMarkup(render())
  assert.match(summary, /Athlétique/)
  assert.match(summary, /Jambes et bras/)
  assert.match(summary, /Sans date limite/)
})
