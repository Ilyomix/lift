import { L, locale } from '../lib/i18n'
import { ArrowDownRight, ArrowUpRight, Equal, Flag, Minus, Scale, Star, TriangleAlert } from 'lucide-react'
import type { Comparison } from '../lib/types'
import { Tag } from './ui'

/** Headlines written by compareExercise (lib/training), French then English. */
const HEADLINES: [string, string][] = [
  ['NON RÉALISÉ', 'NOT DONE'],
  ['NOUVELLE BASELINE', 'NEW BASELINE'],
  ['DÉCHARGE', 'DELOAD'],
  ['SÉANCE ALLÉGÉE', 'LIGHTER SESSION'],
  ['APRÈS SÉANCE ALLÉGÉE', 'AFTER A LIGHTER SESSION'],
  ['APRÈS UNE PAUSE', 'AFTER A BREAK'],
  ['MOINS DE REPS, PLUS DE MARGE', 'FEWER REPS, MORE IN RESERVE'],
  ['CONDITIONS DIFFÉRENTES', 'DIFFERENT CONDITIONS'],
  ['NOMBRE DE SÉRIES DIFFÉRENT', 'DIFFERENT NUMBER OF SETS'],
  ['CHARGE SUPÉRIEURE', 'HEAVIER LOAD'],
  ['RÉPARTITION DES CHARGES MODIFIÉE', 'LOAD PATTERN CHANGED'],
  ['PERFORMANCE ÉGALE', 'SAME PERFORMANCE'],
]

/** A stored headline keeps the language it was logged in: the known ones are shown in the current language. */
function localHeadline(h: string): string {
  const pair = HEADLINES.find(([fr, en]) => h === fr || h === en)
  if (pair) return L(pair[0], pair[1])
  const down = h.match(/^(−\d+ REPS?) VS (?:DERNIÈRE FOIS|LAST TIME)$/)
  if (down) return L(`${down[1]} VS DERNIÈRE FOIS`, `${down[1]} VS LAST TIME`)
  const level = h.match(/^(?:NIVEAU ESTIMÉ|ESTIMATED LEVEL) (−\d+) ?%$/)
  return level ? L(`NIVEAU ESTIMÉ ${level[1]} %`, `ESTIMATED LEVEL ${level[1]}%`) : h
}

/** "Heavier load" headline, in either language (stored headlines keep the language they were logged in). */
export function isHeavierLoad(headline: string): boolean {
  return headline.startsWith('CHARGE SUP') || headline.startsWith('HEAVIER LOAD')
}

/** Stored headlines are upper-case (previous app's format); show them in calm sentence case. */
export function headlineLabel(h: string): string {
  const t = localHeadline(h).toLocaleLowerCase(locale())
  return t.charAt(0).toLocaleUpperCase(locale()) + t.slice(1)
}

export function StatusTag({ c: raw }: { c: Comparison | null }) {
  if (!raw) return null
  const c = { ...raw, headline: headlineLabel(raw.headline) }
  const i = { size: 12, strokeWidth: 2.4, 'aria-hidden': true } as const
  switch (c.status) {
    case 'progress':
      return <Tag tone="good" icon={<ArrowUpRight {...i} />}>{c.headline}</Tag>
    case 'down':
      return <Tag tone="bad" icon={<ArrowDownRight {...i} />}>{c.headline}</Tag>
    case 'stable':
      return <Tag tone="outline" icon={<Equal {...i} />}>{c.headline}</Tag>
    case 'load-change':
      return <Tag tone={isHeavierLoad(raw.headline) ? 'good' : 'outline'} icon={isHeavierLoad(raw.headline) ? <ArrowUpRight {...i} /> : <Scale {...i} />}>{c.headline}</Tag>
    case 'different-sets':
    case 'different-context':
      return <Tag tone="warn" icon={<TriangleAlert {...i} />}>{c.headline}</Tag>
    case 'new-baseline':
      return <Tag tone="ink" icon={<Flag {...i} />}>{c.headline}</Tag>
    default:
      return <Tag tone="muted" icon={<Minus {...i} />}>{c.headline}</Tag>
  }
}

export function RecordTag() {
  return (
    <Tag tone="signal" icon={<Star size={12} strokeWidth={2.4} aria-hidden />}>
      Record
    </Tag>
  )
}
