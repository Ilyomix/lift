import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { bindDismissGesture, createDismissMotion } from '../lib/dismissGesture'

const CONTROLS = 'button, a, input, textarea, select, summary, label, canvas, video, iframe, [contenteditable], [role="button"], [role="slider"], [role="tab"], [draggable="true"], [data-swipe-ignore]'

/** Shared by bottom sheets and the rest panel. Closing never stops the rest. */
export function useDismissGesture(ref: RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void, backdrop?: RefObject<HTMLDivElement | null>, revision = 0, canDismiss?: () => boolean | Promise<boolean>) {
  const close = useRef(onClose)
  const allow = useRef(canDismiss)
  allow.current = canDismiss
  const motionRef = useRef<ReturnType<typeof createDismissMotion> | null>(null)
  const asking = useRef(false)
  const release = useCallback((dismiss: boolean) => {
    const motion = motionRef.current
    if (!motion || asking.current) return
    if (!dismiss) { motion.release(false); return }
    const allowed = allow.current?.() ?? true
    if (!(allowed instanceof Promise)) { motion.release(allowed); return }
    asking.current = true
    motion.release(false)
    void allowed.then(ok => {
      if (ok && motionRef.current === motion) motion.release(true)
    }).finally(() => { asking.current = false })
  }, [])
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const panel = ref.current
    if (!open || !panel) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motion = createDismissMotion(panel, backdrop?.current ?? null, reduced, () => close.current())
    motionRef.current = motion
    const unbind = bindDismissGesture(panel, {
      height: () => panel.getBoundingClientRect().height,
      canStart: target => {
        if (motion.settling || !(target instanceof Element) || target.closest(CONTROLS)) return false
        if (document.activeElement?.matches('input, textarea, select, [contenteditable]')) return false
        // The header is always a grab area. Content may dismiss only at its top;
        // a scroll that reaches the top must finish before a new pull can dismiss.
        if (target.closest('[data-sheet-handle]')) return true
        for (let node: Element | null = target; node && panel.contains(node); node = node.parentElement) {
          if (node.scrollTop > 0) return false
          if (node === panel) break
        }
        return true
      },
      drag: motion.drag,
      release,
    })
    return () => {
      unbind()
      motion.dispose()
      motionRef.current = null
    }
  }, [open, ref, backdrop, revision])
  // Buttons, backdrop and Escape share the same completion as a confirmed pull.
  return useCallback(() => release(true), [release])
}
