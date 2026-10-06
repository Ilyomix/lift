/** A downward pull owns the gesture only after vertical intent is established. */
export function bindDismissGesture(element: HTMLElement, options: {
  canStart: (target: EventTarget | null) => boolean
  drag: (distance: number) => void
  release: (dismiss: boolean) => void
}) {
  type Pull = { id: number; x: number; y: number; time: number; distance: number; claimed: boolean }
  let pull: Pull | undefined
  const cancel = () => {
    if (pull?.claimed) options.release(false)
    pull = undefined
  }
  const start = (event: TouchEvent) => {
    cancel()
    if (event.touches.length !== 1 || event.defaultPrevented || !options.canStart(event.target)) return
    const touch = event.touches[0]
    pull = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp, distance: 0, claimed: false }
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
    pull.distance = Math.max(0, dy)
    options.drag(pull.distance)
  }
  const end = (event: TouchEvent) => {
    const current = pull
    pull = undefined
    if (!current?.claimed) return
    if (event.touches.length || event.defaultPrevented) { options.release(false); return }
    const touch = Array.from(event.changedTouches).find(point => point.identifier === current.id)
    if (!touch) { options.release(false); return }
    const dy = touch.clientY - current.y
    const duration = Math.max(1, event.timeStamp - current.time)
    // A short deliberate flick or a longer pull; reversing before release cancels.
    const dismiss = dy >= 100 || (dy >= 48 && dy / duration >= 0.5)
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
  let distance = 0
  let height = 0
  let timeout: ReturnType<typeof setTimeout> | undefined
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
      if (settling) return
      prepare()
      settling = true
      const duration = reduced ? 100 : dismiss ? 180 : 220
      const easing = 'cubic-bezier(0.16, 1, 0.3, 1)'
      panel.style.transition = `${reduced ? 'opacity' : 'transform'} ${duration}ms ${easing}`
      panel.style.transform = reduced ? 'none' : `translate3d(0, ${dismiss ? Math.max(height, distance) : 0}px, 0)`
      panel.style.opacity = reduced && dismiss ? '0' : '1'
      if (backdrop) {
        backdrop.style.transition = `opacity ${duration}ms ${easing}`
        backdrop.style.opacity = dismiss ? '0' : '1'
      }
      timeout = setTimeout(() => {
        if (dismiss) { onClose(); return }
        settling = false
        height = 0
        panel.style.willChange = previous.willChange
        if (backdrop) backdrop.style.willChange = backdropPrevious!.willChange
      }, duration)
    },
    dispose() {
      clearTimeout(timeout)
      Object.assign(panel.style, previous)
      if (backdrop) Object.assign(backdrop.style, backdropPrevious)
    },
  }
}
