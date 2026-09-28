import { useMemo, useRef, useState } from 'react'
import { Camera, Check, Flag, ImageOff, Ruler, Target, TriangleAlert } from 'lucide-react'
import { diffDays, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { L } from '../lib/i18n'
import { CUT_LENGTH, CUT_WEEKS, GOAL_DATE } from '../lib/program'
import { navigate } from '../lib/router'
import { imageToDataUrl } from '../lib/share'
import { GOAL_PHOTO_ID, useStore } from '../lib/store'
import type { Look, Zone } from '../lib/types'
import { bodyFatEstimate, DEFAULT_ZONES, goalApplied, LOOKS, lookInfo, MAX_ZONES, reachesLook, visualPlan, ZONES, zonesText, type PaceResult } from '../lib/visual'
import { RefList } from '../components/Evidence'
import { Button, Card, cx, Field, Header, inputClass, Screen, Section } from '../components/ui'

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
  const { applyVisualGoal, clearVisualGoal, setGoalPhoto, notify } = useStore.getState()
  const saved = state.visualGoal
  const applied = goalApplied(saved)
  const [look, setLook] = useState<Look>(saved?.look ?? 'taille')
  const [zones, setZones] = useState<Zone[]>(saved?.zones ?? [])
  const [height, setHeight] = useState(state.profile.heightCm ? String(state.profile.heightCm) : '')
  const [sex, setSex] = useState<'m' | 'f'>(state.profile.sex ?? 'm')
  const [measured, setMeasured] = useState(saved?.bodyFat ? L(String(saved.bodyFat).replace('.', ','), String(saved.bodyFat)) : '')
  const file = useRef<HTMLInputElement>(null)
  const today = todayISO()
  const heightCm = parseNumber(height) ?? 0
  const override = parseNumber(measured)
  const bf = bodyFatEstimate(state, { override: override && override >= 3 && override <= 60 ? override : null, heightCm, sex })
  const plan = useMemo(() => (bf ? visualPlan(state, { look, bodyFat: bf, sex, today }) : null), [state, look, bf?.pct, sex, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const photo = photos.find((p) => p.id === GOAL_PHOTO_ID)
  const waistMissing = !state.bodyEntries.some((b) => typeof b.waist === 'number' && b.waist > 0)
  const noWeight = !state.bodyEntries.some((b) => typeof b.weight === 'number' && b.weight > 0)
  const waistAge = bf?.source === 'tour de taille' && bf.waistDate ? diffDays(bf.waistDate, today) : 0
  const waistStale = waistAge > STALE_WAIST_DAYS
  const planDate = plan ? (plan.fits ? GOAL_DATE : (plan.suggestedGoal ?? GOAL_DATE)) : GOAL_DATE

  const toggleZone = (z: Zone) => {
    setZones((cur) => (cur.includes(z) ? cur.filter((x) => x !== z) : cur.length >= MAX_ZONES ? cur : [...cur, z]))
  }
  const apply = (goal?: string) => {
    if (!plan) return
    applyVisualGoal({ look, zones, bodyFat: override ?? null, heightCm, sex }, { cutWeeks: plan.cutWeeks, target: plan.target, goal })
    notify(L(`Objectif « ${lookInfo(look).label} » appliqué : plan recalculé.`, `Goal “${lookInfo(look).label}” applied: plan recalculated.`), 'good')
    navigate('')
  }
  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    await setGoalPhoto(await imageToDataUrl(f))
    notify(L('Photo de référence enregistrée sur ce téléphone.', 'Reference photo saved on this phone.'), 'good')
  }
  const paceHint = (r: PaceResult) => L(`≈ ${pct(r.pct)} de gras${r.look ? ` · ${r.look.label.toLowerCase()}` : ''}`, `≈ ${pct(r.pct)} body fat${r.look ? ` · ${r.look.label.toLowerCase()}` : ''}`)

  return (
    <Screen>
      <Header
        backTo="plus/reglages"
        eyebrow={L('Objectif', 'Goal')}
        title={L('Objectif visuel', 'Visual goal')}
        sub={L('Un physique se joue d’abord sur le taux de gras, puis sur le muscle. Choisis le look : l’app en déduit ton poids cible, la durée de sèche et les zones à travailler.', 'A physique comes down to body fat first, then muscle. Choose the look: the app works out your target weight, how long to cut and which areas to work on.')}
      />

      {applied && saved && (
        <Card className="mb-2 flex items-center gap-3 p-4">
          <Target size={20} className="shrink-0 text-signal-text" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{L('Objectif actif : ', 'Active goal: ')}{lookInfo(saved.look).label}</p>
            <p className="text-[13px] leading-[1.45] text-text-2">{fmtNum(state.goals.targetWeightMin, 1)}–{kg(state.goals.targetWeightMax)} {L('d’ici le', 'by')} {nb(fmtDate(GOAL_DATE, { long: true, year: true }))}</p>
            <p className="text-[13px] leading-[1.45] text-text-2">
              {L(`Sèche de ${plural(CUT_LENGTH, 'semaine', 'semaines')}`, `${CUT_LENGTH}-week cut`)}{zonesText(saved.zones) ? L(` · priorités : ${zonesText(saved.zones)}`, ` · priorities: ${zonesText(saved.zones)}`) : ''}
            </p>
          </div>
        </Card>
      )}

      <Section title={L('Le look', 'The look')} className="mt-4">
        <div className="grid gap-2" role="radiogroup" aria-label={L('Look visé', 'Target look')}>
          {LOOKS.map((l) => {
            const on = l.id === look
            const r = l.range[sex]
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
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
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Repères visuels indicatifs : à taux égal, la répartition du gras varie d’une personne à l’autre.', 'Visual landmarks for guidance only: at the same body fat, fat distribution varies from one person to another.')}</p>
      </Section>

      <Section title={L('Zones prioritaires', 'Priority areas')} action={<span className="text-[13px] text-text-2 tnum">{zones.length}/{MAX_ZONES}</span>}>
        <div className="flex flex-wrap gap-2" role="group" aria-label={L('Zones prioritaires', 'Priority areas')}>
          {ZONES.map((z) => {
            const on = zones.includes(z.id)
            const full = !on && zones.length >= MAX_ZONES
            return (
              <button
                key={z.id}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => toggleZone(z.id)}
                className={cx('pressable h-10 rounded-full border px-4 text-[14px] font-semibold disabled:opacity-35', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2')}
              >
                {z.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">
          {L('Une série de plus sur un exercice de chaque zone, à chaque séance qui la travaille, dès la S3 du bloc 2. Trois zones au plus : tout prioriser revient à ne rien prioriser.', 'One extra set on one exercise per area, in every session that trains it, from W3 of block 2. Three areas at most: prioritizing everything means prioritizing nothing.')}
          {zones.length === 0 && L(` Sans choix : ${DEFAULT_ZONES.map((z) => ZONES.find((x) => x.id === z)!.label.toLowerCase()).join(', ')} (le V du programme).`, ` If none is chosen: ${DEFAULT_ZONES.map((z) => ZONES.find((x) => x.id === z)!.label.toLowerCase()).join(', ')} (the program’s V shape).`)}
        </p>
      </Section>

      <Section title={L('Où tu en es', 'Where you stand')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={L('Taille (cm)', 'Height (cm)')}><input className={inputClass} inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="189" /></Field>
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-medium text-text-2">{L('Sexe', 'Sex')}</p>
            <div className="grid h-12 grid-cols-2 gap-1 rounded-[10px] border border-line-strong p-1" role="radiogroup" aria-label={L('Sexe', 'Sex')}>
              {([['m', L('Homme', 'Male')], ['f', L('Femme', 'Female')]] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => setSex(v)} className={cx('pressable rounded-[7px] text-[14px] font-semibold', sex === v ? 'bg-text text-bg' : 'text-text-2')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Field label={L('Taux de gras mesuré (%)', 'Measured body fat (%)')} hint={L('Impédancemètre, DEXA… sinon estimé', 'Bioimpedance scale, DEXA… otherwise estimated')} className="col-span-2">
            <input className={inputClass} inputMode="decimal" value={measured} onChange={(e) => setMeasured(e.target.value)} placeholder={bf && bf.source === 'tour de taille' ? `≈ ${fmtNum(bf.pct, 0)}` : '—'} />
          </Field>
        </div>
        {bf ? (
          <Card className="mt-3 divide-y divide-line">
            <Line label={L('Taux de gras', 'Body fat')} value={`≈ ${pct(bf.pct)}`} hint={bf.source === 'mesure' ? L('Valeur mesurée', 'Measured value') : bf.source === 'imc' ? L('Estimé avec ton IMC (poids, taille, âge) · formule de Deurenberg', 'Estimated from your BMI (weight, height, age) · Deurenberg formula') : L(`Estimé avec ton tour de taille (${fmtNum(bf.waist!, 0)} cm, ${nb(fmtRelativeDay(bf.waistDate!, today))}) · formule RFM`, `Estimated from your waist (${fmtNum(bf.waist!, 0)} cm, ${nb(fmtRelativeDay(bf.waistDate!, today))}) · RFM formula`)} />
            {plan && <Line label={L('Masse maigre', 'Lean mass')} value={kg(plan.lean)} hint={L(`Masse grasse ≈ ${kg(plan.fat)} sur ${kg(plan.weight)}`, `Fat mass ≈ ${kg(plan.fat)} of ${kg(plan.weight)}`)} />}
          </Card>
        ) : (
          <Card className="mt-3 p-4 text-[14px] leading-[1.45] text-text-2">
            {!heightCm ? L('Renseigne ta taille. ', 'Enter your height. ') : ''}
            {waistMissing ? L('Il faut un tour de taille (au nombril, à jeun) ou un taux mesuré.', 'You need a waist measurement (at the navel, fasted) or a measured body fat.') : ''}
          </Card>
        )}
        {waistStale && (
          <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            {L('Tour de taille mesuré il y a', 'Waist measured')} {plural(Math.round(waistAge / 7), L('semaine', 'week'), L('semaines', 'weeks'))}{L(' : remesure-le (au nombril, à jeun) pour un plan à jour.', ' ago: measure it again (at the navel, fasted) for an up-to-date plan.')}
          </p>
        )}
        {(waistMissing || noWeight || waistStale) && (
          <Button variant="outline" full className="mt-2" icon={<Ruler size={16} aria-hidden />} onClick={() => navigate('progres/corps/mesure')}>
            {noWeight ? L('Ajouter une pesée', 'Add a weigh-in') : L('Mesurer mon tour de taille', 'Measure my waist')}
          </Button>
        )}
      </Section>

      {plan && (
        <Section title={L('Le plan', 'The plan')}>
          <Card className="divide-y divide-line">
            <Line label={L(`Poids cible · ${plan.look.label}`, `Target weight · ${plan.look.label}`)} value={`${fmtNum(plan.target[0], 1)}–${kg(plan.target[1])}`} hint={L(`${plan.range[0]}–${pct(plan.range[1])} de gras, muscle conservé (jusqu’à +2 kg de masse maigre)`, `${plan.range[0]}–${pct(plan.range[1])} body fat, muscle kept (up to +2 kg of lean mass)`)} strong />
            <Line label={L('Sèche', 'Cut')} value={plan.cutWeeks === 0 ? L('Aucune', 'None') : plural(plan.cutWeeks, L('semaine', 'week'), L('semaines', 'weeks'))} hint={plan.cutWeeks === 0 ? L('Tu es déjà dans la fourchette : recomposition jusqu’à la date.', 'You’re already in the range: recomposition until the date.') : L(`À −0,6 %/semaine en moyenne${plan.cutWeeks !== CUT_WEEKS ? ` (le plan de base en prévoit ${CUT_WEEKS})` : ''}`, `At −0.6%/week on average${plan.cutWeeks !== CUT_WEEKS ? ` (the base plan calls for ${CUT_WEEKS})` : ''}`)} />
            <Line label={L(`Au ${fmtDate(planDate, { long: true })}, rythme prudent`, `By ${fmtDate(planDate, { long: true })}, cautious pace`)} value={kg(plan.atGoal.prudent.weight)} hint={paceHint(plan.atGoal.prudent)} good={reachesLook(plan.atGoal.prudent.look, look)} />
            <Line label={L(`Au ${fmtDate(planDate, { long: true })}, rythme soutenu`, `By ${fmtDate(planDate, { long: true })}, brisk pace`)} value={kg(plan.atGoal.fast.weight)} hint={paceHint(plan.atGoal.fast)} good={reachesLook(plan.atGoal.fast.look, look)} />
          </Card>
          {plan.fits ? (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <Flag size={15} className="mt-0.5 shrink-0 text-signal-text" aria-hidden />
              {reachesLook(plan.atGoal.prudent.look, look)
                ? L(`Tenable d’ici le ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))}, même au rythme prudent.`, `Doable by ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))}, even at the cautious pace.`)
                : L(`Tenable d’ici le ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))} en tenant le rythme soutenu de la sèche (−0,7 %/semaine) : les calories s’ajustent sur ta courbe de poids.`, `Doable by ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))} if you hold the cut’s brisk pace (−0.7%/week): calories adjust to your weight curve.`)}
            </p>
          ) : (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              {plan.suggestedGoal
                ? L(`Pas tenable au ${fmtDate(GOAL_DATE, { long: true })} sans perdre de muscle : il faut aller jusqu’au ${nb(fmtDate(plan.suggestedGoal, { long: true, year: true }))}, ou garder la date avec un look moins sec.`, `Not doable by ${fmtDate(GOAL_DATE, { long: true })} without losing muscle: you need until ${nb(fmtDate(plan.suggestedGoal, { long: true, year: true }))}, or keep the date with a less lean look.`)
                : L('Trop loin pour un seul plan : choisis un look moins sec pour commencer.', 'Too far for a single plan: choose a less lean look to start with.')}
            </p>
          )}
          <div className="mt-4 grid gap-2">
            {plan.fits ? (
              <Button variant="primary" size="lg" full onClick={() => apply()}>{applied ? L('Mettre à jour le plan', 'Update the plan') : L('Appliquer ce plan', 'Apply this plan')}</Button>
            ) : (
              <>
                {plan.suggestedGoal && <Button variant="primary" size="lg" full onClick={() => apply(plan.suggestedGoal!)}>{L('Viser le', 'Aim for')} {fmtDate(plan.suggestedGoal, { long: true, year: true })}</Button>}
                <Button variant="outline" size="lg" full onClick={() => apply()}>{L('Garder le', 'Keep')} {fmtDate(GOAL_DATE, { long: true })} {L('(sèche plus courte)', '(shorter cut)')}</Button>
              </>
            )}
            {applied && <Button variant="ghost" full onClick={() => { clearVisualGoal(); notify(L('Objectif visuel retiré : plan de base rétabli.', 'Visual goal removed: base plan restored.')) }}>{L('Retirer l’objectif visuel', 'Remove the visual goal')}</Button>}
          </div>
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            {L('Appliquer fixe ton poids cible, la durée de la sèche (le calendrier est recalculé) et les zones prioritaires dans tes séances. Ton poids ne change jamais tes charges.', 'Applying sets your target weight, the length of the cut (the calendar is recalculated) and the priority areas in your sessions. Your weight never changes your loads.')}
          </p>
        </Section>
      )}

      <Section title={L('Photo de référence', 'Reference photo')}>
        {photo ? (
          <div className="grid grid-cols-[120px_1fr] items-start gap-3">
            <img src={photo.dataUrl} alt={L('Photo de référence de l’objectif', 'Goal reference photo')} className="aspect-[3/4] w-full rounded-[10px] object-cover" />
            <div className="grid gap-2">
              <p className="text-[13px] leading-[1.45] text-text-2">{L('Compare-la à tes photos dans Progrès → Corps → Comparer.', 'Compare it with your photos in Progress → Body → Compare.')}</p>
              <Button size="sm" variant="soft" icon={<Camera size={15} aria-hidden />} onClick={() => file.current?.click()}>{L('Changer', 'Change')}</Button>
              <Button size="sm" variant="ghost" icon={<ImageOff size={15} aria-hidden />} onClick={() => void setGoalPhoto(null)}>{L('Retirer', 'Remove')}</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => file.current?.click()} className="pressable flex w-full items-center gap-3 rounded-[12px] border border-dashed border-line-strong p-4 text-left hover:border-muted">
            <Camera size={20} className="shrink-0 text-text-2" aria-hidden />
            <span>
              <span className="block text-[15px] font-medium">{L('Ajouter une photo du physique visé', 'Add a photo of the physique you’re aiming for')}</span>
              <span className="block text-[13px] text-muted">{L('Pour la motivation et la comparaison. Elle reste sur ce téléphone.', 'For motivation and comparison. It stays on this phone.')}</span>
            </span>
          </button>
        )}
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = '' }} />
      </Section>

      <Section title={L('Sur quoi ça repose', 'What this is based on')}>
        <ul className="space-y-2 text-[13px] leading-[1.5] text-text-2">
          <li>{L('Taux de gras estimé par la masse grasse relative (RFM), validée contre la DEXA : fiable pour suivre une tendance, à quelques points près pour une valeur isolée.', 'Body fat estimated with relative fat mass (RFM), validated against DEXA: reliable for tracking a trend, within a few points for a single value.')}</li>
          <li>{L('Sèche entre −0,5 et −0,7 % du poids par semaine : au-delà, la masse maigre est moins bien préservée.', 'Cut between −0.5 and −0.7% of body weight per week: faster than that, lean mass is less well preserved.')}</li>
          <li>{L('Gain de muscle pendant une recomposition puis une sèche : modeste, 0 à 2 kg au mieux (opinion d’experts).', 'Muscle gain during a recomposition then a cut: modest, 0 to 2 kg at best (expert opinion).')}</li>
        </ul>
        <RefList refs={['woolcott2018', 'garthe2011', 'helms2014']} compact />
      </Section>
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
