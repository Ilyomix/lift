import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Plus, Trash } from 'lucide-react'
import { dayName } from '../lib/date'
import { fmtLoad, fmtRest, parseNumber, plural, unitLabel } from '../lib/format'
import { L } from '../lib/i18n'
import { LIBRARY, MUSCLES } from '../lib/library'
import { fmtDate } from '../lib/date'
import { doableAt, GOAL_DATE, PERIODS, ROTATION, TYPE_META } from '../lib/program'
import { caveats, PRINCIPLES, SOURCES, VERDICT_FREQUENCY } from '../lib/research'
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
  const recomp = PERIODS.filter((p) => p.phase === 'recomp')
  const cut = PERIODS.filter((p) => ['cut', 'cut-end', 'diet-break'].includes(p.phase))
  const holidays = PERIODS.filter((p) => p.kind === 'holiday')
  const breakWeek = PERIODS.find((p) => p.phase === 'diet-break')
  const stab = PERIODS.find((p) => p.kind === 'stabilization')
  const cutText = cut.length
    ? L(
        `sèche du ${fmtDate(cut[0].start, { long: true })} au ${fmtDate(cut[cut.length - 1].end, { long: true })}`,
        `cut from ${fmtDate(cut[0].start, { long: true })} to ${fmtDate(cut[cut.length - 1].end, { long: true })}`,
      )
    : L('pas de sèche', 'no cut')
  return (
    <Screen>
      <Header
        backTo="plus"
        eyebrow={L('Fondé sur la recherche', 'Research-based')}
        title={L('Programme', 'Program')}
        sub={L(
          `Upper · Lower · Push · Pull · Legs — ${weekly} séances par semaine, 2 passages par muscle, blocs de 5 semaines + décharge, ${cutText}.`,
          `Upper · Lower · Push · Pull · Legs — ${plural(weekly, 'session', 'sessions')} a week, each muscle trained twice, 5-week blocks + deload, ${cutText}.`,
        )}
      />

      <Card className="p-4">
        <Eyebrow>{L('La question', 'The question')}</Eyebrow>
        <h2 className="mt-1 text-[20px] leading-[1.2] font-semibold tracking-[-0.02em]">{VERDICT_FREQUENCY.title}</h2>
        <p className="mt-2 text-[15px] leading-[1.5]">{VERDICT_FREQUENCY.answer}</p>
        <p className="mt-2 text-[15px] leading-[1.5] text-text-2">{VERDICT_FREQUENCY.keep}</p>
        <RefList refs={VERDICT_FREQUENCY.refs} compact />
      </Card>

      <Section title={L('Semaine type', 'Typical week')}>
        <Card className="divide-y divide-line">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="w-24 text-[15px] capitalize">{dayName(d)}</span>
              <select
                aria-label={L(`Séance du ${dayName(d)}`, `${dayName(d)} session`)}
                value={state.schedule[d] ?? ''}
                onChange={(e) => setSchedule(d, (e.target.value || null) as WorkoutType | null)}
                className="h-10 min-w-[150px] rounded-[9px] border border-line-strong bg-surface px-3 text-[16px] font-medium focus:border-signal focus:outline-none"
              >
                <option value="">{L('Repos', 'Rest')}</option>
                {ROTATION.map((t) => <option key={t} value={t}>{typeName(t)}</option>)}
              </select>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Jambes mardi et samedi (3–4 jours d’écart), haut du corps lundi, jeudi, vendredi. La rotation se décale si tu manques un jour.', 'Legs on Tuesday and Saturday (3–4 days apart), upper body on Monday, Thursday and Friday. The rotation shifts if you miss a day.')}</p>
      </Section>

      <Section title={L('Séances', 'Sessions')}>
        <Card className="divide-y divide-line">
          {ROTATION.map((t) => {
            const tpl = state.templates[t]
            const sets = tpl.exercises.reduce((a, e) => a + e.target.sets, 0)
            return (
              <button key={t} type="button" onClick={() => navigate(`plus/programme/${t}`)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <span className="flex h-10 w-11 shrink-0 items-center justify-center rounded-[8px] bg-text text-[11px] font-bold text-bg">{TYPE_META[t].code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{TYPE_META[t].label}{TYPE_META[t].fr !== TYPE_META[t].label && <> <span className="font-normal text-text-2">· {TYPE_META[t].fr}</span></>}</span>
                  <span className="block text-[13px] text-muted">{plural(tpl.exercises.length, L('exercice', 'exercise'), L('exercices', 'exercises'))} · {L(`${sets} séries`, `${sets} sets`)} · ~{TYPE_META[t].minutes} min</span>
                </span>
                <ChevronRight size={16} className="text-muted" aria-hidden />
              </button>
            )
          })}
        </Card>
      </Section>

      <Section title={L('Séries par muscle et par semaine', 'Sets per muscle per week')}>
        <p className="-mt-1 mb-4 text-[13px] leading-[1.45] text-text-2">{L('Volume prévu par le programme (comptage fractionnaire). Zone visée : 10–20.', 'Volume planned by the program (fractional counting). Target zone: 10–20.')}</p>
        <Card className="p-4">
          <RangeBars rows={MUSCLES.map((m) => ({ key: m.id, label: m.label, value: planned[m.id] }))} />
        </Card>
      </Section>

      <Section title={L('Calendrier des blocs', 'Block calendar')} action={<button type="button" onClick={() => navigate('calendrier')} className="text-[13px] font-medium text-text-2 hover:text-text">{L('Calendrier', 'Calendar')}</button>}>
        <PhaseTrack />
        <p className="mt-3 text-[13px] leading-[1.5] text-text-2">
          {L('Blocs d’environ 5 semaines + 1 semaine de décharge, calculés depuis ta date objectif.', 'Blocks of about 5 weeks + 1 deload week, calculated from your goal date.')}
          {recomp.length
            ? L(
                ` Recomposition du ${fmtDate(recomp[0].start)} au ${fmtDate(recomp[recomp.length - 1].end)}${holidays.length ? ' (fêtes en maintenance)' : ''},`,
                ` Recomposition from ${fmtDate(recomp[0].start)} to ${fmtDate(recomp[recomp.length - 1].end)}${holidays.length ? ' (holidays at maintenance)' : ''},`,
              )
            : ''}
          {` ${cutText}${breakWeek ? L(` avec une pause diététique le ${fmtDate(breakWeek.start)}`, ` with a diet break on ${fmtDate(breakWeek.start)}`) : ''}`}
          {stab ? L(`, stabilisation jusqu’au ${fmtDate(GOAL_DATE, { long: true, year: true })}.`, `, stabilization until ${fmtDate(GOAL_DATE, { long: true, year: true })}.`) : '.'}
        </p>
      </Section>

      <Section title={L('Règles', 'Rules')}>
        <Card className="divide-y divide-line text-[14px] leading-[1.45]">
          <RuleRow title="Double progression" text={L('Toutes les séries au haut de la fourchette, au RIR visé, technique propre : +2,5 % environ (plus petit incrément), puis retour au bas de la fourchette.', 'Every set at the top of the rep range, at the target RIR, with clean technique: about +2.5% (smallest increment), then back to the bottom of the range.')} />
          <RuleRow title={L('Effort dans le bloc', 'Effort within the block')} text={L('S1 RIR 3 · S2 RIR 2 · S3–S4 RIR 1–2 (polyarticulaire) et 0–1 (isolation) · S5 RIR 0–1, dernière série d’isolation à l’échec technique.', 'W1 RIR 3 · W2 RIR 2 · W3–W4 RIR 1–2 (compound) and 0–1 (isolation) · W5 RIR 0–1, last isolation set to technical failure.')} />
          <RuleRow title="Volume" text={L('À partir du bloc 2 : +1 série sur les muscles prioritaires en S3 si les performances montent. Plafond indicatif : 20 séries par muscle.', 'From block 2: +1 set on priority muscles in W3 if performance is going up. Rough ceiling: 20 sets per muscle.')} />
          <RuleRow title={L('Charges automatiques', 'Automatic loads')} text={L('Après chaque séance, la charge monte quand toutes les séries touchent le haut de la fourchette et baisse quand elles restent sous le bas. Pendant la séance, les séries suivantes s’ajustent si tu es très au-dessus ou au-dessous. Machines : par salle.', 'After each session, the load goes up when every set hits the top of the range and goes down when they stay below the bottom. During the session, the next sets adjust if you are well above or below. Machines: per gym.')} />
          <RuleRow title={L('Signal d’alerte', 'Warning sign')} text={L('Performance en baisse 2 séances de suite sur un exercice : 1 série de moins jusqu’à la fin du bloc. Baisse générale : l’app propose d’avancer la décharge.', 'Performance down 2 sessions in a row on an exercise: 1 set fewer until the end of the block. General drop: the app suggests bringing the deload forward.')} />
          <RuleRow title={L('Décharge', 'Deload')} text={L('Mêmes exercices, moitié des séries, charges −10 %, RIR 3–4.', 'Same exercises, half the sets, loads −10%, RIR 3–4.')} />
        </Card>
      </Section>

      <Section title={L('Ce que dit la recherche', 'What the research says')} action={<button type="button" onClick={() => navigate('plus/preuves')} className="text-[13px] font-medium text-text-2 hover:text-text">{L('Toutes les sources', 'All sources')}</button>}>
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

      <Section title={L('Limites', 'Limitations')}>
        <ul className="space-y-2 text-[13px] leading-[1.5] text-text-2">
          {caveats().map((c) => <li key={c} className="flex gap-2"><span className="text-muted">—</span>{c}</li>)}
        </ul>
      </Section>
    </Screen>
  )
}

/** « Upper · Haut du corps »; the label alone when the description reads the same (Push · Push in English). */
function typeName(t: WorkoutType): string {
  const m = TYPE_META[t]
  return m.fr === m.label ? m.label : `${m.label} · ${m.fr}`
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
      <Header
        backTo="plus/programme"
        eyebrow={L('Preuves', 'Evidence')}
        title="Sources"
        sub={L(
          `${Object.keys(SOURCES).length} publications vérifiées dans le rapport de recherche. Méta-analyses et essais randomisés en priorité.`,
          `${Object.keys(SOURCES).length} publications checked in the research report. Meta-analyses and randomized trials first.`,
        )}
      />
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
  const setup = useStore((s) => s.state.settings.setup)
  const { moveTemplateExercise, removeTemplateExercise, addTemplateExercise } = useStore.getState()
  // At home, only what the equipment allows; at the gym, everything.
  const addable = Object.values(LIBRARY).filter((x) => !setup || doableAt(x.id, setup))
  const [edit, setEdit] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  if (!tpl) return <Screen><Empty title={L('Séance inconnue', 'Unknown session')} /></Screen>
  const meta = TYPE_META[type]
  return (
    <Screen>
      <Header
        backTo="plus/programme"
        eyebrow={meta.fr !== meta.label ? meta.fr : undefined}
        title={meta.label}
        sub={L('Touchez un exercice pour ajuster ses cibles. Les règles du bloc (RIR, décharges, reprises) s’appliquent automatiquement par-dessus.', 'Tap an exercise to adjust its targets. The block rules (RIR, deloads, returns) are applied automatically on top.')}
      />
      <Card className="divide-y divide-line">
        {tpl.exercises.map((e, i) => (
          <div key={`${e.exerciseId}-${i}`} className="flex items-center gap-2 px-3 py-2.5">
            <button type="button" onClick={() => setEdit(i)} className="pressable min-w-0 flex-1 rounded-[8px] px-1 py-1 text-left hover:bg-surface-2">
              <span className="block text-[15px] font-medium">
                {e.name}{' '}
                {(e.volumeTag === 'priority' || e.focus) && (
                  <span className="ml-1 inline-block border border-signal/50 bg-signal-soft px-1.5 align-[2px] text-[11px] leading-4 font-semibold whitespace-nowrap text-signal-text">{L('Prioritaire', 'Priority')}</span>
                )}
              </span>
              <span className="block text-[13px] text-text-2 tnum">{e.target.sets} × {e.target.minReps}–{e.target.maxReps} · RIR {e.target.rir ?? '—'} · {fmtRest(e.target.restSeconds)} · {fmtLoad(e.target.weight, e.unit)}</span>
            </button>
            <IconButton label={L('Monter', 'Move up')} disabled={i === 0} onClick={() => moveTemplateExercise(type, i, -1)} className="h-9 w-9"><ArrowUp size={16} /></IconButton>
            <IconButton label={L('Descendre', 'Move down')} disabled={i === tpl.exercises.length - 1} onClick={() => moveTemplateExercise(type, i, 1)} className="h-9 w-9"><ArrowDown size={16} /></IconButton>
          </div>
        ))}
      </Card>
      <Button variant="outline" size="lg" full className="mt-3" icon={<Plus size={18} aria-hidden />} onClick={() => setAdding(true)}>{L('Ajouter un exercice', 'Add exercise')}</Button>

      {edit !== null && tpl.exercises[edit] && (
        <EditSheet
          ex={tpl.exercises[edit]}
          onClose={() => setEdit(null)}
          onRemove={() => { removeTemplateExercise(type, edit); setEdit(null) }}
          onSave={(patch) => { useStore.getState().editTemplateExercise(type, edit, patch); setEdit(null) }}
        />
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title={L('Ajouter un exercice', 'Add exercise')} tall>
        <div className="divide-y divide-line">
          {addable.map((x) => (
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
    weight: ex.target.weight === null ? '' : L(String(ex.target.weight).replace('.', ','), String(ex.target.weight)),
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
    <Sheet open onClose={onClose} title={ex.name} footer={<div className="flex gap-2"><Button variant="danger" size="lg" onClick={onRemove} aria-label={L('Retirer l’exercice', 'Remove exercise')}><Trash size={16} /></Button><Button variant="primary" size="lg" className="flex-1" onClick={save}>{L('Enregistrer', 'Save')}</Button></div>}>
      <div className="grid grid-cols-2 gap-3">
        {ex.unit !== 'PDC' && <Field label={L(`Charge (${ex.unit})`, `Load (${unitLabel(ex.unit)})`)} className="col-span-2"><input className={inputClass} inputMode="decimal" value={v.weight} onChange={set('weight')} placeholder={L('À trouver', 'To find')} /></Field>}
        <Field label={L('Séries', 'Sets')}><input className={inputClass} inputMode="numeric" value={v.sets} onChange={set('sets')} /></Field>
        <Field label={L('RIR visé', 'Target RIR')}><input className={inputClass} value={v.rir} onChange={set('rir')} placeholder="1–2" /></Field>
        <Field label={L('Reps min', 'Min reps')}><input className={inputClass} inputMode="numeric" value={v.minReps} onChange={set('minReps')} /></Field>
        <Field label={L('Reps max', 'Max reps')}><input className={inputClass} inputMode="numeric" value={v.maxReps} onChange={set('maxReps')} /></Field>
        <Field label={L('Repos (s)', 'Rest (s)')} className="col-span-2"><input className={inputClass} inputMode="numeric" value={v.rest} onChange={set('rest')} /></Field>
        <Field label={L('Réglage machine / note', 'Machine setting / note')} className="col-span-2"><textarea className={cx(inputClass, 'h-20 resize-none py-2.5')} value={v.technique} onChange={set('technique')} placeholder={L('Ex. : siège 4, pieds repère 4–5', 'E.g. seat 4, feet on mark 4–5')} /></Field>
      </div>
      {ex.note && <p className="mt-3 text-[13px] text-muted">{L(`Programme : ${ex.note}`, `Program: ${ex.note}`)}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{ex.focus ? <Tag tone="outline">{L('Zone prioritaire : +1 série dès le bloc 2', 'Priority area: +1 set from block 2')}</Tag> : ex.volumeTag === 'priority' && <Tag tone="outline">{L('Muscle prioritaire : +1 série dès le bloc 2', 'Priority muscle: +1 set from block 2')}</Tag>}{ex.volumeTag === 'calves' && <Tag tone="outline">{L('Mollets : +1 série dès le bloc 3', 'Calves: +1 set from block 3')}</Tag>}</div>
    </Sheet>
  )
}
