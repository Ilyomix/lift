import { ChevronRight } from 'lucide-react'
import { navigate } from '../lib/router'
import { SportArt, type SportArtKind } from './SportArt'
import { Row } from './ui'

/** One destination in More or Settings; keep editing controls on its page. */
export function SettingsMenuRow({ to, art, label, hint }: { to: string; art: SportArtKind; label: string; hint?: string }) {
  return <Row
    className="py-3.5"
    onClick={() => navigate(to)}
    label={<span className="flex min-w-0 items-center gap-3">
      <SportArt kind={art} size="title" />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-[13px] font-normal text-muted">{hint}</span>}
      </span>
    </span>}
    right={<ChevronRight size={16} className="text-muted" aria-hidden />}
  />
}
