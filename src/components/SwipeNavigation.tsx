import { useLayoutEffect, useRef } from 'react'
import { canGoBack, goBack, navigate } from '../lib/router'
import { bindSwipeNavigation, excludesSwipeTarget } from '../lib/swipeNavigation'

/** Mount only in the configured app, never during onboarding. */
export function SwipeNavigation({ path }: { path: string[] }) {
  const route = path.join('/')
  const pending = useRef<{ from: string; target?: string; direction: number } | undefined>(undefined)
  useLayoutEffect(() => {
    const screen = document.querySelector<HTMLElement>('.route-viewport > .route-surface')
    if (!screen) return
    const viewport = screen.closest<HTMLElement>('.route-viewport')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation: Animation | undefined
    let fallback: ReturnType<typeof setTimeout> | undefined
    let settling = false
    let offset = 0
    const stop = () => { animation?.cancel(); animation = undefined; clearTimeout(fallback) }
    const reset = () => {
      stop(); offset = 0; settling = false
      screen.style.removeProperty('translate')
      screen.style.removeProperty('will-change')
    }
    const settle = (from: number, to: number, duration: number, finish: () => void) => {
      stop(); settling = true
      screen.style.translate = `${reduced.matches ? 0 : to}px 0`
      if (reduced.matches) { finish(); return }
      // The individual property composes with Screen's translateY entrance;
      // its animation-fill-mode cannot override the finger's horizontal drag.
      screen.style.willChange = 'translate'
      animation = screen.animate([{ translate: `${from}px 0` }, { translate: `${to}px 0` }], {
        duration, easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      })
      animation.onfinish = finish
    }
    const incoming = pending.current
    pending.current = undefined
    if (incoming && incoming.from !== route && (incoming.target === undefined || incoming.target === route)) {
      settle(-incoming.direction * Math.min(viewport.clientWidth * 0.2, 100), 0, 180, reset)
    }
    const unbind = bindSwipeNavigation(document, {
      context: () => {
        // Measure the stationary viewport, not the translated screen.
        const bounds = viewport.getBoundingClientRect()
        return { path: route, left: bounds.left, width: bounds.width, scrollY: window.scrollY, canGoBack: canGoBack() }
      },
      excluded: excludesSwipeTarget,
      blocked: () => settling || !!document.querySelector('[aria-modal="true"], dialog[open]')
        || !!document.activeElement?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
        || !!window.getSelection()?.toString(),
      drag: next => {
        stop(); offset = next
        if (!reduced.matches) {
          screen.style.willChange = 'translate'
          screen.style.translate = `${next}px 0`
        }
      },
      cancel: () => settle(offset, 0, 150, reset),
      perform: (action, release) => {
        const direction = Math.sign(release.offset)
        settle(release.offset, direction * release.width, 120, () => {
          stop()
          pending.current = { from: route, target: action.type === 'navigate' ? action.path : undefined, direction }
          // history.back() is asynchronous. Restore this screen if it produces
          // no route change; route cleanup cancels this fallback on success.
          fallback = setTimeout(() => { pending.current = undefined; reset() }, 500)
          if (action.type === 'back') { if (!goBack()) { pending.current = undefined; reset() } }
          else navigate(action.path)
        })
      },
    })
    const reduceChanged = () => { if (reduced.matches) { pending.current = undefined; reset() } }
    reduced.addEventListener('change', reduceChanged)
    return () => {
      unbind(); reset()
      reduced.removeEventListener('change', reduceChanged)
    }
  }, [route])
  return null
}
