import { useEffect, useRef, useState } from 'react'
import {
  Apple, BellRing, Check, ChevronLeft, ChevronRight, CirclePause, ClipboardPaste, Download, Flag, FlaskConical, MapPin, Pencil, Settings, Sparkles, Trash, Upload,
} from 'lucide-react'
import { requestNotifications, notificationsSupported } from '../lib/alerts'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { globalPrompt, parsePlanUpdate, previewPlanUpdate, sessionPrompt, type PlanUpdate } from '../lib/coach'
import { addDays, capitalize, DAYS, DAYS_LETTER, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { HOME_GYM } from '../lib/gyms'
import { contextAt, GOAL_DATE, trainingDays, TYPE_META } from '../lib/program'
import { disablePush, enablePush, preparePush, pushReady, pushSupported, testPush } from '../lib/push'
import { SOURCES } from '../lib/research'
import { navigate } from '../lib/router'
import { isIOS, isStandalone, saveFile, shareText } from '../lib/share'
import { calorieAdvice, goalWeightRange, nutritionDays, nutritionFor, proteinTargetFor } from '../lib/stats'
import { useStore } from '../lib/store'
import { Columns } from '../components/charts'
import { RefList } from '../components/Evidence'
import { GoalSheet } from '../components/GoalSheet'
import { Button, Card, cx, Empty, Field, Header, inputClass, Row, Screen, Section, Segmented, Sheet, Tag, Toggle } from '../components/ui'


export function MoreScreen() {
  const state = useStore((s) => s.state)
  const items = [
    { to: 'plus/nutrition', icon: Apple, label: 'Nutrition', hint: 'Calories, protéines, créatine' },
    { to: 'plus/programme', icon: FlaskConical, label: 'Programme et preuves', hint: `${Object.keys(SOURCES).length} études citées` },
    { to: 'plus/coach', icon: Sparkles, label: 'Coach Claude', hint: 'Bilan et mise à jour des cibles' },
    { to: 'plus/pause', icon: CirclePause, label: 'Pause du programme', hint: state.programPause.active ? 'En pause' : 'Vacances, maladie, blessure' },
    { to: 'plus/rappels', icon: BellRing, label: 'Rappels iPhone', hint: 'Séances, pesée, décharges' },
    { to: 'plus/donnees', icon: Download, label: 'Sauvegarde', hint: state.meta.lastBackupAt ? `Dernier export ${fmtRelativeDay(state.meta.lastBackupAt.slice(0, 10))}` : 'Jamais exportée' },
    { to: 'plus/reglages', icon: Settings, label: 'Réglages', hint: 'Objectifs, minuteur, apparence' },
  ]
  return (
    <Screen>
      <Header title="Plus" />
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
        Golgoth · programme fondé sur la recherche (rapport du 26 sept. 2026)
        <br />
        Données stockées sur cet appareil uniquement.
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
        <button type="button" aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong"><ChevronLeft size={18} /></button>
        <p className="text-[15px] font-semibold">{capitalize(fmtRelativeDay(date, today))}</p>
        <button type="button" aria-label="Jour suivant" disabled={date >= today} onClick={() => setDate(addDays(date, 1))} className="pressable inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-line-strong disabled:opacity-30"><ChevronRight size={18} /></button>
      </div>

      <Card className="mt-4 divide-y divide-line">
        <Counter label="Protéines" unit="g" value={e.protein} target={`${protein.min}–${protein.max} g`} onSet={(n) => setNutrition(date, { protein: n })} steps={[-10, 10, 25]} onAdd={(n) => add('protein', n)} />
        <Counter label="Calories" unit="kcal" value={e.calories} target={`${state.nutritionTargets.calories} kcal`} onSet={(n) => setNutrition(date, { calories: n })} steps={[-100, 100, 250]} onAdd={(n) => add('calories', n)} />
        <Toggle label="Créatine" hint={`${state.nutritionTargets.creatine} g par jour · fait retenir 1–2 kg d’eau`} checked={e.creatine > 0} onChange={(v) => setNutrition(date, { creatine: v ? state.nutritionTargets.creatine : 0 })} />
      </Card>

      <Section title="Calories : ajustement">
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{advice.headline}</p>
              <p className="mt-1 text-[14px] leading-[1.45] text-text-2">{advice.detail}</p>
            </div>
            {advice.status !== 'wait' && <Tag tone={advice.status === 'ok' ? 'good' : 'warn'}>{advice.status === 'ok' ? 'OK' : `${advice.delta > 0 ? '+' : '−'}${Math.abs(advice.delta)} kcal`}</Tag>}
          </div>
          {(advice.status === 'lower' || advice.status === 'raise') && (
            <Button variant="primary" full className="mt-3" onClick={() => { setNutritionTargets({ calories: advice.target }); notify(`Cible : ${advice.target} kcal. Prochain point dans 2 semaines.`, 'good') }}>
              Passer à {advice.target} kcal
            </Button>
          )}
          <p className="mt-3 text-[12px] leading-[1.45] text-muted">
            Tendance de ta moyenne de poids sur 7 jours (3 dernières semaines){advice.waist ? `, tour de taille ${advice.waist === 'down' ? 'en baisse' : advice.waist === 'up' ? 'en hausse' : 'stable'} sur un mois` : ''}. Pas de 150 kcal, puis 2 semaines pour que le poids réagisse. Le poids ne change jamais les charges.
          </p>
        </Card>
      </Section>

      <Section title="Protéines, 14 jours" action={<span className="text-[13px] text-text-2 tnum">{hit}/14 jours ≥ {protein.min} g</span>}>
        <Card className="p-4">
          <Columns
            ariaLabel="Protéines par jour sur 14 jours"
            bars={days.map((d) => ({ key: d.date, label: String(Number(d.date.slice(8))), value: d.protein, tooltip: <span>{fmtDate(d.date)} : {fmtNum(d.protein, 0)} g</span> }))}
            target={{ value: protein.min, label: `${protein.min} g` }}
            format={(v) => fmtNum(v, 0)}
          />
        </Card>
      </Section>

      <Section title="Cibles">
        <Card className="mb-3">
          <Toggle
            label="Protéines adaptées à ton poids"
            hint={adaptive && protein.weight ? `${protein.min}–${protein.max} g : ≈ ${fmtNum(protein.perKg![0], 1)}–${fmtNum(protein.perKg![1], 1)} g/kg × ${fmtNum(protein.weight, 1)} kg (moyenne 7 jours)` : adaptive ? 'Dès ta première pesée' : 'Fourchette fixe ci-dessous'}
            checked={adaptive}
            onChange={(v) => setNutritionTargets({ adaptive: v })}
          />
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)"><NumInput value={state.nutritionTargets.calories} onChange={(n) => setNutritionTargets({ calories: n })} /></Field>
          <Field label="Créatine (g)"><NumInput value={state.nutritionTargets.creatine} onChange={(n) => setNutritionTargets({ creatine: n })} /></Field>
          {!adaptive && (
            <>
              <Field label="Protéines min (g)"><NumInput value={state.nutritionTargets.proteinMin} onChange={(n) => setNutritionTargets({ proteinMin: n })} /></Field>
              <Field label="Protéines max (g)"><NumInput value={state.nutritionTargets.proteinMax} onChange={(n) => setNutritionTargets({ proteinMax: n })} /></Field>
            </>
          )}
        </div>
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">Aucune étude ne donne ta maintenance : les calories se règlent sur ta moyenne de poids. Protéines : ≈ 2 g/kg, un peu plus en sèche, jamais en baisse pendant la sèche.</p>
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
        <span className="text-[12px] text-muted">cible {target}</span>
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
      useStore.getState().notify('Colle le texte manuellement dans le champ.', 'bad')
    }
  }
  const preview = update ? previewPlanUpdate(state, update) : []
  return (
    <Screen>
      <Header backTo="plus" eyebrow="Coach" title="Claude" sub="Envoie un bilan précis à Claude, colle sa réponse : tes cibles se mettent à jour, avec un aperçu avant de valider." />
      <ol className="space-y-2">
        {['Partage un bilan (séance ou global).', 'Claude analyse et répond avec un bloc JSON.', 'Colle la réponse ici, vérifie, applique.'].map((s, i) => (
          <li key={i} className="flex gap-3 text-[14px] text-text-2"><span className="font-semibold text-text tnum">{i + 1}.</span>{s}</li>
        ))}
      </ol>
      <div className="mt-5 grid gap-2">
        <Button variant="ink" size="lg" full icon={<Sparkles size={18} aria-hidden />} disabled={!last} onClick={() => last && void shareText(sessionPrompt(state, last), `Séance ${last.sessionNumber}`)}>
          {last ? `Bilan de la séance n°${last.sessionNumber}` : 'Aucune séance'}
        </Button>
        <Button variant="outline" size="lg" full onClick={() => void shareText(globalPrompt(state), 'Bilan Golgoth')}>Bilan global du programme</Button>
      </div>

      <Section title="Réponse de Claude" action={<Button size="sm" variant="ghost" icon={<ClipboardPaste size={15} aria-hidden />} onClick={paste}>Coller</Button>}>
        <textarea className={cx(inputClass, 'h-36 resize-none py-2.5 font-mono')} value={text} onChange={(e) => setText(e.target.value)} placeholder="Colle ici la réponse complète : le bloc JSON est détecté automatiquement." />
        {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
        <Button variant="outline" full className="mt-2" disabled={!text.trim()} onClick={analyze}>Analyser</Button>
      </Section>

      {update && (
        <Section title="Aperçu">
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
            {update.nutritionTargets && <div className="px-4 py-3 text-[13px] text-text-2">Nutrition : {Object.entries(update.nutritionTargets).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>}
          </Card>
          <Button variant="primary" size="lg" full className="mt-3" onClick={() => { applyPlan(update); setUpdate(null); setText(''); useStore.getState().notify('Cibles mises à jour.', 'good') }}>
            Appliquer {plural(update.changes.length, 'changement', 'changements')}
          </Button>
        </Section>
      )}

      <Section title="Historique des mises à jour">
        {state.appliedPlanUpdates.length ? (
          <Card className="divide-y divide-line">
            {[...state.appliedPlanUpdates].reverse().slice(0, 12).map((u) => (
              <div key={u.updateId + u.appliedAt} className="px-4 py-3">
                <p className="text-[12px] text-muted">{fmtDate(u.appliedAt.slice(0, 10), { year: true })} · {plural(u.changeCount, 'changement', 'changements')}{u.source ? ` · ${u.source === 'claude' ? 'Claude' : u.source === 'program' ? 'programme' : 'progression'}` : ''}</p>
                <p className="mt-0.5 text-[14px] leading-[1.45]">{u.summary}</p>
              </div>
            ))}
          </Card>
        ) : (
          <Empty title="Aucune mise à jour" />
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
  const days = trainingDays(state)
  const perWeek = days.length
  return (
    <Screen>
      <Header backTo="plus" title="Réglages" />

      <Section title="Objectif" className="mt-0">
        <Card className="divide-y divide-line">
          <Row
            label="Date objectif"
            hint="Le plan (recomposition, sèche, stabilisation) se recalcule autour"
            value={<span className="inline-flex items-center gap-1.5 font-medium text-text"><Flag size={14} className="text-signal-text" aria-hidden />{fmtDate(GOAL_DATE, { long: true, year: true })}</span>}
            right={<Pencil size={14} className="text-muted" aria-hidden />}
            onClick={() => setGoalOpen(true)}
          />
          <div className="px-4 py-3.5">
            <p className="text-[15px]">Jours d’entraînement</p>
            <div className="mt-2.5 grid grid-cols-7 gap-1.5" role="group" aria-label="Jours d’entraînement">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = days.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    aria-label={DAYS[d]}
                    onClick={() => toggleTrainingDay(d)}
                    className={cx('pressable h-11 rounded-[10px] border text-[14px] font-semibold', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong text-text-2')}
                  >
                    {DAYS_LETTER[d]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2.5 text-[13px] leading-[1.45] text-text-2">
              {plural(perWeek, 'séance', 'séances')} par semaine. {perWeek === 5
                ? 'Le rythme du programme : chaque muscle 2 fois par semaine.'
                : perWeek < 5
                  ? `La rotation Upper → Legs continue sur ${perWeek} jours : chaque séance revient moins souvent, environ ${Math.round((perWeek / 5) * 100)} % du volume hebdomadaire prévu.`
                  : `Environ ${Math.round((perWeek / 5) * 100)} % du volume prévu : surveille la récupération (sommeil, performances).`}
            </p>
          </div>
        </Card>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Poids cible min (kg)" hint={goal?.computed ? `Plan : ${fmtNum(goal.min, 0)} kg` : undefined}>
            <GoalInput value={state.goals.targetWeightMin || null} placeholder={goal ? fmtNum(goal.min, 0) : ''} onChange={(n) => setGoals({ targetWeightMin: n ?? 0 })} />
          </Field>
          <Field label="Poids cible max (kg)" hint={goal?.computed ? `Plan : ${fmtNum(goal.max, 0)} kg` : undefined}>
            <GoalInput value={state.goals.targetWeightMax || null} placeholder={goal ? fmtNum(goal.max, 0) : ''} onChange={(n) => setGoals({ targetWeightMax: n ?? 0 })} />
          </Field>
          <Field label="Tour de taille cible (cm)" className="col-span-2"><GoalInput value={state.goals.targetWaist} placeholder="—" onChange={(n) => setGoals({ targetWaist: n })} /></Field>
        </div>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">Sans valeur, la cible vient de la trajectoire du plan (recomposition à poids stable, puis sèche à −0,5 %/semaine). Taux de gras et poids cible restent des estimations : ajuste avec ton tour de taille et tes photos.</p>
      </Section>

      <Section title="Séances">
        <Card className="divide-y divide-line">
          <Toggle
            label="Charges automatiques"
            hint="Après chaque séance : charge augmentée quand toutes les séries touchent le haut de la fourchette, baissée quand elles restent sous le bas. Pendant la séance, les séries suivantes s’ajustent. Tout reste annulable."
            checked={state.prefs.autoLoad}
            onChange={(v) => setPrefs({ autoLoad: v })}
          />
        </Card>
        <GymManager />
      </Section>

      <Section title="Minuteur de repos">
        <Card className="divide-y divide-line">
          <Toggle label="Son de fin de repos" hint="Trois tons courts, par-dessus ta musique" checked={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
          <Toggle label="Garder l’écran allumé" hint="Pendant la séance, pour voir le minuteur" checked={state.prefs.wakeLock} onChange={(v) => setPrefs({ wakeLock: v })} />
          <PushRow />
          {!state.prefs.push && (
            <Row
              label="Alerte dans l’app"
              hint={perm === 'granted' ? 'Activée : quand l’app est ouverte' : perm === 'denied' ? 'Refusée dans les réglages iOS' : perm === 'unsupported' ? (isIOS() && !isStandalone() ? 'Installe d’abord l’app sur l’écran d’accueil' : 'Non disponible') : 'Alerte système quand le repos se termine, app ouverte'}
              right={perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' ? <Button size="sm" variant="ink" onClick={async () => { const p = await requestNotifications(); setPerm(p); setPrefs({ notifications: p === 'granted' }) }}>Activer</Button> : undefined}
            />
          )}
        </Card>
      </Section>

      <Section title="Apparence">
        <Segmented label="Thème" value={state.prefs.theme} onChange={(t) => setPrefs({ theme: t })} options={[{ value: 'auto', label: 'Automatique' }, { value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }]} />
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Couleur d’accent">
          {([['blue', 'Bleu', '#3068f5'], ['orange', 'Orange', '#ff7b00']] as const).map(([v, label, color]) => (
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

      <Section title="Installer sur l’iPhone">
        <Card className="p-4">
          {isStandalone() ? (
            <p className="text-[14px] text-text-2">Golgoth est installée : elle fonctionne hors ligne.</p>
          ) : (
            <ol className="space-y-2 text-[14px] leading-[1.45] text-text-2">
              <li><span className="font-semibold text-text">1.</span> Ouvre cette page dans Safari.</li>
              <li><span className="font-semibold text-text">2.</span> Touche Partager, puis « Sur l’écran d’accueil ».</li>
              <li><span className="font-semibold text-text">3.</span> Lance Golgoth depuis l’icône : plein écran, hors ligne, notifications possibles.</li>
            </ol>
          )}
        </Card>
      </Section>
      {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
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
        label="Notifications écran verrouillé"
        hint={isIOS() && !installed ? 'Installe d’abord Golgoth sur l’écran d’accueil (Partager → Sur l’écran d’accueil), puis ouvre-la depuis l’icône.' : 'Non disponibles sur ce navigateur.'}
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
        notify('Activées. Touche « Tester » puis verrouille le téléphone.', 'good')
      } else if (r === 'denied') {
        notify('Notifications refusées : Réglages iOS → Notifications → Golgoth.', 'bad')
      } else {
        notify('Notifications non disponibles ici.', 'bad')
      }
    } catch (e) {
      notify((e as Error).message || 'Activation impossible.', 'bad')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Toggle
        label="Notifications écran verrouillé"
        hint={active ? 'Fin de repos envoyée par le serveur Golgoth, même app fermée.' : 'La fin du repos arrive même téléphone verrouillé ou app en arrière-plan.'}
        checked={active || busy}
        onChange={(v) => void toggle(v)}
      />
      {active && (
        <div className="flex items-center justify-between gap-3 px-4 pb-3">
          <p className="text-[12px] leading-[1.4] text-muted">Aucun compte : le serveur garde l’abonnement une heure au plus, le temps d’un repos.</p>
          <Button size="sm" variant="soft" onClick={() => { if (testPush(8)) notify('Verrouille ton téléphone : notification dans 8 s.') }}>Tester</Button>
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
                <input data-autofocus className={cx(inputClass, 'h-10')} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nom de la salle" />
                <Button type="submit" size="sm" variant="ink">OK</Button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => selectGym(g.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px]">{g.name}</span>
                  <span className="block text-[12px] text-muted">{g.id === current ? 'Prochaine séance ici' : g.id === HOME_GYM ? 'Salle principale' : 'Toucher pour la choisir'}</span>
                </button>
                <button type="button" onClick={() => { setEdit(g.id); setName(g.name) }} aria-label={`Renommer ${g.name}`} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:text-text"><Pencil size={15} aria-hidden /></button>
                {g.id !== HOME_GYM && (
                  <button type="button" onClick={() => removeGym(g.id)} aria-label={`Supprimer ${g.name}`} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-[8px] text-muted hover:text-bad"><Trash size={15} aria-hidden /></button>
                )}
              </>
            )}
          </div>
        ))}
      </Card>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { addGym(adding); setAdding('') } }}>
        <input className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Ajouter une salle" aria-label="Nom de la nouvelle salle" />
        <Button type="submit" variant="ink" size="lg" disabled={!adding.trim()}>Ajouter</Button>
      </form>
      <p className="mt-2 text-[12px] leading-[1.45] text-muted">Machines, poulies et Smith : charges et historique propres à chaque salle. Haltères, barres, poids du corps : communs.</p>
    </div>
  )
}

function GoalInput({ value, onChange, placeholder }: { value: number | null; onChange: (n: number | null) => void; placeholder?: string }) {
  const [t, setT] = useState(value === null ? '' : String(value).replace('.', ','))
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
    void saveFile(`golgoth-${todayISO()}.json`, JSON.stringify(b), 'application/json')
  }
  return (
    <Screen>
      <Header backTo="plus" title="Sauvegarde" sub="Tes données vivent sur ce téléphone (IndexedDB). Exporte régulièrement : le fichier contient séances, mesures, nutrition et photos." />
      <Card className="divide-y divide-line">
        <Row label="Séances" value={<span className="tnum">{state.workouts.length}</span>} />
        <Row label="Mesures" value={<span className="tnum">{state.bodyEntries.length}</span>} />
        <Row label="Photos" value={<span className="tnum">{photos.length}</span>} />
        <Row label="Dernier export" value={state.meta.lastBackupAt ? fmtRelativeDay(state.meta.lastBackupAt.slice(0, 10)) : 'jamais'} />
      </Card>
      <div className="mt-4 grid gap-2">
        <Button variant="primary" size="lg" full icon={<Download size={18} aria-hidden />} onClick={doExport}>Exporter la sauvegarde</Button>
        <Button variant="outline" size="lg" full icon={<Upload size={18} aria-hidden />} onClick={() => file.current?.click()}>Importer une sauvegarde</Button>
        <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">Compatible avec les sauvegardes de ton ancien Golgoth Tracker (même format).</p>

      <Section title="Zone sensible">
        <Button variant="danger" full onClick={() => setReset(true)}>Tout effacer sur cet appareil</Button>
      </Section>

      <ImportSheet parsed={parsed} upgrade={upgrade} setUpgrade={setUpgrade} onClose={() => setParsed(null)} onConfirm={async () => { await importBackup(parsed!, { upgrade }); setParsed(null); navigate('') }} />
      <Sheet open={reset} onClose={() => setReset(false)} title="Tout effacer ?" footer={<div className="flex gap-2"><Button variant="outline" size="lg" className="flex-1" onClick={() => setReset(false)}>Annuler</Button><Button variant="danger" size="lg" className="flex-1" onClick={async () => { await resetAll(); navigate('') }}>Effacer</Button></div>}>
        <p className="text-[15px] leading-[1.5] text-text-2">Séances, mesures, photos et réglages seront supprimés de cet appareil. Exporte une sauvegarde avant si tu veux les garder.</p>
      </Sheet>
    </Screen>
  )
}

export function ImportSheet({ parsed, upgrade, setUpgrade, onClose, onConfirm }: { parsed: ParsedBackup | null; upgrade: boolean; setUpgrade: (v: boolean) => void; onClose: () => void; onConfirm: () => void }) {
  if (!parsed) return null
  const s = parsed.summary
  return (
    <Sheet open onClose={onClose} title="Importer cette sauvegarde" footer={<Button variant="primary" size="lg" full onClick={onConfirm}>Importer</Button>}>
      <Card className="divide-y divide-line">
        <Row label="Séances" value={<span className="tnum">{s.workouts}</span>} />
        <Row label="Mesures" value={<span className="tnum">{s.bodyEntries}</span>} />
        <Row label="Jours de nutrition" value={<span className="tnum">{s.nutritionDays}</span>} />
        <Row label="Photos" value={<span className="tnum">{s.photos}</span>} />
        {s.exportedAt && <Row label="Exportée" value={fmtDate(s.exportedAt.slice(0, 10), { year: true })} />}
      </Card>
      {parsed.legacy && (
        <Card className="mt-4">
          <Toggle
            checked={upgrade}
            onChange={setUpgrade}
            label="Passer au programme fondé sur la recherche"
            hint="Recommandé. Tes charges sont reprises ; l’historique reste intact ; l’ancien programme est archivé."
          />
        </Card>
      )}
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">L’import remplace les données actuelles de cet appareil.</p>
    </Sheet>
  )
}

