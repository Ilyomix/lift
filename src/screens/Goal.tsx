import { useMemo, useRef, useState } from 'react'
import { Camera, Check, Flag, ImageOff, Ruler, Target, TriangleAlert } from 'lucide-react'
import { diffDays, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { CUT_LENGTH, CUT_WEEKS, GOAL_DATE } from '../lib/program'
import { navigate } from '../lib/router'
import { imageToDataUrl } from '../lib/share'
import { GOAL_PHOTO_ID, useStore } from '../lib/store'
import type { Look, Zone } from '../lib/types'
import { bodyFatEstimate, DEFAULT_ZONES, LOOKS, lookInfo, MAX_ZONES, reachesLook, visualPlan, ZONES, zonesText, type PaceResult } from '../lib/visual'
import { RefList } from '../components/Evidence'
import { Button, Card, cx, Field, Header, inputClass, Screen, Section } from '../components/ui'

const kg = (x: number) => `${fmtNum(x, 1)} kg`
const pct = (x: number) => `${fmtNum(x, 0)} %`
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
  const applied = !!saved?.cutWeeks
  const [look, setLook] = useState<Look>(saved?.look ?? 'taille')
  const [zones, setZones] = useState<Zone[]>(saved?.zones ?? [])
  const [height, setHeight] = useState(state.profile.heightCm ? String(state.profile.heightCm) : '')
  const [sex, setSex] = useState<'m' | 'f'>(state.profile.sex ?? 'm')
  const [measured, setMeasured] = useState(saved?.bodyFat ? String(saved.bodyFat).replace('.', ',') : '')
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
    notify(`Objectif « ${lookInfo(look).label} » appliqué : plan recalculé.`, 'good')
    navigate('')
  }
  const onPhoto = async (f: File | undefined) => {
    if (!f) return
    await setGoalPhoto(await imageToDataUrl(f))
    notify('Photo de référence enregistrée sur ce téléphone.', 'good')
  }
  const paceHint = (r: PaceResult) => `≈ ${pct(r.pct)} de gras${r.look ? ` · ${r.look.label.toLowerCase()}` : ''}`

  return (
    <Screen>
      <Header
        backTo="plus/reglages"
        eyebrow="Objectif"
        title="Objectif visuel"
        sub="Un physique se joue d’abord sur le taux de gras, puis sur le muscle. Choisis le look : l’app en déduit ton poids cible, la durée de sèche et les zones à travailler."
      />

      {applied && saved && (
        <Card className="mb-2 flex items-center gap-3 p-4">
          <Target size={20} className="shrink-0 text-signal-text" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Objectif actif : {lookInfo(saved.look).label}</p>
            <p className="text-[13px] leading-[1.45] text-text-2">{fmtNum(state.goals.targetWeightMin, 1)}–{kg(state.goals.targetWeightMax)} d’ici le {nb(fmtDate(GOAL_DATE, { long: true, year: true }))}</p>
            <p className="text-[13px] leading-[1.45] text-text-2">
              Sèche de {plural(CUT_LENGTH, 'semaine', 'semaines')}{zonesText(saved.zones) ? ` · priorités : ${zonesText(saved.zones)}` : ''}
            </p>
          </div>
        </Card>
      )}

      <Section title="Le look" className="mt-4">
        <div className="grid gap-2" role="radiogroup" aria-label="Look visé">
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
                    <span className="shrink-0 text-[13px] font-semibold text-text-2 tnum">{r[0]}–{pct(r[1])} de gras</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-2">{l.text}</span>
                  {l.note && on && <span className="mt-1.5 block text-[12px] leading-[1.45] text-warn">{l.note}</span>}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[12px] leading-[1.45] text-muted">Repères visuels indicatifs : à taux égal, la répartition du gras varie d’une personne à l’autre.</p>
      </Section>

      <Section title="Zones prioritaires" action={<span className="text-[13px] text-text-2 tnum">{zones.length}/{MAX_ZONES}</span>}>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Zones prioritaires">
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
          Une série de plus sur un exercice de chaque zone, à chaque séance qui la travaille, dès la S3 du bloc 2. Trois zones au plus : tout prioriser revient à ne rien prioriser.
          {zones.length === 0 && ` Sans choix : ${DEFAULT_ZONES.map((z) => ZONES.find((x) => x.id === z)!.label.toLowerCase()).join(', ')} (le V du programme).`}
        </p>
      </Section>

      <Section title="Où tu en es">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Taille (cm)"><input className={inputClass} inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="189" /></Field>
          <div className="min-w-0">
            <p className="mb-1.5 text-[13px] font-medium text-text-2">Sexe</p>
            <div className="grid h-12 grid-cols-2 gap-1 rounded-[10px] border border-line-strong p-1" role="radiogroup" aria-label="Sexe">
              {([['m', 'Homme'], ['f', 'Femme']] as const).map(([v, label]) => (
                <button key={v} type="button" role="radio" aria-checked={sex === v} onClick={() => setSex(v)} className={cx('pressable rounded-[7px] text-[14px] font-semibold', sex === v ? 'bg-text text-bg' : 'text-text-2')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Taux de gras mesuré (%)" hint="Impédancemètre, DEXA… sinon estimé" className="col-span-2">
            <input className={inputClass} inputMode="decimal" value={measured} onChange={(e) => setMeasured(e.target.value)} placeholder={bf && bf.source === 'tour de taille' ? `≈ ${fmtNum(bf.pct, 0)}` : '—'} />
          </Field>
        </div>
        {bf ? (
          <Card className="mt-3 divide-y divide-line">
            <Line label="Taux de gras" value={`≈ ${pct(bf.pct)}`} hint={bf.source === 'mesure' ? 'Valeur mesurée' : `Estimé avec ton tour de taille (${fmtNum(bf.waist!, 0)} cm, ${nb(fmtRelativeDay(bf.waistDate!, today))}) · formule RFM`} />
            {plan && <Line label="Masse maigre" value={kg(plan.lean)} hint={`Masse grasse ≈ ${kg(plan.fat)} sur ${kg(plan.weight)}`} />}
          </Card>
        ) : (
          <Card className="mt-3 p-4 text-[14px] leading-[1.45] text-text-2">
            {!heightCm ? 'Renseigne ta taille. ' : ''}
            {waistMissing ? 'Il faut un tour de taille (au nombril, à jeun) ou un taux mesuré.' : ''}
          </Card>
        )}
        {waistStale && (
          <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
            Tour de taille mesuré il y a {plural(Math.round(waistAge / 7), 'semaine', 'semaines')} : remesure-le (au nombril, à jeun) pour un plan à jour.
          </p>
        )}
        {(waistMissing || noWeight || waistStale) && (
          <Button variant="outline" full className="mt-2" icon={<Ruler size={16} aria-hidden />} onClick={() => navigate('progres/corps/mesure')}>
            {noWeight ? 'Ajouter une pesée' : 'Mesurer mon tour de taille'}
          </Button>
        )}
      </Section>

      {plan && (
        <Section title="Le plan">
          <Card className="divide-y divide-line">
            <Line label={`Poids cible · ${plan.look.label}`} value={`${fmtNum(plan.target[0], 1)}–${kg(plan.target[1])}`} hint={`${plan.range[0]}–${pct(plan.range[1])} de gras, muscle conservé (jusqu’à +2 kg de masse maigre)`} strong />
            <Line label="Sèche" value={plural(plan.cutWeeks, 'semaine', 'semaines')} hint={`À −0,6 %/semaine en moyenne${plan.cutWeeks !== CUT_WEEKS ? ` (le plan de base en prévoit ${CUT_WEEKS})` : ''}`} />
            <Line label={`Au ${fmtDate(planDate, { long: true })}, rythme prudent`} value={kg(plan.atGoal.prudent.weight)} hint={paceHint(plan.atGoal.prudent)} good={reachesLook(plan.atGoal.prudent.look, look)} />
            <Line label={`Au ${fmtDate(planDate, { long: true })}, rythme soutenu`} value={kg(plan.atGoal.fast.weight)} hint={paceHint(plan.atGoal.fast)} good={reachesLook(plan.atGoal.fast.look, look)} />
          </Card>
          {plan.fits ? (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <Flag size={15} className="mt-0.5 shrink-0 text-signal-text" aria-hidden />
              {reachesLook(plan.atGoal.prudent.look, look)
                ? `Tenable d’ici le ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))}, même au rythme prudent.`
                : `Tenable d’ici le ${nb(fmtDate(GOAL_DATE, { long: true, year: true }))} en tenant le rythme soutenu de la sèche (−0,7 %/semaine) : les calories s’ajustent sur ta courbe de poids.`}
            </p>
          ) : (
            <p className="mt-3 flex gap-2 text-[13px] leading-[1.45] text-text-2">
              <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              {plan.suggestedGoal
                ? `Pas tenable au ${fmtDate(GOAL_DATE, { long: true })} sans perdre de muscle : il faut aller jusqu’au ${nb(fmtDate(plan.suggestedGoal, { long: true, year: true }))}, ou garder la date avec un look moins sec.`
                : 'Trop loin pour un seul plan : choisis un look moins sec pour commencer.'}
            </p>
          )}
          <div className="mt-4 grid gap-2">
            {plan.fits ? (
              <Button variant="primary" size="lg" full onClick={() => apply()}>{applied ? 'Mettre à jour le plan' : 'Appliquer ce plan'}</Button>
            ) : (
              <>
                {plan.suggestedGoal && <Button variant="primary" size="lg" full onClick={() => apply(plan.suggestedGoal!)}>Viser le {fmtDate(plan.suggestedGoal, { long: true, year: true })}</Button>}
                <Button variant="outline" size="lg" full onClick={() => apply()}>Garder le {fmtDate(GOAL_DATE, { long: true })} (sèche plus courte)</Button>
              </>
            )}
            {applied && <Button variant="ghost" full onClick={() => { clearVisualGoal(); notify('Objectif visuel retiré : plan de base rétabli.') }}>Retirer l’objectif visuel</Button>}
          </div>
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            Appliquer fixe ton poids cible, la durée de la sèche (le calendrier est recalculé) et les zones prioritaires dans tes séances. Ton poids ne change jamais tes charges.
          </p>
        </Section>
      )}

      <Section title="Photo de référence">
        {photo ? (
          <div className="grid grid-cols-[120px_1fr] items-start gap-3">
            <img src={photo.dataUrl} alt="Photo de référence de l’objectif" className="aspect-[3/4] w-full rounded-[10px] object-cover" />
            <div className="grid gap-2">
              <p className="text-[13px] leading-[1.45] text-text-2">Compare-la à tes photos dans Progrès → Corps → Comparer.</p>
              <Button size="sm" variant="soft" icon={<Camera size={15} aria-hidden />} onClick={() => file.current?.click()}>Changer</Button>
              <Button size="sm" variant="ghost" icon={<ImageOff size={15} aria-hidden />} onClick={() => void setGoalPhoto(null)}>Retirer</Button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => file.current?.click()} className="pressable flex w-full items-center gap-3 rounded-[12px] border border-dashed border-line-strong p-4 text-left hover:border-muted">
            <Camera size={20} className="shrink-0 text-text-2" aria-hidden />
            <span>
              <span className="block text-[15px] font-medium">Ajouter une photo du physique visé</span>
              <span className="block text-[13px] text-muted">Pour la motivation et la comparaison. Elle reste sur ce téléphone.</span>
            </span>
          </button>
        )}
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = '' }} />
      </Section>

      <Section title="Sur quoi ça repose">
        <ul className="space-y-2 text-[13px] leading-[1.5] text-text-2">
          <li>Taux de gras estimé par la masse grasse relative (RFM), validée contre la DEXA : fiable pour suivre une tendance, à quelques points près pour une valeur isolée.</li>
          <li>Sèche entre −0,5 et −0,7 % du poids par semaine : au-delà, la masse maigre est moins bien préservée.</li>
          <li>Gain de muscle pendant une recomposition puis une sèche : modeste, 0 à 2 kg au mieux (opinion d’experts).</li>
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
