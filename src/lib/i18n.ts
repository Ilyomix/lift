// Two languages, written inline: L('texte', 'text'). French is the original wording and
// English sits right next to it, so no string can be missing in one of the languages.
// The language is a module variable: the app remounts when it changes (App keys on it).

export type Lang = 'fr' | 'en'
export type LangPref = Lang | 'auto'

/** The phone's language: French if it is the first preferred language, English otherwise. */
export function detectLang(): Lang {
  try {
    const list = typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? []), navigator.language]
    const first = list.find((x) => typeof x === 'string' && x.length > 0)?.toLowerCase() ?? 'fr'
    return first.startsWith('fr') ? 'fr' : 'en'
  } catch {
    return 'fr'
  }
}

let current: Lang = detectLang()

export const lang = (): Lang => current

export function resolveLang(pref: LangPref | undefined): Lang {
  return pref === 'fr' || pref === 'en' ? pref : detectLang()
}

export function setLang(next: Lang): void {
  current = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
}

/** French first, English second. */
export function L(fr: string, en: string): string {
  return current === 'en' ? en : fr
}

/** Intl locale of the current language (British English: day-month dates, metric units). */
export function locale(): string {
  return current === 'en' ? 'en-GB' : 'fr-FR'
}
