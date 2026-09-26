import { ExternalLink } from 'lucide-react'
import { LEVEL_LABEL, SOURCES, type EvidenceLevel } from '../lib/research'
import { Tag } from './ui'

export function LevelTag({ level }: { level: EvidenceLevel }) {
  const tone = level === 'fort' ? 'ink' : level === 'modere' ? 'outline' : 'muted'
  return <Tag tone={tone}>{LEVEL_LABEL[level]}</Tag>
}

export function RefList({ refs, compact }: { refs: string[]; compact?: boolean }) {
  const list = refs.map((r) => SOURCES[r]).filter(Boolean)
  if (!list.length) return null
  return (
    <ul className={compact ? 'mt-2 space-y-1' : 'mt-3 space-y-2'}>
      {list.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-start gap-1.5 text-[13px] leading-[18px] text-text-2 hover:text-text">
            <ExternalLink size={13} className="mt-[3px] shrink-0 text-muted group-hover:text-text" aria-hidden />
            <span>
              <span className="font-medium text-text">{s.authors.split(',')[0]} {s.year}</span>
              {!compact && <span> — {s.title}. </span>}
              <span className="text-muted">{compact ? ` · ${s.kind}` : `${s.journal} · ${s.kind}`}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
