import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'
import './index.css'
import App from './App'

// The native WebView ends at the keyboard, so bottom bars would sit on it while typing.
if (Capacitor.isNativePlatform()) {
  // The decimal pad has no return key: the bar's ✓ is the way to close it.
  if (Capacitor.getPlatform() === 'ios') void Keyboard.setAccessoryBarVisible({ isVisible: true })
  // A hardware keyboard on iPad still reports a zero-height keyboard.
  void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => { if (keyboardHeight > 0) document.documentElement.dataset.keyboard = '' })
  void Keyboard.addListener('keyboardWillHide', () => { delete document.documentElement.dataset.keyboard })
  // The WebView shrinks after the keyboard animation: bring the typed field back into view.
  window.addEventListener('resize', () => {
    const field = document.activeElement
    if ('keyboard' in document.documentElement.dataset && field instanceof HTMLElement && field.matches('input, textarea')) field.scrollIntoView({ block: 'center' })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
