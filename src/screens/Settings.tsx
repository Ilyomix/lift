import { useEffect, useId, useState } from 'react'
import { BellRing, Check, ChevronRight, MapPin, Pencil, Plus, Ruler, Scale, Trash } from 'lucide-react'
import { NativeActivitySettings } from '../components/NativeActivitySettings'
import { MeasurementPicker } from '../components/MeasurementPicker'
import { SettingsMenuRow } from '../components/SettingsMenu'
import { GoalSheet } from '../components/GoalSheet'
import { SetupSheet, setupLabel } from '../components/Setup'
import { Button, Card, cx, Disclosure, Field, Header, IconButton, inputClass, PageActions, Row, Screen, Section, Segmented, Toggle } from '../components/ui'
import { type SportArtKind } from '../components/SportArt'
import { requestNotifications, notificationsSupported } from '../lib/alerts'
import { dayLetter, dayName, fmtDate, isoFromTimestamp } from '../lib/date'
import { fmtNum, parseNumber, plural } from '../lib/format'
import { HOME_GYM } from '../lib/gyms'
import { L } from '../lib/i18n'
import { isNative } from '../lib/native/bridge'
import { GOAL_DATE, MAINTENANCE, PLAN_DAYS, sharePhrase, templateSets, trainingDays, weekShape } from '../lib/program'
import { disablePush, enablePush, preparePush, pushReady, pushSupported, testPush } from '../lib/push'
import { navigate } from '../lib/router'
import { isIOS, isStandalone } from '../lib/share'
import { goalWeightRange } from '../lib/stats'
import { useStore } from '../lib/store'
import { confirmUnsavedChanges, useUnsavedChanges } from '../lib/unsavedChanges'
import { MeasureSheet } from './Progress'
import { lookInfo } from '../lib/visual'

export function SettingsScreen({ section }: { section?: string }) {
  switch (section) {
    case 'objectifs': return <GoalSettings />
    case 'seances': return <TrainingSettings />
    case 'jours': return <ScheduleSettings />
    case 'materiel': return <EquipmentSettings />
    case 'repos': return <RestSettings />
    case 'apparence': return <AppearanceSettings />
    case 'donnees': return <DataSettings />
    default: return <SettingsIndex />
  }
}

function SettingsIndex() {
  const items: { to: string; art: SportArtKind; label: string; hint: string }[] = [
    { to: 'objectifs', art: 'trophy', label: L('Objectifs', 'Goals'), hint: L('Durée, physique et mesures cibles', 'Duration, physique and target measurements') },
    { to: 'seances', art: 'dumbbell', label: L('Séances et matériel', 'Workouts and equipment'), hint: L('Jours, exercices, salles et charges', 'Days, exercises, gyms and loads') },
    { to: 'repos', art: 'stopwatch', label: L('Repos et alertes', 'Rest and alerts'), hint: L('Son, écran et notifications', 'Sound, screen and notifications') },
    { to: 'nutrition', art: 'nutrition', label: L('Cibles nutritionnelles', 'Nutrition targets'), hint: L('Calories, protéines et créatine', 'Calories, protein and creatine') },
    { to: 'apparence', art: 'appearance', label: L('Apparence', 'Appearance'), hint: L('Langue, thème et couleur', 'Language, theme and color') },
    { to: 'donnees', art: 'backup', label: L('Données et confidentialité', 'Data and privacy'), hint: L('Sauvegarde, import et suppression', 'Backup, import and deletion') },
  ]
  return <Screen>
    <Header art="settings" backTo="plus" title={L('Réglages', 'Settings')} sub={L('Choisis les réglages à modifier.', 'Choose which settings to change.')} />
    <Card className="divide-y divide-line">
      {items.map(item => <SettingsMenuRow key={item.to} {...item} to={`plus/reglages/${item.to}`} />)}
    </Card>
  </Screen>
}

function TrainingSettings() {
  const state = useStore(s => s.state)
  return <Screen>
    <Header art="dumbbell" backTo="plus/reglages" title={L('Séances et matériel', 'Workouts and equipment')} />
    <Card className="divide-y divide-line">
      <SettingsMenuRow to="plus/reglages/jours" art="calendar" label={L('Jours et fréquence', 'Days and frequency')} hint={L(`${trainingDays(state).length} séances par semaine`, `${trainingDays(state).length} workouts per week`)} />
      <SettingsMenuRow to="plus/reglages/materiel" art="kit" label={L('Matériel et salles', 'Equipment and gyms')} hint={setupLabel(state.settings.setup)} />
      <SettingsMenuRow to="plus/pause" art="pause" label={L('Pause du programme', 'Program pause')} hint={state.programPause.active ? L('En pause', 'Paused') : L('Vacances, maladie ou blessure', 'Vacation, illness or injury')} />
      <SettingsMenuRow to="plus/rappels" art="reminders" label={L('Rappels calendrier', 'Calendar reminders')} hint={L('Exporter les rappels de séance et de pesée', 'Export workout and weigh-in reminders')} />
    </Card>
    <Section art="plate" title={L('Progression des charges', 'Load progression')}>
      <Card>
        <Toggle label={L('Charges automatiques', 'Automatic loads')} hint={L('Ajustées selon tes séries, avec les changements détaillés dans le bilan.', 'Adjusted from your sets, with changes shown in your workout summary.')} checked={state.prefs.autoLoad} onChange={autoLoad => useStore.getState().setPrefs({ autoLoad })} />
      </Card>
      <Disclosure className="mt-3" bordered={false} title={L('Comment les charges évoluent', 'How loads change')} contentClassName="text-[13px] leading-relaxed text-text-2">
        {L('La charge augmente quand toutes les séries atteignent le haut de la fourchette à l’effort prévu, et baisse si elles restent sous le bas. Pendant la séance, les séries suivantes peuvent aussi s’ajuster. Tu peux annuler un changement depuis le bilan tant qu’il est encore applicable.', 'The load increases when every set reaches the top of the range at the planned effort, and decreases if sets stay below the bottom. Later sets can also adjust during a workout. You can undo a change from the summary while it still applies.')}
      </Disclosure>
    </Section>
  </Screen>
}

function DataSettings() {
  const last = useStore(s => s.state.meta.lastBackupAt)
  return <Screen>
    <Header art="backup" backTo="plus/reglages" title={L('Données et confidentialité', 'Data and privacy')} sub={L('Tes données restent sur cet appareil.', 'Your data stays on this device.')} />
    <Card className="divide-y divide-line">
      <SettingsMenuRow to="plus/donnees" art="backup" label={L('Sauvegarde et restauration', 'Backup and restore')} hint={last ? L(`Dernier export : ${fmtDate(isoFromTimestamp(last))}`, `Last export: ${fmtDate(isoFromTimestamp(last))}`) : L('Aucune sauvegarde exportée', 'No backup exported yet')} />
      <SettingsMenuRow to="plus/confidentialite" art="privacy" label={L('Confidentialité', 'Privacy')} hint={L('Stockage local et services externes', 'Local storage and external services')} />
    </Card>
  </Screen>
}

function GoalSettings() {
  const state = useStore(s => s.state)
  const [goalOpen, setGoalOpen] = useState(false)
  const [targetsRevision, setTargetsRevision] = useState(0)
  return <Screen>
    <Header art="trophy" backTo="plus/reglages" title={L('Objectifs', 'Goals')} />
        <Card className="divide-y divide-line">
          <Row
            label={L('Durée du programme', 'Program duration')}
            hint={MAINTENANCE ? L('Sans date limite · poids stable', 'No deadline · stable weight') : L(`Date cible : ${fmtDate(GOAL_DATE, { long: true, year: true })}`, `Target date: ${fmtDate(GOAL_DATE, { long: true, year: true })}`)}
            right={<Pencil size={14} className="text-muted" aria-hidden />}
            onClick={async () => { if (!await confirmUnsavedChanges()) return; setTargetsRevision(value => value + 1); setGoalOpen(true) }}
          />
          <Row
            label={L('Physique et priorités', 'Physique and priorities')}
            hint={state.visualGoal ? lookInfo(state.visualGoal.look).label : L('Repère physique et muscles prioritaires', 'Physique reference and priority muscles')}
            right={<ChevronRight size={16} className="text-muted" aria-hidden />}
            onClick={() => navigate('plus/objectif')}
          />
        </Card>
    <TargetMeasurements key={`${targetsRevision}:${state.goals.targetWeightMin}:${state.goals.targetWeightMax}:${state.goals.targetWaist}`} />

    {goalOpen && <GoalSheet onClose={() => setGoalOpen(false)} />}
  </Screen>
}

function ScheduleSettings() {
  const state = useStore(s => s.state)
  const { setPrefs, toggleTrainingDay } = useStore.getState()
  const days = trainingDays(state)
  const perWeek = days.length
  // With fewer than five days, sessions take more sets to keep the weekly volume (unless turned off).
  const keepVolume = state.prefs.keepWeeklyVolume !== false
  const week = weekShape(templateSets(state.templates), perWeek, keepVolume)
  const span = (a: number, b: number) => (a === b ? String(a) : L(`${a} à ${b}`, `${a} to ${b}`))
  const weekPct = Math.round(week.share * 100)
  const weekSets = span(week.sets[0], week.sets[1])
  const weekMinutes = span(week.minutes[0], week.minutes[1])
  return <Screen>
    <Header art="calendar" backTo="plus/reglages/seances" title={L('Jours et fréquence', 'Days and frequency')} />
    <Card className="divide-y divide-line">
          <div className="px-4 py-3.5">
            <p className="text-[15px]">{L('Jours d’entraînement', 'Training days')}</p>
            <div className="mt-3 grid grid-cols-4 min-[400px]:grid-cols-7 gap-1" role="group" aria-label={L('Jours d’entraînement', 'Training days')}>
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
            <p className="mt-3 text-[13px] leading-[1.45] text-text-2">
              {plural(perWeek, L('séance', 'workout'), L('séances', 'workouts'))} {L('par semaine.', 'per week.')} {perWeek === PLAN_DAYS
                ? L('Le rythme du programme : chaque muscle 2 fois par semaine.', 'The program’s pace: each muscle twice a week.')
                : perWeek > PLAN_DAYS
                  ? L(`Environ ${weekPct} % du volume prévu : surveille la récupération (sommeil, performances).`, `About ${weekPct}% of the planned volume: keep an eye on recovery (sleep, performance).`)
                  : week.factor === 1
                    ? L(`Séances du programme (${weekSets} séries, environ ${weekMinutes} min) : environ ${weekPct} % du volume hebdomadaire prévu.`, `The program’s workouts (${weekSets} sets, about ${weekMinutes} min): about ${weekPct}% of the planned weekly volume.`)
                    : perWeek >= 3
                      ? L(`Les séances prennent plus de séries (${weekSets}, environ ${weekMinutes} min) : la semaine garde ${sharePhrase(week.share)}, en moyenne sur la rotation.`, `Workouts take more sets (${weekSets}, about ${weekMinutes} min): the week keeps ${sharePhrase(week.share)}, on average over the rotation.`)
                      : L(`Les séances prennent plus de séries (${weekSets}, environ ${weekMinutes} min), sans dépasser ce qui est utile en une séance : la semaine tient ${sharePhrase(week.share)}. À partir de 3 jours, elle le tient presque en entier.`, `Workouts take more sets (${weekSets}, about ${weekMinutes} min), without going past what one workout can use: the week holds ${sharePhrase(week.share)}. From 3 days, it holds almost all of it.`)}
              {week.factor > 1 && week.minutes[1] >= 85 && L(' Pour raccourcir : enchaîne deux exercices opposés (superset). Croissance comparable, effort ressenti plus élevé.', ' To save time: alternate two opposing exercises (superset). Similar growth, higher perceived effort.')}
            </p>
          </div>
          {perWeek < PLAN_DAYS && (
            <Toggle
              label={L('Séances allongées', 'Longer workouts')}
              hint={L('Plus de séries par séance : ce sont les séries par muscle et par semaine qui font progresser, pas le nombre de séances. Désactivé : séances d’une heure, volume réduit.', 'More sets per workout: progress comes from the sets per muscle per week, not from the number of workouts. Off: one-hour workouts, reduced volume.')}
              checked={keepVolume}
              onChange={(v) => setPrefs({ keepWeeklyVolume: v })}
            />
          )}
    </Card>
  </Screen>
}

function EquipmentSettings() {
  const state = useStore(s => s.state)
  const [setupOpen, setSetupOpen] = useState(false)
  return <Screen>
    <Header art="kit" backTo="plus/reglages/seances" title={L('Matériel et salles', 'Equipment and gyms')} />
    <Card>
          <Row
            label={L('Lieu d’entraînement', 'Where you train')}
            hint={setupLabel(state.settings.setup)}
            right={<ChevronRight size={16} className="text-muted" aria-hidden />}
            onClick={() => setSetupOpen(true)}
          />
    </Card>
    <Section art="kit" title={L('Mes salles', 'My gyms')}><GymManager /></Section>
    {setupOpen && <SetupSheet onClose={() => setSetupOpen(false)} />}
  </Screen>
}

function RestSettings() {
  const state = useStore(s => s.state)
  const { setPrefs } = useStore.getState()
  const [perm, setPerm] = useState<string>(notificationsSupported() ? Notification.permission : 'unsupported')
  return <Screen>
    <Header art="stopwatch" backTo="plus/reglages" title={L('Repos et alertes', 'Rest and alerts')} />
        <Card className="divide-y divide-line">
          <Toggle label={L('Son de fin de repos', 'End-of-rest sound')} hint={isNative() ? L('Son de la notification système. Sans notification, son uniquement dans l’app ouverte.', 'System notification sound. With alerts off, sound plays only while the app is open.') : L('Trois tons courts, par-dessus ta musique', 'Three short tones, over your music')} checked={state.prefs.sound} onChange={(v) => setPrefs({ sound: v })} />
          <Toggle label={L('Garder l’écran allumé', 'Keep the screen on')} hint={L('Pendant la séance, pour voir le minuteur', 'During the workout, to see the timer')} checked={state.prefs.wakeLock} onChange={(v) => setPrefs({ wakeLock: v })} />
          {isNative() ? <NativeActivitySettings /> : <PushRow />}
          {!isNative() && !state.prefs.push && (
            <Row
              label={L('Notification avec l’app ouverte', 'Notification while the app is open')}
              hint={perm === 'granted' ? L('Activée : quand l’app est ouverte', 'On: while the app is open') : perm === 'denied' ? L('Refusée dans les réglages de l’appareil', 'Denied in your device settings') : perm === 'unsupported' ? (isIOS() && !isStandalone() ? L('Installe d’abord l’app sur l’écran d’accueil', 'Install the app on your Home Screen first') : L('Non disponible', 'Not available')) : L('Alerte système quand le repos se termine, app ouverte', 'System alert when rest ends, app open')}
              right={perm !== 'granted' && perm !== 'unsupported' && perm !== 'denied' ? <Button size="sm" variant="ink" icon={<BellRing size={16} aria-hidden />} onClick={async () => { const p = await requestNotifications(); setPerm(p); setPrefs({ notifications: p === 'granted' }) }}>{L('Activer', 'Turn on')}</Button> : undefined}
            />
          )}
        </Card>
  </Screen>
}

function AppearanceSettings() {
  const state = useStore(s => s.state)
  const { setPrefs } = useStore.getState()
  return <Screen>
    <Header art="appearance" backTo="plus/reglages" title={L('Apparence', 'Appearance')} />
        <Section art="settings" title={L('Langue', 'Language')} className="mt-0">
        <Segmented layout="fit" label={L('Langue', 'Language')} value={state.prefs.lang ?? 'auto'} onChange={(v) => setPrefs({ lang: v })} options={[{ value: 'auto', label: L('Automatique', 'Automatic') }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
        </Section>
        <Section art="appearance" title={L('Thème', 'Theme')}>
        <Segmented layout="fit" label={L('Thème', 'Theme')} value={state.prefs.theme} onChange={(t) => setPrefs({ theme: t })} options={[{ value: 'auto', label: L('Automatique', 'Automatic') }, { value: 'dark', label: L('Sombre', 'Dark') }, { value: 'light', label: L('Clair', 'Light') }]} />
        </Section>
        <Section art="appearance" title={L('Couleur d’accent', 'Accent color')}>
        <div className="flex gap-2" role="group" aria-label={L('Couleur d’accent', 'Accent color')}>
          {([['orange', 'Orange', '#ff7b00'], ['blue', L('Bleu', 'Blue'), '#3068f5']] as const).map(([v, label, color]) => (
            <button
              key={v}
              type="button"
              aria-pressed={state.prefs.accent === v}
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
  </Screen>
}

/** End-of-rest notifications for the web/PWA build. */
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
        notify(L('Notifications activées. Touche « Tester » puis verrouille le téléphone.', 'Notifications on. Tap “Test”, then lock your phone.'), 'good')
      } else if (r === 'denied') {
        notify(L('Notifications refusées : autorise-les pour Lift dans les réglages de ton appareil.', 'Notifications denied: allow them for Lift in your device settings.'), 'bad')
      } else {
        notify(L('Notifications non disponibles ici.', 'Notifications not available here.'), 'bad')
      }
    } catch (e) {
      notify((e as Error).message || L('Impossible d’activer les notifications. Réessaie.', 'Couldn’t enable notifications. Try again.'), 'bad')
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
          <Button size="sm" variant="soft" icon={<BellRing size={16} aria-hidden />} onClick={() => { if (testPush(8)) notify(L('Verrouille ton téléphone : notification dans 8 s.', 'Lock your phone: notification in 8 s.')) }}>{L('Tester', 'Test')}</Button>
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
  const renameDraft = useUnsavedChanges(!!edit && name.trim() !== gyms.find(g => g.id === edit)?.name)
  const addDraft = useUnsavedChanges(!!adding.trim())
  return (
    <div className="mt-3">
      <Card className="divide-y divide-line">
        {gyms.map((g) => (
          <div key={g.id} className="flex items-center gap-3 px-4 py-2.5">
            <MapPin size={17} className={cx('shrink-0', g.id === current ? 'text-signal-text' : 'text-muted')} aria-hidden />
            {edit === g.id ? (
              <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; renameGym(g.id, name); renameDraft.discard(); setEdit(null) }}>
                <input autoFocus autoCorrect="off" autoComplete="off" enterKeyHint="done" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} aria-label={L('Nom de la salle', 'Gym name')} />
                <Button type="submit" variant="ink" disabled={!name.trim()} icon={<Pencil size={16} aria-hidden />}>{L('Renommer', 'Rename')}</Button>
              </form>
            ) : (
              <>
                <button type="button" onClick={() => selectGym(g.id)} className="pressable min-h-11 min-w-0 flex-1 rounded-[10px] text-left hover:text-text">
                  <span className="block truncate text-[15px]">{g.name}</span>
                  <span className="block text-[12px] text-muted">{g.id === current ? L('Prochaine séance ici', 'Next workout here') : g.id === HOME_GYM ? L('Salle principale', 'Main gym') : L('Choisir cette salle', 'Choose this gym')}</span>
                </button>
                <IconButton onClick={async () => { if (!await renameDraft.confirm()) return; setEdit(g.id); setName(g.name) }} label={L(`Renommer ${g.name}`, `Rename ${g.name}`)}><Pencil size={16} aria-hidden /></IconButton>
                {g.id !== HOME_GYM && (
                  <IconButton onClick={() => removeGym(g.id)} label={L(`Supprimer la salle ${g.name}`, `Delete gym ${g.name}`)} className="hover:text-bad"><Trash size={16} aria-hidden /></IconButton>
                )}
              </>
            )}
          </div>
        ))}
      </Card>
      <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (adding.trim()) { addGym(adding); addDraft.discard(); setAdding('') } }}>
        <input autoCorrect="off" autoComplete="off" enterKeyHint="done" className={inputClass} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={L('Ex. : salle du centre', 'E.g. Downtown gym')} aria-label={L('Nom de la nouvelle salle', 'New gym name')} />
        <Button type="submit" variant="ink" size="lg" icon={<Plus size={18} aria-hidden />} disabled={!adding.trim()}>{L('Ajouter', 'Add')}</Button>
      </form>
      <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Machines, poulies et Smith : charges et historique propres à chaque salle. Haltères, barres, poids du corps : communs.', 'Machines, cables and Smith machine: loads and history are specific to each gym. Dumbbells, barbells, bodyweight: shared.')}</p>
    </div>
  )
}

function TargetMeasurements() {
  const state = useStore(s => s.state)
  const goals = state.goals
  const formId = useId()
  const [measureOpen, setMeasureOpen] = useState(false)
  const estimate = goalWeightRange({ ...state, goals: { ...goals, targetWeightMin: 0, targetWeightMax: 0 } })
  const [weightMode, setWeightMode] = useState<'program' | 'custom'>(goals.targetWeightMin > 0 && goals.targetWeightMax > 0 ? 'custom' : 'program')
  const [waistEnabled, setWaistEnabled] = useState(!!goals.targetWaist)
  const [draft, setDraft] = useState({
    min: goals.targetWeightMin ? String(goals.targetWeightMin) : '',
    max: goals.targetWeightMax ? String(goals.targetWeightMax) : '',
    waist: goals.targetWaist ? String(goals.targetWaist) : '',
  })
  const values = { min: parseNumber(draft.min), max: parseNumber(draft.max), waist: parseNumber(draft.waist) }
  const invalid = (key: keyof typeof draft) => values[key] === null || values[key]! < (key === 'waist' ? 50 : 35) || values[key]! > (key === 'waist' ? 200 : 250)
  const reversed = values.min !== null && values.max !== null && values.min > values.max
  const error = L('Choisis un poids entre 35 et 250 kg.', 'Choose a weight between 35 and 250 kg.')
  const valid = (weightMode === 'program' || (!invalid('min') && !invalid('max') && !reversed)) && (!waistEnabled || !invalid('waist'))
  const next = {
    targetWeightMin: weightMode === 'program' ? 0 : values.min!,
    targetWeightMax: weightMode === 'program' ? 0 : values.max!,
    targetWaist: waistEnabled ? values.waist : null,
  }
  const changed = next.targetWeightMin !== goals.targetWeightMin || next.targetWeightMax !== goals.targetWeightMax || next.targetWaist !== goals.targetWaist
  const dirty = changed || weightMode !== (goals.targetWeightMin > 0 && goals.targetWeightMax > 0 ? 'custom' : 'program') || waistEnabled !== !!goals.targetWaist
  const { discard } = useUnsavedChanges(dirty)
  const set = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }))
  return <Section art="measuring-tape" title={L('Mesures cibles', 'Target measurements')}>
    <form id={formId} onSubmit={event => {
      event.preventDefault()
      if (!valid || !changed) return
      useStore.getState().setGoals(next)
      discard()
      useStore.getState().notify(L('Cibles enregistrées.', 'Targets saved.'), 'good')
    }}>
      <Segmented label={L('Cible de poids', 'Weight target')} layout="fit" value={weightMode} onChange={mode => {
        setWeightMode(mode)
        if (mode === 'custom' && estimate) setDraft(current => ({ ...current, min: current.min || String(estimate.min), max: current.max || String(estimate.max) }))
      }} options={[
        { value: 'program', label: L('Estimation du programme', 'Program estimate') },
        { value: 'custom', label: L('Cible personnalisée', 'Custom target') },
      ]} />
      {weightMode === 'program' ? <div className="mt-3 px-1">
        {estimate ? <>
          <p className="text-[20px] font-semibold tnum">{fmtNum(estimate.min, 1)}–{fmtNum(estimate.max, 1)} <span className="text-[14px] text-text-2">kg</span></p>
          <p className="mt-1 text-[13px] text-text-2">{L('Calculée avec ton programme et tes dernières mesures.', 'Calculated from your program and latest measurements.')}</p>
        </> : <Button full icon={<Ruler size={18} aria-hidden />} onClick={() => setMeasureOpen(true)}>{L('Compléter mes mesures', 'Complete my measurements')}</Button>}
      </div> : <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={L('Poids minimum', 'Minimum weight')} error={draft.min.trim() && invalid('min') ? error : reversed ? L('Le minimum doit être inférieur ou égal au maximum.', 'The minimum must be at most the maximum.') : undefined}>
          <MeasurementPicker icon={<Scale />} label={L('Poids minimum', 'Minimum weight')} unit="kg" value={draft.min} onChange={value => set('min', value)} min={35} max={invalid('max') ? 250 : values.max!} strictBounds step={0.1} defaultValue={estimate?.min ?? 75} required invalid={!!draft.min.trim() && (invalid('min') || reversed)} />
        </Field>
        <Field label={L('Poids maximum', 'Maximum weight')} error={draft.max.trim() && invalid('max') ? error : reversed ? L('Le maximum doit être supérieur ou égal au minimum.', 'The maximum must be at least the minimum.') : undefined}>
          <MeasurementPicker icon={<Scale />} label={L('Poids maximum', 'Maximum weight')} unit="kg" value={draft.max} onChange={value => set('max', value)} min={invalid('min') ? 35 : values.min!} max={250} strictBounds step={0.1} defaultValue={estimate?.max ?? 77} required invalid={!!draft.max.trim() && (invalid('max') || reversed)} />
        </Field>
      </div>}
      <Card className="mt-4">
        <Toggle label={L('Cible de tour de taille', 'Waist target')} hint={waistEnabled ? undefined : L('Aucune cible', 'No target')} checked={waistEnabled} onChange={setWaistEnabled} />
        {waistEnabled && <div className="px-4 pb-3">
          <MeasurementPicker icon={<Ruler />} label={L('Tour de taille', 'Waist')} unit="cm" value={draft.waist} onChange={value => set('waist', value)} min={50} max={200} step={0.1} defaultValue={85} required invalid={!!draft.waist.trim() && invalid('waist')} />
          {draft.waist.trim() && invalid('waist') && <p className="mt-1 text-[13px] text-bad">{L('Choisis un tour de taille entre 50 et 200 cm.', 'Choose a waist size between 50 and 200 cm.')}</p>}
        </div>}
      </Card>
      <PageActions visible={dirty}><Button type="submit" form={formId} variant="primary" full icon={<Check size={18} aria-hidden />} disabled={!changed || !valid}>{L('Enregistrer les cibles', 'Save targets')}</Button></PageActions>
    </form>
    <MeasureSheet open={measureOpen} onClose={() => setMeasureOpen(false)} />
    <Disclosure title={L('Comprendre mes cibles', 'Understanding my targets')} bordered={false} className="mt-3" contentClassName="text-[13px] leading-relaxed text-text-2">
      {MAINTENANCE ? L('L’estimation suit ton poids actuel à ± 1 kg. Une cible personnalisée remplace cette estimation.', 'The estimate follows your current weight within 1 kg. A custom target replaces this estimate.') : L('L’estimation suit la trajectoire du programme. Une cible personnalisée remplace cette estimation.', 'The estimate follows the program trajectory. A custom target replaces this estimate.')}
    </Disclosure>
  </Section>
}
