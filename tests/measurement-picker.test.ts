import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MeasurementPicker } from '../src/components/MeasurementPicker'
import { lang, setLang } from '../src/lib/i18n'

const originalLanguage = lang(), originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let touch = true, pointerListener: (() => void) | undefined, subscribe: ((change: () => void) => () => void) | undefined
setLang('en')
Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({
  matches: touch, addEventListener: (_event: string, listener: () => void) => { pointerListener = listener },
  removeEventListener: () => { pointerListener = undefined },
}) } })
beforeEach(() => { touch = true })
after(() => {
  setLang(originalLanguage)
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

// Exercise actual draft/event handlers without adding a browser DOM dependency.
function mount<P,>(component: (props: P) => ReactNode, props: P | (() => P)) {
  const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const slots: unknown[] = []
  return () => {
    let cursor = 0
    const previous = internals.H
    internals.H = {
      useId: () => 'measurement-test', useEffect() {}, useLayoutEffect() {},
      useSyncExternalStore(listen: typeof subscribe, snapshot: () => unknown) { subscribe = listen; return snapshot() },
      useState(initial: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
        return [slots[i], (next: unknown) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
      },
      useMemo(factory: () => unknown, deps: unknown[]) {
        const i = cursor++, prior = slots[i] as { deps: unknown[]; value: unknown } | undefined
        if (!prior || deps.some((dep, index) => !Object.is(dep, prior.deps[index]))) slots[i] = { deps, value: factory() }
        return (slots[i] as { value: unknown }).value
      },
      useRef(initial: unknown) {
        const i = cursor++
        if (!(i in slots)) slots[i] = { current: initial }
        return slots[i]
      },
    }
    try { return component(typeof props === 'function' ? (props as () => P)() : props) } finally { internals.H = previous }
  }
}

function find(node: ReactNode, match: (element: ReactElement<any>) => boolean): ReactElement<any> {
  for (const child of React.Children.toArray(node)) {
    if (!isValidElement<any>(child)) continue
    if (match(child)) return child
    try { return find(child.props.children, match) } catch {}
  }
  throw new Error('Control not found')
}
const props = (onChange: (value: string) => void) => ({ label: 'Weight', unit: 'kg' as const, value: '', onChange, min: 35, max: 250, step: .1, defaultValue: 78 })
const action = (render: () => ReactNode, text: string) => find(render(), item => item.props.children === text).props.onClick()
function openWheel(render: () => ReactNode) {
  find(render(), item => item.type === 'button' && 'aria-expanded' in item.props).props.onClick()
  const wheel = find(render(), item => typeof item.type === 'function' && 'onPick' in item.props)
  return mount(wheel.type as any, wheel.props)
}
function column(wheel: () => ReactNode, label: string) {
  const element = () => find(wheel(), item => typeof item.type === 'function' && item.props.label === label)
  return mount(element().type as any, () => element().props)
}
const spin = (render: () => ReactNode) => find(render(), item => item.props.role === 'spinbutton')


test('desktop uses direct input and reacts to touch pointer availability', () => {
  touch = false
  const changes: string[] = [], render = mount(MeasurementPicker, props(value => changes.push(value)))
  const input = find(render(), item => item.type === 'input')
  input.props.onChange({ target: { value: '300,25' } })
  assert.deepEqual(changes, ['300,25'], 'manual validation belongs to the parent, not the wheel range')
  assert.doesNotMatch(renderToStaticMarkup(render()), /<button/)
  assert.match(renderToStaticMarkup(render()), /pointer-events-none[^>]*>kg<\/span>/)
  assert.match(input.props.className, /pr-11/)
  assert.equal(input.props.value, '', 'the visible unit does not change numeric input content')
  let notified = 0
  const cleanup = subscribe!(() => { notified++ })
  touch = true; pointerListener!()
  assert.equal(notified, 1)
  assert.equal(find(render(), item => 'aria-expanded' in item.props).props['aria-expanded'], false)
  cleanup(); assert.equal(pointerListener, undefined)
})

test('opening or cancelling a wheel never fills an optional empty measurement', () => {
  const changes: string[] = [], render = mount(MeasurementPicker, props(value => changes.push(value)))
  assert.doesNotMatch(renderToStaticMarkup(render()), /spinbutton/)
  const wheel = openWheel(render), whole = column(wheel, 'Weight: whole number')
  spin(whole).props.onScroll({ currentTarget: { scrollTop: (83 - 35) * 44 } })
  assert.deepEqual(changes, [])
  action(wheel, 'Cancel')
  assert.deepEqual(changes, [])
  assert.equal(find(render(), item => 'aria-expanded' in item.props).props['aria-expanded'], false)
})

test('whole units and tenths scroll independently, retain stable rows and confirm an exact decimal', () => {
  const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, props(value => changes.push(value))))
  const whole = column(wheel, 'Weight: whole number'), tenths = column(wheel, 'Weight: decimals')
  spin(whole).props.onScroll({ currentTarget: { scrollTop: (83 - 35) * 44 } })
  spin(tenths).props.onScroll({ currentTarget: { scrollTop: 2 * 44 } })
  assert.equal(spin(whole).props['aria-valuenow'], 83)
  assert.equal(spin(tenths).props['aria-valuenow'], .2)
  assert.equal([...renderToStaticMarkup(whole()).matchAll(/snap-center/g)].length, 216)
  assert.equal([...renderToStaticMarkup(tenths()).matchAll(/snap-center/g)].length, 10)
  assert.doesNotMatch(renderToStaticMarkup(whole()), />kg</)
  assert.equal([...renderToStaticMarkup(wheel()).matchAll(/>kg</g)].length, 1, 'unit is fixed beside both columns')
  action(wheel, 'Confirm')
  assert.deepEqual(changes, ['83.2'])
})

test('the maximum whole unit constrains decimal values and keyboard input respects bounds', () => {
  const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, props(value => changes.push(value))))
  const whole = column(wheel, 'Weight: whole number'), tenths = column(wheel, 'Weight: decimals')
  spin(tenths).props.onScroll({ currentTarget: { scrollTop: 9 * 44 } })
  const key = (key: string) => spin(whole).props.onKeyDown({ key, preventDefault() {} })
  key('End'); key('ArrowUp')
  assert.equal(spin(whole).props['aria-valuenow'], 250)
  assert.equal(spin(tenths).props['aria-valuemax'], 0)
  assert.equal(spin(tenths).props['aria-valuenow'], 0)
  action(wheel, 'Confirm')
  assert.deepEqual(changes, ['250'])
})

test('tapping the selected value types within the wheel; cancel, precision and empty input are preserved', () => {
  const changes: string[] = [], render = mount(MeasurementPicker, props(value => changes.push(value)))
  const type = (value: string) => {
    const wheel = openWheel(render), whole = column(wheel, 'Weight: whole number')
    find(whole(), item => item.props.children === '78' && !!item.props.onClick).props.onClick()
    const input = find(wheel(), item => item.type === 'input')
    assert.equal(input.props.inputMode, 'decimal')
    assert.equal(input.props.value, '78')
    const overlay = find(wheel(), item => typeof item.props.className === 'string' && item.props.className.includes('absolute inset-x-0 top-[88px] flex'))
    assert.equal(find(overlay, item => item.type === 'input').props.value, '78', 'manual entry occupies the selected row, not a separate field')
    assert.equal(find(wheel(), item => item.props.inert === true).props['aria-hidden'], true)
    input.props.onChange({ target: { value } })
    assert.deepEqual(changes, [])
    return wheel
  }
  action(type('80'), 'Cancel'); assert.deepEqual(changes, [])
  action(type('78,25'), 'Confirm'); assert.deepEqual(changes, ['78,25'])
  changes.length = 0
  action(type(''), 'Confirm'); assert.deepEqual(changes, [''])
})

test('whole-centimetre inputs use one column and expose parent error descriptions', () => {
  const p = { ...props(() => {}), label: 'Height', unit: 'cm' as const, min: 120, max: 230, step: 1, defaultValue: 178, 'aria-describedby': 'height-error', 'aria-invalid': true as const }
  const render = mount(MeasurementPicker, p)
  assert.equal(find(render(), item => 'aria-expanded' in item.props).props['aria-describedby'], 'height-error')
  const html = renderToStaticMarkup(openWheel(render)())
  assert.equal([...html.matchAll(/role="spinbutton"/g)].length, 1)
  touch = false
  assert.equal(find(render(), item => item.type === 'input').props['aria-invalid'], true)
  assert.equal(find(render(), item => item.type === 'input').props['aria-describedby'], 'height-error')
})


test('Enter on Cancel does not commit the draft; Enter on a spinbutton does', () => {
  const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, props(value => changes.push(value))))
  const panel = find(wheel(), item => item.props.id === 'measurement-test')
  let prevented = false
  panel.props.onKeyDown({ key: 'Enter', target: { getAttribute: () => null }, preventDefault() { prevented = true } })
  assert.equal(prevented, false, 'button activation is left to the focused button')
  assert.deepEqual(changes, [])
  panel.props.onKeyDown({ key: 'Enter', target: { getAttribute: () => 'spinbutton' }, preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.deepEqual(changes, ['78'])
})


test('large nutrition ranges keep a bounded stable list and never round the existing value on confirmation', () => {
  for (const step of [1, 10, 50]) {
    const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, {
      ...props(value => changes.push(value)), label: 'Calories', unit: 'kcal', value: '1234', min: 0, max: 10000, step,
    }))
    const calories = column(wheel, 'Calories (kcal)'), rows = () => spin(calories).props.children
    assert.ok(rows().length <= 502)
    assert.ok(rows().some((row: ReactElement<any>) => row.props.children === '1,234'))
    const count = rows().length
    action(wheel, 'Confirm')
    assert.deepEqual(changes, ['1234'])
    spin(calories).props.onScroll({ currentTarget: { scrollTop: 4 * 44 } })
    assert.equal(rows().length, count, 'scrolling must not add, remove or rebase rows')
  }
})

test('opening decimal measurements keeps their exact precision with a narrow fractional column', () => {
  const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, { ...props(value => changes.push(value)), value: '78,25' }))
  const fractions = column(wheel, 'Weight: decimals')
  assert.equal(spin(fractions).props['aria-valuenow'], .25)
  assert.match(spin(fractions).props.className, /w-11 flex-none/)
  assert.ok(spin(fractions).props.children.some((row: ReactElement<any>) => row.props.children === '25'))
  action(wheel, 'Confirm')
  assert.deepEqual(changes, ['78.25'])
})

test('compact workout fields omit the chevron, use a sheet and respect disabled state', () => {
  const p = { ...props(() => {}), presentation: 'sheet' as const, inputClassName: 'compact-control', disabled: true, value: '22.5', unit: 'kg/hand' }
  const render = mount(MeasurementPicker, p)
  const trigger = find(render(), item => 'aria-expanded' in item.props)
  assert.equal(trigger.props.disabled, true)
  assert.doesNotMatch(renderToStaticMarkup(trigger), /<svg/)
  assert.equal(trigger.props['aria-haspopup'], 'dialog')
  assert.match(trigger.props.className, /flex-col justify-center/)
  assert.match(find(trigger, item => item.props.children === '22.5').props.className, /whitespace-nowrap/)
  assert.match(renderToStaticMarkup(trigger), />kg\/hand</)
  touch = false
  const input = find(render(), item => item.type === 'input')
  assert.equal(input.props.disabled, true)
  assert.match(input.props.className, /pb-3 text-center/)
  assert.doesNotMatch(input.props.className, /pr-11|pr-5/)
  assert.equal(input.props.value, '22.5')
  assert.match(find(render(), item => item.props.children === 'kg/hand').props.className, /bottom-1/)
})


test('reopening a manually entered value outside the suggested wheel range never clamps it', () => {
  const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, { ...props(value => changes.push(value)), value: '300,25' }))
  assert.equal(spin(column(wheel, 'Weight: whole number')).props['aria-valuemax'], 300)
  assert.equal(spin(column(wheel, 'Weight: decimals')).props['aria-valuemax'], .25)
  action(wheel, 'Confirm')
  assert.deepEqual(changes, ['300.25'])
})


test('weight and protein wheels retain one-unit steps through 500', () => {
  for (const [label, unit, step, value] of [['Load', 'kg', .1, '47.3'], ['Protein', 'g', 1, '151']] as const) {
    const changes: string[] = [], wheel = openWheel(mount(MeasurementPicker, { ...props(next => changes.push(next)), label, unit, step, value, min: 0, max: 500 }))
    const whole = column(wheel, step < 1 ? `${label}: whole number` : `${label} (${unit})`)
    assert.equal(spin(whole).props.children.length, 501)
    spin(whole).props.onScroll({ currentTarget: { scrollTop: 48 * 44 } })
    action(wheel, 'Confirm')
    assert.deepEqual(changes, [step < 1 ? '48.3' : '48'])
  }
})


test('desktop focus callbacks reach the input without affecting mobile draft editing', () => {
  const onFocus = () => {}, onBlur = () => {}
  const render = mount(MeasurementPicker, { ...props(() => {}), onFocus, onBlur })
  touch = false
  const input = find(render(), item => item.type === 'input')
  assert.equal(input.props.onFocus, onFocus)
  assert.equal(input.props.onBlur, onBlur)
  touch = true
  const trigger = find(render(), item => 'aria-expanded' in item.props)
  assert.equal(trigger.props.onFocus, undefined)
  assert.equal(trigger.props.onBlur, undefined)
})
