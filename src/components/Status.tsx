import { ArrowDownRight, ArrowUpRight, Equal, Flag, Minus, Scale, Star, TriangleAlert } from 'lucide-react'
import type { Comparison } from '../lib/types'
import { Tag } from './ui'

/** Stored headlines are upper-case (previous app's format); show them in calm sentence case. */
export function headlineLabel(h: string): string {
  const t = h.toLocaleLowerCase('fr-FR')
  return t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1)
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
      return <Tag tone={raw.headline.startsWith('CHARGE SUP') ? 'good' : 'outline'} icon={raw.headline.startsWith('CHARGE SUP') ? <ArrowUpRight {...i} /> : <Scale {...i} />}>{c.headline}</Tag>
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
