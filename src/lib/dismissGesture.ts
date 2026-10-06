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
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
      if (dy < 0 || dy < Math.abs(dx) * 1.5) { cancel(); return }
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
    cancel()
    element.removeEventListener('touchstart', start)
    element.removeEventListener('touchmove', move)
    element.removeEventListener('touchend', end)
    element.removeEventListener('touchcancel', cancel)
  }
}
