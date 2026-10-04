/** Leave single-finger gestures to the page; claim only two fingers on the model. */
export function bindTwoFingerRotation(element: HTMLElement, rotate: (yaw: number, pitch: number) => void, active: (value: boolean) => void) {
  type Position = { ids: string; x: number; y: number }
  let previous: Position | null = null
  const position = (event: TouchEvent): Position | null => {
    if (event.targetTouches.length !== 2 || !event.cancelable) return null
    const [a, b] = Array.from(event.targetTouches)
    return { ids: [a.identifier, b.identifier].sort((x, y) => x - y).join(','), x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
  }
  const reset = () => {
    if (previous) active(false)
    previous = null
  }
  const start = (event: TouchEvent) => {
    const next = position(event)
    if (!next) { reset(); return }
    event.preventDefault()
    previous = next
    active(true)
  }
  const move = (event: TouchEvent) => {
    const next = position(event)
    if (!next) { reset(); return }
    // A gesture already claimed by the browser must never become a rotation.
    event.preventDefault()
    if (previous?.ids === next.ids) {
      const scale = 2 * Math.PI / Math.max(element.clientWidth, 1)
      rotate((previous.x - next.x) * scale, (previous.y - next.y) * scale)
    } else active(true)
    previous = next
  }
  element.addEventListener('touchstart', start, { passive: false })
  element.addEventListener('touchmove', move, { passive: false })
  element.addEventListener('touchend', start, { passive: false })
  element.addEventListener('touchcancel', reset)
  return () => {
    reset()
    element.removeEventListener('touchstart', start)
    element.removeEventListener('touchmove', move)
    element.removeEventListener('touchend', start)
    element.removeEventListener('touchcancel', reset)
  }
}
