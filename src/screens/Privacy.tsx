import type { SyntheticEvent } from 'react'
import geologicaFont from '../assets/fonts/geologica-latin-wght-normal.woff2?url'
import { Header, Screen } from '../components/ui'
import { L } from '../lib/i18n'

function applyEmbeddedTheme(event: SyntheticEvent<HTMLIFrameElement>) {
  const document = event.currentTarget.contentDocument
  if (!document) return
  const theme = getComputedStyle(window.document.documentElement)
  for (const token of ['surface', 'text', 'text-2', 'muted', 'signal-text', 'line']) {
    document.documentElement.style.setProperty(`--lift-${token}`, theme.getPropertyValue(`--${token}`))
  }
  document.documentElement.style.setProperty('--lift-font-family', getComputedStyle(window.document.body).fontFamily)
  document.documentElement.style.setProperty('--lift-color-scheme', theme.colorScheme)
  // Font faces belong to their document; the embedded policy needs the same bundled face.
  const font = document.createElement('style')
  font.textContent = `@font-face { font-family: 'Geologica'; font-style: normal; font-weight: 100 900; font-display: swap; src: url('${geologicaFont}') format('woff2'); }`
  document.head.appendChild(font)
}

/** Keep the app and its storage connection alive while reading the local policy. */
export function PrivacyScreen() {
  return (
    <Screen>
      <Header art="privacy" backTo="plus" title={L('Politique de confidentialité', 'Privacy policy')} />
      <iframe
        title={L('Politique de confidentialité', 'Privacy policy')}
        src={`${import.meta.env.BASE_URL}privacy.html?embedded=1#${L('fr', 'en')}`}
        onLoad={applyEmbeddedTheme}
        className="block h-[calc(100dvh-var(--top-bar)-240px-env(safe-area-inset-bottom))] min-h-[320px] w-full rounded-[12px] border border-line bg-surface"
      />
    </Screen>
  )
}
