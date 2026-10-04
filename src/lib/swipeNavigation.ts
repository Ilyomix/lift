export const MAIN_ROUTES = ['', 'seance', 'calendrier', 'progres', 'plus'] as const
export type SwipeAction = { type: 'navigate'; path: string } | { type: 'back' }
export type SwipeContext = { path: string; left: number; width: number; scrollY: number; canGoBack: boolean }

export function mainRouteIndex(path: string) {
  if (['progres/corps', 'progres/volume', 'progres/seances', 'progres/force'].includes(path)) return 3
  return MAIN_ROUTES.findIndex(route => route === path)
}

/** One touch, deliberate horizontal intent; never reclaim a vertical/browser-owned gesture. */
export function bindSwipeNavigation(element: HTMLElement | Document, options: {
  context: () => SwipeContext
  excluded: (target: EventTarget | null) => boolean
  blocked: () => boolean
  perform: (action: SwipeAction) => void
}) {
  type Candidate = { id: number; x: number; y: number; time: number; context: SwipeContext; tab: number; direction: number }
  let candidate: Candidate | undefined
  const clear = () => { candidate = undefined }
  const action = (start: Candidate, direction: number): SwipeAction | undefined => {
    if (start.tab < 0) return direction > 0 && start.context.canGoBack ? { type: 'back' } : undefined
    const path = MAIN_ROUTES[start.tab + (direction < 0 ? 1 : -1)]
    return path !== undefined ? { type: 'navigate', path } : undefined
  }
  const start = (event: TouchEvent) => {
    clear()
    if (event.touches.length !== 1 || !event.cancelable || event.defaultPrevented || options.blocked() || options.excluded(event.target)) return
    const touch = event.touches[0]
    const context = { ...options.context() }
    const x = touch.clientX - context.left
    // Preserve the system's screen-edge gestures, including Safari Back/Forward.
    if (x < 20 || x > context.width - 20) return
    const tab = mainRouteIndex(context.path)
    if (tab < 0 && (x > 56 || !context.canGoBack)) return
    candidate = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp, context, tab, direction: 0 }
  }
  const valid = (event: TouchEvent, start: Candidate) => {
    const now = options.context()
    return event.timeStamp - start.time <= 900 && !event.defaultPrevented && !options.blocked()
      && now.path === start.context.path && now.width === start.context.width
      && Math.abs(now.scrollY - start.context.scrollY) <= 4
  }
  const move = (event: TouchEvent) => {
    const current = candidate
    if (!current) return
    if (event.touches.length !== 1 || !event.cancelable || !valid(event, current)) { clear(); return }
    const touch = event.touches[0]
    if (touch.identifier !== current.id) { clear(); return }
    const dx = touch.clientX - current.x, dy = touch.clientY - current.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
    if (Math.abs(dx) < Math.abs(dy) * 2 || (current.direction && Math.sign(dx) !== current.direction)) { clear(); return }
    const direction = Math.sign(dx)
    if (!action(current, direction)) { clear(); return }
    current.direction = direction
    event.preventDefault()
  }
  const end = (event: TouchEvent) => {
    const current = candidate
    clear()
    if (!current || !current.direction || event.touches.length !== 0 || !valid(event, current)) return
    const touch = Array.from(event.changedTouches).find(point => point.identifier === current.id)
    if (!touch) return
    const dx = touch.clientX - current.x, dy = touch.clientY - current.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2 || Math.sign(dx) !== current.direction) return
    const next = action(current, current.direction)
    if (!next) return
    if (event.cancelable) event.preventDefault()
    options.perform(next)
  }
  // These are touch-only listeners. Mouse drags and trackpad scrolling stay native.
  element.addEventListener('touchstart', start as EventListener, { passive: true })
  element.addEventListener('touchmove', move as EventListener, { passive: false })
  element.addEventListener('touchend', end as EventListener, { passive: false })
  element.addEventListener('touchcancel', clear)
  return () => {
    clear()
    element.removeEventListener('touchstart', start as EventListener)
    element.removeEventListener('touchmove', move as EventListener)
    element.removeEventListener('touchend', end as EventListener)
    element.removeEventListener('touchcancel', clear)
  }
}

const INTERACTIVE = 'input, textarea, select, button, a, summary, label, nav, canvas, svg, video, audio, iframe, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="tab"], [role="tablist"], [role="switch"], [role="spinbutton"], [role="combobox"], [role="listbox"], [draggable="true"], [data-swipe-ignore]'

export function excludesSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !target.closest('main') || target.closest(INTERACTIVE)) return true
  for (let node: Element | null = target; node; node = node.parentElement) {
    // Keep carousels, segmented scrollers and tables in control even at their ends.
    if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return true
    if (node.tagName === 'MAIN') break
  }
  return false
}
