import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, CirclePlay, Dumbbell, ExternalLink, Gauge, Layers, Link2, Replace, Timer, Trash } from 'lucide-react'
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
import { reserveLabel } from './EffortGuidance'
import { ExerciseDemo } from './ExerciseDemo'
import { ExerciseAlternatives, type ExerciseReplacementTarget } from './ExerciseAlternatives'
import { SportArt } from './SportArt'
import { Button, Disclosure, Field, inputClass, LinkButton, SectionHeading, Sheet, SheetAction, Tag } from './ui'

// Retain the public export used by exercise detail/session screens.
export const DemoFrames = ExerciseDemo

export function ExerciseSheet({
  exerciseId, name, open, onClose, prescription, replacement,
}: {
  exerciseId: string
  name?: string
  open: boolean
  onClose: () => void
  prescription?: Prescription
  replacement?: ExerciseReplacementTarget
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
    <Sheet open={open} dirty={draft !== video} onClose={() => { setDraft(video); setVideoError(false); setPlay(false); onClose() }} title={name ?? info.name} icon={<Dumbbell size={18} aria-hidden />} tall>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="outline">{info.muscle || L('Exercice', 'Exercise')}</Tag>
        <Tag tone="muted">{info.role === 'compound' ? L('Polyarticulaire', 'Compound') : 'Isolation'}</Tag>
      </div>

      {prescription && (
        <dl aria-label={L('Repères pour la séance', 'Training targets')} className="mt-3 flex flex-wrap gap-2">
          <Metric icon={<Layers size={18} aria-hidden />} label={L('Séries × répétitions', 'Sets × reps')} value={`${prescription.sets} × ${prescription.minReps}–${prescription.maxReps}`} />
          <Metric icon={<Gauge size={18} aria-hidden />} label={L('Répétitions en réserve', 'Reps in reserve')} value={reserveLabel(prescription.rir)} />
          <Metric icon={<Timer size={18} aria-hidden />} label={L('Repos', 'Rest')} value={fmtRest(prescription.restSeconds)} />
        </dl>
      )}

      <DemoFrames id={exerciseId} name={info.name} className="mt-4" />

      {info.cues.length > 0 && (
        <section className="mt-5">
          <SectionHeading icon={<SportArt kind="coach" size="title" />}>Technique</SectionHeading>
          <ol className="mt-3 list-decimal space-y-3 pl-5 marker:font-semibold marker:text-signal-text">
            {info.cues.map((cue, index) => <li key={index} className="pl-1 text-[15px] leading-[1.5]">{cue}</li>)}
          </ol>
        </section>
      )}

      <div className="mt-5">
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
                <CirclePlay size={18} aria-hidden /> {L('Lire ma vidéo', 'Play my video')}
              </span>
            </button>
          )
        ) : (
          <LinkButton variant="outline" full href={vid ? `https://www.youtube.com/watch?v=${vid}` : youtubeSearchUrl(info.query)} target="_blank" rel="noopener noreferrer"
            aria-label={vid
              ? L(`Voir ma vidéo : ${info.name}. Ouvre YouTube.`, `Watch my video: ${info.name}. Opens YouTube.`)
              : L(`Rechercher des démonstrations de ${info.name} sur YouTube`, `Find ${info.name} demonstrations on YouTube`)}
            icon={<CirclePlay size={18} aria-hidden />}>
            <span className="min-w-0 flex-1 text-left">
              <span className="block">{vid ? L('Voir ma vidéo', 'Watch my video') : L('Techniques sur YouTube', 'Technique on YouTube')}</span>
            </span>
            <ExternalLink size={16} className="text-muted" aria-hidden />
          </LinkButton>
        )}
      </div>

      <div className="mt-3 divide-y divide-line border-y border-line">
        <Disclosure key={`video-${exerciseId}`} bordered={false} title={video ? L('Modifier ma vidéo', 'Edit my video') : L('Ajouter une vidéo', 'Add a video')} icon={<Link2 size={18} aria-hidden />}>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            if (!youtubeId(draft)) { setVideoError(true); return }
            setVideo(exerciseId, draft.trim()); setDraft(draft.trim()); setPlay(false); setVideoError(false)
            useStore.getState().notify(L('Vidéo enregistrée pour cet exercice.', 'Video saved for this exercise.'), 'good')
          }}>
            <Field label={L('Lien YouTube', 'YouTube link')}>
              <input className={inputClass} value={draft} onChange={event => { setDraft(event.target.value); setVideoError(false) }} placeholder="https://youtu.be/…" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={videoError} aria-describedby={videoError ? errorId : undefined} />
            </Field>
            {videoError && <p id={errorId} role="alert" className="text-[13px] leading-5 text-bad">{L('Lien non reconnu. Copie le lien d’une vidéo YouTube, puis réessaie.', 'Link not recognized. Copy a YouTube video link, then try again.')}</p>}
            <Button type="submit" full variant="ink" icon={<Check size={18} aria-hidden />} disabled={!draft.trim()}>{L('Enregistrer la vidéo', 'Save video')}</Button>
            {video && <SheetAction>{(_close, confirmDiscard) => <Button full variant="ghost" icon={<Trash size={18} aria-hidden />} onClick={async () => {
              if (!await confirmDiscard()) return
              setVideo(exerciseId, ''); setDraft(''); setVideoError(false); setPlay(false)
              useStore.getState().notify(L('Vidéo retirée de cet exercice.', 'Video removed from this exercise.'))
            }}>{L('Retirer la vidéo', 'Remove video')}</Button>}</SheetAction>}
          </form>
        </Disclosure>

        {alternatives.length > 0 && <Disclosure key={exerciseId} bordered={false} title={`Alternatives (${alternatives.length})`} icon={<Replace size={18} aria-hidden />}>
          <SheetAction>{(_close, confirmDiscard) => <ExerciseAlternatives exerciseId={exerciseId} replacement={replacement} beforeReplace={confirmDiscard} onReplaced={onClose} showHeading={false} />}</SheetAction>
        </Disclosure>}
      </div>

      <section className="mt-6">
        <SectionHeading icon={<SportArt kind="evidence" size="title" />} action={<LevelTag level={info.evidence.level} />}>{L('Pourquoi cet exercice', 'Why this exercise')}</SectionHeading>
        <p className="mt-2 text-[14px] leading-[1.5] text-text-2">{info.evidence.text}</p>
        <RefList refs={info.evidence.refs} compact />
      </section>

      {history.length > 0 && (
        <section className="mt-6">
          <SectionHeading icon={<SportArt kind="chart" size="title" />}>{L('Dernières performances', 'Recent performances')}</SectionHeading>
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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd><Tag tone="outline" icon={icon} className="gap-1.5 py-1 text-[12px] tnum [&_svg]:size-[14px]">{value}</Tag></dd>
    </div>
  )
}
