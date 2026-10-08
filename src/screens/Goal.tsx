import { useMemo, useRef, useState } from 'react'
import { Camera, Check, Flag, ImageOff, RotateCcw, Ruler, Target, TriangleAlert } from 'lucide-react'
import { diffDays, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { L } from '../lib/i18n'
import { CUT_LENGTH, CUT_WEEKS, GOAL_DATE, MAINTENANCE, TYPE_META } from '../lib/program'
import { navigate } from '../lib/router'
import { useUnsavedChanges } from '../lib/unsavedChanges'
import { weightStatus } from '../lib/stats'
import { imageToDataUrl } from '../lib/share'
import { GOAL_PHOTO_ID, useStore } from '../lib/store'
import type { Look, WorkoutType, Zone } from '../lib/types'
import { bodyFatEstimate, cutDrift, DEFAULT_ZONES, goalApplied, LOOKS, lookInfo, MAX_ZONES, prioritySets, prioritySetsStart, reachesLook, visualPlan, ZONES, zonesText, type PaceResult } from '../lib/visual'
import { RefList } from '../components/Evidence'
import { ZonePicker } from '../components/ZonePicker'
import { SportArt } from '../components/SportArt'
import { MeasurementPicker } from '../components/MeasurementPicker'
import { Disclosure, Button, Card, cx, Field, Header, PageActions, Screen, Section, Segmented } from '../components/ui'
import { MeasureSheet } from './Progress'

const kg = (x: number) => `${fmtNum(x, 1)} kg`
const pct = (x: number) => L(`${fmtNum(x, 0)} %`, `${fmtNum(x, 0)}%`)
/** Keeps a date on one line: « 30 juin 2027 ». */
const nb = (text: string) => text.replace(/ /g, ' ')
/** A waist older than this no longer describes today's body fat well. */
const STALE_WAIST_DAYS = 21

/** Visual goal: a look (body-fat level), priority zones, a reference picture → the plan in numbers. */
export function VisualGoalScreen() {
  const state = useStore((s) => s.state)
  const photos = useStore((s) => s.photos)
  const { applyVisualGoal, saveVisualPreferences, clearVisualGoal, setGoalPhoto, notify } = useStore.getState()
  const saved = state.visualGoal
  const applied = goalApplied(saved)
  const [look, setLook] = useState<Look>(saved?.look ?? 'taille')
  const [zones, setZones] = useState<Zone[]>(saved?.zones ?? [])
  const [height, setHeight] = useState(state.profile.heightCm ? String(state.profile.heightCm) : '')
  const [sex, setSex] = useState<'m' | 'f'>(state.profile.sex ?? 'm')
  const [measured, setMeasured] = useState(saved?.bodyFat ? L(String(saved.bodyFat).replace('.', ','), String(saved.bodyFat)) : '')
  const [measureOpen, setMeasureOpen] = useState(false)
  const [measurementsChanged, setMeasurementsChanged] = useState(false)
  const measurementsBefore = useRef(state.bodyEntries)
  const initial = useRef({ look, zones: [...zones], height, sex, measured })
  const numeric = (value: string) => parseNumber(value) ?? value.trim()
  const dirty = look !== initial.current.look || sex !== initial.current.sex
    || numeric(height) !== numeric(initial.current.height) || numeric(measured) !== numeric(initial.current.measured)
    || JSON.stringify([...zones].sort()) !== JSON.stringify([...initial.current.zones].sort()) || measurementsChanged
  const { discard, confirm } = useUnsavedChanges(dirty)
  const file = useRef<HTMLInputElement>(null)
  const today = todayISO()
  const heightCm = parseNumber(height) ?? 0
  const override = parseNumber(measured)
  const validHeight = height.trim() === '' || (heightCm >= 120 && heightCm <= 230)
  const validBodyFat = measured.trim() === '' || (override !== null && override >= 4 && override <= 50)
  const bf = bodyFatEstimate(state, { override: override && override >= 4 && override <= 50 ? override : null, heightCm, sex })
  const goalDate = GOAL_DATE
  const plan = useMemo(() => (!MAINTENANCE && bf ? visualPlan(state, { look, bodyFat: bf, sex, today, goal: goalDate }) : null), [state, look, bf?.pct, sex, today, goalDate]) // eslint-disable-line react-hooks/exhaustive-deps
  const photo = photos.find((p) => p.id === GOAL_PHOTO_ID)
  const waistMissing = !state.bodyEntries.some((b) => typeof b.waist === 'number' && b.waist > 0)
  const weight = weightStatus(state, today)
  const noWeight = !weight.current || weight.stale
  const waistAge = bf?.source === 'tour de taille' && bf.waistDate ? diffDays(bf.waistDate, today) : 0
  const waistStale = waistAge > STALE_WAIST_DAYS
  const planDate = plan ? (plan.fits ? goalDate : (plan.suggestedGoal ?? goalDate)) : goalDate
  // The cut was sized when the goal was applied: the latest measurements may ask for another length.
  const drift = cutDrift(state, today)

  // What the chosen zones change: the exercises that take one more set, zone by zone, and from which week.
  const effects = useMemo(() => {
    const sets = prioritySets(state.templates, zones)
    const groups: { zone: Zone | null; label: string; sets: { type: WorkoutType; name: string }[] }[] = zones.length
      ? zones.map((z) => ({ zone: z, label: ZONES.find((x) => x.id === z)!.label, sets: [] }))
      : [{ zone: null, label: L('Priorités du programme', 'The program’s priorities'), sets: [] }]
    for (const x of sets) groups.find((g) => g.zone === x.zone)?.sets.push({ type: x.type, name: x.name })
    return groups
  }, [state.templates, zones])
  const start = prioritySetsStart(today)
  const apply = (goal?: string) => {
    if (!validHeight || !validBodyFat) return
    const preferences = { look, zones, bodyFat: override ?? null, heightCm, sex }
    if (MAINTENANCE || !plan) {
      if (!saveVisualPreferences(preferences)) {
        notify(L('Vérifie tes mesures avant d’enregistrer.', 'Check your measurements before saving.'), 'bad')
        return
      }
      notify(L('Préférences enregistrées.', 'Preferences saved.'), 'good')
      discard()
      return navigate('plus/reglages/objectifs')
    }
    applyVisualGoal(preferences, { cutWeeks: plan.cutWeeks, target: plan.target, goal })
    notify(L(`Objectif « ${lookInfo(look).label} » appliqué : plan recalculé.`, `Goal “${lookInfo(look).label}” applied: plan recalculated.`), 'good')
    discard()
    return navigate('')
  }
  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    await setGoalPhoto(await imageToDataUrl(f))
    notify(L('Photo de référence enregistrée sur ce téléphone.', 'Reference photo saved on this phone.'), 'good')
  }
  const paceHint = (r: PaceResult) => L(`≈ ${pct(r.pct)} de gras${r.look ? ` · ${r.look.label.toLowerCase()}` : ''}`, `≈ ${pct(r.pct)} body fat${r.look ? ` · ${r.look.label.toLowerCase()}` : ''}`)

  return (
    <Screen>
      <Header art="trophy"
        backTo="plus/reglages/objectifs"
        title={L('Physique et priorités', 'Physique and priorities')}
        sub={L('Choisis ton repère physique et les muscles à privilégier.', 'Choose your physique reference and priority muscles.')}
      />

      {(applied || MAINTENANCE) && saved && (
        <Card className="mb-3 flex items-center gap-3 p-4">
          <Target size={20} className="shrink-0 text-signal-text" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{MAINTENANCE ? L('Repère enregistré : ', 'Saved reference: ') : L('Objectif actif : ', 'Active goal: ')}{lookInfo(saved.look).label}</p>
            {!MAINTENANCE && <p className="text-[13px] leading-[1.45] text-text-2">{fmtNum(state.goals.targetWeightMin, 1)}–{kg(state.goals.targetWeightMax)} {L('d’ici le', 'by')} {nb(fmtDate(goalDate, { long: true, year: true }))}</p>}
            <p className="text-[13px] leading-[1.45] text-text-2">
              {!MAINTENANCE && L(`Sèche de ${plural(CUT_LENGTH, 'semaine', 'semaines')}`, `${CUT_LENGTH}-week cut`)}{zonesText(saved.zones) ? `${MAINTENANCE ? '' : ' · '}${L('Priorités : ', 'Priorities: ')}${zonesText(saved.zones)}` : ''}
            </p>
            {drift && (
              <p className="mt-1 text-[13px] leading-[1.45] text-warn">
                {drift.needed === 0
                  ? L('Ton dernier tour de taille te place déjà dans cet objectif : applique les modifications du plan.', 'Your latest waist measurement already puts you at this goal: apply the plan changes.')
                  : L(`Ton dernier tour de taille demande ${plural(drift.needed, 'semaine', 'semaines')} de sèche : applique les modifications du plan.`, `Your latest waist measurement calls for a cut of ${drift.needed} weeks: apply the plan changes.`)}
              </p>
            )}
          </div>
        </Card>
      )}

      <Section art="body-target" title={MAINTENANCE ? L('Repère physique', 'Physique reference') : L('Physique visé', 'Target physique')} className={(MAINTENANCE || applied) && saved ? undefined : 'mt-0'}>
        <div className="grid gap-2" role="group" aria-label={MAINTENANCE ? L('Repère physique', 'Physique reference') : L('Physique visé', 'Target physique')}>
          {LOOKS.map((l) => {
            const on = l.id === look
            const r = l.range[sex]
            return (
              <button
                key={l.id}
                type="button"
                aria-pressed={on}
                onClick={() => setLook(l.id)}
                className={cx('pressable card flex items-start gap-3 p-4 text-left', on ? 'border-signal shadow-[0_0_0_1px_var(--signal)]' : 'hover:border-line-strong')}
              >
                <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong')}>
                  {on && <Check size={12} strokeWidth={3} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[16px] font-semibold">{l.label}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-text-2 tnum">{r[0]}–{pct(r[1])} {L('de gras', 'body fat')}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-2">{l.text}</span>
                  {l.note && on && <span className="mt-1.5 block text-[12px] leading-[1.45] text-warn">{l.note}</span>}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Repères visuels indicatifs : à taux égal, la musculature et la répartition du gras varient. Aucun résultat visuel n’est garanti.', 'Visual references for guidance only: at the same body fat, musculature and fat distribution vary. No visual outcome is guaranteed.')}</p>
      </Section>

      <Section art="dumbbell" title={L('Zones prioritaires', 'Priority areas')} action={<span className="text-[13px] text-text-2 tnum">{zones.length}/{MAX_ZONES}</span>}>
        <ZonePicker value={zones} onChange={setZones} />
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">
          {L('Jusqu’à 3 zones. Le programme peut ajouter une série sur un exercice de ces muscles.', 'Up to 3 areas. The program can add a set to an exercise for these muscles.')}
          {zones.length === 0 && L(` Sans choix : ${zonesText(DEFAULT_ZONES)}.`, ` If none is chosen: ${zonesText(DEFAULT_ZONES)}.`)}
        </p>
        <Disclosure title={L('Effet sur les séances', 'Effect on workouts')} className="mt-3">
        <Card className="divide-y divide-line">
          {effects.map((g) => (
            <div key={g.zone ?? 'programme'} className="px-4 py-3">
              <p className="text-[14px] font-semibold">{g.label} <span className="font-normal text-text-2">· {g.sets.length ? L(`+1 série sur ${plural(g.sets.length, 'exercice', 'exercices')}`, `+1 set on ${plural(g.sets.length, 'exercise', 'exercises')}`) : L('aucun exercice dans tes séances', 'no exercise in your workouts')}</span></p>
              {g.sets.map((x, i) => (
                <p key={i} className="mt-0.5 text-[13px] leading-[1.45] text-text-2">{TYPE_META[x.type].label}{L(' : ', ': ')}{x.name}</p>
              ))}
            </div>
          ))}
          <p className="px-4 py-3 text-[13px] leading-[1.45] text-text-2">
            <span className="block text-[14px] font-semibold text-text">{L('Début des séries supplémentaires', 'When extra sets start')}</span>
            {!start
              ? L('Plus aucune semaine du plan n’ajoute ces séries.', 'No remaining week of the plan adds these sets.')
              : start.running
                ? L(`En cours depuis le ${nb(fmtDate(start.date, { long: true }))} (${start.label})${start.ifRising ? ', sur les exercices dont les performances ont monté en début de bloc' : ''}.`, `Running since ${nb(fmtDate(start.date, { long: true }))} (${start.label})${start.ifRising ? ', on the exercises whose performance went up early in the block' : ''}.`)
                : L(`Le ${nb(fmtDate(start.date, { long: true, year: true }))} (${start.label}, semaine ${start.week})${start.ifRising ? ', sur les exercices dont les performances montent les deux premières semaines du bloc' : ''}.`, `On ${nb(fmtDate(start.date, { long: true, year: true }))} (${start.label}, week ${start.week})${start.ifRising ? ', on the exercises whose performance goes up in the first two weeks of the block' : ''}.`)}
            {start?.sure && L(` Sans condition à partir du ${nb(fmtDate(start.sure.date, { long: true, year: true }))} (${start.sure.label}, sèche).`, ` With no condition from ${nb(fmtDate(start.sure.date, { long: true, year: true }))} (${start.sure.label}, cut).`)}
            {start && !start.running && L(' D’ici là, tes séances ne changent pas.', ' Until then, your workouts don’t change.')}
          </p>
        </Card>
        </Disclosure>
      </Section>

      <Section art="measuring-tape" title={L('Où tu en es', 'Where you stand')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L('Taille (cm)', 'Height (cm)')} error={!validHeight ? L('Entre 120 et 230 cm.', 'Between 120 and 230 cm.') : undefined}><MeasurementPicker label={L('Taille', 'Height')} unit="cm" value={height} onChange={setHeight} min={120} max={230} defaultValue={178} invalid={!validHeight} placeholder="—" /></Field>
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Sexe', 'Sex')}</p>
            <Segmented label={L('Sexe', 'Sex')} value={sex} layout="fit" onChange={setSex} options={[{ value: 'm', label: L('Homme', 'Male') }, { value: 'f', label: L('Femme', 'Female') }]} />
          </div>
          <Field label={L('Taux de gras mesuré (%), facultatif', 'Measured body fat (%), optional')} hint={L('Impédancemètre, DEXA… Laisse vide pour utiliser l’estimation.', 'Bioimpedance scale, DEXA… Leave blank to use the estimate.')} error={!validBodyFat ? L('Entre 4 et 50 % ou laisse vide.', 'Between 4 and 50%, or leave blank.') : undefined} className="col-span-2">
            <MeasurementPicker label={L('Taux de gras mesuré', 'Measured body fat')} unit="%" value={measured} onChange={setMeasured} min={4} max={50} step={0.1} defaultValue={bf?.pct ?? 20} invalid={!validBodyFat} placeholder={bf && bf.source === 'tour de taille' ? `≈ ${fmtNum(bf.pct, 0)}` : '—'} />
          </Field>
        </div>
        {bf ? (
          <Card className="divide-y divide-line">
            <Line label={L('Taux de gras', 'Body fat')} value={`≈ ${pct(bf.pct)}`} hint={bf.source === 'mesure' ? L('Valeur mesurée', 'Measured value') : bf.source === 'imc' ? L('Estimé avec ton IMC (poids, taille, âge) · formule de Deurenberg', 'Estimated from your BMI (weight, height, age) · Deurenberg formula') : L(`Estimé avec ton tour de taille (${fmtNum(bf.waist!, 0)} cm, ${nb(fmtRelativeDay(bf.waistDate!, today))}) · formule RFM`, `Estimated from your waist (${fmtNum(bf.waist!, 0)} cm, ${nb(fmtRelativeDay(bf.waistDate!, today))}) · RFM formula`)} />
            {plan && <Line label={L('Masse maigre', 'Lean mass')} value={kg(plan.lean)} hint={L(`Masse grasse ≈ ${kg(plan.fat)} sur ${kg(plan.weight)}`, `Fat mass ≈ ${kg(plan.fat)} of ${kg(plan.weight)}`)} />}
          </Card>
        ) : !MAINTENANCE ? (
          <Card className="mt-3 flex items-start gap-3 p-4">
            <Ruler size={24} className="mt-0.5 shrink-0 text-signal-text" aria-hidden />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{L('Quelques mesures pour commencer', 'A few measurements to get started')}</p>
              <p className="mt-1 text-[13px] leading-[1.5] text-text-2">
                {!heightCm ? L('Renseigne ta taille. ', 'Enter your height. ') : ''}
                {waistMissing ? L('Il faut un tour de taille (au nombril, à jeun) ou un taux mesuré.', 'You need a waist measurement (at the navel, fasted) or a measured body-fat percentage.') : ''}
              </p>
            </div>
          </Card>
        ) : null}
        {waistStale && (
          <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            {L('Tour de taille mesuré il y a', 'Waist measured')} {plural(Math.round(waistAge / 7), L('semaine', 'week'), L('semaines', 'weeks'))}{L(' : remesure-le (au nombril, à jeun) pour une estimation à jour.', ' ago: measure it again (at the navel, fasted) for an up-to-date estimate.')}
          </p>
        )}
        {!MAINTENANCE && (waistMissing || noWeight || waistStale) && (
          <Button variant="outline" full className="mt-2" icon={<Ruler size={16} aria-hidden />} onClick={() => { measurementsBefore.current = state.bodyEntries; setMeasureOpen(true) }}>
            {L('Compléter mes mesures', 'Complete my measurements')}
          </Button>
        )}
      </Section>

      {(MAINTENANCE || !plan) && <>
        <PageActions visible={dirty}><Button variant="primary" size="lg" full icon={<Check size={18} aria-hidden />} disabled={!validHeight || !validBodyFat} onClick={() => apply()}>{L('Enregistrer les préférences', 'Save preferences')}</Button></PageActions>
        {MAINTENANCE && saved && <Button variant="outline" full className="mt-5" icon={<RotateCcw size={18} aria-hidden />} onClick={async () => { if (!await confirm()) return; clearVisualGoal(); discard(); notify(L('Préférences physiques réinitialisées.', 'Physique preferences reset.')); return navigate('plus/reglages/objectifs') }}>{L('Réinitialiser les préférences', 'Reset preferences')}</Button>}
      </>}

      {plan && (
        <Section art="program" title={L('Le plan', 'The plan')}>
          <Card className="divide-y divide-line">
            <Line label={L(`Poids cible · ${plan.look.label}`, `Target weight · ${plan.look.label}`)} value={`${fmtNum(plan.target[0], 1)}–${kg(plan.target[1])}`} hint={L(`${plan.range[0]}–${pct(plan.range[1])} de gras, masse maigre conservée sans gain présumé`, `${plan.range[0]}–${pct(plan.range[1])} body fat, lean mass retained with no assumed gain`)} strong />
            <Line label={L('Sèche', 'Cut')} value={plan.cutWeeks === 0 ? L('Aucune', 'None') : plural(plan.cutWeeks, L('semaine', 'week'), L('semaines', 'weeks'))} hint={plan.cutWeeks === 0 ? L('Tu es déjà dans la fourchette : recomposition jusqu’à la date.', 'You’re already in the range: recomposition until the date.') : L(`Scénario prudent, limité par le budget de 500 kcal/j, pauses incluses${plan.cutWeeks !== CUT_WEEKS ? ` (le plan de base en prévoit ${CUT_WEEKS})` : ''}`, `Conservative scenario, capped by the 500 kcal/day budget, breaks included${plan.cutWeeks !== CUT_WEEKS ? ` (the base plan calls for ${CUT_WEEKS})` : ''}`)} />
            <Line label={L(`Au ${fmtDate(planDate, { long: true })}, rythme prudent`, `By ${fmtDate(planDate, { long: true })}, cautious pace`)} value={kg(plan.atGoal.prudent.weight)} hint={paceHint(plan.atGoal.prudent)} good={reachesLook(plan.atGoal.prudent.look, look)} />
            <Line label={L(`Au ${fmtDate(planDate, { long: true })}, rythme soutenu`, `By ${fmtDate(planDate, { long: true })}, brisk pace`)} value={kg(plan.atGoal.fast.weight)} hint={paceHint(plan.atGoal.fast)} good={reachesLook(plan.atGoal.fast.look, look)} />
          </Card>
          {plan.fits ? (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <Flag size={15} className="mt-0.5 shrink-0 text-signal-text" aria-hidden />
              {reachesLook(plan.atGoal.prudent.look, look)
                ? L(`Compatible avec le scénario prudent au ${nb(fmtDate(goalDate, { long: true, year: true }))}. Ce n’est pas une garantie de résultat.`, `Compatible with the conservative scenario by ${nb(fmtDate(goalDate, { long: true, year: true }))}. This is not a guarantee.`)
                : L(`Le résultat dépendra des mesures réelles et de la récupération ; réévalue la date plutôt que forcer le déficit.`, `The outcome depends on actual measurements and recovery; reassess the deadline rather than force the deficit.`)}
            </p>
          ) : (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              {plan.suggestedGoal
                ? L(`Le scénario prudent dépasse le ${fmtDate(goalDate, { long: true })} : date estimée ${nb(fmtDate(plan.suggestedGoal, { long: true, year: true }))}, ou garder la date avec un physique moins sec.`, `The conservative scenario extends past ${fmtDate(goalDate, { long: true })}: estimated date ${nb(fmtDate(plan.suggestedGoal, { long: true, year: true }))}, or keep the date with a less lean physique.`)
                : L('Trop loin pour un seul plan : choisis un physique moins sec pour commencer.', 'Too far for a single plan: choose a less lean physique to start with.')}
            </p>
          )}
          <PageActions visible={dirty}>
            {plan.fits ? (
              <Button variant="primary" size="lg" full icon={<Check size={18} aria-hidden />} disabled={!validHeight || !validBodyFat} onClick={() => apply()}>{applied ? L('Mettre à jour le plan', 'Update the plan') : L('Appliquer ce plan', 'Apply this plan')}</Button>
            ) : (
              <>
                {plan.suggestedGoal && <Button variant="primary" size="lg" full icon={<Check size={18} aria-hidden />} disabled={!validHeight || !validBodyFat} onClick={() => apply(plan.suggestedGoal!)}>{L('Viser le', 'Aim for')} {fmtDate(plan.suggestedGoal, { long: true, year: true })}</Button>}
                <Button variant="outline" size="lg" full icon={<Flag size={18} aria-hidden />} disabled={!validHeight || !validBodyFat} onClick={() => apply()}>{L('Garder le', 'Keep')} {fmtDate(goalDate, { long: true })} {L('(sèche plus courte)', '(shorter cut)')}</Button>
              </>
            )}
          </PageActions>
          {applied && <Button variant="outline" full className="mt-4" icon={<RotateCcw size={18} aria-hidden />} onClick={async () => { if (!await confirm()) return; clearVisualGoal(); discard(); notify(L('Objectif visuel retiré : plan de base rétabli.', 'Visual goal removed: base plan restored.')); return navigate('plus/reglages/objectifs') }}>{L('Retirer l’objectif visuel', 'Remove the visual goal')}</Button>}
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            {L('Appliquer fixe ton poids cible, la durée de la sèche (le calendrier est recalculé) et les zones prioritaires dans tes séances. Ton poids ne change jamais tes charges.', 'Applying sets your target weight, the length of the cut (the calendar is recalculated) and the priority areas in your workouts. Your weight never changes your loads.')}
          </p>
        </Section>
      )}

      <Disclosure icon={<SportArt kind="camera" size="title" />} title={L('Photo de référence', 'Reference photo')} className="mt-4">
        {photo ? (
          <div className="grid grid-cols-[120px_1fr] items-start gap-3">
            <img src={photo.dataUrl} alt={L('Photo de référence de l’objectif', 'Goal reference photo')} className="aspect-[3/4] w-full rounded-[10px] object-cover" />
            <div className="grid gap-2">
              <p className="text-[13px] leading-[1.45] text-text-2">{L('Compare-la à tes photos dans Progrès → Corps → Comparer.', 'Compare it with your photos in Progress → Body → Compare.')}</p>
              <Button size="sm" variant="soft" icon={<Camera size={15} aria-hidden />} aria-label={L('Changer la photo', 'Change photo')} onClick={() => file.current?.click()}>{L('Changer', 'Change')}</Button>
              <Button size="sm" variant="outline" icon={<ImageOff size={15} aria-hidden />} aria-label={L('Retirer la photo', 'Remove photo')} onClick={() => void setGoalPhoto(null)}>{L('Retirer', 'Remove')}</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => file.current?.click()} className="pressable flex w-full items-center gap-3 rounded-[12px] border border-dashed border-line-strong p-4 text-left hover:border-muted">
            <Camera size={20} className="shrink-0 text-text-2" aria-hidden />
            <span>
              <span className="block text-[15px] font-medium">{L('Ajouter une photo du physique visé', 'Add a photo of the physique you’re aiming for')}</span>
              <span className="block text-[13px] text-muted">{L('Pour la motivation et la comparaison. Elle reste sur cet appareil.', 'For motivation and comparison. It stays on this device.')}</span>
            </span>
          </button>
        )}
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = '' }} />
      </Disclosure>

      <Disclosure icon={<SportArt kind="evidence" size="title" />} title={L('Sur quoi ça repose', 'What this is based on')} className="mt-4">
        <ul className="space-y-2 text-[13px] leading-[1.5] text-text-2">
          <li>{L('Taux de gras estimé par la masse grasse relative (RFM), validée contre la DEXA : fiable pour suivre une tendance, à quelques points près pour une valeur isolée.', 'Body fat estimated with relative fat mass (RFM), validated against DEXA: reliable for tracking a trend, within a few points for a single value.')}</li>
          {!MAINTENANCE && <>
            <li>{L('Sèche entre −0,5 et −0,7 % du poids par semaine : au-delà, la masse maigre est moins bien préservée.', 'Cut between −0.5 and −0.7% of body weight per week: faster than that, lean mass is less well preserved.')}</li>
            <li>{L('Le calendrier ne suppose aucun gain de muscle. Le poids cible reste une estimation, à réévaluer avec des mesures récentes.', 'The calendar assumes no muscle gain. Target weight remains an estimate to revisit with recent measurements.')}</li>
          </>}
        </ul>
        <RefList refs={MAINTENANCE ? ['woolcott2018'] : ['woolcott2018', 'garthe2011', 'helms2014']} compact />
      </Disclosure>
      <MeasureSheet open={measureOpen} onClose={() => {
        if (!MAINTENANCE && useStore.getState().state.bodyEntries !== measurementsBefore.current) setMeasurementsChanged(true)
        setMeasureOpen(false)
      }} />
    </Screen>
  )
}

function Line({ label, value, hint, strong, good }: { label: string; value: string; hint?: string; strong?: boolean; good?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-[14px]">{label}</span>
        {hint && <span className={cx('mt-0.5 block text-[12px] leading-[1.4]', good ? 'text-good' : 'text-muted')}>{hint}</span>}
      </span>
      <span className={cx('shrink-0 text-right tnum', strong ? 'text-[16px] font-semibold' : 'text-[14px] font-semibold')}>{value}</span>
    </div>
  )
}
