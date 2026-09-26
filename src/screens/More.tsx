import { useRef, useState } from 'react'
import {
  Apple, BellRing, ChevronLeft, ChevronRight, CirclePause, ClipboardPaste, Download, FlaskConical, Settings, Sparkles, Upload,
} from 'lucide-react'
import { requestNotifications, notificationsSupported } from '../lib/alerts'
import { parseBackup, type ParsedBackup } from '../lib/backup'
import { globalPrompt, parsePlanUpdate, previewPlanUpdate, sessionPrompt, type PlanUpdate } from '../lib/coach'
import { addDays, capitalize, fmtDate, fmtRelativeDay, todayISO } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { contextAt, TYPE_META } from '../lib/program'
import { SOURCES } from '../lib/research'
import { navigate } from '../lib/router'
import { isIOS, isStandalone, saveFile, shareText } from '../lib/share'
import { cutAdvice, goalWeightRange, nutritionDays, nutritionFor, proteinTargetFor } from '../lib/stats'
import { useStore } from '../lib/store'
import { Columns } from '../components/charts'
import { RefList } from '../components/Evidence'
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
  const { setNutrition, setNutritionTargets } = useStore.getState()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const e = nutritionFor(state, date)
  const protein = proteinTargetFor(state, date)
  const ctx = contextAt(date)
  const days = nutritionDays(state, 14, today)
  const advice = cutAdvice(state, today)
  const hit = days.filter((d) => d.protein >= protein.min).length
  const add = (k: 'calories' | 'protein', n: number) => setNutrition(date, { [k]: Math.max(0, (e[k] ?? 0) + n) })
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

      {advice && (
        <Section title="Ajustement de la sèche">
          <Card className="p-4 text-[14px] leading-[1.5]">{advice}</Card>
        </Section>
      )}

      <Section title="Cibles">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)"><NumInput value={state.nutritionTargets.calories} onChange={(n) => setNutritionTargets({ calories: n })} /></Field>
          <Field label="Créatine (g)"><NumInput value={state.nutritionTargets.creatine} onChange={(n) => setNutritionTargets({ creatine: n })} /></Field>
          <Field label="Protéines min (g)"><NumInput value={state.nutritionTargets.proteinMin} onChange={(n) => setNutritionTargets({ proteinMin: n })} /></Field>
          <Field label="Protéines max (g)"><NumInput value={state.nutritionTargets.proteinMax} onChange={(n) => setNutritionTargets({ proteinMax: n })} /></Field>
        </div>
        <p className="mt-3 text-[13px] leading-[1.45] text-text-2">Aucune étude ne donne ta maintenance : ajuste les calories selon ta moyenne de poids sur 7 jours. En sèche, les protéines montent à 185–200 g automatiquement.</p>
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
  const { setPrefs, setGoals } = useStore.getState()
  const goal = goalWeightRange(state)
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported')
  return (
    <Screen>
      <Header backTo="plus" title="Réglages" />
      <Section title="Apparence" className="mt-0">
        <Segmented label="Thème" value={state.prefs.theme} onChange={(t) => setPrefs({ theme: t })} options={[{ value: 'auto', label: 'Automatique' }, { value: 'dark', label: 'Sombre' }, { value: 'light', label: 'Clair' }]} />
      </Section>

      <Section title="Minuteur de repos">
        <Card className="divide-y divide-line">
          <Toggle label="Son de fin de repos" hint="Trois tons courts, par-dessus ta musique" checked={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
          <Toggle label="Garder l’écran allumé" hint="Pendant la séance, pour que le minuteur sonne" checked={state.prefs.wakeLock} onChange={(v) => setPrefs({ wakeLock: v })} />
          <Row
            label="Notifications"
            hint={perm === 'granted' ? 'Activées' : perm === 'denied' ? 'Refusées dans les réglages iOS' : perm === 'unsupported' ? (isIOS() && !isStandalone() ? 'Installe d’abord l’app sur l’écran d’accueil' : 'Non disponibles') : 'Alerte système quand le repos se termine'}
            right={perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' ? <Button size="sm" variant="ink" onClick={async () => { const p = await requestNotifications(); setPerm(p); setPrefs({ notifications: p === 'granted' }) }}>Activer</Button> : undefined}
          />
        </Card>
      </Section>

      <Section title="Objectifs">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Poids cible min (kg)" hint={goal?.computed ? `Plan : ${fmtNum(goal.min, 0)} kg` : undefined}>
            <GoalInput value={state.goals.targetWeightMin || null} placeholder={goal ? fmtNum(goal.min, 0) : ''} onChange={(n) => setGoals({ targetWeightMin: n ?? 0 })} />
          </Field>
          <Field label="Poids cible max (kg)" hint={goal?.computed ? `Plan : ${fmtNum(goal.max, 0)} kg` : undefined}>
            <GoalInput value={state.goals.targetWeightMax || null} placeholder={goal ? fmtNum(goal.max, 0) : ''} onChange={(n) => setGoals({ targetWeightMax: n ?? 0 })} />
          </Field>
          <Field label="Tour de taille cible (cm)"><GoalInput value={state.goals.targetWaist} placeholder="—" onChange={(n) => setGoals({ targetWaist: n })} /></Field>
          <Field label="Séances par semaine"><GoalInput value={state.goals.sessionsPerWeek} onChange={(n) => setGoals({ sessionsPerWeek: n ?? 5 })} /></Field>
        </div>
        <p className="mt-3 text-[12px] leading-[1.45] text-muted">Sans valeur, la cible vient de la trajectoire du plan (recomposition à poids stable, puis sèche à −0,5 %/semaine). Taux de gras et poids cible restent des estimations : ajuste avec ton tour de taille et tes photos.</p>
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
    </Screen>
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

