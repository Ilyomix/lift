import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, TriangleAlert, Upload } from 'lucide-react'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { addDays, capitalize, dayLetter, dayName, fmtDate, shiftMonths, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { L, lang, setLang, type Lang } from '../lib/i18n'
import { onboardingPreview, onboardingSession, type OnboardingAnswers } from '../lib/onboarding'
import { defaultGoalFor, isValidGoal, MIN_PLAN_WEEKS, PLAN_DAYS, planSets, programStartFor, ROTATION, sharePhrase, TYPE_META, weekShape } from '../lib/program'
import { studyCount } from '../lib/research'
import { useStore } from '../lib/store'
import { navigate } from '../lib/router'
import type { Look, TrainingSetup, Zone } from '../lib/types'
import { DEFAULT_ZONES, LOOKS, MAX_ZONES, reachesLook, zonesText } from '../lib/visual'
import { ZonePicker } from '../components/ZonePicker'
import { setupLabel, SetupPicker } from '../components/Setup'
import { Button, Card, Disclosure, cx, DateInput, Field, inputClass, Segmented, Sheet } from '../components/ui'
import { ImportSheet } from './More'
import { SportArt } from '../components/SportArt'

/** The same official artwork used by the launcher and Live Activity. */
export function AppIcon({ size = 64, className }: { size?: number; className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}icons/pwa-192.png`} alt="" aria-hidden width={size} height={size} className={className} style={{ width: size, height: size, borderRadius: '24%', flexShrink: 0 }} />
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
  /** Priority zones, three at most; none keeps the program's own. */
  zones: Zone[]
  goalDate: string
  /** Maintenance mode: no goal date, no look. */
  maintenance: boolean
}

const inRange = (v: number | null, min: number, max: number): v is number => v !== null && v >= min && v <= max

/** First run: welcome, where and when you train, your body, your goal, then the plan it gives. */
export function Onboarding() {
  const [language, setLanguage] = useState<Lang>(lang())
  const [step, setStep] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!step) return
    window.scrollTo({ top: 0 })
    title.current?.focus({ preventScroll: true })
  }, [step])
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
    zones: [],
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
    ? { lang: language, setup: d.setup, days: d.days, sex: d.sex, age: age!, heightCm: height!, weight: weight!, waist: d.waist.trim() ? waist : null, look: d.look, zones: d.zones, goalDate: d.goalDate, maintenance: d.maintenance }
    : null
  const goalOk = d.maintenance || isValidGoal(d.goalDate, start)
  const preview = useMemo(() => (answers && goalOk ? onboardingPreview(answers, today) : null), [JSON.stringify(answers), goalOk, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = step === 1 ? true : step === 2 ? d.days.length >= 2 : step === 3 ? bodyOk : step === 4 ? goalOk && !!preview : true
  const next = () => setStep((s) => Math.min(STEPS, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))
  const finish = () => {
    if (!answers || !preview) return
    useStore.getState().completeOnboarding(answers)
    navigate('seance')
  }

  if (step === 0) return <Welcome language={language} onLanguage={chooseLang} onStart={() => setStep(1)} />

  const titles = [
    '',
    L('Où t’entraînes-tu ?', 'Where do you train?'),
    L('Quels jours ?', 'Which days?'),
    L('Ton point de départ', 'Your starting point'),
    L('Ton objectif', 'Your goal'),
    L('Ta première séance', 'Your first session'),
  ]

  return (
    <main className="screen-in mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 safe-top safe-bottom">
      <div className="flex min-h-11 items-center justify-between gap-3 pt-2">
        <button type="button" onClick={back} className="pressable -ml-2 inline-flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[15px] text-text-2" aria-label={L('Retour', 'Back')}>
          <ArrowLeft size={18} aria-hidden />
          {L('Retour', 'Back')}
        </button>
        <span className="text-[13px] font-medium text-muted tnum" aria-live="polite">{L(`Étape ${step} sur ${STEPS}`, `Step ${step} of ${STEPS}`)}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full rounded-full bg-signal transition-[width] duration-300" style={{ width: `${(step / STEPS) * 100}%` }} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <SportArt kind={step === 1 ? 'dumbbell' : step === 2 ? 'calendar' : step === 3 ? 'chart' : 'trophy'} size="illustration" />
        <h1 ref={title} tabIndex={-1} className="min-w-0 flex-1 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] outline-none">{titles[step]}</h1>
      </div>

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
          <Button variant="primary" size="lg" full disabled={!answers || !preview} onClick={finish}>{L('Voir ma première séance', 'See my first session')}</Button>
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
  // Studies only: general health guidance is listed with the sources, not counted as one.
  const studies = studyCount()
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
        <div className="flex items-center gap-4">
          <AppIcon />
          <h1 className="text-[44px] leading-[1] font-semibold tracking-[-0.035em]">Lift</h1>
        </div>
        <p className="mt-3 max-w-[440px] text-[18px] leading-[1.4] text-text-2">
          {L('Savoir quoi faire à chaque séance. Voir tes progrès au fil des semaines.', 'Know what to do each session. See your progress week after week.')}
        </p>
        <ul className="mt-8 space-y-3 text-[15px] leading-[1.45]">
          <li className="flex items-center gap-3"><SportArt kind="dumbbell" /><span>{L('Un programme adapté à ton matériel et à tes jours disponibles.', 'A program matched to your equipment and available days.')}</span></li>
          <li className="flex items-center gap-3"><SportArt kind="stopwatch" /><span>{L('Les mouvements en 3D, les séries à noter et le repos guidé.', '3D movements, sets to log and a guided rest timer.')}</span></li>
        </ul>
        <p className="mt-6 text-[13px] leading-[1.5] text-muted">{L('5 étapes pour préparer ta première séance. Tes choix restent modifiables.', '5 steps to prepare your first session. You can change your choices later.')}</p>
      </div>
      <div className="pb-6">
        <Button variant="primary" size="lg" full onClick={onStart}>{L('Préparer mes séances', 'Set up my training')}</Button>
        <Button variant="ghost" size="lg" full className="mt-2" icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>
          {L('J’ai une sauvegarde', 'I have a backup')}
        </Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        {error && <p className="mt-3 text-center text-[13px] text-bad">{error}</p>}
        <p className="mt-4 text-center text-[12px] leading-[1.5] text-muted">
          {L(`${studies} publications citées · données stockées sur cet appareil`, `${studies} studies cited · data stored on this device`)}
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
  // Fewer than five days: sessions take more sets to keep the weekly volume.
  const week = weekShape(planSets(), n, true)
  const pct = Math.round(week.share * 100)
  return (
    <div>
      <p className="mb-4 text-[15px] leading-[1.5] text-text-2">{L('Choisis les jours que tu peux tenir dans la durée. Une séance manquée décale la suite du programme.', 'Choose days you can stick to. A missed session moves the next one along.')}</p>
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
        {n >= 2 && <span className="text-text-2"> · {L(`environ ${week.minutes[0]}–${week.minutes[1]} min par séance`, `about ${week.minutes[0]}–${week.minutes[1]} min per session`)}</span>}
      </p>
      {n < 2 && <p role="status" className="mt-2 text-[13px] text-text-2">{L('Choisis au moins 2 jours pour continuer.', 'Choose at least 2 days to continue.')}</p>}
      {n >= 2 && <Disclosure title={L('Comment les séances s’adaptent', 'How sessions adapt')} className="mt-5" contentClassName="text-[13px] leading-[1.5] text-text-2">
        <p className="mt-2">
              {L(`Chaque muscle travaille environ ${fmtNum(perMuscle, 1)} fois par semaine. `, `Each muscle works about ${fmtNum(perMuscle, 1)} times a week. `)}
              {L('Le programme tourne sur 5 séances (Upper, Lower, Push, Pull, Legs). ', 'The program rotates 5 sessions (Upper, Lower, Push, Pull, Legs). ')}
              {n === PLAN_DAYS
                ? L('Avec 5 jours, chaque muscle travaille 2 fois par semaine. ', 'With 5 days, each muscle works twice a week. ')
                : n > PLAN_DAYS
                  ? L(`Avec ${n} jours, la rotation tourne plus vite : environ ${pct} % du volume prévu, surveille ta récupération. `, `With ${n} days, the rotation turns faster: about ${pct}% of the planned volume, keep an eye on recovery. `)
                  : n >= 3
                    ? L(`Avec ${n} jours, chaque séance prend plus de séries (environ ${week.minutes[0]} à ${week.minutes[1]} min) et la semaine garde ${sharePhrase(week.share)}. Les réglages permettent de revenir à des séances d’une heure, avec moins de volume. `, `With ${n} days, each session takes more sets (about ${week.minutes[0]} to ${week.minutes[1]} min) and the week keeps ${sharePhrase(week.share)}. Settings let you go back to one-hour sessions, with less volume. `)
                    : L(`Avec ${n} jours, chaque séance prend plus de séries (environ ${week.minutes[0]} à ${week.minutes[1]} min), sans dépasser ce qui est utile en une séance : la semaine tient ${sharePhrase(week.share)}. À partir de 3 jours, elle le tient presque en entier. `, `With ${n} days, each session takes more sets (about ${week.minutes[0]} to ${week.minutes[1]} min), without going past what one session can use: the week holds ${sharePhrase(week.share)}. From 3 days, it holds almost all of it. `)}
              {L('Une séance manquée décale la rotation, elle n’est jamais sautée.', 'A missed session shifts the rotation, it is never skipped.')}
        </p>
      </Disclosure>}
    </div>
  )
}

function BodyStep({ d, patch }: { d: Draft; patch: (p: Partial<Draft>) => void }) {
  const error = (value: string, min: number, max: number) => value.trim() !== '' && !inRange(parseNumber(value), min, max)
  return (
    <div className="grid grid-cols-2 gap-3">
      <p className="col-span-2 mb-2 text-[15px] leading-[1.5] text-text-2">{L('Ces informations servent à estimer tes besoins et ton objectif. Elles restent sur cet appareil.', 'These details help estimate your needs and goal. They stay on this device.')}</p>
      <div className="col-span-2">
        <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Sexe', 'Sex')}</p>
        <Segmented label={L('Sexe', 'Sex')} value={d.sex} layout="fit" onChange={(sex) => patch({ sex })} options={[{ value: 'm', label: L('Homme', 'Male') }, { value: 'f', label: L('Femme', 'Female') }]} />
      </div>
      <Field label={L('Âge', 'Age')} hint={error(d.age, 14, 90) ? L('Entre 14 et 90 ans.', 'Between 14 and 90 years.') : undefined}><input className={inputClass} inputMode="numeric" required aria-invalid={error(d.age, 14, 90)} value={d.age} onChange={(e) => patch({ age: e.target.value })} placeholder="30" /></Field>
      <Field label={L('Taille (cm)', 'Height (cm)')} hint={error(d.height, 120, 230) ? L('Entre 120 et 230 cm.', 'Between 120 and 230 cm.') : undefined}><input className={inputClass} inputMode="numeric" required aria-invalid={error(d.height, 120, 230)} value={d.height} onChange={(e) => patch({ height: e.target.value })} placeholder="178" /></Field>
      <Field label={L('Poids actuel (kg)', 'Current weight (kg)')} hint={error(d.weight, 35, 250) ? L('Entre 35 et 250 kg.', 'Between 35 and 250 kg.') : undefined} className="col-span-2">
        <input className={inputClass} inputMode="decimal" required aria-invalid={error(d.weight, 35, 250)} value={d.weight} onChange={(e) => patch({ weight: e.target.value })} placeholder={L('78,5', '78.5')} />
      </Field>
      <Field
        label={L('Tour de taille (cm), facultatif', 'Waist (cm), optional')}
        hint={error(d.waist, 50, 200) ? L('Entre 50 et 200 cm, ou laisse ce champ vide.', 'Between 50 and 200 cm, or leave this blank.') : L('Au nombril, à jeun. Cette mesure affine l’estimation du taux de gras.', 'At the navel, before eating. This helps refine the body-fat estimate.')}
        className="col-span-2"
      >
        <input className={inputClass} inputMode="decimal" aria-invalid={error(d.waist, 50, 200)} value={d.waist} onChange={(e) => patch({ waist: e.target.value })} placeholder="—" />
      </Field>
      <p className="col-span-2 text-[12px] leading-[1.45] text-muted">
        {L('Renseigne ton âge, ta taille et ton poids pour continuer. Le tour de taille peut attendre.', 'Enter your age, height and weight to continue. You can add your waist measurement later.')}
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
  const mode = <div className="grid gap-2" role="radiogroup" aria-label={L('Type de plan', 'Plan type')}>
    {[
      { maintenance: false, title: L('Un objectif à une date', 'A goal by a date'), text: L('Choisir le physique visé et le temps pour y arriver.', 'Choose the physique you want and the time to work towards it.') },
      { maintenance: true, title: L('M’entraîner sans date limite', 'Train without a deadline'), text: L('Continuer à progresser en gardant un poids stable.', 'Keep progressing while maintaining a stable weight.') },
    ].map((option) => <button key={String(option.maintenance)} type="button" role="radio" aria-checked={d.maintenance === option.maintenance} onClick={() => patch({ maintenance: option.maintenance })} className={cx('pressable card flex items-center gap-3 px-4 py-3 text-left', d.maintenance === option.maintenance ? 'border-signal bg-signal-soft' : 'hover:border-line-strong')}>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">{option.title}</span><span className="mt-1 block text-[13px] leading-[1.45] text-text-2">{option.text}</span></span>
      {d.maintenance === option.maintenance && <Check size={18} className="shrink-0 text-signal-text" aria-hidden />}
    </button>)}
  </div>
  if (d.maintenance) {
    return (
      <div>
        {mode}
        <p className="mt-4 text-[15px] leading-[1.5] text-text-2">{L('Ton programme alterne entraînement et semaines plus légères. Tu pourras définir une date objectif plus tard.', 'Your program alternates training with lighter weeks. You can set a goal date later.')}</p>
        {preview && (
          <Disclosure title={L('Voir les estimations et le rythme', 'View estimates and training rhythm')} className="mt-5">
          <Card className="mt-2 divide-y divide-line">
            {bodyFat}
            <Line label="Calories" value={`${fmtNum(preview.calories, 0)} kcal`} hint={L('Maintenance estimée : poids stable, ajustée ensuite sur ta moyenne 7 jours', 'Estimated maintenance: stable weight, then adjusted to your 7-day average')} />
            <Line
              label={L('Rythme', 'Rhythm')}
              value={L('5 sem. + décharge', '5 wk + deload')}
              hint={L('Les blocs se suivent sans date de fin, fêtes de fin d’année à volume réduit. Pas de sèche.', 'Blocks follow one another with no end date, year-end holidays at reduced volume. No cut.')}
            />
          </Card>
          </Disclosure>
        )}
      </div>
    )
  }
  return (
    <div>
      {mode}
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
        {!isValidGoal(d.goalDate, start) && <p role="status" className="mt-2 text-[13px] text-bad">{L(`Choisis une date à partir du ${fmtDate(min, { long: true, year: true })}.`, `Choose a date from ${fmtDate(min, { long: true, year: true })} onwards.`)}</p>}
      </div>

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

      <Disclosure title={<>{L('Personnaliser les zones prioritaires', 'Customize priority areas')}{d.zones.length > 0 && <span className="ml-2 text-muted tnum">{d.zones.length}/{MAX_ZONES}</span>}</>} className="mt-5">
      <div className="mt-2 mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-text-2">{L('Zones prioritaires (facultatif)', 'Priority areas (optional)')}</p>
        <span className="text-[13px] text-text-2 tnum">{d.zones.length}/{MAX_ZONES}</span>
      </div>
      <ZonePicker value={d.zones} onChange={(zones) => patch({ zones })} />
      <p className="mt-2 text-[12px] leading-[1.45] text-muted">
        {L('Une série de plus sur un exercice de chaque zone, à chaque séance qui la travaille : à partir du bloc 2 (semaine 3, si tes performances montent), puis dès la semaine 1 en sèche.', 'One more set on one exercise per area, in every session that trains it: from block 2 (week 3, if your performance is going up), then from week 1 in the cut.')}
        {d.zones.length === 0 && L(` Sans choix : ${zonesText(DEFAULT_ZONES)}.`, ` If none is chosen: ${zonesText(DEFAULT_ZONES)}.`)}
      </p>
      </Disclosure>



      {preview && (
        <Disclosure title={L('Voir les estimations du plan', 'View plan estimates')} className="mt-5">
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
        </Disclosure>
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
  const session = useMemo(() => onboardingSession(answers), [answers])
  const firstType = TYPE_META[session.type]
  return (
    <div>
      <p className="text-[15px] leading-[1.5] text-text-2">{L('Voici le programme construit avec tes choix. Tu pourras regarder chaque mouvement avant de démarrer.', 'Here is the program built from your choices. You can view each movement before starting.')}</p>
      <Card className="mt-5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{firstType.fr}</h2>
            <p className="mt-1 text-[13px] text-text-2">{capitalize(fmtDate(preview.firstSession, { weekday: true }))}</p>
          </div>
          <SportArt kind="workout-upper" />
        </div>
        <p className="mt-4 text-[13px] text-text-2">{setupLabel(answers.setup)} · {plural(session.exercises.length, L('exercice', 'exercise'), L('exercices', 'exercises'))}</p>
        <ol className="mt-2 divide-y divide-line">
          {session.exercises.slice(0, 3).map((exercise, i) => <li key={exercise.exerciseId} className="flex gap-3 py-2.5 text-[14px]"><span className="text-muted tnum">{i + 1}</span><span>{exercise.name}</span></li>)}
        </ol>
        {session.exercises.length > 3 && <Disclosure title={L(`Voir les ${session.exercises.length - 3} autres exercices`, `See the other ${session.exercises.length - 3} exercises`)}>
          <ol start={4} className="divide-y divide-line">{session.exercises.slice(3).map((exercise, i) => <li key={exercise.exerciseId} className="flex gap-3 py-2.5 text-[14px]"><span className="text-muted tnum">{i + 4}</span><span>{exercise.name}</span></li>)}</ol>
        </Disclosure>}
      </Card>
      <p className="mt-4 text-[14px] leading-[1.5]"><span className="font-medium">{plural(answers.days.length, L('séance par semaine', 'session per week'), L('séances par semaine', 'sessions per week'))}</span><br /><span className="text-text-2">{[1, 2, 3, 4, 5, 6, 0].filter((x) => answers.days.includes(x)).map((x) => dayName(x, true)).join(' · ')}</span></p>
      <p className="mt-2 text-[13px] text-text-2">{answers.maintenance ? L('Entretien · sans date limite', 'Maintenance · no deadline') : `${plan?.look.label ?? ''} · ${fmtDate(answers.goalDate, { long: true, year: true })}`}</p>
      <p className="mt-3 text-[13px] leading-[1.5] text-text-2">{L('Pour commencer, choisis des charges confortables : garde de quoi faire encore 3 répétitions à la fin de chaque série.', 'Start with comfortable weights: finish each set feeling you could do 3 more repetitions.')}</p>
      <Disclosure title={L('Objectif et repères nutritionnels', 'Goal and nutrition estimates')} className="mt-5">
      <Card className="mt-2 divide-y divide-line">
        {answers.maintenance ? (
          <>
            <Line label={L('Objectif', 'Goal')} value={L('Entretien', 'Maintenance')} hint={L('Sans date : blocs de 5 semaines + décharge, en continu', 'No end date: 5-week blocks + deload, ongoing')} />
            <Line label={L('Séances du bloc 1', 'Sessions in block 1')} value={String(preview.sessions)} hint={L(`Jusqu’au ${fmtDate(preview.until, { long: true })}, puis une semaine de décharge`, `Until ${fmtDate(preview.until, { long: true })}, then a deload week`)} />
          </>
        ) : (
          <>
            <Line label={L('Objectif', 'Goal')} value={plan ? plan.look.label : '—'} hint={fmtDate(answers.goalDate, { long: true, year: true })} />
            {plan && <Line label={L('Poids cible', 'Target weight')} value={`${fmtNum(plan.target[0], 1)}–${fmtNum(plan.target[1], 1)} kg`} />}
            {plan && (
              <Line
                label={L('Zones prioritaires', 'Priority areas')}
                value={capitalize(zonesText(answers.zones?.length ? answers.zones : DEFAULT_ZONES) ?? '')}
                hint={L(`+1 série par zone et par séance, à partir du bloc 2${answers.zones?.length ? '' : ' · celles du programme'}`, `+1 set per area and per session, from block 2${answers.zones?.length ? '' : ' · the program’s own'}`)}
              />
            )}
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
      </Disclosure>
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {L('Rien ne démarre automatiquement. Tes choix restent modifiables dans Plus → Réglages.', 'Nothing starts automatically. You can change your choices in More → Settings.')}
      </p>
    </div>
  )
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] leading-[1.4] text-muted">{hint}</span>}
      </span>
      <span className="ml-auto max-w-full text-right text-[14px] font-semibold tnum">{value}</span>
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
