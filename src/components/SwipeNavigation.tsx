import { useEffect } from 'react'
import { canGoBack, goBack, navigate } from '../lib/router'
import { bindSwipeNavigation, excludesSwipeTarget } from '../lib/swipeNavigation'

/** Mount only in the configured app, never during onboarding. */
export function SwipeNavigation({ path }: { path: string[] }) {
  const route = path.join('/')
  useEffect(() => bindSwipeNavigation(document, {
    context: () => {
      const bounds = document.querySelector('main')?.getBoundingClientRect()
      return { path: route, left: bounds?.left ?? 0, width: bounds?.width ?? window.innerWidth, scrollY: window.scrollY, canGoBack: canGoBack() }
    },
    excluded: excludesSwipeTarget,
    blocked: () => !!document.querySelector('[aria-modal="true"], dialog[open]')
      || !!document.activeElement?.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      || !!window.getSelection()?.toString(),
    perform: action => { if (action.type === 'back') goBack(); else navigate(action.path) },
  }), [route])
  return null
}
