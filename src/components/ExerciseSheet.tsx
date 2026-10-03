import { useEffect, useId, useState } from 'react'
import { CirclePlay, ExternalLink, Link2 } from 'lucide-react'
import { isNative } from '../lib/native/bridge'
import { infoFor, youtubeId, youtubeSearchUrl } from '../lib/library'
import { alternativesFor } from '../lib/exerciseAlternatives'
import { fmtDate } from '../lib/date'
import { fmtRest } from '../lib/format'
import { L } from '../lib/i18n'
import { useStore } from '../lib/store'
import { exerciseHistory, setsSummary } from '../lib/training'
import type { Prescription } from '../lib/types'
import { LevelTag, RefList } from './Evidence'
import { ExerciseDemo } from './ExerciseDemo'
import { ExerciseAlternatives } from './ExerciseAlternatives'
import { Button, Disclosure, Eyebrow, Field, inputClass, LinkButton, Sheet, Tag } from './ui'

// Retain the public export used by exercise detail/session screens.
export const DemoFrames = ExerciseDemo

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
  const [videoError, setVideoError] = useState(false)
  const errorId = useId()
  const [play, setPlay] = useState(false)
  const vid = youtubeId(video)
  const history = exerciseHistory(workouts, exerciseId).slice(-3).reverse()
  const alternatives = alternativesFor(exerciseId)
  useEffect(() => {
    if (open) { setDraft(video); setVideoError(false); setPlay(false) }
  }, [exerciseId, open, video])

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
          <LinkButton full size="lg" href={vid ? `https://www.youtube.com/watch?v=${vid}` : youtubeSearchUrl(info.query)} target="_blank" rel="noopener noreferrer" icon={<CirclePlay size={18} aria-hidden />}>
            <span className="min-w-0">{vid ? L('Voir ma vidéo sur YouTube', 'Watch my video on YouTube') : L('Technique sur YouTube', 'Technique on YouTube')}</span>
            <ExternalLink size={14} className="text-muted" aria-hidden />
          </LinkButton>
        )}
        <Disclosure key={`video-${exerciseId}`} className="mt-3" title={video ? L('Modifier ma vidéo', 'Edit my video') : L('Ajouter une vidéo', 'Add a video')} icon={<Link2 size={18} />}>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            if (!youtubeId(draft)) { setVideoError(true); return }
            setVideo(exerciseId, draft.trim()); setPlay(false); setVideoError(false)
            useStore.getState().notify(L('Vidéo enregistrée pour cet exercice.', 'Video saved for this exercise.'), 'good')
          }}>
            <Field label={L('Lien YouTube', 'YouTube link')}>
              <input className={inputClass} value={draft} onChange={event => { setDraft(event.target.value); setVideoError(false) }} placeholder="https://youtu.be/…" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={videoError} aria-describedby={videoError ? errorId : undefined} />
            </Field>
            {videoError && <p id={errorId} role="alert" className="text-[13px] leading-5 text-bad">{L('Ajoute le lien d’une vidéo YouTube pour l’enregistrer.', 'Enter a YouTube video link to save it.')}</p>}
            <Button type="submit" full variant="ink" disabled={!draft.trim()}>{L('Enregistrer la vidéo', 'Save video')}</Button>
            {video && <Button full variant="ghost" onClick={() => {
              setVideo(exerciseId, ''); setDraft(''); setVideoError(false); setPlay(false)
              useStore.getState().notify(L('Vidéo retirée de cet exercice.', 'Video removed from this exercise.'))
            }}>{L('Retirer la vidéo', 'Remove video')}</Button>}
          </form>
        </Disclosure>
      </div>

      {prescription && (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Metric label={L('Séries × reps', 'Sets × reps')} value={`${prescription.sets} × ${prescription.minReps}–${prescription.maxReps}`} />
          <Metric label="Effort" value={`RIR ${prescription.rir}`} />
          <Metric label={L('Repos', 'Rest')} value={fmtRest(prescription.restSeconds)} />
        </div>
      )}

      {alternatives.length > 0 && <Disclosure key={exerciseId} bordered={!!prescription} className={prescription ? 'mt-5' : 'border-b border-line'} title={`Alternatives (${alternatives.length})`}>
        <ExerciseAlternatives exerciseId={exerciseId} onChoose={onReplace ? id => { onReplace(id); onClose() } : undefined} />
      </Disclosure>}

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
        <div className="flex flex-wrap items-center justify-between gap-2">
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
              <li key={h.workoutId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-[14px]">
                <span className="text-text-2">{fmtDate(h.date)}</span>
                <span className="font-medium tnum">{setsSummary(h.sets, h.unit)}</span>
              </li>
            ))}
          </ul>
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
