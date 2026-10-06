import { useLayoutEffect, useRef } from 'react'
import { canGoBack, decodeRouteHash, goBack, isDirectRouteChange, navigate, navigationPosition, previousRoute } from '../lib/router'
import { bindSwipeNavigation, excludesSwipeTarget } from '../lib/swipeNavigation'
import { pageOffsets, routeDirection, settlePageEntrance, snapshotPage, type PageSnapshot } from '../lib/routeTransition'
import { useStore } from '../lib/store'

/** One live route. Previous pages are inert visual copies, never mounted twice. */
export function SwipeNavigation({ path }: { path: string[] }) {
  const route = path.join('/')
  const motion = useRef<ReturnType<typeof createPageMotion> | undefined>(undefined)
  useLayoutEffect(() => {
    const screen = document.querySelector<HTMLElement>('.route-viewport > .route-surface')
    if (!screen) return
    motion.current = createPageMotion(screen, route)
    return () => { motion.current?.dispose(); motion.current = undefined }
  }, [])
  useLayoutEffect(() => { motion.current?.arrive(route) }, [route])
  return null
}

function createPageMotion(screen: HTMLElement, initialRoute: string) {
  const viewport = screen.closest<HTMLElement>('.route-viewport')!
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const scrollRestoration = window.history.scrollRestoration
  window.history.scrollRestoration = 'manual'
  const cache = new Map<string, PageSnapshot>()
  let route = initialRoute, index = navigationPosition(), offset = 0, settling = false
  let preview: HTMLElement | undefined, outgoing: HTMLElement | undefined
  let animations: Animation[] = []
  let fallback: ReturnType<typeof setTimeout> | undefined
  let pending: { target: string; direction: number; offset: number; scrollY: number } | undefined
  let releasedDirection: number | undefined

  const stop = () => { animations.forEach(a => a.cancel()); animations = []; clearTimeout(fallback) }
  const clean = () => {
    // data-route-moving temporarily disables screen-in. Consume that entrance
    // before lifting the suppression, including a cancelled or interrupted drag.
    if (viewport.hasAttribute('data-route-moving')) settlePageEntrance(screen)
    stop(); preview?.remove(); outgoing?.remove(); preview = outgoing = undefined
    screen.style.removeProperty('translate'); screen.style.removeProperty('will-change'); screen.style.removeProperty('opacity')
    viewport.removeAttribute('data-route-moving')
    offset = 0; settling = false; releasedDirection = undefined
  }
  const layer = (snapshot: PageSnapshot, scrollY: number) => {
    const bounds = viewport.getBoundingClientRect()
    const pane = document.createElement('div')
    pane.className = 'route-transition-copy'
    pane.inert = true; pane.setAttribute('aria-hidden', 'true')
    Object.assign(pane.style, { left: `${bounds.left}px`, width: `${bounds.width}px` })
    const content = snapshot.node.cloneNode(true) as HTMLElement
    pane.append(content)
    document.body.append(pane)
    // Real scrolling preserves sticky workout headers inside the copy.
    pane.scrollTop = scrollY
    return pane
  }
  const animate = (element: HTMLElement, from: number, to: number, duration: number) => {
    element.style.translate = `${to}px 0`
    const a = element.animate([{ translate: `${from}px 0` }, { translate: `${to}px 0` }], {
      duration, easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    })
    animations.push(a)
    return a
  }
  const remember = (name: string, snapshot: PageSnapshot) => {
    cache.delete(name); cache.set(name, snapshot)
    if (cache.size > 8) cache.delete(cache.keys().next().value!)
  }
  const capture = (event: Event) => {
    const target = decodeRouteHash(window.location.hash).join('/')
    if (target === route || pending?.target === target) return
    const bounds = viewport.getBoundingClientRect()
    const snapshot = snapshotPage(screen, bounds.width)
    remember(route, snapshot)
    const direction = releasedDirection ?? routeDirection(route, target, index, navigationPosition())
    const back = navigationPosition() < index
    const saved = cache.get(target)
    const scrollY = back && saved?.width === bounds.width ? saved.scrollY : 0
    const start = offset
    clean()
    pending = { target, direction, offset: start, scrollY }
    settling = true
    viewport.setAttribute('data-route-moving', '')
    if (!reduced.matches && !isDirectRouteChange(event)) {
      outgoing = layer(snapshot, snapshot.scrollY)
      outgoing.style.translate = `${start}px 0`
    }
  }
  // Capture before useRoute's subscription lets React replace the current page.
  window.addEventListener('hashchange', capture, true)
  const unbind = bindSwipeNavigation(document, {
    context: () => {
      const bounds = viewport.getBoundingClientRect()
      return { path: route, left: bounds.left, width: bounds.width, scrollY: window.scrollY, canGoBack: canGoBack() }
    },
    excluded: excludesSwipeTarget,
    blocked: () => settling || !!document.querySelector('[aria-modal="true"], dialog[open]')
      || !!document.activeElement?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      || !!window.getSelection()?.toString(),
    drag: (next, action) => {
      const target = action.type === 'navigate' ? action.path : previousRoute()
      const saved = target === undefined ? undefined : cache.get(target)
      const width = viewport.clientWidth
      if (reduced.matches) return
      // On a first visit there is no previous view to reveal. Keep this page
      // intact until release; then animate it together with the real destination.
      if (!saved || saved.width !== width) return
      if (!preview) {
        preview = layer(saved, action.type === 'back' ? saved.scrollY : 0)
        viewport.setAttribute('data-route-moving', '')
        screen.style.willChange = 'translate'
      }
      offset = next
      const positions = pageOffsets(next, Math.sign(next) || 1, width)
      screen.style.translate = `${positions.outgoing}px 0`
      preview.style.translate = `${positions.incoming}px 0`
    },
    cancel: () => {
      if (!preview || reduced.matches) { clean(); return }
      settling = true
      const direction = Math.sign(offset) || 1
      animate(preview, offset - direction * viewport.clientWidth, -direction * viewport.clientWidth, 180)
      animate(screen, offset, 0, 180).onfinish = clean
    },
    perform: (action, release) => {
      settling = true
      releasedDirection = Math.sign(release.offset)
      fallback = setTimeout(() => { if (!pending) clean() }, 600)
      if (action.type === 'back') { if (!goBack()) clean() }
      else navigate(action.path)
    },
  })
  const invalidate = () => { cache.clear(); if (!pending) clean() }
  window.addEventListener('resize', invalidate)
  reduced.addEventListener('change', invalidate)
  const appearance = new MutationObserver(invalidate)
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent', 'lang'] })
  const unsubscribe = useStore.subscribe((next, previous) => { if (next.state !== previous.state) invalidate() })
  return {
    arrive(nextRoute: string) {
      if (route === nextRoute) return
      route = nextRoute; index = navigationPosition()
      const transition = pending
      pending = undefined
      window.scrollTo({ top: transition?.scrollY ?? 0, left: 0, behavior: 'instant' })
      if (!transition || reduced.matches || !outgoing) { clean(); return }
      const width = viewport.clientWidth
      const positions = pageOffsets(transition.offset, transition.direction, width)
      screen.style.willChange = 'translate'
      screen.style.translate = `${positions.incoming}px 0`
      animate(outgoing, positions.outgoing, transition.direction * width, 240)
      animate(screen, positions.incoming, 0, 240).onfinish = clean
    },
    dispose() {
      unbind(); clean(); cache.clear(); appearance.disconnect(); unsubscribe()
      window.removeEventListener('hashchange', capture, true)
      window.removeEventListener('resize', invalidate)
      reduced.removeEventListener('change', invalidate)
      window.history.scrollRestoration = scrollRestoration
    },
  }
}
