import { useEffect, useRef, useState } from 'react'
import {
  Apple, BellRing, Check, ChevronLeft, ChevronRight, CirclePause, ClipboardPaste, Download, Flag, FlaskConical, Infinity as InfinityIcon, MapPin, Pencil, Settings, Sparkles, Trash, Upload,
} from 'lucide-react'
import { requestNotifications, notificationsSupported } from '../lib/alerts'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { globalPrompt, parsePlanUpdate, previewPlanUpdate, sessionPrompt, type PlanUpdate } from '../lib/coach'
import { L } from '../lib/i18n'
import { addDays, capitalize, dayLetter, dayName, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { HOME_GYM } from '../lib/gyms'
import { contextAt, GOAL_DATE, MAINTENANCE, trainingDays, TYPE_META } from '../lib/program'
import { disablePush, enablePush, preparePush, pushReady, pushSupported, testPush } from '../lib/push'
import { SOURCES } from '../lib/research'
import { navigate } from '../lib/router'
import { isIOS, isStandalone, saveFile, shareText } from '../lib/share'
import { calorieAdvice, goalWeightRange, nutritionDays, nutritionFor, proteinTargetFor } from '../lib/stats'
import { lookInfo, ZONES, goalApplied } from '../lib/visual'
import { useStore } from '../lib/store'
import { Columns } from '../components/charts'
import { RefList } from '../components/Evidence'
import { GoalSheet } from '../components/GoalSheet'
import { SetupSheet, setupLabel } from '../components/Setup'
import { Button, Card, cx, Empty, Field, Header, inputClass, Row, Screen, Section, Segmented, Sheet, Tag, Toggle } from '../components/ui'


export function MoreScreen() {
  const state = useStore((s) => s.state)
  const items = [
    { to: 'plus/nutrition', icon: Apple, label: 'Nutrition', hint: L('Calories, protéines, créatine', 'Calories, protein, creatine') },
    { to: 'plus/programme', icon: FlaskConical, label: L('Programme et preuves', 'Program and evidence'), hint: L(`${Object.keys(SOURCES).length} études citées`, `${Object.keys(SOURCES).length} studies cited`) },
    { to: 'plus/coach', icon: Sparkles, label: 'Coach Claude', hint: L('Bilan et mise à jour des cibles', 'Summary and target updates') },
    { to: 'plus/pause', icon: CirclePause, label: L('Pause du programme', 'Program pause'), hint: state.programPause.active ? L('En pause', 'Paused') : L('Vacances, maladie, blessure', 'Vacation, illness, injury') },
    { to: 'plus/rappels', icon: BellRing, label: L('Rappels iPhone', 'iPhone reminders'), hint: L('Séances, pesée, décharges', 'Sessions, weigh-ins, deloads') },
    { to: 'plus/donnees', icon: Download, label: L('Sauvegarde', 'Backup'), hint: state.meta.lastBackupAt ? L(`Dernier export ${fmtRelativeDay(state.meta.lastBackupAt.slice(0, 10))}`, `Last export ${fmtRelativeDay(state.meta.lastBackupAt.slice(0, 10))}`) : L('Jamais exportée', 'Never exported') },
    { to: 'plus/reglages', icon: Settings, label: L('Réglages', 'Settings'), hint: L('Objectifs, minuteur, apparence', 'Goals, timer, appearance') },
  ]
  return (
    <Screen>
      <Header title={L('Plus', 'More')} />
      <Card className="divide-y divide-line">
        {items.map(({ to, icon: Icon, label, hint }) => (
          <button key={to} type="button" onClick={() => navigate(to)} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
            <Icon size={20} className="shrink-0 text-text-2" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{label}</span>
              <span className="block text-[13px] text-muted">{hint}</span>
            </span>
            <ChevronRight size={16} className="text-muted" aria-hidden />
          </button>
        ))}
      </Card>
      <p className="mt-8 text-center text-[12px] leading-[1.5] text-muted">
        <span className="font-semibold text-text-2">Lift</span> · {L('conçue par', 'designed by')}{' '}
        <a href="https://github.com/Ilyomix" target="_blank" rel="noopener noreferrer" className="font-medium text-text-2 underline decoration-line-strong underline-offset-2">Ilyomix</a>
        {' · '}
        <a href="https://github.com/Ilyomix/lift" target="_blank" rel="noopener noreferrer" className="font-medium text-text-2 underline decoration-line-strong underline-offset-2">GitHub</a>
        <br />
        {L('Programme fondé sur la recherche (rapport du 26 sept. 2026)', 'Research-based program (report of 26 Sept 2026)')}
        <br />
        {L('Données stockées sur cet appareil uniquement.', 'Data stored on this device only.')}
      </p>
    </Screen>
  )
}

// ───────────────────────── Nutrition ─────────────────────────

export function NutritionScreen() {
  const state = useStore((s) => s.state)
  const { setNutrition, setNutritionTargets, notify } = useStore.getState()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const e = nutritionFor(state, date)
  const protein = proteinTargetFor(state, date)
  const ctx = contextAt(date)
  const days = nutritionDays(state, 14, today)
  const advice = calorieAdvice(state, today)
  const hit = days.filter((d) => d.protein >= protein.min).length
  const add = (k: 'calories' | 'protein', n: number) => setNutrition(date, { [k]: Math.max(0, (e[k] ?? 0) + n) })
  const adaptive = state.nutritionTargets.adaptive !== false
  return (
    <Screen>
      <Header backTo="plus" eyebrow={ctx.phase?.label ?? 'Nutrition'} title="Nutrition" sub={ctx.phase?.nutrition} />
      <div className="flex items-center justify-between">
        <button type="button" aria-label={L('Jour précédent', 'Previous day')} onClick={() => setDate(addDays(date, -1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong"><ChevronLeft size={18} /></button>
        <p className="text-[15px] font-semibold">{capitalize(fmtRelativeDay(date, today))}</p>
        <button type="button" aria-label={L('Jour suivant', 'Next day')} disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      <Card className="mt-4 divide-y divide-line">
        <Counter label={L('Protéines', 'Protein')} unit="g" value={e.protein} target={`${protein.min}–${protein.max} g`} onSet={(n) => setNutrition(date, { protein: n })} steps={[-10, 10, 25]} onAdd={(n) => add('protein', n)} />
        <Counter label="Calories" unit="kcal" value={e.calories} target={`${state.nutritionTargets.calories} kcal`} onSet={(n) => setNutrition(date, { calories: n })} steps={[-100, 100, 250]} onAdd={(n) => add('calories', n)} />
        <Toggle label={L('Créatine', 'Creatine')} hint={L(`${state.nutritionTargets.creatine} g par jour · fait retenir 1–2 kg d’eau`, `${state.nutritionTargets.creatine} g per day · makes you retain 1–2 kg of water`)} checked={e.creatine > 0} onChange={(v) => setNutrition(date, { creatine: v ? state.nutritionTargets.creatine : 0 })} />
      </Card>

      <Section title={L('Calories : ajustement', 'Calories: adjustment')}>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{advice.headline}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{advice.detail}</p>
            </div>
            {advice.status !== 'wait' && <Tag tone={advice.status === 'ok' ? 'good' : 'warn'}>{advice.status === 'ok' ? 'OK' : `${advice.delta > 0 ? '+' : '−'}${Math.abs(advice.delta)} kcal`}</Tag>}
          </div>
          {(advice.status === 'lower' || advice.status === 'raise') && (
            <Button variant="primary" full className="mt-3" onClick={() => { setNutritionTargets({ calories: advice.target }); notify(L(`Cible : ${advice.target} kcal. Prochain point dans 2 semaines.`, `Target: ${advice.target} kcal. Next check-in in 2 weeks.`), 'good') }}>
              {L(`Passer à ${advice.target} kcal`, `Switch to ${advice.target} kcal`)}
            </Button>
          )}
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            {L('Tendance de ta moyenne de poids sur 7 jours (3 dernières semaines)', 'Trend of your 7-day average weight (last 3 weeks)')}{advice.waist ? L(`, tour de taille ${advice.waist === 'down' ? 'en baisse' : advice.waist === 'up' ? 'en hausse' : 'stable'} sur un mois`, `, waist ${advice.waist === 'down' ? 'down' : advice.waist === 'up' ? 'up' : 'stable'} over a month`) : ''}. {L('Pas de 150 kcal, puis 2 semaines pour que le poids réagisse. Le poids ne change jamais les charges.', 'Steps of 150 kcal, then 2 weeks for your weight to respond. Your weight never changes your loads.')}
          </p>
        </Card>
      </Section>

      <Section title={L('Protéines, 14 jours', 'Protein, 14 days')} action={<span className="text-[13px] text-text-2 tnum">{L(`${hit}/14 jours ≥ ${protein.min} g`, `${hit}/14 days ≥ ${protein.min} g`)}</span>}>
        <Card className="p-4">
          <Columns
            ariaLabel={L('Protéines par jour sur 14 jours', 'Protein per day over 14 days')}
            bars={days.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.protein, tooltip: <span>{fmtDate(d.date)}{L(' : ', ': ')}{fmtNum(d.protein, 0)} g</span> }))}
            target={{ value: protein.min, label: `${protein.min} g` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card>
      </Section>

      <Section title={L('Cibles', 'Targets')}>
        <Card className="mb-3">
          <Toggle
            label={L('Protéines adaptées à ton poids', 'Protein adjusted to your weight')}
            hint={adaptive && protein.weight ? L(`${protein.min}–${protein.max} g : ≈ ${fmtNum(protein.perKg![0], 1)}–${fmtNum(protein.perKg![1], 1)} g/kg × ${fmtNum(protein.weight, 1)} kg (moyenne 7 jours)`, `${protein.min}–${protein.max} g: ≈ ${fmtNum(protein.perKg![0], 1)}–${fmtNum(protein.perKg![1], 1)} g/kg × ${fmtNum(protein.weight, 1)} kg (7-day average)`) : adaptive ? L('Dès ta première pesée', 'From your first weigh-in') : L('Fourchette fixe ci-dessous', 'Fixed range below')}
            checked={adaptive}
            onChange={(v) => setNutritionTargets({ adaptive: v })}
          />
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)"><NumInput value={state.nutritionTargets.calories} onChange={(n) => setNutritionTargets({ calories: n })} /></Field>
          <Field label={L('Créatine (g)', 'Creatine (g)')}><NumInput value={state.nutritionTargets.creatine} onChange={(n) => setNutritionTargets({ creatine: n })} /></Field>
          {!adaptive && (
            <>
              <Field label={L('Protéines min (g)', 'Protein min (g)')}><NumInput value={state.nutritionTargets.proteinMin} onChange={(n) => setNutritionTargets({ proteinMin: n })} /></Field>
              <Field label={L('Protéines max (g)', 'Protein max (g)')}><NumInput value={state.nutritionTargets.proteinMax} onChange={(n) => setNutritionTargets({ proteinMax: n })} /></Field>
            </>
          )}
        </div>
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">{L('Aucune étude ne donne ta maintenance : les calories se règlent sur ta moyenne de poids. Protéines : ≈ 2 g/kg, un peu plus en sèche, jamais en baisse pendant la sèche.', 'No study can tell you your maintenance: calories are set from your weight average. Protein: ≈ 2 g/kg, a little more during a cut, never lowered during the cut.')}</p>
        <RefList refs={['morton2018', 'helms2014', 'murphy2022', 'garthe2011', 'burke2023']} compact />
      </Section>
    </Screen>
  )
}

function NumInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [t, setT] = useState(String(value))
  return <input className={inputClass} inputMode="numeric" value={t} onChange={(e) => { setT(e.target.value); const n = parseNumber(e.target.value); if (n !== null) onChange(n) }} />
}

function Counter({ label, unit, value, target, onSet, steps, onAdd }: { label: string; unit: string; value: number; target: string; onSet: (n: number) => void; steps: number[]; onAdd: (n: number) => void }) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-[12px] text-muted">{L(`cible ${target}`, `target ${target}`)}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          aria-label={`${label} (${unit})`}
          className="h-12 w-28 rounded-[10px] border border-line-strong bg-surface px-3 text-[22px] font-semibold tnum focus:border-signal focus:outline-none"
          inputMode="numeric"
          value={value || ''}
          placeholder="0"
          onChange={(e) => onSet(parseNumber(e.target.value) ?? 0)}
        />
        <span className="text-[13px] text-muted">{unit}</span>
        <div className="ml-auto flex gap-1.5">
          {steps.map((s) => (
            <button key={s} type="button" onClick={() => onAdd(s)} className="pressable h-10 rounded-[9px] border border-line-strong px-2.5 text-[13px] font-semibold tnum hover:border-muted">
              {s > 0 ? `+${s}` : `−${-s}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Coach ─────────────────────────

export function CoachScreen() {
  const state = useStore((s) => s.state)
  const applyPlan = useStore((s) => s.applyPlan)
  const [text, setText] = useState('')
  const [update, setUpdate] = useState<PlanUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const last = state.workouts[state.workouts.length - 1]
  const analyze = () => {
    try {
      setUpdate(parsePlanUpdate(text))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setUpdate(null)
    }
  }
  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText())
    } catch {
      useStore.getState().notify(L('Colle le texte manuellement dans le champ.', 'Paste the text into the field manually.'), 'bad')
    }
  }
  const preview = update ? previewPlanUpdate(state, update) : []
  return (
    <Screen>
      <Header backTo="plus" eyebrow="Coach" title="Claude" sub={L('Envoie un bilan précis à Claude, colle sa réponse : tes cibles se mettent à jour, avec un aperçu avant de valider.', 'Send Claude a detailed summary, paste its reply: your targets update, with a preview before you confirm.')} />
      <ol className="space-y-2">
        {[L('Partage un bilan (séance ou global).', 'Share a summary (session or overall).'), L('Claude analyse et répond avec un bloc JSON.', 'Claude analyzes it and replies with a JSON block.'), L('Colle la réponse ici, vérifie, applique.', 'Paste the reply here, check it, apply it.')].map((s, i) => (
          <li key={i} className="flex gap-3 text-[14px] text-text-2"><span className="font-semibold text-text tnum">{i + 1}.</span>{s}</li>
        ))}
      </ol>
      <div className="mt-5 grid gap-2">
        <Button variant="ink" size="lg" full icon={<Sparkles size={18} aria-hidden />} disabled={!last} onClick={() => last && void shareText(sessionPrompt(state, last), L(`Séance ${last.sessionNumber}`, `Session ${last.sessionNumber}`))}>
          {last ? L(`Bilan de la séance n°${last.sessionNumber}`, `Session #${last.sessionNumber} summary`) : L('Aucune séance', 'No sessions')}
        </Button>
        <Button variant="outline" size="lg" full onClick={() => void shareText(globalPrompt(state), L('Bilan Lift', 'Lift summary'))}>{L('Bilan global du programme', 'Overall program summary')}</Button>
      </div>

      <Section title={L('Réponse de Claude', 'Claude’s reply')} action={<Button size="sm" variant="ghost" icon={<ClipboardPaste size={15} aria-hidden />} onClick={paste}>{L('Coller', 'Paste')}</Button>}>
        <textarea className={cx(inputClass, 'h-36 resize-none py-2.5 font-mono')} value={text} onChange={(e) => setText(e.target.value)} placeholder={L('Colle ici la réponse complète : le bloc JSON est détecté automatiquement.', 'Paste the full reply here: the JSON block is detected automatically.')} />
        {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
        <Button variant="outline" full className="mt-2" disabled={!text.trim()} onClick={analyze}>{L('Analyser', 'Analyze')}</Button>
      </Section>

      {update && (
        <Section title={L('Aperçu', 'Preview')}>
          <p className="mb-3 text-[14px] leading-[1.45]">{update.summary}</p>
          <Card className="divide-y divide-line">
            {preview.map((p, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Tag tone={p.kind === 'add' ? 'good' : p.kind === 'remove' ? 'bad' : 'outline'}>{TYPE_META[p.template].code}</Tag>
                  <span className="text-[15px] font-medium">{p.label}</span>
                </div>
                <p className="mt-1 text-[13px] text-text-2 tnum"><span className="text-muted">{p.before}</span> → <span className="font-semibold text-text">{p.after}</span></p>
              </div>
            ))}
            {update.nutritionTargets && <div className="px-4 py-3 text-[13px] text-text-2">{L('Nutrition : ', 'Nutrition: ')}{Object.entries(update.nutritionTargets).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>}
          </Card>
          <Button variant="primary" size="lg" full className="mt-3" onClick={() => { applyPlan(update); setUpdate(null); setText(''); useStore.getState().notify(L('Cibles mises à jour.', 'Targets updated.'), 'good') }}>
            {L('Appliquer', 'Apply')} {plural(update.changes.length, L('changement', 'change'), L('changements', 'changes'))}
          </Button>
        </Section>
      )}

      <Section title={L('Historique des mises à jour', 'Update history')}>
        {state.appliedPlanUpdates.length ? (
          <Card className="divide-y divide-line">
            {[...state.appliedPlanUpdates].reverse().slice(0, 12).map((u) => (
              <div key={u.updateId + u.appliedAt} className="px-4 py-3">
                <p className="text-[12px] text-muted">{fmtDate(u.appliedAt.slice(0, 10), { year: true })} · {plural(u.changeCount, L('changement', 'change'), L('changements', 'changes'))}{u.source ? ` · ${u.source === 'claude' ? 'Claude' : u.source === 'program' ? L('programme', 'program') : 'progression'}` : ''}</p>
                <p className="mt-0.5 text-[14px] leading-[1.45]">{u.summary}</p>
              </div>
            ))}
          </Card>
        ) : (
          <Empty title={L('Aucune mise à jour', 'No updates')} />
        )}
      </Section>
    </Screen>
  )
}

// ───────────────────────── Réglages ─────────────────────────

export function SettingsScreen() {
  const state = useStore((s) => s.state)
  const { setPrefs, setGoals, toggleTrainingDay } = useStore.getState()
  const goal = goalWeightRange(state)
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported')
  const [goalOpen, setGoalOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const days = trainingDays(state)
  const perWeek = days.length
  return (
    <Screen>
      <Header backTo="plus" title={L('Réglages', 'Settings')} />

      <Section title={L('Objectif', 'Goal')} className="mt-0">
        <Card className="divide-y divide-line">
          <Row
            label={L('Objectif visuel', 'Visual goal')}
            hint={goalApplied(state.visualGoal) ? L(`Cible ${fmtNum(state.goals.targetWeightMin, 1)}–${fmtNum(state.goals.targetWeightMax, 1)} kg · ${state.visualGoal.zones.length ? `zones : ${state.visualGoal.zones.map((z) => ZONES.find((x) => x.id === z)?.label.toLowerCase()).join(', ')}` : 'V du programme'}`, `Target ${fmtNum(state.goals.targetWeightMin, 1)}–${fmtNum(state.goals.targetWeightMax, 1)} kg · ${state.visualGoal.zones.length ? `areas: ${state.visualGoal.zones.map((z) => ZONES.find((x) => x.id === z)?.label.toLowerCase()).join(', ')}` : 'program’s V shape'}`) : MAINTENANCE ? L('En entretien, pas de sèche : appliquer un look repasse sur une date objectif', 'In maintenance, no cut: applying a look switches back to a goal date') : L('Le look visé fixe le poids cible, la sèche et les zones prioritaires', 'Your target look sets the target weight, the cut and the priority areas')}
            value={<span className="font-medium text-text">{goalApplied(state.visualGoal) ? lookInfo(state.visualGoal.look).label : MAINTENANCE ? (state.visualGoal ? L('En pause', 'On hold') : L('Aucun', 'None')) : L('À choisir', 'Choose')}</span>}
            right={<ChevronRight size={16} className="text-muted" aria-hidden />}
            onClick={() => navigate('plus/objectif')}
          />
          {MAINTENANCE ? (
            <Row
              label={L('Objectif', 'Goal')}
              hint={L('Sans date : blocs et décharges en continu, calories à maintenance', 'No end date: blocks and deloads that keep going, maintenance calories')}
              value={<span className="inline-flex items-center gap-1.5 font-medium text-text"><InfinityIcon size={14} className="text-signal-text" aria-hidden />{L('Entretien', 'Maintenance')}</span>}
              right={<Pencil size={14} className="text-muted" aria-hidden />}
              onClick={() => setGoalOpen(true)}
            />
          ) : (
            <Row
              label={L('Date objectif', 'Goal date')}
              hint={L('Le plan (recomposition, sèche, stabilisation) se recalcule autour. Ou mode entretien, sans date.', 'The plan (recomposition, cut, stabilization) is recalculated around it. Or maintenance mode, with no date.')}
              value={<span className="inline-flex items-center gap-1.5 font-medium text-text"><Flag size={14} className="text-signal-text" aria-hidden />{fmtDate(GOAL_DATE, { long: true, year: true })}</span>}
              right={<Pencil size={14} className="text-muted" aria-hidden />}
              onClick={() => setGoalOpen(true)}
            />
          )}
          <Row
            label={L('Lieu d’entraînement', 'Where you train')}
            hint={setupLabel(state.settings.setup)}
            right={<ChevronRight size={16} className="text-muted" aria-hidden />}
            onClick={() => setSetupOpen(true)}
          />
          <div className="px-4 py-3.5">
            <p className="text-[15px]">{L('Jours d’entraînement', 'Training days')}</p>
            <div className="mt-2.5 grid grid-cols-7 gap-1.5" role="group" aria-label={L('Jours d’entraînement', 'Training days')}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = days.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={dayName(d)}
                    onClick={() => toggleTrainingDay(d)}
                    className={cx('pressable h-11 rounded-[10px] border text-[14px] font-semibold', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2')}
                  >
                    {dayLetter(d)}
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 text-[13px] leading-[1.45] text-text-2">
              {plural(perWeek, L('séance', 'session'), L('séances', 'sessions'))} {L('par semaine.', 'per week.')} {perWeek === 5
                ? L('Le rythme du programme : chaque muscle 2 fois par semaine.', 'The program’s pace: each muscle twice a week.')
                : perWeek < 5
                  ? L(`La rotation Upper → Legs continue sur ${perWeek} jours : chaque séance revient moins souvent, environ ${Math.round((perWeek / 5) * 100)} % du volume hebdomadaire prévu.`, `The Upper → Legs rotation continues over ${perWeek} days: each session comes around less often, about ${Math.round((perWeek / 5) * 100)}% of the planned weekly volume.`)
                  : L(`Environ ${Math.round((perWeek / 5) * 100)} % du volume prévu : surveille la récupération (sommeil, performances).`, `About ${Math.round((perWeek / 5) * 100)}% of the planned volume: keep an eye on recovery (sleep, performance).`)}
            </p>
          </div>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={L('Poids cible min (kg)', 'Target weight min (kg)')} hint={goal?.computed ? L(`Plan : ${fmtNum(goal.min, 0)} kg`, `Plan: ${fmtNum(goal.min, 0)} kg`) : undefined}>
            <GoalInput value={state.goals.targetWeightMin || null} placeholder={goal ? fmtNum(goal.min, 0) : ''} onChange={(n) => setGoals({ targetWeightMin: n ?? 0 })} />
          </Field>
          <Field label={L('Poids cible max (kg)', 'Target weight max (kg)')} hint={goal?.computed ? L(`Plan : ${fmtNum(goal.max, 0)} kg`, `Plan: ${fmtNum(goal.max, 0)} kg`) : undefined}>
            <GoalInput value={state.goals.targetWeightMax || null} placeholder={goal ? fmtNum(goal.max, 0) : ''} onChange={(n) => setGoals({ targetWeightMax: n ?? 0 })} />
          </Field>
          <Field label={L('Tour de taille cible (cm)', 'Target waist (cm)')} className="col-span-2"><GoalInput value={state.goals.targetWaist} placeholder="—" onChange={(n) => setGoals({ targetWaist: n })} /></Field>
        </div>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">{MAINTENANCE ? L('Sans valeur, la cible est ton poids actuel ± 1 kg : en entretien, le poids reste stable. Taux de gras et poids restent des estimations : suis aussi ton tour de taille et tes photos.', 'With no value, the target is your current weight ± 1 kg: in maintenance, your weight stays stable. Body fat and weight are still estimates: also track your waist and your photos.') : L('Sans valeur, la cible vient de la trajectoire du plan (recomposition à poids stable, puis sèche à −0,5 %/semaine). Taux de gras et poids cible restent des estimations : ajuste avec ton tour de taille et tes photos.', 'With no value, the target comes from the plan’s trajectory (recomposition at a stable weight, then a cut at −0.5%/week). Body fat and target weight are still estimates: adjust with your waist and your photos.')}</p>
      </Section>

      <Section title={L('Séances', 'Sessions')}>
        <Card className="divide-y divide-line">
          <Toggle
            label={L('Charges automatiques', 'Automatic loads')}
            hint={L('Après chaque séance : charge augmentée quand toutes les séries touchent le haut de la fourchette, baissée quand elles restent sous le bas. Pendant la séance, les séries suivantes s’ajustent. Tout reste annulable.', 'After each session: the load goes up when every set hits the top of the range, down when they stay below the bottom. During the session, the next sets adjust. Everything can be undone.')}
            checked={state.prefs.autoLoad}
            onChange={(v) => setPrefs({ autoLoad: v })}
          />
        </Card>
        <GymManager />
      </Section>

      <Section title={L('Minuteur de repos', 'Rest timer')}>
        <Card className="divide-y divide-line">
          <Toggle label={L('Son de fin de repos', 'End-of-rest sound')} hint={L('Trois tons courts, par-dessus ta musique', 'Three short tones, over your music')} checked={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
          <Toggle label={L('Garder l’écran allumé', 'Keep the screen on')} hint={L('Pendant la séance, pour voir le minuteur', 'During the session, to see the timer')} checked={state.prefs.wakeLock} onChange={(v) => setPrefs({ wakeLock: v })} />
          <PushRow />
          {!state.prefs.push && (
            <Row
              label={L('Alerte dans l’app', 'In-app alert')}
              hint={perm === 'granted' ? L('Activée : quand l’app est ouverte', 'On: while the app is open') : perm === 'denied' ? L('Refusée dans les réglages iOS', 'Denied in iOS Settings') : perm === 'unsupported' ? (isIOS() && !isStandalone() ? L('Installe d’abord l’app sur l’écran d’accueil', 'Install the app on your Home Screen first') : L('Non disponible', 'Not available')) : L('Alerte système quand le repos se termine, app ouverte', 'System alert when rest ends, app open')}
              right={perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' ? <Button size="sm" variant="ink" onClick={async () => { const p = await requestNotifications(); setPerm(p); setPrefs({ notifications: p === 'granted' }) }}>{L('Activer', 'Turn on')}</Button> : undefined}
            />
          )}
        </Card>
      </Section>

      <Section title={L('Apparence', 'Appearance')}>
        <Segmented label={L('Langue', 'Language')} value={state.prefs.lang ?? 'auto'} onChange={(v) => setPrefs({ lang: v })} options={[{ value: 'auto', label: L('Auto (téléphone)', 'Auto (phone)') }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
        <div className="mt-3" />
        <Segmented label={L('Thème', 'Theme')} value={state.prefs.theme} onChange={(t) => setPrefs({ theme: t })} options={[{ value: 'auto', label: L('Automatique', 'Automatic') }, { value: 'dark', label: L('Sombre', 'Dark') }, { value: 'light', label: L('Clair', 'Light') }]} />
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label={L('Couleur d’accent', 'Accent color')}>
          {([['blue', L('Bleu', 'Blue'), '#3068f5'], ['orange', 'Orange', '#ff7b00']] as const).map(([v, label, color]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={state.prefs.accent === v}
              onClick={() => setPrefs({ accent: v })}
              className={cx('pressable inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border text-[14px] font-semibold', state.prefs.accent === v ? 'border-text' : 'border-line-strong text-text-2')}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: color }} aria-hidden />
              {label}
              {state.prefs.accent === v && <Check size={15} aria-hidden />}
            </button>
          ))}
        </div>
      </Section>

      <Section title={L('Installer sur le téléphone', 'Install on your phone')}>
        <Card className="p-4">
          {isStandalone() ? (
            <p className="text-[14px] text-text-2">{L('Lift est installée : elle fonctionne hors ligne.', 'Lift is installed: it works offline.')}</p>
          ) : (
            <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
              <li><span className="font-semibold text-text">iPhone</span> · {L('dans Safari, touche Partager, puis « Sur l’écran d’accueil ».', 'in Safari, tap Share, then “Add to Home Screen”.')}</li>
              <li><span className="font-semibold text-text">Android</span> · {L('dans Chrome, menu ⋮, puis « Installer l’application ».', 'in Chrome, open the ⋮ menu, then “Install app”.')}</li>
              <li>{L('Lance ensuite Lift depuis l’icône : plein écran, hors ligne, notifications possibles.', 'Then open Lift from the icon: full screen, offline, notifications available.')}</li>
            </ol>
          )}
        </Card>
      </Section>
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
      {setupOpen && <SetupSheet onClose={() => setSetupOpen(false)} />}
    </Screen>
  )
}

/** End-of-rest notifications through the push server (the only way to be alerted phone locked). */
function PushRow() {
  const on = useStore((s) => s.state.prefs.push)
  const { setPrefs, notify } = useStore.getState()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void preparePush()
  }, [])
  const installed = isStandalone()
  const supported = pushSupported()
  const active = on && pushReady()
  if (!supported || (isIOS() && !installed)) {
    return (
      <Row
        label={L('Notifications écran verrouillé', 'Lock screen notifications')}
        hint={isIOS() && !installed ? L('Installe d’abord Lift sur l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-la depuis l’icône.', 'Install Lift on your Home Screen first (Share → Add to Home Screen), then open it from the icon.') : L('Non disponibles sur ce navigateur.', 'Not available in this browser.')}
      />
    )
  }
  const toggle = async (v: boolean) => {
    if (!v) {
      setPrefs({ push: false })
      await disablePush()
      return
    }
    setBusy(true)
    try {
      const r = await enablePush()
      if (r === 'on') {
        setPrefs({ push: true })
        notify(L('Activées. Touche « Tester » puis verrouille le téléphone.', 'On. Tap “Test”, then lock your phone.'), 'good')
      } else if (r === 'denied') {
        notify(L('Notifications refusées : Réglages iOS → Notifications → Lift.', 'Notifications denied: iOS Settings → Notifications → Lift.'), 'bad')
      } else {
        notify(L('Notifications non disponibles ici.', 'Notifications not available here.'), 'bad')
      }
    } catch (e) {
      notify((e as Error).message || L('Activation impossible.', 'Couldn’t turn them on.'), 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Toggle
        label={L('Notifications écran verrouillé', 'Lock screen notifications')}
        hint={active ? L('Fin de repos envoyée par le serveur Lift, même app fermée.', 'End of rest sent by the Lift server, even with the app closed.') : L('La fin du repos arrive même téléphone verrouillé ou app en arrière-plan.', 'The end of rest reaches you even with the phone locked or the app in the background.')}
        checked={active || busy}
        onChange={(v) => void toggle(v)}
      />
      {active && (
        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <p className="text-[12px] leading-[1.4] text-muted">{L('Aucun compte : le serveur garde l’abonnement une heure au plus, le temps d’un repos.', 'No account: the server keeps the subscription for an hour at most, just long enough for one rest.')}</p>
          <Button size="sm" variant="soft" onClick={() => { if (testPush(8)) notify(L('Verrouille ton téléphone : notification dans 8 s.', 'Lock your phone: notification in 8 s.')) }}>{L('Tester', 'Test')}</Button>
        </div>
      )}
    </div>
  )
}

/** Gyms: machine loads and history are kept per gym. */
function GymManager() {
  const gyms = useStore((s) => s.state.gyms)
  const current = useStore((s) => s.state.gymId)
  const { renameGym, removeGym, addGym, selectGym } = useStore.getState()
  const [edit, setEdit] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState('')
  return (
    <div className="mt-3">
      <Card className="divide-y divide-line">
        {gyms.map((g) => (
          <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
            <MapPin size={17} className={cx('shrink-0', g.id === current ? 'text-signal-text' : 'text-muted')} aria-hidden />
            {edit === g.id ? (
              <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); renameGym(g.id, name); setEdit(null) }}>
                <input data-autofocus className={cx(inputClass, 'h-10')} value={name} onChange={(e) => setName(e.target.value)} aria-label={L('Nom de la salle', 'Gym name')} />
                <Button type="submit" size="sm" variant="ink">OK</Button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => selectGym(g.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px]">{g.name}</span>
                  <span className="block text-[12px] text-muted">{g.id === current ? L('Prochaine séance ici', 'Next session here') : g.id === HOME_GYM ? L('Salle principale', 'Main gym') : L('Toucher pour la choisir', 'Tap to choose it')}</span>
                </button>
                <button type="button" onClick={() => { setEdit(g.id); setName(g.name) }} aria-label={L(`Renommer ${g.name}`, `Rename ${g.name}`)} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:text-text"><Pencil size={15} aria-hidden /></button>
                {g.id !== HOME_GYM && (
                  <button type="button" onClick={() => removeGym(g.id)} aria-label={L(`Supprimer ${g.name}`, `Delete ${g.name}`)} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:text-bad"><Trash size={15} aria-hidden /></button>
                )}
              </>
            )}
          </div>
        ))}
      </Card>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { addGym(adding); setAdding('') } }}>
        <input className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={L('Ajouter une salle', 'Add a gym')} aria-label={L('Nom de la nouvelle salle', 'New gym name')} />
        <Button type="submit" variant="ink" size="lg" disabled={!adding.trim()}>{L('Ajouter', 'Add')}</Button>
      </form>
      <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Machines, poulies et Smith : charges et historique propres à chaque salle. Haltères, barres, poids du corps : communs.', 'Machines, cables and Smith machine: loads and history are specific to each gym. Dumbbells, barbells, bodyweight: shared.')}</p>
    </div>
  )
}

function GoalInput({ value, onChange, placeholder }: { value: number | null; onChange: (n: number | null) => void; placeholder?: string }) {
  const [t, setT] = useState(value === null ? '' : L(String(value).replace('.', ','), String(value)))
  return <input className={inputClass} inputMode="decimal" value={t} placeholder={placeholder} onChange={(e) => { setT(e.target.value); onChange(parseNumber(e.target.value)) }} />
}

// ───────────────────────── Données ─────────────────────────

export function DataScreen() {
  const state = useStore((s) => s.state)
  const photos = useStore((s) => s.photos)
  const { exportBackup, importBackup, resetAll } = useStore.getState()
  const file = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [upgrade, setUpgrade] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reset, setReset] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setParsed(parseBackup(await f.text()))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const doExport = () => {
    const b = exportBackup()
    void saveFile(`lift-${todayISO()}.json`, JSON.stringify(b), 'application/json')
  }
  return (
    <Screen>
      <Header backTo="plus" title={L('Sauvegarde', 'Backup')} sub={L('Tes données vivent sur ce téléphone (IndexedDB). Exporte régulièrement : le fichier contient séances, mesures, nutrition et photos.', 'Your data lives on this phone (IndexedDB). Export regularly: the file contains sessions, measurements, nutrition and photos.')} />
      <Card className="divide-y divide-line">
        <Row label={L('Séances', 'Sessions')} value={<span className="tnum">{state.workouts.length}</span>} />
        <Row label={L('Mesures', 'Measurements')} value={<span className="tnum">{state.bodyEntries.length}</span>} />
        <Row label="Photos" value={<span className="tnum">{photos.length}</span>} />
        <Row label={L('Dernier export', 'Last export')} value={state.meta.lastBackupAt ? fmtRelativeDay(state.meta.lastBackupAt.slice(0, 10)) : L('jamais', 'never')} />
      </Card>
      <div className="mt-4 grid gap-2">
        <Button variant="primary" size="lg" full icon={<Download size={18} aria-hidden />} onClick={doExport}>{L('Exporter la sauvegarde', 'Export backup')}</Button>
        <Button variant="outline" size="lg" full icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>{L('Importer une sauvegarde', 'Import a backup')}</Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">{L('Compatible avec les sauvegardes de ton ancien Golgoth Tracker (même format).', 'Compatible with backups from your old Golgoth Tracker (same format).')}</p>

      <Section title={L('Zone sensible', 'Danger zone')}>
        <Button variant="danger" full onClick={() => setReset(true)}>{L('Tout effacer sur cet appareil', 'Erase everything on this device')}</Button>
      </Section>

      <ImportSheet parsed={parsed} upgrade={upgrade} setUpgrade={setUpgrade} onClose={() => setParsed(null)} onConfirm={async () => { await importBackup(parsed!, { upgrade }); setParsed(null); navigate('') }} />
      <Sheet open={reset} onClose={() => setReset(false)} title={L('Tout effacer ?', 'Erase everything?')} footer={<div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1" onClick={() => setReset(false)}>{L('Annuler', 'Cancel')}</Button><Button variant="danger" size="lg" className="flex-1" onClick={async () => { await resetAll(); navigate('') }}>{L('Effacer', 'Erase')}</Button></div>}>
        <p className="text-[15px] leading-[1.5] text-text-2">{L('Séances, mesures, photos et réglages seront supprimés de cet appareil. Exporte une sauvegarde avant si tu veux les garder.', 'Sessions, measurements, photos and settings will be deleted from this device. Export a backup first if you want to keep them.')}</p>
      </Sheet>
    </Screen>
  )
}

export function ImportSheet({ parsed, upgrade, setUpgrade, onClose, onConfirm }: { parsed: ParsedBackup | null; upgrade: boolean; setUpgrade: (v: boolean) => void; onClose: () => void; onConfirm: () => void }) {
  if (!parsed) return null
  const s = parsed.summary
  return (
    <Sheet open onClose={onClose} title={L('Importer cette sauvegarde', 'Import this backup')} footer={<Button variant="primary" size="lg" full onClick={onConfirm}>{L('Importer', 'Import')}</Button>}>
      <Card className="divide-y divide-line">
        <Row label={L('Séances', 'Sessions')} value={<span className="tnum">{s.workouts}</span>} />
        <Row label={L('Mesures', 'Measurements')} value={<span className="tnum">{s.bodyEntries}</span>} />
        <Row label={L('Jours de nutrition', 'Nutrition days')} value={<span className="tnum">{s.nutritionDays}</span>} />
        <Row label="Photos" value={<span className="tnum">{s.photos}</span>} />
        {s.exportedAt && <Row label={L('Exportée', 'Exported')} value={fmtDate(s.exportedAt.slice(0, 10), { year: true })} />}
      </Card>
      {parsed.legacy && (
        <Card className="mt-4">
          <Toggle
            checked={upgrade}
            onChange={setUpgrade}
            label={L('Passer au programme fondé sur la recherche', 'Switch to the research-based program')}
            hint={L('Recommandé. Tes charges sont reprises ; l’historique reste intact ; l’ancien programme est archivé.', 'Recommended. Your loads carry over; your history stays intact; the old program is archived.')}
          />
        </Card>
      )}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">{L('L’import remplace les données actuelles de cet appareil.', 'Importing replaces the current data on this device.')}</p>
    </Sheet>
  )
}

