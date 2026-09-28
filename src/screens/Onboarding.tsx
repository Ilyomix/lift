import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, TriangleAlert, Upload } from 'lucide-react'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { addDays, capitalize, dayLetter, dayName, fmtDate, shiftMonths, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { L, lang, setLang, type Lang } from '../lib/i18n'
import { onboardingPreview, type OnboardingAnswers } from '../lib/onboarding'
import { defaultGoalFor, isValidGoal, MIN_PLAN_WEEKS, programStartFor, ROTATION, TYPE_META } from '../lib/program'
import { SOURCES } from '../lib/research'
import { useStore } from '../lib/store'
import type { Look, TrainingSetup } from '../lib/types'
import { LOOKS, reachesLook } from '../lib/visual'
import { PlanModePicker } from '../components/PlanMode'
import { setupLabel, SetupPicker } from '../components/Setup'
import { Button, Card, cx, DateInput, Field, inputClass, Sheet, Tag } from '../components/ui'
import { ImportSheet } from './More'

/** The app icon: a weight-plate dial with the progress arc in the accent colour. */
export function Dial({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="golgoth-dial-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0D162A" />
          <stop offset="1" stopColor="#050810" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#golgoth-dial-bg)" />
      <path d="M46.874 41.028A17.4 17.4 0 1 1 31.618 14.604" fill="none" stroke="#E8EEFB" strokeWidth="6.2" />
      <path d="M32.382 14.604A17.4 17.4 0 0 1 47.256 40.367" fill="none" stroke="var(--accent-bright, #3D7BFF)" strokeWidth="6.2" />
      <circle cx="32" cy="32" r="3.3" fill="#E8EEFB" />
    </svg>
  )
}

const STEPS = 5
const endOfMonth = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
}

interface Draft {
  setup: TrainingSetup
  days: number[]
  sex: 'm' | 'f'
  age: string
  height: string
  weight: string
  waist: string
  look: Look
  goalDate: string
  /** Maintenance mode: no goal date, no look. */
  maintenance: boolean
}

const inRange = (v: number | null, min: number, max: number): v is number => v !== null && v >= min && v <= max

/** First run: welcome, where and when you train, your body, your goal, then the plan it gives. */
export function Onboarding() {
  const [language, setLanguage] = useState<Lang>(lang())
  const [step, setStep] = useState(0)
  const today = todayISO()
  const start = programStartFor(today)
  const [d, setD] = useState<Draft>(() => ({
    setup: { place: 'gym', equipment: [] },
    days: [1, 2, 4, 5, 6],
    sex: 'm',
    age: '',
    height: '',
    weight: '',
    waist: '',
    look: 'sec',
    goalDate: defaultGoalFor(start),
    maintenance: false,
  }))
  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const chooseLang = (l: Lang) => {
    setLang(l)
    setLanguage(l)
  }

  const age = parseNumber(d.age)
  const height = parseNumber(d.height)
  const weight = parseNumber(d.weight)
  const waist = parseNumber(d.waist)
  const bodyOk = inRange(age, 14, 90) && inRange(height, 120, 230) && inRange(weight, 35, 250) && (d.waist.trim() === '' || inRange(waist, 50, 200))
  const answers: OnboardingAnswers | null = bodyOk
    ? { lang: language, setup: d.setup, days: d.days, sex: d.sex, age: age!, heightCm: height!, weight: weight!, waist: d.waist.trim() ? waist : null, look: d.look, goalDate: d.goalDate, maintenance: d.maintenance }
    : null
  const goalOk = d.maintenance || isValidGoal(d.goalDate, start)
  const preview = useMemo(() => (answers && goalOk ? onboardingPreview(answers, today) : null), [JSON.stringify(answers), goalOk, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = step === 1 ? true : step === 2 ? d.days.length >= 2 : step === 3 ? bodyOk : step === 4 ? goalOk && !!preview : true
  const next = () => setStep((s) => Math.min(STEPS, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))
  const finish = () => answers && useStore.getState().completeOnboarding(answers)

  if (step === 0) return <Welcome language={language} onLanguage={chooseLang} onStart={() => setStep(1)} />

  const titles = [
    '',
    L('Où t’entraînes-tu ?', 'Where do you train?'),
    L('Quels jours ?', 'Which days?'),
    L('Toi, aujourd’hui', 'You, today'),
    L('Ton objectif', 'Your goal'),
    L('Ton programme est prêt', 'Your program is ready'),
  ]

  return (
    <main className="screen-in mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 safe-top safe-bottom">
      <div className="flex min-h-11 items-center justify-between gap-3 pt-2">
        <button type="button" onClick={back} className="pressable -ml-2 inline-flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[15px] text-text-2" aria-label={L('Retour', 'Back')}>
          <ArrowLeft size={18} aria-hidden />
          {L('Retour', 'Back')}
        </button>
        <span className="text-[13px] font-medium text-muted tnum">{L(`Étape ${step} sur ${STEPS}`, `Step ${step} of ${STEPS}`)}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-signal transition-[width] duration-300" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>
      <h1 className="mt-6 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em]">{titles[step]}</h1>

      <div className="flex-1 py-5">
        {step === 1 && <SetupPicker value={d.setup} onChange={(setup) => patch({ setup })} />}
        {step === 2 && <DaysStep days={d.days} onChange={(days) => patch({ days })} />}
        {step === 3 && <BodyStep d={d} patch={patch} />}
        {step === 4 && <GoalStep d={d} patch={patch} start={start} preview={preview} />}
        {step === 5 && preview && answers && <Summary answers={answers} preview={preview} />}
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-bg px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        {step < STEPS ? (
          <Button variant="primary" size="lg" full disabled={!canNext} onClick={next}>{L('Continuer', 'Continue')}</Button>
        ) : (
          <Button variant="primary" size="lg" full disabled={!answers || !preview} onClick={finish}>{L('C’est parti', 'Let’s go')}</Button>
        )}
      </div>
    </main>
  )
}

function Welcome({ language, onLanguage, onStart }: { language: Lang; onLanguage: (l: Lang) => void; onStart: () => void }) {
  const { importBackup } = useStore.getState()
  const file = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedBackup | null>(null)
  const [upgrade, setUpgrade] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setParsed(parseBackup(await f.text()))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <main className="screen-in mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 safe-top safe-bottom">
      <div className="flex min-h-11 items-center justify-end pt-2">
        <div className="inline-flex rounded-[10px] border border-line-strong p-1" role="radiogroup" aria-label={L('Langue', 'Language')}>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={language === l}
              onClick={() => onLanguage(l)}
              className={cx('pressable h-8 rounded-[7px] px-3 text-[13px] font-semibold', language === l ? 'bg-text text-bg' : 'text-text-2')}
            >
              {l === 'fr' ? 'Français' : 'English'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center py-8">
        <Dial />
        <h1 className="mt-8 text-[44px] leading-[1] font-semibold tracking-[-0.035em]">Lift</h1>
        <p className="mt-3 max-w-[440px] text-[18px] leading-[1.4] text-text-2">
          {L('Ton programme d’hypertrophie fondé sur la recherche, calé sur ta date objectif ou en entretien, sans date.', 'Your research-based hypertrophy program, built around your goal date or in maintenance mode, with no end date.')}
        </p>
        <ul className="mt-8 space-y-3 text-[15px] leading-[1.45]">
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">01</span>{L('Séances guidées, en salle ou à la maison : séries, RIR, minuteur de repos, charges qui progressent.', 'Guided sessions, at the gym or at home: sets, RIR, rest timer, loads that progress.')}</li>
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">02</span>{L('Un plan jusqu’à ta date, ou sans fin en entretien : blocs, décharges, sèche et reprises après pause.', 'A plan up to your date, or open-ended in maintenance: blocks, deloads, cut and returns after a break.')}</li>
          <li className="flex gap-3"><span className="font-semibold text-signal-text tnum">03</span>{L('Poids moyen sur 7 jours, taux de gras, 1RM estimé, séries par muscle.', '7-day average weight, body fat, estimated 1RM, sets per muscle.')}</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-2">
          {ROTATION.map((t) => <Tag key={t} tone="outline">{TYPE_META[t].label}</Tag>)}
        </div>
      </div>
      <div className="pb-6">
        <Button variant="primary" size="lg" full onClick={onStart}>{L('Commencer', 'Get started')}</Button>
        <Button variant="ghost" size="lg" full className="mt-2" icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>
          {L('J’ai une sauvegarde', 'I have a backup')}
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        {error && <p className="mt-3 text-center text-[13px] text-bad">{error}</p>}
        <p className="mt-4 text-center text-[12px] leading-[1.5] text-muted">
          {L(`${Object.keys(SOURCES).length} publications citées · données stockées sur ce téléphone uniquement`, `${Object.keys(SOURCES).length} studies cited · data stored on this phone only`)}
        </p>
      </div>
      <ImportSheet parsed={parsed} upgrade={upgrade} setUpgrade={setUpgrade} onClose={() => setParsed(null)} onConfirm={() => void importBackup(parsed!, { upgrade })} />
    </main>
  )
}

function DaysStep({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const toggle = (day: number) => {
    const nextDays = days.includes(day) ? days.filter((x) => x !== day) : [...days, day]
    if (nextDays.length >= 1) onChange(nextDays)
  }
  const n = days.length
  const perMuscle = (n * 2) / 5
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={L('Jours d’entraînement', 'Training days')}>
        {[1, 2, 3, 4, 5, 6, 0].map((day) => {
          const on = days.includes(day)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              aria-label={dayName(day)}
              onClick={() => toggle(day)}
              className={cx('pressable h-12 rounded-[10px] border text-[15px] font-semibold', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2')}
            >
              {dayLetter(day)}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-[15px] leading-[1.5]">
        {plural(n, L('séance', 'session'), L('séances', 'sessions'))} {L('par semaine', 'per week')}
        {n >= 2 && <span className="text-text-2"> · {L(`chaque muscle ≈ ${fmtNum(perMuscle, 1)} fois par semaine`, `each muscle ≈ ${fmtNum(perMuscle, 1)}× a week`)}</span>}
      </p>
      <p className="mt-2 text-[13px] leading-[1.5] text-text-2">
        {n < 2
          ? L('Choisis au moins 2 jours.', 'Pick at least 2 days.')
          : L(
              'Le programme tourne sur 5 séances (Upper, Lower, Push, Pull, Legs). Avec 5 jours, chaque muscle travaille 2 fois par semaine ; avec moins, la rotation s’étale. Une séance manquée décale la rotation, elle n’est jamais sautée.',
              'The program rotates 5 sessions (Upper, Lower, Push, Pull, Legs). With 5 days, each muscle works twice a week; with fewer, the rotation spreads out. A missed session shifts the rotation, it is never skipped.',
            )}
      </p>
    </div>
  )
}

function BodyStep({ d, patch }: { d: Draft; patch: (p: Partial<Draft>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Sexe', 'Sex')}</p>
        <div className="grid h-12 grid-cols-2 gap-1 rounded-[10px] border border-line-strong p-1" role="radiogroup" aria-label={L('Sexe', 'Sex')}>
          {([['m', L('Homme', 'Male')], ['f', L('Femme', 'Female')]] as const).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={d.sex === v} onClick={() => patch({ sex: v })} className={cx('pressable rounded-[7px] text-[14px] font-semibold', d.sex === v ? 'bg-text text-bg' : 'text-text-2')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field label={L('Âge', 'Age')}><input className={inputClass} inputMode="numeric" value={d.age} onChange={(e) => patch({ age: e.target.value })} placeholder="30" /></Field>
      <Field label={L('Taille (cm)', 'Height (cm)')}><input className={inputClass} inputMode="numeric" value={d.height} onChange={(e) => patch({ height: e.target.value })} placeholder="178" /></Field>
      <Field label={L('Poids ce matin (kg)', 'Weight this morning (kg)')} className="col-span-2">
        <input className={inputClass} inputMode="decimal" value={d.weight} onChange={(e) => patch({ weight: e.target.value })} placeholder={L('78,5', '78.5')} />
      </Field>
      <Field
        label={L('Tour de taille (cm), facultatif', 'Waist (cm), optional')}
        hint={L('Au nombril, à jeun. Il estime ton taux de gras bien mieux que l’IMC.', 'At the navel, before eating. It estimates your body fat far better than BMI.')}
        className="col-span-2"
      >
        <input className={inputClass} inputMode="decimal" value={d.waist} onChange={(e) => patch({ waist: e.target.value })} placeholder="—" />
      </Field>
      <p className="col-span-2 text-[12px] leading-[1.45] text-muted">
        {L('Tes données restent sur ce téléphone. Elles servent à estimer ton taux de gras, ton poids cible et tes calories de départ.', 'Your data stays on this phone. It is used to estimate your body fat, target weight and starting calories.')}
      </p>
    </div>
  )
}

function GoalStep({ d, patch, start, preview }: { d: Draft; patch: (p: Partial<Draft>) => void; start: string; preview: ReturnType<typeof onboardingPreview> | null }) {
  const min = addDays(start, MIN_PLAN_WEEKS * 7)
  const max = addDays(start, 5 * 365)
  const chips = [3, 6, 9, 12].map((m) => ({ label: L(`${m} mois`, `${m} months`), date: endOfMonth(shiftMonths(start, m)) }))
  const plan = preview?.plan
  const bodyFat = preview && (
    <Line
      label={L('Taux de gras estimé', 'Estimated body fat')}
      value={preview.bodyFat ? `≈${fmtNum(preview.bodyFat.pct, 0)}${L(' %', '%')}` : '—'}
      hint={preview.bodyFat?.source === 'imc' ? L('Avec ton IMC : ± 4 points. Mesure ton tour de taille pour mieux faire.', 'From your BMI: ± 4 points. Measure your waist to do better.') : L('Avec ton tour de taille (formule RFM)', 'From your waist (RFM formula)')}
    />
  )
  const mode = <PlanModePicker value={d.maintenance ? 'maintenance' : 'goal'} onChange={(m) => patch({ maintenance: m === 'maintenance' })} />
  if (d.maintenance) {
    return (
      <div>
        {mode}
        {preview && (
          <Card className="mt-5 divide-y divide-line">
            {bodyFat}
            <Line label="Calories" value={`${fmtNum(preview.calories, 0)} kcal`} hint={L('Maintenance estimée : poids stable, ajustée ensuite sur ta moyenne 7 jours', 'Estimated maintenance: stable weight, then adjusted to your 7-day average')} />
            <Line
              label={L('Rythme', 'Rhythm')}
              value={L('5 sem. + décharge', '5 wk + deload')}
              hint={L('Les blocs se suivent sans date de fin, fêtes de fin d’année à volume réduit. Pas de sèche.', 'Blocks follow one another with no end date, year-end holidays at reduced volume. No cut.')}
            />
          </Card>
        )}
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
          {L('Pour garder ton physique et continuer à progresser. Tu pourras fixer une date objectif plus tard dans Réglages : le plan passera en recomposition puis en sèche.', 'To keep your physique and keep progressing. You can set a goal date later in Settings: the plan then switches to recomposition, then a cut.')}
        </p>
      </div>
    )
  }
  return (
    <div>
      {mode}
      <p className="mt-5 mb-2 text-[13px] font-medium text-text-2">{L('Look visé', 'Target look')}</p>
      <div className="grid gap-2" role="radiogroup" aria-label={L('Look visé', 'Target look')}>
        {LOOKS.map((l) => {
          const on = l.id === d.look
          const r = l.range[d.sex]
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => patch({ look: l.id })}
              className={cx('pressable card flex items-center gap-3 px-4 py-3 text-left', on ? 'border-signal shadow-[0_0_0_1px_var(--signal)]' : 'hover:border-line-strong')}
            >
              <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong')}>
                {on && <Check size={12} strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{l.label}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-text-2 tnum">{r[0]}–{r[1]}{L(' % de gras', '% fat')}</span>
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.4] text-text-2">{l.text}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <DateInput label={L('Date objectif', 'Goal date')} value={d.goalDate} min={min} max={max} onChange={(goalDate) => patch({ goalDate })} />
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5" role="group" aria-label={L('Durée', 'Duration')}>
          {chips.map((c) => (
            <button
              key={c.date}
              type="button"
              onClick={() => patch({ goalDate: c.date })}
              className={cx('pressable inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] whitespace-nowrap', d.goalDate === c.date ? 'border-signal bg-signal-soft' : 'border-line-strong')}
            >
              <span className="font-semibold">{c.label}</span>
              <span className="text-muted tnum">{fmtDate(c.date)}</span>
            </button>
          ))}
        </div>
      </div>

      {preview && (
        <Card className="mt-5 divide-y divide-line">
          {bodyFat}
          {plan && preview.shape && (
            <>
              <Line label={L(`Poids cible · ${plan.look.label}`, `Target weight · ${plan.look.label}`)} value={`${fmtNum(plan.target[0], 1)}–${fmtNum(plan.target[1], 1)} kg`} />
              <Line
                label={L('Sèche', 'Cut')}
                value={plan.cutWeeks === 0 ? L('Aucune', 'None') : plural(preview.shape.cutWeeks, L('semaine', 'week'), L('semaines', 'weeks'))}
                hint={plan.cutWeeks === 0 ? L('Tu es déjà dans la fourchette : recomposition jusqu’à la date.', 'You’re already in range: recomposition up to the date.') : preview.shape.recompWeeks > 0 ? L(`Après ${plural(preview.shape.recompWeeks, 'semaine', 'semaines')} de recomposition`, `After ${plural(preview.shape.recompWeeks, 'week', 'weeks')} of recomposition`) : L('Dès le début', 'From the start')}
              />
              <Line
                label={L(`Au ${fmtDate(d.goalDate, { long: true })}`, `By ${fmtDate(d.goalDate, { long: true })}`)}
                value={`${fmtNum(plan.atGoal.prudent.weight, 1)} → ${fmtNum(plan.atGoal.fast.weight, 1)} kg`}
                hint={L('Rythme prudent → rythme soutenu', 'Cautious pace → brisk pace')}
              />
            </>
          )}
        </Card>
      )}
      {plan && !plan.fits && (
        <div className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <div>
            {plan.suggestedGoal
              ? L(`Trop court pour ce look sans perdre de muscle. Il faudrait aller jusqu’au ${fmtDate(plan.suggestedGoal, { long: true, year: true })}.`, `Too short for this look without losing muscle. You would need until ${fmtDate(plan.suggestedGoal, { long: true, year: true })}.`)
              : L('Trop loin pour un seul plan : choisis un look moins sec.', 'Too far for a single plan: pick a less lean look.')}
            {plan.suggestedGoal && (
              <Button size="sm" variant="soft" className="mt-2" onClick={() => patch({ goalDate: plan.suggestedGoal! })}>
                {L(`Viser le ${fmtDate(plan.suggestedGoal, { long: true, year: true })}`, `Aim for ${fmtDate(plan.suggestedGoal, { long: true, year: true })}`)}
              </Button>
            )}
          </div>
        </div>
      )}
      {plan?.fits && !reachesLook(plan.atGoal.prudent.look, d.look) && (
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
          {L('Tenable en tenant le rythme soutenu de la sèche (−0,7 %/semaine) : les calories s’ajustent sur ta courbe de poids.', 'Doable if you hold the brisk cutting pace (−0.7%/week): calories adjust to your weight curve.')}
        </p>
      )}
    </div>
  )
}

function Summary({ answers, preview }: { answers: OnboardingAnswers; preview: NonNullable<ReturnType<typeof onboardingPreview>> }) {
  const plan = preview.plan
  const firstType = TYPE_META.UPPER
  return (
    <div>
      <Card className="divide-y divide-line">
        <Line label={L('Lieu', 'Place')} value={setupLabel(answers.setup)} />
        <Line
          label={L('Séances', 'Sessions')}
          value={`${answers.days.length}/${L('sem.', 'wk')}`}
          hint={[1, 2, 3, 4, 5, 6, 0].filter((x) => answers.days.includes(x)).map((x) => dayName(x, true)).join(' · ')}
        />
        <Line
          label={L('Première séance', 'First session')}
          value={capitalize(fmtDate(preview.firstSession, { weekday: true }))}
          hint={`${firstType.label} · ${L('semaine 1 à 3 répétitions de l’échec', 'week 1 at 3 reps from failure')}`}
        />
        {answers.maintenance ? (
          <>
            <Line label={L('Objectif', 'Goal')} value={L('Entretien', 'Maintenance')} hint={L('Sans date : blocs de 5 semaines + décharge, en continu', 'No end date: 5-week blocks + deload, ongoing')} />
            <Line label={L('Séances du bloc 1', 'Sessions in block 1')} value={String(preview.sessions)} hint={L(`Jusqu’au ${fmtDate(preview.until, { long: true })}, puis une semaine de décharge`, `Until ${fmtDate(preview.until, { long: true })}, then a deload week`)} />
          </>
        ) : (
          <>
            <Line label={L('Objectif', 'Goal')} value={plan ? plan.look.label : '—'} hint={fmtDate(answers.goalDate, { long: true, year: true })} />
            {plan && <Line label={L('Poids cible', 'Target weight')} value={`${fmtNum(plan.target[0], 1)}–${fmtNum(plan.target[1], 1)} kg`} />}
            <Line label={L('Séances d’ici là', 'Sessions until then')} value={String(preview.sessions)} />
          </>
        )}
        <Line
          label={L('Calories de départ', 'Starting calories')}
          value={`${fmtNum(preview.calories, 0)} kcal`}
          hint={answers.maintenance ? L('Maintenance estimée (Mifflin–St Jeor), ajustée ensuite sur ta moyenne de poids 7 jours', 'Estimated maintenance (Mifflin–St Jeor), then adjusted to your 7-day average weight') : L('Estimation (Mifflin–St Jeor) ajustée ensuite sur ta moyenne de poids 7 jours', 'Estimate (Mifflin–St Jeor), then adjusted to your 7-day average weight')}
        />
        <Line label={L('Protéines', 'Protein')} value={`${fmtNum(Math.round((1.95 * answers.weight) / 5) * 5, 0)}–${fmtNum(Math.round((2.05 * answers.weight) / 5) * 5, 0)} g`} hint={L('≈ 2 g par kg de poids', '≈ 2 g per kg of body weight')} />
      </Card>
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {L('Tout se modifie ensuite dans Plus → Réglages : lieu, jours, date objectif ou entretien, objectif visuel.', 'You can change everything later in More → Settings: place, days, goal date or maintenance, visual goal.')}
      </p>
    </div>
  )
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-[1.4] text-muted">{hint}</span>}
      </span>
      <span className="shrink-0 text-right text-[14px] font-semibold tnum">{value}</span>
    </div>
  )
}

/** After an import: what changed in the program, and today's weight to anchor the goal. */
export function ImportResultSheet() {
  const lastImport = useStore((s) => s.lastImport)
  const lastWeigh = useStore((s) => s.state.bodyEntries.filter((b) => b.weight !== null).at(-1))
  const saveBody = useStore((s) => s.saveBody)
  const [w, setW] = useState('')
  if (!lastImport) return null
  const close = () => useStore.setState({ lastImport: null })
  const added = lastImport.changes.filter((c) => c.kind === 'added')
  const removed = lastImport.changes.filter((c) => c.kind === 'removed')
  const stale = !lastWeigh || lastWeigh.date < todayISO()
  return (
    <Sheet
      open
      onClose={close}
      title={L('Import terminé', 'Import complete')}
      footer={
        <Button variant="primary" size="lg" full onClick={() => {
          const n = parseNumber(w)
          if (n) saveBody({ date: todayISO(), weight: n, waist: null, arm: null, chest: null, shoulders: null })
          close()
        }}>
          {L('Continuer', 'Continue')}
        </Button>
      }
    >
      {lastImport.changes.length > 0 ? (
        <>
          <p className="text-[15px] leading-[1.5] text-text-2">
            {L('Ton historique est intact et tes charges sont reprises. Le programme passe au split fondé sur la recherche.', 'Your history is intact and your loads carry over. The program switches to the research-based split.')}
          </p>
          <Card className="mt-4 divide-y divide-line">
            {ROTATION.map((t) => {
              const a = added.filter((c) => c.type === t)
              const r = removed.filter((c) => c.type === t)
              if (!a.length && !r.length) return null
              return (
                <div key={t} className="px-4 py-3 text-[13px] leading-[1.5]">
                  <p className="text-[14px] font-semibold">{TYPE_META[t].label}</p>
                  {a.length > 0 && <p className="text-good">+ {a.map((c) => c.name).join(', ')}</p>}
                  {r.length > 0 && <p className="text-muted line-through">{r.map((c) => c.name).join(', ')}</p>}
                </div>
              )
            })}
          </Card>
        </>
      ) : (
        <p className="text-[15px] text-text-2">{L('Données importées.', 'Data imported.')}</p>
      )}
      {stale && (
        <Field label={L('Ton poids ce matin (kg)', 'Your weight this morning (kg)')} hint={L('Il ancre la trajectoire et la cible du plan.', 'It anchors the plan’s path and target.')} className="mt-5">
          <input data-autofocus className={inputClass} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={lastWeigh?.weight ? fmtNum(lastWeigh.weight, 1) : '—'} />
        </Field>
      )}
    </Sheet>
  )
}

