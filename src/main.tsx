import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import './index.css'
import App from './App'

// The native WebView keeps its height under the keyboard (resize: none).
if (Capacitor.isNativePlatform()) {
  // The decimal pad has no return key: the bar's ✓ is the way to close it.
  if (Capacitor.getPlatform() === 'ios') void Keyboard.setAccessoryBarVisible({ isVisible: true })
  // The keyboard height arrives as it starts to rise: sheets and bars follow it
  // at once (--kb), then the typed field is brought above it. A hardware
  // keyboard on iPad reports a zero height and changes nothing.
  const root = document.documentElement
  let reveal = 0
  void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => {
    if (keyboardHeight <= 0) return
    root.style.setProperty('--kb', `${keyboardHeight}px`)
    root.dataset.keyboard = ''
    clearTimeout(reveal)
    reveal = window.setTimeout(() => revealField(keyboardHeight), 280)
  })
  void Keyboard.addListener('keyboardWillHide', () => {
    clearTimeout(reveal)
    root.style.removeProperty('--kb')
    delete root.dataset.keyboard
  })
  // iOS restores a focused field's keyboard on return, out of step with the
  // layout. Leaving the app ends the entry; the typed value stays.
  document.addEventListener('visibilitychange', () => {
    const field = document.activeElement
    if (document.visibilityState === 'hidden' && field instanceof HTMLElement && field.matches('input, textarea')) field.blur()
  })
}

function revealField(keyboardHeight: number) {
  const field = document.activeElement
  if (!(field instanceof HTMLElement) || !field.matches('input, textarea')) return
  // A sheet scrolls its own content; the page behind it is pinned.
  if (field.closest('[role="dialog"]')) { field.scrollIntoView({ block: 'nearest' }); return }
  const limit = window.innerHeight - keyboardHeight - 16
  const bottom = field.getBoundingClientRect().bottom
  if (bottom > limit) window.scrollBy({ top: bottom - limit, behavior: 'smooth' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
