import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import React, { isValidElement, type ReactElement, type ReactNode } from 'react'
import { LineChart, type ChartSeries } from '../src/components/charts'
import { fmtNum } from '../src/lib/format'
import { lang, setLang } from '../src/lib/i18n'

const internals = (React as any).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
const originalLang = lang()
afterEach(() => setLang(originalLang))

function chart(values: number[], options: Partial<Parameters<typeof LineChart>[0]> = {}) {
  const series: ChartSeries[] = [{ id: 'test', label: 'Test', kind: 'line', color: 'var(--chart-1)', points: values.map((y, x) => ({ x, y })) }]
  const before = structuredClone(series)
  const previous = internals.H
  internals.H = {
    useRef: () => ({ current: null }),
    useState: (value: unknown) => [value === 0 ? 320 : value, () => {}],
    useLayoutEffect() {},
    useMemo: (run: () => unknown) => run(),
  }
  let rendered: ReactNode
  try { rendered = LineChart({ series, ariaLabel: 'Test', xFormat: String, ...options }) }
  finally { internals.H = previous }
  const elements: ReactElement<any>[] = []
  const visit = (node: ReactNode) => React.Children.forEach(node, child => {
    if (!isValidElement<any>(child)) return
    elements.push(child)
    visit(child.props.children)
  })
  visit(rendered)
  assert.deepEqual(series, before, 'formatting the axis never changes logged or estimated values')
  const labels = elements.filter(node => node.type === 'text' && node.props.className === 'fill-muted text-[11px] tnum').map(node => String(node.props.children))
  const path = elements.find(node => node.type === 'path' && node.props.stroke === 'var(--chart-1)')?.props.d as string
  assert.ok(labels.length >= 2, 'a narrow or constant series retains a usable scale')
  assert.equal(new Set(labels).size, labels.length, 'axis labels must remain distinct at the chosen precision')
  assert.doesNotMatch(path, /NaN|Infinity/)
  return { labels, path }
}

test('a single estimated 1RM has distinct whole-unit graduations', () => {
  setLang('en')
  const result = chart([30], { yFormat: value => fmtNum(value, 0), yTickStep: 1 })
  assert.deepEqual(result.labels, ['29', '30', '31'])
})

test('small estimated-load variations keep their positions without inventing decimal labels', () => {
  setLang('en')
  const result = chart([30, 30.04], { yFormat: value => fmtNum(value, 0), yTickStep: 1 })
  assert.deepEqual(result.labels, ['29', '30', '31'])
  const pointYs = [...result.path.matchAll(/[ML][\d.]+,([\d.]+)/g)].map(match => match[1])
  assert.equal(new Set(pointYs).size, 2, 'the measured difference is not rounded out of the plotted series')
})

test('bodyweight repetition ticks are exact nonnegative integers, including a zero series', () => {
  setLang('en')
  assert.deepEqual(chart([0, 6], { yFormat: value => fmtNum(value, 0), yTickStep: 1 }).labels, ['0', '3', '6'])
  assert.deepEqual(chart([0], { yFormat: value => fmtNum(value, 0), yTickStep: 1 }).labels, ['0', '1'])
})

test('nearby body measurements retain distinct tenths in French and English', () => {
  for (const language of ['fr', 'en'] as const) {
    setLang(language)
    assert.deepEqual(chart([92.5, 92.51]).labels, [92.4, 92.5, 92.6].map(value => fmtNum(value, 1)))
  }
})
