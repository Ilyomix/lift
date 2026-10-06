export const MAIN_ROUTES = ['', 'seance', 'calendrier', 'progres', 'plus'] as const
export type SwipeAction = { type: 'navigate'; path: string } | { type: 'back' }
export type SwipeContext = { path: string; left: number; width: number; scrollY: number; canGoBack: boolean }
export type SwipeRelease = { offset: number; width: number }

export function mainRouteIndex(path: string) {
  if (path === 'calendrier/programme') return 2
  if (['progres/corps', 'progres/volume', 'progres/seances', 'progres/force'].includes(path)) return 3
  return MAIN_ROUTES.findIndex(route => route === path)
}

/** One touch, deliberate horizontal intent; never reclaim a vertical/browser-owned gesture. */
export function bindSwipeNavigation(element: HTMLElement | Document, options: {
  context: () => SwipeContext
  excluded: (target: EventTarget | null) => boolean
  blocked: () => boolean
  perform: (action: SwipeAction, release: SwipeRelease) => void
  drag?: (offset: number) => void
  cancel?: () => void
}) {
  type Candidate = { id: number; x: number; y: number; time: number; context: SwipeContext; tab: number; direction: number }
  let candidate: Candidate | undefined
  const clear = () => {
    const claimed = !!candidate?.direction
    candidate = undefined
    if (claimed) options.cancel?.()
  }
  const action = (start: Candidate, direction: number): SwipeAction | undefined => {
    if (start.tab < 0) return direction > 0 && start.context.canGoBack ? { type: 'back' } : undefined
    const path = MAIN_ROUTES[start.tab + (direction < 0 ? 1 : -1)]
    return path !== undefined ? { type: 'navigate', path } : undefined
  }
  const start = (event: TouchEvent) => {
    clear()
    // This passive listener only observes the start. Claiming the gesture waits
    // for a cancelable horizontal move; a non-cancelable start is not a scroll.
    if (event.touches.length !== 1 || event.defaultPrevented || options.blocked() || options.excluded(event.target)) return
    const touch = event.touches[0]
    const context = { ...options.context() }
    const x = touch.clientX - context.left
    // Preserve the system's screen-edge gestures, including Safari Back/Forward.
    if (x < 20 || x > context.width - 20) return
    const tab = mainRouteIndex(context.path)
    if (tab < 0 && !context.canGoBack) return
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
    if (!current.direction && Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
    if (Math.abs(dx) < Math.abs(dy) * 2 || (current.direction && dx !== 0 && Math.sign(dx) !== current.direction)) { clear(); return }
    const direction = current.direction || Math.sign(dx)
    if (!action(current, direction)) { clear(); return }
    current.direction = direction
    event.preventDefault()
    options.drag?.(Math.max(-current.context.width, Math.min(current.context.width, dx)))
  }
  const end = (event: TouchEvent) => {
    const current = candidate
    candidate = undefined
    if (!current?.direction) return
    const usable = event.touches.length === 0 && valid(event, current)
    // A claimed drag must not turn into a click on the row/button underneath,
    // including when it is too short to navigate and returns to its start.
    if (event.cancelable) event.preventDefault()
    if (!usable) { options.cancel?.(); return }
    const touch = Array.from(event.changedTouches).find(point => point.identifier === current.id)
    if (!touch) { options.cancel?.(); return }
    const dx = touch.clientX - current.x, dy = touch.clientY - current.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2 || Math.sign(dx) !== current.direction) { options.cancel?.(); return }
    const next = action(current, current.direction)
    if (!next) { options.cancel?.(); return }
    options.perform(next, { offset: Math.max(-current.context.width, Math.min(current.context.width, dx)), width: current.context.width })
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

// A horizontal swipe can begin on a row or button: claiming touchend suppresses
// its click. Inputs, sliders, tabs, reorder handles and 3D keep their own gestures.
const INTERACTIVE = 'input, textarea, select, nav, canvas, video, audio, iframe, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="tab"], [role="tablist"], [role="switch"], [role="spinbutton"], [role="combobox"], [role="listbox"], [draggable="true"], [data-swipe-ignore]'

export function excludesSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !target.closest('main') || target.closest(INTERACTIVE)) return true
  for (let node: Element | null = target; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    // Reorder handles reserve all touch motion; charts reserve horizontal motion
    // while letting the browser scroll vertically. Neither uses HTML draggable.
    if (style.touchAction === 'none' || style.touchAction.split(' ').includes('pan-y')) return true
    // Keep carousels, segmented scrollers and tables in control even at their ends.
    if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) return true
    if (node.tagName === 'MAIN') break
  }
  return false
}
