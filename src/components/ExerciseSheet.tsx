import { useState } from 'react'
import { CirclePlay, ExternalLink, Replace } from 'lucide-react'
import { isNative } from '../lib/native/bridge'
import { infoFor, LIBRARY, youtubeId, youtubeSearchUrl } from '../lib/library'
import { fmtDate } from '../lib/date'
import { fmtRest } from '../lib/format'
import { L } from '../lib/i18n'
import { useStore } from '../lib/store'
import { exerciseHistory, setsSummary } from '../lib/training'
import type { Prescription } from '../lib/types'
import { LevelTag, RefList } from './Evidence'
import { Button, Eyebrow, inputClass, Sheet, Tag } from './ui'

export function DemoFrames({ id, name, className }: { id: string; name: string; className?: string }) {
  const base = import.meta.env.BASE_URL
  const info = LIBRARY[id]
  if (!info?.demo) return null
  const a = `${base}demos/${id}/0.jpg`
  const b = `${base}demos/${id}/1.jpg`
  return (
    <figure className={className}>
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[12px] bg-surface-2">
        <img src={a} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-[1.15] object-cover opacity-60 blur-[36px] motion-reduce:hidden" />
        <img src={a} alt={L(`${name} : position de départ`, `${name}: start position`)} className="demo-a absolute inset-0 h-full w-full object-contain" loading="lazy" decoding="async" />
        <img src={b} alt={L(`${name} : position d’arrivée`, `${name}: end position`)} className="demo-b absolute inset-0 h-full w-full object-contain" loading="lazy" decoding="async" />
      </div>
      <figcaption className="mt-1.5 text-[11px] text-muted">{L('Démonstration · Free Exercise DB (domaine public)', 'Demonstration · Free Exercise DB (public domain)')}</figcaption>
    </figure>
  )
}

export function ExerciseSheet({
  exerciseId, name, open, onClose, prescription, onReplace,
}: {
  exerciseId: string
  name?: string
  open: boolean
  onClose: () => void
  prescription?: Prescription
  onReplace?: (id: string) => void
}) {
  const info = infoFor(exerciseId, { name })
  const video = useStore((s) => s.state.exerciseVideos[exerciseId] ?? '')
  const workouts = useStore((s) => s.state.workouts)
  const setVideo = useStore((s) => s.setExerciseVideo)
  const [draft, setDraft] = useState(video)
  const [play, setPlay] = useState(false)
  const vid = youtubeId(video)
  const history = exerciseHistory(workouts, exerciseId).slice(-3).reverse()

  return (
    <Sheet open={open} onClose={() => { setPlay(false); onClose() }} title={name ?? info.name} tall>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="outline">{info.muscle || L('Exercice', 'Exercise')}</Tag>
        <Tag tone="muted">{info.role === 'compound' ? L('Polyarticulaire', 'Compound') : 'Isolation'}</Tag>
      </div>

      <DemoFrames id={exerciseId} name={info.name} className="mt-4" />

      <div className="mt-4">
        {vid && !isNative() ? (
          play ? (
            <div className="aspect-video w-full overflow-hidden rounded-[12px] bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&playsinline=1&rel=0`}
                title={L(`Vidéo : ${info.name}`, `Video: ${info.name}`)}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <button type="button" onClick={() => setPlay(true)} className="pressable relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[12px] bg-black">
              <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
              <span className="relative inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-[14px] font-semibold text-white">
                <CirclePlay size={18} /> {L('Lire ta vidéo', 'Play your video')}
              </span>
            </button>
          )
        ) : (
          <a href={vid ? `https://www.youtube.com/watch?v=${vid}` : youtubeSearchUrl(info.query)} target="_blank" rel="noopener noreferrer" className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-[10px] border border-line-strong text-[14px] font-medium hover:border-muted">
            <CirclePlay size={18} aria-hidden /> {vid ? L('Ouvrir ta vidéo sur YouTube', 'Open your video on YouTube') : L('Vidéos de technique sur YouTube', 'Technique videos on YouTube')}
            <ExternalLink size={14} className="text-muted" aria-hidden />
          </a>
        )}
        <details className="mt-2 text-[13px] text-text-2">
          <summary className="cursor-pointer py-1.5">{vid ? L('Changer ta vidéo', 'Change your video') : L('Épingler ta vidéo de référence', 'Pin your reference video')}</summary>
          <div className="mt-2 flex gap-2">
            <input className={inputClass} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={L('Lien YouTube', 'YouTube link')} inputMode="url" aria-label={L('Lien de la vidéo', 'Video link')} />
            <Button variant="ink" onClick={() => { setVideo(exerciseId, draft); setPlay(false) }}>OK</Button>
          </div>
        </details>
      </div>

      {prescription && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label={L('Séries × reps', 'Sets × reps')} value={`${prescription.sets} × ${prescription.minReps}–${prescription.maxReps}`} />
          <Metric label="Effort" value={`RIR ${prescription.rir}`} />
          <Metric label={L('Repos', 'Rest')} value={fmtRest(prescription.restSeconds)} />
        </div>
      )}

      {info.cues.length > 0 && (
        <section className="mt-6">
          <Eyebrow>Technique</Eyebrow>
          <ol className="mt-2 space-y-2">
            {info.cues.map((c, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-[1.45]">
                <span className="mt-[1px] text-[12px] font-semibold text-muted tnum">{String(i + 1).padStart(2, '0')}</span>
                {c}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow>{L('Pourquoi cet exercice', 'Why this exercise')}</Eyebrow>
          <LevelTag level={info.evidence.level} />
        </div>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-2">{info.evidence.text}</p>
        <RefList refs={info.evidence.refs} compact />
      </section>

      {history.length > 0 && (
        <section className="mt-6">
          <Eyebrow>{L('Dernières performances', 'Recent performances')}</Eyebrow>
          <ul className="mt-2 divide-y divide-line rounded-[12px] border border-line">
            {history.map((h) => (
              <li key={h.workoutId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[14px]">
                <span className="text-text-2">{fmtDate(h.date)}</span>
                <span className="font-medium tnum">{setsSummary(h.sets, h.unit)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {onReplace && info.alternatives.length > 0 && (
        <section className="mt-6">
          <Eyebrow>{L('Machine prise ? Remplacer par', 'Machine taken? Replace with')}</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">
            {info.alternatives.map((alt) => (
              <Button key={alt} variant="outline" full icon={<Replace size={16} aria-hidden />} onClick={() => { onReplace(alt); onClose() }} className="justify-start">
                {LIBRARY[alt]?.name ?? alt}
              </Button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tnum">{value}</div>
    </div>
  )
}
