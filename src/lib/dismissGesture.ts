/** A downward pull owns the gesture only after vertical intent is established. */
export function bindDismissGesture(element: HTMLElement, options: {
  height: () => number
  canStart: (target: EventTarget | null) => boolean
  drag: (distance: number) => void
  release: (dismiss: boolean) => void
}) {
  type Pull = { id: number; x: number; y: number; threshold: number; peak: number; claimed: boolean }
  let pull: Pull | undefined
  const cancel = () => {
    if (pull?.claimed) options.release(false)
    pull = undefined
  }
  const start = (event: TouchEvent) => {
    cancel()
    if (event.touches.length !== 1 || event.defaultPrevented || !options.canStart(event.target)) return
    const touch = event.touches[0]
    // A small flick must return, including on full-height rest panels. Freeze
    // the threshold for this gesture so content changes cannot decide its fate.
    const threshold = Math.max(120, Math.min(200, options.height() * 0.25))
    pull = { id: touch.identifier, x: touch.clientX, y: touch.clientY, threshold, peak: 0, claimed: false }
  }
  const move = (event: TouchEvent) => {
    if (!pull) return
    if (event.touches.length !== 1 || !event.cancelable || event.defaultPrevented) { cancel(); return }
    const touch = event.touches[0]
    if (touch.identifier !== pull.id) { cancel(); return }
    const dx = touch.clientX - pull.x, dy = touch.clientY - pull.y
    if (!pull.claimed) {
      // Do not let the first small downward move begin native scrolling. Once
      // Safari has claimed that scroll, later touchmoves may not be cancelable.
      if (dx === 0 && dy === 0) return
      if (dy <= 0 || dy < Math.abs(dx) * 1.5) { cancel(); return }
      pull.claimed = true
    }
    event.preventDefault()
    pull.peak = Math.max(pull.peak, dy)
    options.drag(Math.max(0, dy))
  }
  const end = (event: TouchEvent) => {
    const current = pull
    pull = undefined
    if (!current?.claimed) return
    if (event.touches.length || event.defaultPrevented) { options.release(false); return }
    const touch = Array.from(event.changedTouches).find(point => point.identifier === current.id)
    if (!touch) { options.release(false); return }
    const dy = touch.clientY - current.y
    // Distance, not speed, confirms closing. A clear reversal expresses the
    // intent to keep the panel, even if it is still below its starting point.
    const reversed = current.peak - dy >= 24
    const dismiss = dy >= current.threshold && !reversed
    if (event.cancelable) event.preventDefault()
    options.release(dismiss)
  }
  element.addEventListener('touchstart', start, { passive: true })
  element.addEventListener('touchmove', move, { passive: false })
  element.addEventListener('touchend', end, { passive: false })
  element.addEventListener('touchcancel', cancel)
  return () => {
    // Teardown must not start a return animation on an unmounting dialog.
    pull = undefined
    element.removeEventListener('touchstart', start)
    element.removeEventListener('touchmove', move)
    element.removeEventListener('touchend', end)
    element.removeEventListener('touchcancel', cancel)
  }
}

/** Imperative motion avoids a React render for every touchmove or timer tick. */
export function createDismissMotion(panel: HTMLElement, backdrop: HTMLElement | null, reduced: boolean, onClose: () => void) {
  const previous = {
    animation: panel.style.animation, transform: panel.style.transform,
    transition: panel.style.transition, opacity: panel.style.opacity, willChange: panel.style.willChange,
  }
  const backdropPrevious = backdrop && {
    animation: backdrop.style.animation, transition: backdrop.style.transition,
    opacity: backdrop.style.opacity, willChange: backdrop.style.willChange,
  }
  let settling = false
  let closing = false
  let distance = 0
  let height = 0
  let animations: Animation[] = []
  const cancelAnimations = () => {
    for (const animation of animations) { animation.onfinish = null; animation.cancel() }
    animations = []
  }
  const prepare = () => {
    // Entry animations use fill:both. Hand control to the gesture so they no
    // longer own transform/opacity, including the backdrop's completed fade.
    panel.style.animation = 'none'
    panel.style.willChange = reduced ? 'opacity' : 'transform'
    if (backdrop) {
      backdrop.style.animation = 'none'
      backdrop.style.willChange = 'opacity'
    }
    height ||= Math.max(1, panel.getBoundingClientRect().height)
  }
  return {
    get settling() { return settling },
    drag(next: number) {
      if (settling) return
      prepare()
      distance = Math.max(0, next)
      const progress = Math.min(1, distance / height)
      panel.style.transition = 'none'
      panel.style.transform = reduced ? 'none' : `translate3d(0, ${distance}px, 0)`
      panel.style.opacity = reduced ? String(1 - progress * 0.15) : '1'
      if (backdrop) {
        backdrop.style.transition = 'none'
        backdrop.style.opacity = String(1 - progress)
      }
    },
    release(dismiss: boolean) {
      if (closing || (settling && !dismiss)) return
      // Explicit keyframes preserve the last rendered position even when a
      // release and the final touchmove happen in the same browser frame.
      const view = panel.ownerDocument.defaultView!
      const start = view.getComputedStyle(panel)
      const from = reduced ? { opacity: start.opacity } : { transform: start.transform }
      const backdropFrom = backdrop ? view.getComputedStyle(backdrop).opacity : '1'
      cancelAnimations()
      prepare()
      settling = true
      closing = dismiss
      const duration = reduced ? 100 : dismiss ? 240 : 220
      const easing = dismiss ? 'cubic-bezier(0.4, 0, 1, 1)' : 'cubic-bezier(0.16, 1, 0.3, 1)'
      panel.style.transition = 'none'
      panel.style.transform = reduced ? 'none' : `translate3d(0, ${dismiss ? Math.max(height, distance) : 0}px, 0)`
      panel.style.opacity = reduced && dismiss ? '0' : '1'
      const to = reduced ? { opacity: panel.style.opacity } : { transform: panel.style.transform }
      const exit = panel.animate([from, to], { duration, easing })
      animations.push(exit)
      if (backdrop) {
        backdrop.style.transition = 'none'
        backdrop.style.opacity = dismiss ? '0' : '1'
        animations.push(backdrop.animate([{ opacity: backdropFrom }, { opacity: backdrop.style.opacity }], { duration, easing }))
      }
      // A wall-clock timeout can unmount a busy WebView before it paints the
      // exit. The animation itself owns completion, including Reduce Motion.
      exit.onfinish = () => {
        if (dismiss) { onClose(); return }
        settling = false
        distance = 0
        height = 0
        panel.style.willChange = previous.willChange
        if (backdrop) backdrop.style.willChange = backdropPrevious!.willChange
      }
    },
    dispose() {
      cancelAnimations()
      Object.assign(panel.style, previous)
      if (backdrop) Object.assign(backdrop.style, backdropPrevious)
    },
  }
}
