import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Plus, Trash } from 'lucide-react'
import { DAYS } from '../lib/date'
import { fmtLoad, fmtRest, parseNumber, plural } from '../lib/format'
import { LIBRARY, MUSCLES } from '../lib/library'
import { ROTATION, TYPE_META } from '../lib/program'
import { CAVEATS, PRINCIPLES, SOURCES, VERDICT_FREQUENCY } from '../lib/research'
import { navigate } from '../lib/router'
import { useStore } from '../lib/store'
import { plannedVolume } from '../lib/training'
import type { TemplateExercise, WorkoutType } from '../lib/types'
import { RangeBars } from '../components/charts'
import { LevelTag, RefList } from '../components/Evidence'
import { PhaseTrack } from '../components/Program'
import { Button, Card, cx, Empty, Eyebrow, Field, Header, IconButton, inputClass, Screen, Section, Sheet, Tag } from '../components/ui'

export function ProgramScreen() {
  const state = useStore((s) => s.state)
  const setSchedule = useStore((s) => s.setSchedule)
  const planned = plannedVolume(state.templates)
  const weekly = Object.values(state.schedule).filter(Boolean).length
  return (
    <Screen>
      <Header backTo="plus" eyebrow="Fondé sur la recherche" title="Programme" sub={`Upper · Lower · Push · Pull · Legs — ${weekly} séances par semaine, 2 passages par muscle, blocs de 5 semaines + décharge, sèche du 4 janvier au 13 juin.`} />

      <Card className="p-4">
        <Eyebrow>La question</Eyebrow>
        <h2 className="mt-1 text-[20px] leading-[1.2] font-semibold tracking-[-0.02em]">{VERDICT_FREQUENCY.title}</h2>
        <p className="mt-2 text-[15px] leading-[1.5]">{VERDICT_FREQUENCY.answer}</p>
        <p className="mt-2 text-[15px] leading-[1.5] text-text-2">{VERDICT_FREQUENCY.keep}</p>
        <RefList refs={VERDICT_FREQUENCY.refs} compact />
      </Card>

      <Section title="Semaine type">
        <Card className="divide-y divide-line">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="w-24 text-[15px] capitalize">{DAYS[d]}</span>
              <select
                aria-label={`Séance du ${DAYS[d]}`}
                value={state.schedule[d] ?? ''}
                onChange={(e) => setSchedule(d, (e.target.value || null) as WorkoutType | null)}
                className="h-10 min-w-[150px] rounded-[9px] border border-line-strong bg-surface px-3 text-[16px] font-medium focus:border-signal focus:outline-none"
              >
                <option value="">Repos</option>
                {ROTATION.map((t) => <option key={t} value={t}>{TYPE_META[t].label} · {TYPE_META[t].fr}</option>)}
              </select>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">Jambes mardi et samedi (3–4 jours d’écart), haut du corps lundi, jeudi, vendredi. La rotation se décale si tu manques un jour.</p>
      </Section>

      <Section title="Séances">
        <Card className="divide-y divide-line">
          {ROTATION.map((t) => {
            const tpl = state.templates[t]
            const sets = tpl.exercises.reduce((a, e) => a + e.target.sets, 0)
            return (
              <button key={t} type="button" onClick={() => navigate(`plus/programme/${t}`)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[8px] bg-text text-[11px] font-bold text-bg">{TYPE_META[t].code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{TYPE_META[t].label} <span className="font-normal text-text-2">· {TYPE_META[t].fr}</span></span>
                  <span className="block text-[13px] text-muted">{plural(tpl.exercises.length, 'exercice', 'exercices')} · {sets} séries · ~{TYPE_META[t].minutes} min</span>
                </span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            )
          })}
        </Card>
      </Section>

      <Section title="Séries par muscle et par semaine">
        <p className="-mt-1 mb-4 text-[13px] leading-[1.45] text-text-2">Volume prévu par le programme (comptage fractionnaire). Zone visée : 10–20.</p>
        <Card className="p-4">
          <RangeBars rows={MUSCLES.map((m) => ({ key: m.id, label: m.label, value: planned[m.id] }))} />
        </Card>
      </Section>

      <Section title="Calendrier des blocs" action={<button type="button" onClick={() => navigate('calendrier')} className="text-[13px] font-medium text-text-2 hover:text-text">Calendrier</button>}>
        <PhaseTrack />
        <p className="mt-3 text-[13px] leading-[1.5] text-text-2">
          Blocs de 5 semaines + 1 semaine de décharge. Recomposition du 28 sept. au 3 janv. (fêtes en maintenance), sèche du 4 janv. au 13 juin avec une pause diététique fin mars, stabilisation jusqu’au 30 juin.
        </p>
      </Section>

      <Section title="Règles">
        <Card className="divide-y divide-line text-[14px] leading-[1.45]">
          <RuleRow title="Double progression" text="Toutes les séries au haut de la fourchette, au RIR visé, technique propre : +2,5 % environ (plus petit incrément), puis retour au bas de la fourchette." />
          <RuleRow title="Effort dans le bloc" text="S1 RIR 3 · S2 RIR 2 · S3–S4 RIR 1–2 (polyarticulaire) et 0–1 (isolation) · S5 RIR 0–1, dernière série d’isolation à l’échec technique." />
          <RuleRow title="Volume" text="À partir du bloc 2 : +1 série sur les muscles prioritaires en S3 si les performances montent. Plafond indicatif : 20 séries par muscle." />
          <RuleRow title="Signal d’alerte" text="Performance en baisse 2 séances de suite sur un exercice : retire 1 série à ce muscle. Baisse générale : avance la décharge." />
          <RuleRow title="Décharge" text="Mêmes exercices, moitié des séries, charges −10 %, RIR 3–4." />
        </Card>
      </Section>

      <Section title="Ce que dit la recherche" action={<button type="button" onClick={() => navigate('plus/preuves')} className="text-[13px] font-medium text-text-2 hover:text-text">Toutes les sources</button>}>
        <Card className="divide-y divide-line">
          {PRINCIPLES.map((p) => (
            <details key={p.id} className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block">{p.title}</span>
                  <span className="mt-0.5 block text-[15px] leading-[1.35] font-semibold">{p.rule}</span>
                </span>
                <LevelTag level={p.level} />
                <ChevronDown size={16} className="mt-1 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-[14px] leading-[1.5] text-text-2">{p.detail}</p>
                <RefList refs={p.refs} compact />
              </div>
            </details>
          ))}
        </Card>
      </Section>

      <Section title="Limites">
        <ul className="space-y-2 text-[13px] leading-[1.5] text-text-2">
          {CAVEATS.map((c) => <li key={c} className="flex gap-2"><span className="text-muted">—</span>{c}</li>)}
        </ul>
      </Section>
    </Screen>
  )
}

function RuleRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="px-4 py-3">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-text-2">{text}</p>
    </div>
  )
}

export function SourcesScreen() {
  return (
    <Screen>
      <Header backTo="plus/programme" eyebrow="Preuves" title="Sources" sub={`${Object.keys(SOURCES).length} publications vérifiées dans le rapport de recherche. Méta-analyses et essais randomisés en priorité.`} />
      <Card className="divide-y divide-line">
        {Object.values(SOURCES).sort((a, b) => a.authors.localeCompare(b.authors)).map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="pressable block px-4 py-3 hover:bg-surface-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[14px] leading-[1.4] font-medium">{s.title}</p>
              <ExternalLink size={14} className="mt-1 shrink-0 text-muted" aria-hidden />
            </div>
            <p className="mt-1 text-[13px] text-text-2">{s.authors} ({s.year}) · {s.journal}</p>
            <p className="mt-0.5 text-[12px] text-muted">{s.kind} · {s.id}</p>
          </a>
        ))}
      </Card>
    </Screen>
  )
}

// ───────────────────────── Template editor ─────────────────────────

export function TemplateEditor({ type }: { type: WorkoutType }) {
  const tpl = useStore((s) => s.state.templates[type])
  const { moveTemplateExercise, removeTemplateExercise, addTemplateExercise } = useStore.getState()
  const [edit, setEdit] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  if (!tpl) return <Screen><Empty title="Séance inconnue" /></Screen>
  return (
    <Screen>
      <Header backTo="plus/programme" eyebrow={TYPE_META[type].fr} title={TYPE_META[type].label} sub="Touchez un exercice pour ajuster ses cibles. Les règles du bloc (RIR, décharges, reprises) s’appliquent automatiquement par-dessus." />
      <Card className="divide-y divide-line">
        {tpl.exercises.map((e, i) => (
          <div key={`${e.exerciseId}-${i}`} className="flex items-center gap-2 px-3 py-2.5">
            <button type="button" onClick={() => setEdit(i)} className="pressable min-w-0 flex-1 rounded-[8px] px-1 py-1 text-left hover:bg-surface-2">
              <span className="block text-[15px] font-medium">{e.name}</span>
              <span className="block text-[13px] text-text-2 tnum">{e.target.sets} × {e.target.minReps}–{e.target.maxReps} · RIR {e.target.rir ?? '—'} · {fmtRest(e.target.restSeconds)} · {fmtLoad(e.target.weight, e.unit)}</span>
            </button>
            <IconButton label="Monter" disabled={i === 0} onClick={() => moveTemplateExercise(type, i, -1)} className="h-9 w-9"><ArrowUp size={16} /></IconButton>
            <IconButton label="Descendre" disabled={i === tpl.exercises.length - 1} onClick={() => moveTemplateExercise(type, i, 1)} className="h-9 w-9"><ArrowDown size={16} /></IconButton>
          </div>
        ))}
      </Card>
      <Button variant="outline" size="lg" full className="mt-3" icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)}>Ajouter un exercice</Button>

      {edit !== null && tpl.exercises[edit] && (
        <EditSheet
          ex={tpl.exercises[edit]}
          onClose={() => setEdit(null)}
          onRemove={() => { removeTemplateExercise(type, edit); setEdit(null) }}
          onSave={(patch) => { useStore.getState().editTemplateExercise(type, edit, patch); setEdit(null) }}
        />
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Ajouter un exercice" tall>
        <div className="divide-y divide-line">
          {Object.values(LIBRARY).map((x) => (
            <button key={x.id} type="button" onClick={() => { addTemplateExercise(type, x.id); setAdding(false) }} className="pressable flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-surface-2">
              <span>
                <span className="block text-[15px] font-medium">{x.name}</span>
                <span className="block text-[13px] text-muted">{x.muscle}</span>
              </span>
              <LevelTag level={x.evidence.level} />
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  )
}

function EditSheet({ ex, onClose, onSave, onRemove }: { ex: TemplateExercise; onClose: () => void; onSave: (p: Partial<TemplateExercise>) => void; onRemove: () => void }) {
  const [v, setV] = useState({
    weight: ex.target.weight === null ? '' : String(ex.target.weight).replace('.', ','),
    sets: String(ex.target.sets),
    minReps: String(ex.target.minReps),
    maxReps: String(ex.target.maxReps),
    rest: String(ex.target.restSeconds),
    rir: ex.target.rir ?? '',
    technique: ex.technique ?? '',
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  const save = () =>
    onSave({
      target: {
        weight: ex.unit === 'PDC' ? null : parseNumber(v.weight),
        sets: Math.max(1, parseNumber(v.sets) ?? ex.target.sets),
        minReps: Math.max(1, parseNumber(v.minReps) ?? ex.target.minReps),
        maxReps: Math.max(1, parseNumber(v.maxReps) ?? ex.target.maxReps),
        restSeconds: Math.max(15, parseNumber(v.rest) ?? ex.target.restSeconds),
        rir: v.rir || undefined,
      },
      technique: v.technique || undefined,
      nextTarget: undefined,
    })
  return (
    <Sheet open onClose={onClose} title={ex.name} footer={<div className="flex gap-2"><Button variant="danger" size="lg" onClick={onRemove} aria-label="Retirer l’exercice"><Trash size={16} /></Button><Button variant="primary" size="lg" className="flex-1" onClick={save}>Enregistrer</Button></div>}>
      <div className="grid grid-cols-2 gap-3">
        {ex.unit !== 'PDC' && <Field label={`Charge (${ex.unit})`} className="col-span-2"><input className={inputClass} inputMode="decimal" value={v.weight} onChange={set('weight')} placeholder="À trouver" /></Field>}
        <Field label="Séries"><input className={inputClass} inputMode="numeric" value={v.sets} onChange={set('sets')} /></Field>
        <Field label="RIR visé"><input className={inputClass} value={v.rir} onChange={set('rir')} placeholder="1–2" /></Field>
        <Field label="Reps min"><input className={inputClass} inputMode="numeric" value={v.minReps} onChange={set('minReps')} /></Field>
        <Field label="Reps max"><input className={inputClass} inputMode="numeric" value={v.maxReps} onChange={set('maxReps')} /></Field>
        <Field label="Repos (s)" className="col-span-2"><input className={inputClass} inputMode="numeric" value={v.rest} onChange={set('rest')} /></Field>
        <Field label="Réglage machine / note" className="col-span-2"><textarea className={cx(inputClass, 'h-20 resize-none py-2.5')} value={v.technique} onChange={set('technique')} placeholder="Ex. : siège 4, pieds repère 4–5" /></Field>
      </div>
      {ex.note && <p className="mt-3 text-[13px] text-muted">Programme : {ex.note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{ex.volumeTag === 'priority' && <Tag tone="outline">Muscle prioritaire : +1 série dès le bloc 2</Tag>}{ex.volumeTag === 'calves' && <Tag tone="outline">Mollets : +1 série dès le bloc 3</Tag>}</div>
    </Sheet>
  )
}
