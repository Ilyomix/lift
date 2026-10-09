import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardPaste, Download, ExternalLink, Eye, Minus, Pencil, Plus, Share2, SlidersHorizontal, Smartphone, Sparkles, Trash, TriangleAlert, Upload, X } from 'lucide-react'
import { isNative } from '../lib/native/bridge'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { globalPrompt, nutritionFigures, parsePlanUpdate, previewPlanUpdate, sessionPrompt, type PlanUpdate } from '../lib/coach'
import { L } from '../lib/i18n'
import { addDays, capitalize, fmtDate, fmtRelativeDay, isoFromTimestamp, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { contextAt, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { isAndroid, isIOS, isStandalone, saveFile, shareText } from '../lib/share'
import { calorieAdvice, calorieStepPatch, nutritionDays, nutritionFor, proteinTargetFor } from '../lib/stats'
import { useStore } from '../lib/store'
import { confirmUnsavedChanges, useUnsavedChanges } from '../lib/unsavedChanges'
import { Columns } from '../components/charts'
import { RefList } from '../components/Evidence'
import { SettingsMenuRow } from '../components/SettingsMenu'
import { MeasurementPicker } from '../components/MeasurementPicker'
import { SportArt } from '../components/SportArt'
import { Button, Card, cx, Disclosure, Empty, Field, Header, IconButton, inputClass, PageActions, ProgressBar, Row, Screen, Section, Sheet, Tag, Toggle } from '../components/ui'

export function MoreScreen() {
  return (
    <Screen>
      <Header art="kit" title={L('Plus', 'More')} sub={L('Objectifs, suivi et entraînement.', 'Goals, tracking and training.')} />
      <section aria-labelledby="more-daily">
        <h2 id="more-daily" className="mb-2 text-[13px] font-semibold text-text-2">{L('Au quotidien', 'Daily tracking')}</h2>
        <Card className="divide-y divide-line">
          <SettingsMenuRow to="plus/nutrition" art="nutrition" label="Nutrition" />
          <SettingsMenuRow to="plus/reglages/objectifs" art="trophy" label={L('Objectifs', 'Goals')} />
        </Card>
      </section>
      <section aria-labelledby="more-training" className="mt-4">
        <h2 id="more-training" className="mb-2 text-[13px] font-semibold text-text-2">{L('Entraînement', 'Training')}</h2>
        <Card className="divide-y divide-line">
          <SettingsMenuRow to="plus/reglages/materiel" art="kit" label={L('Salles et matériel', 'Gyms and equipment')} />
        </Card>
      </section>
      <Card className="mt-4">
        <SettingsMenuRow to="plus/reglages" art="settings" label={L('Réglages', 'Settings')} hint={L('Entraînement, préférences et données', 'Training, preferences and data')} />
      </Card>
      <Disclosure icon={<SportArt kind="evidence" size="title" />} title={L('Ressources', 'Resources')} className="mt-4" contentClassName="text-[13px] text-text-2">
        <Card className="divide-y divide-line">
          <SettingsMenuRow to="plus/preuves" art="evidence" label={L('Sources scientifiques', 'Scientific sources')} />
          <SettingsMenuRow to="plus/coach" art="coach" label={L('Aide IA facultative', 'Optional AI assistance')} />
          <SettingsMenuRow to="plus/a-propos" art="kit" label={L('À propos de Lift', 'About Lift')} />
        </Card>
      </Disclosure>
    </Screen>
  )
}

export function AboutScreen() {
  return (
    <Screen>
      <Header art="kit" backTo="plus" title={L('À propos de Lift', 'About Lift')} />
      <Card>
        <a href="https://github.com/Ilyomix" target="_blank" rel="noopener noreferrer" className="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
          <img src={`${import.meta.env.BASE_URL}icons/ilyomix.jpg`} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 shrink-0 rounded-full border border-line-strong object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{L('Conçue par Ilyomix', 'Designed by Ilyomix')}</span>
            <span className="block text-[13px] text-muted tnum" title={__APP_COMMIT__ || undefined}>
              Lift {__APP_VERSION__}{__APP_BUILD__ ? ` · build ${__APP_BUILD__}` : isNative() ? '' : L(' · build local', ' · local build')} · {fmtDate(isoFromTimestamp(__APP_BUILT__), { year: true })}
            </span>
          </span>
          <ExternalLink size={16} className="shrink-0 text-muted" aria-hidden />
        </a>
      </Card>
      <p className="mt-4 text-[14px] leading-[1.5] text-text-2">{L('Programme fondé sur la recherche (rapport du 26 sept. 2026). Séances et mesures enregistrées sur cet appareil.', 'Research-based program (report of 26 Sept 2026). Workouts and measurements stored on this device.')}</p>
      <Card className="mt-4 divide-y divide-line">
        <SettingsMenuRow to="plus/confidentialite" art="privacy" label={L('Politique de confidentialité', 'Privacy policy')} />
        <a href="https://github.com/Ilyomix/lift" target="_blank" rel="noopener noreferrer" className="pressable flex min-h-11 items-center justify-between gap-3 px-4 py-3.5 text-[15px] font-medium hover:bg-surface-2">
          {L('Code source sur GitHub', 'Source code on GitHub')}<ExternalLink size={16} className="shrink-0 text-muted" aria-hidden />
        </a>
      </Card>
      {!isNative() && <Section icon={<Smartphone size={18} aria-hidden />} title={L('Installation', 'Installation')}>
        <Card className="p-4">
          {isStandalone() ? (
            <p className="text-[14px] text-text-2">{L('Lift est installée : elle fonctionne hors ligne.', 'Lift is installed: it works offline.')}</p>
          ) : (
            <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
              {!isAndroid() && <li><span className="font-semibold text-text">Safari</span> · {L('touche Partager, puis « Sur l’écran d’accueil ».', 'tap Share, then “Add to Home Screen”.')}</li>}
              {!isIOS() && <li><span className="font-semibold text-text">Chrome</span> · {L('menu ⋮, puis « Installer l’application ».', 'open the ⋮ menu, then “Install app”.')}</li>}
              <li>{L('Lance ensuite Lift depuis l’icône : plein écran, hors ligne, notifications possibles.', 'Then open Lift from the icon: full screen, offline, notifications available.')}</li>
            </ol>
          )}
        </Card>
      </Section>}
    </Screen>
  )
}

// ───────────────────────── Nutrition ─────────────────────────

export function NutritionScreen() {
  const state = useStore((s) => s.state)
  const { setNutrition } = useStore.getState()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const changeDate = async (next: string) => {
    if (next !== date && !await confirmUnsavedChanges()) return false
    setDate(next)
    return true
  }
  const proteinInput = useRef<HTMLDivElement>(null)
  const e = nutritionFor(state, date)
  const protein = proteinTargetFor(state, date)
  const ctx = contextAt(date)
  const days = nutritionDays(state, 14, today)
  const chartProtein = proteinTargetFor(state, today)
  const hit = days.filter((d) => d.protein >= chartProtein.min).length
  const nutritionDates = Object.keys(state.nutritionEntries)
  const hasRecentNutrition = nutritionDates.some((entryDate) => entryDate >= addDays(today, -13) && entryDate <= today)
  const add = (k: 'calories' | 'protein', n: number) => setNutrition(date, { [k]: Math.max(0, (e[k] ?? 0) + n) })
  return (
    <Screen>
      <Header art="nutrition" backTo="plus" eyebrow={ctx.phase?.label} title="Nutrition" sub={ctx.phase?.nutrition} />
      <div className="flex items-center justify-between gap-2">
        <IconButton label={L('Jour précédent', 'Previous day')} onClick={() => changeDate(addDays(date, -1))} className="border border-line-strong"><ChevronLeft size={18} aria-hidden /></IconButton>
        <p className="min-w-0 text-center text-[15px] font-semibold">{capitalize(fmtRelativeDay(date, today))}</p>
        <IconButton label={L('Jour suivant', 'Next day')} disabled={date >= today} onClick={() => changeDate(addDays(date, 1))} className="border border-line-strong"><ChevronRight size={18} aria-hidden /></IconButton>
      </div>

      <Card className="mt-4 divide-y divide-line">
        <Counter key={`${date}-protein`} label={L('Protéines', 'Protein')} unit="g" value={e.protein} target={`${protein.min}–${protein.max} g`} targetValue={protein.min} targetMax={protein.max} inputRef={proteinInput} onSet={(n) => setNutrition(date, { protein: n })} steps={[-10, 10, 25]} onAdd={(n) => add('protein', n)} />
        <Counter key={`${date}-calories`} label="Calories" unit="kcal" value={e.calories} target={`${state.nutritionTargets.calories} kcal`} targetValue={state.nutritionTargets.calories} onSet={(n) => setNutrition(date, { calories: n })} steps={[-100, 100, 250]} onAdd={(n) => add('calories', n)} />
        <Toggle label={L('Créatine', 'Creatine')} hint={L(`${state.nutritionTargets.creatine} g par jour · fait retenir 1–2 kg d’eau`, `${state.nutritionTargets.creatine} g per day · makes you retain 1–2 kg of water`)} checked={e.creatine > 0} onChange={(v) => setNutrition(date, { creatine: v ? state.nutritionTargets.creatine : 0 })} />
      </Card>

      <Section art="chart" title={L('Protéines, 14 derniers jours', 'Protein, last 14 days')} action={hasRecentNutrition ? <span className="text-[13px] text-text-2 tnum">{L(`${hit}/14 jours ≥ ${chartProtein.min} g`, `${hit}/14 days ≥ ${chartProtein.min} g`)}</span> : undefined}>
        {hasRecentNutrition ? <Card className="p-4">
          <Columns
            ariaLabel={L('Protéines par jour sur 14 jours', 'Protein per day over 14 days')}
            bars={days.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.protein, tooltip: <span>{fmtDate(d.date)}{L(' : ', ': ')}{fmtNum(d.protein, 0)} g</span> }))}
            target={{ value: chartProtein.min, label: `${chartProtein.min} g` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card> : <Empty
          title={nutritionDates.length ? L('Pas de relevé sur ces 14 jours', 'No entries in these 14 days') : L('Ton suivi nutritionnel commence ici', 'Your nutrition log starts here')}
          action={<Button variant="outline" icon={<Pencil size={16} aria-hidden />} onClick={async () => { if (!await changeDate(today)) return; requestAnimationFrame(() => proteinInput.current?.querySelector<HTMLElement>('input, button')?.focus()) }}>{L('Renseigner aujourd’hui', 'Log today')}</Button>}
        >{L('Renseigne tes totaux quotidiens dans les compteurs. Tu verras ensuite leur évolution par rapport à ta cible.', 'Enter your daily totals in the counters. You will then see how they compare with your target.')}</Empty>}
      </Section>

      <Card className="mt-6">
        <SettingsMenuRow to="plus/reglages/nutrition" art="nutrition" label={L('Cibles et ajustements', 'Targets and adjustments')} hint={L('Protéines, calories et créatine', 'Protein, calories and creatine')} />
      </Card>
    </Screen>
  )
}

export function NutritionTargetsScreen() {
  const state = useStore((s) => s.state)
  const { setNutritionTargets, notify } = useStore.getState()
  const today = todayISO()
  const advice = calorieAdvice(state, today)
  const [normal, setNormal] = useState<boolean | null>(null)
  const first = advice.status === 'ask' ? advice.first : undefined
  const step = !first || normal === null ? null : normal ? { ...first, sized: true } : advice.otherwise ? { ...advice.otherwise, sized: false } : null
  return (
    <Screen>
      <Header art="nutrition" backTo="plus/reglages" title={L('Cibles nutritionnelles', 'Nutrition targets')} sub={L('Tes cibles quotidiennes et leurs ajustements.', 'Your daily targets and their adjustments.')} />
      <NutritionTargetForm />
      <Section art="settings" title={L('Ajuster les calories', 'Adjust calories')}>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{advice.headline}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{advice.detail}</p>
            </div>
            {advice.status !== 'wait' && advice.status !== 'ask' && <Tag tone={advice.status === 'ok' ? 'good' : 'warn'}>{advice.status === 'ok' ? 'OK' : advice.status === 'hold' ? L('Seuil minimum', 'Minimum') : `${advice.delta > 0 ? '+' : '−'}${Math.abs(advice.delta)} kcal`}</Tag>}
            {step && <Tag tone="warn">{`−${Math.abs(step.delta)} kcal`}</Tag>}
          </div>
          {(advice.status === 'lower' || advice.status === 'raise') && (
            <Button variant="primary" full className="mt-3" icon={<SlidersHorizontal size={16} aria-hidden />} onClick={async () => { if (!await confirmUnsavedChanges()) return; setNutritionTargets({ calories: advice.target }); notify(L(`Cible : ${advice.target} kcal. Prochain point dans 2 semaines.`, `Target: ${advice.target} kcal. Next check-in in 2 weeks.`), 'good') }}>
              {L(`Passer à ${advice.target} kcal`, `Switch to ${advice.target} kcal`)}
            </Button>
          )}
          {first && !step && (
            <div className="mt-3">
              <p className="text-[14px] font-medium leading-[1.4]">{first.question}</p>
              <p className="mt-1 text-[13px] leading-[1.45] text-text-2">{first.hint}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button full icon={<Check size={16} aria-hidden />} onClick={() => setNormal(true)}>{L('Oui, normales', 'Yes, normal')}</Button>
                <Button full icon={<X size={16} aria-hidden />} onClick={() => setNormal(false)}>{L('Non', 'No')}</Button>
              </div>
            </div>
          )}
          {step && (
            <>
              <p className="mt-3 text-[14px] leading-[1.45] text-text-2">{step.detail}</p>
              <Button
                variant="primary"
                icon={<SlidersHorizontal size={16} aria-hidden />}
                full
                className="mt-3"
                onClick={async () => {
                  // The sized step is kept with its day: there is one a cut, and part of it goes back if it overshot.
                  // It can be taken back on the spot: the targets return to what they were, record included.
                  if (!await confirmUnsavedChanges()) return
                  const before = state.nutritionTargets
                  setNutritionTargets(calorieStepPatch(before, step.target, step.sized, today))
                  setNormal(null)
                  notify(
                    L(`Cible : ${step.target} kcal. Prochain point dans 2 semaines.`, `Target: ${step.target} kcal. Next check-in in 2 weeks.`), 'good',
                    { label: L('Annuler', 'Undo'), run: async () => { if (await confirmUnsavedChanges()) useStore.getState().update((s) => ({ ...s, nutritionTargets: before })) } },
                  )
                }}
              >
                {L(`Passer à ${step.target} kcal`, `Switch to ${step.target} kcal`)}
              </Button>
              <Button variant="outline" full icon={<ArrowLeft size={16} aria-hidden />} onClick={() => setNormal(null)} className="mt-2">{L('Revenir à la question', 'Back to the question')}</Button>
            </>
          )}
        </Card>
        <p className="mt-3 text-[13px] leading-[1.45] text-muted">{L('Repères généraux, pas un avis médical. Demande l’avis d’un médecin avant de réduire tes calories, surtout en cas de problème de santé, de grossesse ou si tu as moins de 18 ans.', 'General guidance, not medical advice. Check with a doctor before cutting calories, especially if you have a health condition, are pregnant or are under 18.')}</p>
      </Section>

      <Disclosure icon={<SportArt kind="nutrition" size="title" />} title={L('Comment les cibles sont calculées', 'How targets are calculated')} className="mt-6" contentClassName="text-[13px] leading-[1.5] text-text-2">
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            {L('Tendance de ta moyenne de poids sur 7 jours (3 dernières semaines)', 'Trend of your 7-day average weight (last 3 weeks)')}{advice.waist ? L(`, tour de taille ${advice.waist === 'down' ? 'en baisse' : advice.waist === 'up' ? 'en hausse' : 'stable'} sur un mois`, `, waist ${advice.waist === 'down' ? 'down' : advice.waist === 'up' ? 'up' : 'stable'} over a month`) : ''}. {L('Les ajustements se font généralement par paliers de 150 kcal. Une fois par sèche, une baisse plus importante peut être proposée pour atteindre le déficit prévu. Le conseil attend ensuite au moins 2 semaines avant un nouvel ajustement.', 'Adjustments are usually made in steps of 150 kcal. Once per cut, a larger reduction may be suggested to reach the planned deficit. The advice then waits at least 2 weeks before another adjustment.')}{advice.floorIs === 'rest' ? L(` Jamais sous ta dépense au repos estimée (${advice.floor} kcal).`, ` Never under your estimated energy at rest (${advice.floor} kcal).`) : L(` Jamais sous ${advice.floor} kcal, le minimum conseillé sans suivi médical.`, ` Never under ${advice.floor} kcal, the minimum advised without medical supervision.`)} {L('Le poids ne change jamais les charges.', 'Your weight never changes your loads.')}
          </p>
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">{L('L’apport calorique qui maintient ton poids s’ajuste en suivant ta moyenne de poids. Protéines : ≈ 2 g/kg, un peu plus en sèche, jamais en baisse pendant la sèche.', 'The calorie intake that keeps your weight stable is adjusted by tracking your average weight. Protein: ≈ 2 g/kg, a little more during a cut, never lowered during the cut.')}</p>
        <RefList refs={['morton2018', 'helms2014', 'murphy2022', 'garthe2011', 'burke2023']} compact />
      </Disclosure>
    </Screen>
  )
}

type NutritionDraft = { calories: string; creatine: string; proteinMin: string; proteinMax: string; adaptive: boolean }
type NutritionField = Exclude<keyof NutritionDraft, 'adaptive'>

function NutritionTargetForm() {
  const formId = useId()
  const state = useStore((s) => s.state)
  const targets = state.nutritionTargets
  const protein = proteinTargetFor(state, todayISO())
  const values = { calories: String(targets.calories), creatine: String(targets.creatine), proteinMin: String(targets.proteinMin), proteinMax: String(targets.proteinMax), adaptive: targets.adaptive !== false }
  const [draft, setDraft] = useState<NutritionDraft>(values)
  const [errors, setErrors] = useState<Partial<Record<NutritionField, string>>>({})
  // Advice actions and their undo update the same stored targets. Reflect those
  // explicit changes without writing half-entered field values to the store.
  useEffect(() => {
    setDraft({ calories: String(targets.calories), creatine: String(targets.creatine), proteinMin: String(targets.proteinMin), proteinMax: String(targets.proteinMax), adaptive: targets.adaptive !== false })
    setErrors({})
  }, [targets.calories, targets.creatine, targets.proteinMin, targets.proteinMax, targets.adaptive])
  const dirty = (Object.keys(values) as (keyof NutritionDraft)[]).some(key => draft[key] !== values[key])
  const { discard } = useUnsavedChanges(dirty)
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const calories = parseNumber(draft.calories)
    const creatine = parseNumber(draft.creatine)
    const proteinMin = parseNumber(draft.proteinMin)
    const proteinMax = parseNumber(draft.proteinMax)
    const next: Partial<Record<NutritionField, string>> = {}
    if (calories === null || calories <= 0) next.calories = L('Saisis une valeur supérieure à 0.', 'Enter a value greater than 0.')
    if (creatine === null || creatine < 0) next.creatine = L('Saisis une valeur égale ou supérieure à 0.', 'Enter a value of 0 or more.')
    if (proteinMin === null || proteinMin < 0) next.proteinMin = L('Saisis une valeur égale ou supérieure à 0.', 'Enter a value of 0 or more.')
    if (proteinMax === null || proteinMax < 0) next.proteinMax = L('Saisis une valeur égale ou supérieure à 0.', 'Enter a value of 0 or more.')
    if (proteinMin !== null && proteinMax !== null && proteinMin > proteinMax) next.proteinMax = L('Le maximum doit être au moins égal au minimum.', 'The maximum must be at least the minimum.')
    setErrors(next)
    if (Object.keys(next).length) return
    setDraft({ calories: String(calories), creatine: String(creatine), proteinMin: String(proteinMin), proteinMax: String(proteinMax), adaptive: draft.adaptive })
    useStore.getState().setNutritionTargets({ calories: calories!, creatine: creatine!, proteinMin: proteinMin!, proteinMax: proteinMax!, adaptive: draft.adaptive })
    discard()
    useStore.getState().notify(L('Cibles nutritionnelles enregistrées.', 'Nutrition targets saved.'), 'good')
  }
  const proteinMin = parseNumber(draft.proteinMin), proteinMax = parseNumber(draft.proteinMax)
  const validProteinMin = proteinMin !== null && proteinMin >= 0
  const validProteinMax = proteinMax !== null && proteinMax >= 0
  const field = (key: NutritionField, label: string) => (
    <Field label={label} error={errors[key]}>
      <MeasurementPicker label={label} unit={key === 'calories' ? 'kcal' : 'g'} value={draft[key]} onChange={value => setDraft(current => ({ ...current, [key]: value }))}
        min={key === 'calories' ? 50 : key === 'proteinMax' && validProteinMin ? proteinMin : 0}
        max={key === 'calories' ? 10000 : key === 'creatine' ? 20 : key === 'proteinMin' && validProteinMax ? proteinMax : Math.max(500, validProteinMin ? proteinMin : 0, validProteinMax ? proteinMax : 0)}
        strictBounds={key === 'proteinMin' || key === 'proteinMax'}
        step={key === 'calories' ? 50 : key === 'creatine' ? 0.1 : 1} defaultValue={Number(values[key])} required invalid={!!errors[key]} />
    </Field>
  )
  return (
    <form id={formId} onSubmit={save} noValidate>
      <div className="grid grid-cols-2 gap-3">
        {field('calories', 'Calories')}
        {field('creatine', L('Créatine', 'Creatine'))}
      </div>
      <Card className="mt-4">
        <Toggle label={L('Protéines adaptées à ton poids', 'Protein adjusted to your weight')}
          hint={draft.adaptive && protein.weight ? L(`${protein.min}–${protein.max} g : ≈ ${fmtNum(protein.perKg![0], 1)}–${fmtNum(protein.perKg![1], 1)} g/kg × ${fmtNum(protein.weight, 1)} kg (moyenne 7 jours)`, `${protein.min}–${protein.max} g: ≈ ${fmtNum(protein.perKg![0], 1)}–${fmtNum(protein.perKg![1], 1)} g/kg × ${fmtNum(protein.weight, 1)} kg (7-day average)`) : draft.adaptive ? L('La fourchette fixe sert en attendant ta première pesée.', 'The fixed range is used until your first weigh-in.') : L('La fourchette fixe ci-dessous s’applique.', 'The fixed range below applies.')}
          checked={draft.adaptive} onChange={adaptive => setDraft(current => ({ ...current, adaptive }))} />
      </Card>
      {draft.adaptive ? (
        <Disclosure title={L('Fourchette avant la première pesée', 'Range before your first weigh-in')} className="mt-4" defaultOpen={!!errors.proteinMin || !!errors.proteinMax} key={errors.proteinMin || errors.proteinMax ? 'invalid-range' : 'range'}>
          <div className="grid grid-cols-2 gap-3">
            {field('proteinMin', L('Protéines min.', 'Min. protein'))}
            {field('proteinMax', L('Protéines max.', 'Max. protein'))}
          </div>
        </Disclosure>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {field('proteinMin', L('Protéines min.', 'Min. protein'))}
          {field('proteinMax', L('Protéines max.', 'Max. protein'))}
        </div>
      )}
      <PageActions visible={dirty}><Button type="submit" form={formId} variant="primary" full icon={<Check size={16} aria-hidden />} disabled={!dirty}>{L('Enregistrer les cibles', 'Save targets')}</Button></PageActions>
    </form>
  )
}

function Counter({ label, unit, value, target, targetValue, targetMax, inputRef, onSet, steps, onAdd }: { label: string; unit: string; value: number; target: string; targetValue: number; targetMax?: number; inputRef?: React.RefObject<HTMLDivElement | null>; onSet: (n: number) => void; steps: number[]; onAdd: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  const ownValue = useRef(value)
  useEffect(() => {
    if (value !== ownValue.current) { ownValue.current = value; setDraft(String(value)) }
  }, [value])
  const parsed = parseNumber(draft)
  const invalid = draft.trim() !== '' && (parsed === null || parsed < 0)
  useUnsavedChanges(invalid)
  const hasTarget = Number.isFinite(targetValue) && targetValue > 0
  const current = Number.isFinite(value) ? Math.max(0, value) : 0
  const upper = typeof targetMax === 'number' && Number.isFinite(targetMax) && targetMax >= targetValue ? targetMax : targetValue
  const over = hasTarget ? Math.max(0, current - upper) : 0
  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-[12px] text-text-2">{hasTarget ? L(`cible ${target}`, `target ${target}`) : L('Cible à définir', 'Set a target')}</span>
      </div>
      <div ref={inputRef} className="mt-3">
        <Field label={<span className="sr-only">{label}</span>} error={invalid ? L('Saisis une valeur égale ou supérieure à zéro.', 'Enter a value of zero or more.') : undefined}>
          <MeasurementPicker label={label} unit={unit} value={draft} min={0} max={unit === 'kcal' ? 10000 : 500} step={unit === 'kcal' ? 50 : 1} defaultValue={value} invalid={invalid} required onChange={next => {
            // An emptied entry keeps the day's total; 0 is typed on purpose.
            if (next.trim() === '') return
            setDraft(next)
            const n = parseNumber(next)
            if (n !== null && n >= 0) { ownValue.current = n; onSet(n) }
          }} />
        </Field>
      </div>
      {hasTarget && <div className="mt-3">
        <ProgressBar value={current / targetValue} tone="signal" label={L(`${label} : ${fmtNum(current)} ${unit}, cible ${target}`, `${label}: ${fmtNum(current)} ${unit}, target ${target}`)} />
        {over > 0 && <p className="mt-1.5 text-center text-[12px] text-text-2 tnum">{L(`${fmtNum(over)} ${unit} au-dessus de ${targetMax ? 'la fourchette' : 'la cible'}`, `${fmtNum(over)} ${unit} above the ${targetMax ? 'range' : 'target'}`)}</p>}
      </div>}
      <div className="mt-4 grid auto-cols-fr grid-flow-col gap-2" role="group" aria-label={L(`Ajuster ${label.toLowerCase()}`, `Adjust ${label.toLowerCase()}`)}>
        {steps.map((s) => (
          <Button key={s} icon={s > 0 ? <Plus size={16} aria-hidden /> : <Minus size={16} aria-hidden />} onClick={() => onAdd(s)} aria-label={L(`${s > 0 ? 'Ajouter' : 'Retirer'} ${Math.abs(s)} ${unit}`, `${s > 0 ? 'Add' : 'Remove'} ${Math.abs(s)} ${unit}`)} className="min-h-11 min-w-0 px-2 tnum">
            {Math.abs(s)}
          </Button>
        ))}
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
  const errorId = useId()
  const draft = useUnsavedChanges(!!text.trim() || !!update)
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
      const pasted = await navigator.clipboard.readText()
      if (pasted !== text && !await draft.confirm()) return
      setText(pasted)
      draft.rearm()
      setUpdate(null)
      setError(null)
    } catch {
      useStore.getState().notify(L('Colle le texte manuellement dans le champ.', 'Paste the text into the field manually.'), 'bad')
    }
  }
  const preview = update ? previewPlanUpdate(state, update) : []
  const nutritionLabels: Record<string, string> = {
    calories: 'Calories (kcal)',
    proteinMin: L('Protéines min (g)', 'Min protein (g)'),
    proteinMax: L('Protéines max (g)', 'Max protein (g)'),
    creatine: L('Créatine (g)', 'Creatine (g)'),
  }
  return (
    <Screen>
      <Header art="coach" backTo="plus" title={L('Aide IA facultative', 'Optional AI assistance')} sub={L('Lift fonctionne sans IA. Partage un bilan avec ton assistant uniquement si tu le souhaites.', 'Lift works without AI. Share a summary with your assistant only if you choose.')} />
      <p className="text-[14px] leading-[1.5] text-text-2">{L('Le bilan est préparé sur cet appareil. Tu choisis où le partager, puis tu peux coller la réponse ici. Vérifie chaque suggestion avant de l’appliquer.', 'The summary is prepared on this device. You choose where to share it, then you can paste the reply here. Review each suggestion before applying it.')}</p>
      <div className="mt-4 grid gap-2">
        <Button variant="ink" size="lg" full icon={<Sparkles size={18} aria-hidden />} disabled={!last} onClick={() => last && void shareText(sessionPrompt(state, last), L(`Séance ${last.sessionNumber}`, `Workout ${last.sessionNumber}`))}>
          {last ? L(`Partager le bilan n°${last.sessionNumber}`, `Share workout #${last.sessionNumber} summary`) : L('Aucune séance enregistrée', 'No workouts recorded')}
        </Button>
        <Button variant="outline" size="lg" full icon={<Share2 size={18} aria-hidden />} onClick={() => void shareText(globalPrompt(state), L('Bilan Lift', 'Lift summary'))}>{L('Partager le bilan du programme', 'Share program summary')}</Button>
      </div>

      <Section art="coach" title={L('Réponse de l’IA', 'AI reply')} action={<Button size="sm" variant="outline" icon={<ClipboardPaste size={15} aria-hidden />} onClick={paste}>{L('Coller', 'Paste')}</Button>}>
        <textarea aria-label={L('Réponse de l’IA', 'AI reply')} autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} className={cx(inputClass, 'h-36 resize-none py-2.5 font-mono')} value={text} onChange={(e) => { setText(e.target.value); setUpdate(null); setError(null) }} placeholder={L('Colle ici la réponse complète : le bloc JSON est détecté automatiquement.', 'Paste the full reply here: the JSON block is detected automatically.')} />
        {error && <p id={errorId} role="alert" className="mt-2 text-[13px] text-bad">{error}</p>}
        <Button variant="outline" full className="mt-2" icon={<Eye size={16} aria-hidden />} disabled={!text.trim()} onClick={analyze}>{L('Prévisualiser les modifications', 'Preview changes')}</Button>
      </Section>

      {update && (
        <Section art="program" title={L('Aperçu', 'Preview')}>
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
            {Object.keys(nutritionFigures(update.nutritionTargets)).length > 0 && <div className="px-4 py-3 text-[13px] text-text-2">{L('Nutrition : ', 'Nutrition: ')}{Object.entries(nutritionFigures(update.nutritionTargets)).map(([k, v]) => `${nutritionLabels[k]} : ${fmtNum(Number(v))}`).join(' · ')}</div>}
          </Card>
          <PageActions visible><Button variant="primary" size="lg" full icon={<Check size={18} aria-hidden />} onClick={() => { applyPlan(update); draft.discard(); setUpdate(null); setText(''); useStore.getState().notify(L('Modifications appliquées.', 'Changes applied.'), 'good') }}>
            {L('Appliquer cette mise à jour', 'Apply update')}
          </Button></PageActions>
        </Section>
      )}

      <Disclosure className="mt-6" icon={<SportArt kind="logbook" size="title" />} title={L('Historique des mises à jour', 'Update history')}>
        {state.appliedPlanUpdates.length ? (
          <Card className="divide-y divide-line">
            {[...state.appliedPlanUpdates].reverse().slice(0, 12).map((u) => (
              <div key={u.updateId + u.appliedAt} className="px-4 py-3">
                <p className="text-[12px] text-muted">{fmtDate(isoFromTimestamp(u.appliedAt), { year: true })} · {plural(u.changeCount, L('changement', 'change'), L('changements', 'changes'))}{u.source ? ` · ${u.source === 'coach' ? L('aide IA', 'AI assistance') : u.source === 'program' ? L('programme', 'program') : 'progression'}` : ''}</p>
                <p className="mt-0.5 text-[14px] leading-[1.45]">{u.summary}</p>
              </div>
            ))}
          </Card>
        ) : (
          <Empty title={L('Aucun ajustement appliqué', 'No adjustments applied yet')}>
            {L('Les ajustements appliqués apparaîtront ici. L’aide IA reste facultative : tu peux continuer tes séances sans l’utiliser.', 'Applied adjustments will appear here. AI assistance is optional: you can keep training without using it.')}
          </Empty>
        )}
      </Disclosure>

    </Screen>
  )
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
  const [exporting, setExporting] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      setParsed(parseBackup(await f.text()))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const doExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const b = exportBackup()
      if (await saveFile(`lift-${todayISO()}.json`, JSON.stringify(b), 'application/json')) {
        useStore.getState().update((s) => ({ ...s, meta: { ...s.meta, lastBackupAt: b.exportedAt } }))
      }
    } catch {
      useStore.getState().notify(L('Export impossible. Réessaie depuis cette page.', 'Export failed. Try again from this page.'), 'bad')
    } finally {
      setExporting(false)
    }
  }
  return (
    <Screen>
      <Header art="backup" backTo="plus/reglages/donnees" title={L('Sauvegarde', 'Backup')} sub={L('Tes données restent sur cet appareil. Exporte une sauvegarde pour conserver tes séances, mesures, données nutritionnelles et photos.', 'Your data stays on this device. Export a backup to keep your workouts, measurements, nutrition data and photos.')} />
      <Card className="divide-y divide-line">
        <Row label={L('Séances', 'Workouts')} value={<span className="tnum">{state.workouts.length}</span>} />
        <Row label={L('Mesures', 'Measurements')} value={<span className="tnum">{state.bodyEntries.length}</span>} />
        <Row label="Photos" value={<span className="tnum">{photos.length}</span>} />
        <Row label={L('Dernier export', 'Last export')} value={state.meta.lastBackupAt ? fmtRelativeDay(isoFromTimestamp(state.meta.lastBackupAt)) : L('jamais', 'never')} />
      </Card>
      <div className="mt-4 grid gap-2">
        <Button variant="primary" size="lg" full icon={<Download size={18} aria-hidden />} disabled={exporting} onClick={() => void doExport()}>{L('Exporter la sauvegarde', 'Export backup')}</Button>
        <Button variant="outline" size="lg" full icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>{L('Importer une sauvegarde', 'Import a backup')}</Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}

      <Section icon={<TriangleAlert size={18} aria-hidden />} title={L('Suppression des données', 'Delete data')}>
        <Button variant="danger" full icon={<Trash size={16} aria-hidden />} onClick={() => setReset(true)}>{L('Effacer les données de Lift', 'Erase Lift data')}</Button>
      </Section>

      <ImportSheet parsed={parsed} upgrade={upgrade} setUpgrade={setUpgrade} onClose={() => setParsed(null)} onConfirm={async () => { if (await importBackup(parsed!, { upgrade })) { setParsed(null); navigate('') } }} />
      <Sheet icon={<Trash size={18} aria-hidden />} open={reset} onClose={() => setReset(false)} title={L('Effacer les données de Lift ?', 'Erase Lift data?')} footer={<div className="grid grid-cols-2 gap-2"><Button variant="outline" size="lg" full icon={<X size={16} aria-hidden />} closeSheet onClick={() => setReset(false)}>{L('Annuler', 'Cancel')}</Button><Button variant="danger" size="lg" full icon={<Trash size={16} aria-hidden />} closeSheet onClick={async () => { if (await resetAll()) navigate('') }}>{L('Effacer', 'Erase')}</Button></div>}>
        <p className="text-[15px] leading-[1.5] text-text-2">{L('Séances, mesures, données nutritionnelles, photos et réglages seront supprimés de cet appareil. Exporte une sauvegarde avant si tu veux les garder.', 'Workouts, measurements, nutrition data, photos and settings will be deleted from this device. Export a backup first if you want to keep them.')}</p>
      </Sheet>
    </Screen>
  )
}

export function ImportSheet({ parsed, upgrade, setUpgrade, onClose, onConfirm }: { parsed: ParsedBackup | null; upgrade: boolean; setUpgrade: (v: boolean) => void; onClose: () => void; onConfirm: () => void | Promise<unknown> }) {
  if (!parsed) return null
  const s = parsed.summary
  return (
    <Sheet icon={<Upload size={18} aria-hidden />} open onClose={onClose} title={L('Importer cette sauvegarde', 'Import this backup')} footer={<Button variant="primary" size="lg" full icon={<Upload size={18} aria-hidden />} closeSheet onClick={onConfirm}>{L('Importer', 'Import')}</Button>}>
      <Card className="divide-y divide-line">
        <Row label={L('Séances', 'Workouts')} value={<span className="tnum">{s.workouts}</span>} />
        <Row label={L('Mesures', 'Measurements')} value={<span className="tnum">{s.bodyEntries}</span>} />
        <Row label={L('Jours de nutrition saisis', 'Days of nutrition logged')} value={<span className="tnum">{s.nutritionDays}</span>} />
        <Row label="Photos" value={<span className="tnum">{s.photos}</span>} />
        {s.exportedAt && <Row label={L('Exportée', 'Exported')} value={fmtDate(isoFromTimestamp(s.exportedAt), { year: true })} />}
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
