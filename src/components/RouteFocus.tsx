import { useLayoutEffect, useRef } from 'react'

/** Announce a new screen without re-focusing on ordinary state updates. */
export function RouteFocus({ route }: { route: string }) {
  const previous = useRef(route)
  useLayoutEffect(() => {
    if (previous.current === route) return
    previous.current = route
    // A modal owns focus until it closes, including navigation behind a Sheet.
    if (document.querySelector('[aria-modal="true"], dialog[open]')) return
    const heading = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main')
    if (!heading) return
    heading.tabIndex = -1
    heading.classList.add('focus:outline-none')
    heading.focus({ preventScroll: true })
  }, [route])
  return null
}
