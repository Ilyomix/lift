import { useEffect, useRef, type RefObject } from 'react'
import { bindDismissGesture } from '../lib/dismissGesture'

const CONTROLS = 'button, a, input, textarea, select, summary, label, canvas, video, iframe, [contenteditable], [role="button"], [role="slider"], [role="tab"], [draggable="true"], [data-swipe-ignore]'

/** Shared by bottom sheets and the rest panel. Closing never stops the rest. */
export function useDismissGesture(ref: RefObject<HTMLDivElement | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  useEffect(() => {
    const panel = ref.current
    if (!open || !panel) return
    let settling = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const release = (dismiss: boolean) => {
      settling = true
      panel.style.transition = reduced ? 'none' : 'translate 160ms ease-out'
      panel.style.translate = dismiss ? `0 ${panel.getBoundingClientRect().height}px` : '0 0'
      timeout = setTimeout(() => {
        settling = false
        panel.style.removeProperty('translate')
        panel.style.removeProperty('transition')
        if (dismiss) close.current()
      }, reduced ? 0 : 160)
    }
    const unbind = bindDismissGesture(panel, {
      canStart: target => {
        if (settling || !(target instanceof Element) || target.closest(CONTROLS)) return false
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
      drag: distance => { panel.style.transition = 'none'; panel.style.translate = `0 ${distance}px` },
      release,
    })
    return () => {
      unbind()
      clearTimeout(timeout)
      panel.style.removeProperty('translate')
      panel.style.removeProperty('transition')
    }
  }, [open, ref])
}
