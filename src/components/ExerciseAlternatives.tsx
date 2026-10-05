import { useId, useState } from 'react'
import { ChevronDown, Replace } from 'lucide-react'
import { alternativeEquipment, alternativesFor } from '../lib/exerciseAlternatives'
import { sessionExercises } from '../lib/exerciseReplacement'
import { L } from '../lib/i18n'
import { TYPE_META, ROTATION } from '../lib/program'
import { useStore } from '../lib/store'
import type { WorkoutType } from '../lib/types'
import { ExerciseDemo } from './ExerciseDemo'
import { Button, cx, Empty, Field, inputClass, SectionHeading, Segmented } from './ui'

export type ExerciseReplacementTarget =
  | { kind: 'active'; index: number }
  | { kind: 'planned' | 'template'; type: WorkoutType; index: number }

type Scope = 'session' | 'program'
const targetKey = (target: ExerciseReplacementTarget) => `${target.kind}:${target.kind === 'active' ? '' : target.type}:${target.index}`

export function ExerciseAlternatives({ exerciseId, replacement, onReplaced, showHeading = true }: {
  exerciseId: string
  replacement?: ExerciseReplacementTarget
  onReplaced?: () => void
  showHeading?: boolean
}) {
  const state = useStore(s => s.state)
  const setup = state.settings.setup
  const [equipment, setEquipment] = useState<'mine' | 'all'>(setup?.place === 'home' ? 'mine' : 'all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState('')
  const [scope, setScope] = useState<Scope>('session')
  const uid = useId()
  const all = alternativesFor(exerciseId)
  const choices = equipment === 'mine' ? alternativesFor(exerciseId, setup) : all
  // A detail opened from Progress has no implicit workout slot. Let the
  // lifter pick one occurrence instead of silently changing every template.
  const targets: ExerciseReplacementTarget[] = replacement ? [replacement] : [
    ...(state.activeWorkout?.exercises.flatMap((exercise, index) => exercise.exerciseId === exerciseId ? [{ kind: 'active' as const, index }] : []) ?? []),
    ...ROTATION.flatMap(type => state.templates[type].exercises.flatMap((exercise, index) => exercise.exerciseId === exerciseId ? [{ kind: 'template' as const, type, index }] : [])),
  ]
  const target = targets.find(item => targetKey(item) === selected) ?? targets[0]
  const active = target?.kind === 'active' ? state.activeWorkout?.exercises[target.index] : undefined
  const hasLoggedSets = !!active?.sets.some(set => set.completed)
  const activeType = state.activeWorkout?.type
  const activeTemplate = target?.kind === 'active' && activeType ? state.templates[activeType].exercises[target.index] : undefined
  const canRemember = target?.kind !== 'active' || !!(active && !state.activeWorkout?.reopened && activeTemplate?.exerciseId === (active.replacement?.fromId ?? active.exerciseId))
  const chosenScope = target?.kind === 'template' ? 'program' : canRemember ? scope : 'session'
  const locked = hasLoggedSets && chosenScope === 'session'
  const slots = target?.kind === 'active'
    ? hasLoggedSets && chosenScope === 'program' && activeType ? state.templates[activeType].exercises : state.activeWorkout?.exercises ?? []
    : target ? chosenScope === 'session' ? sessionExercises(state, target.type) : state.templates[target.type].exercises : []
  const programType = target?.kind === 'active' ? activeType : target?.type
  const plannedSlots = chosenScope === 'program' && programType ? sessionExercises(state, programType) : []
  const alreadyUsed = (id: string) => slots.some((exercise, index) => index !== target?.index && exercise.exerciseId === id)
    || plannedSlots.some((exercise, index) => index !== target?.index && exercise.exerciseId === id)
    || (target?.kind === 'active' && chosenScope === 'program' && activeType
      ? state.templates[activeType].exercises.some((exercise, index) => index !== target.index && exercise.exerciseId === id) : false)
  const targetLabel = (item: ExerciseReplacementTarget) => {
    const type = item.kind === 'active' ? state.activeWorkout!.type : item.type
    return `${item.kind === 'active' ? L('Séance en cours', 'Current workout') : L('Programme', 'Program')} · ${TYPE_META[type].label} · ${String(item.index + 1).padStart(2, '0')}`
  }
  const choose = (id: string) => {
    if (!target || locked) return
    const actions = useStore.getState()
    const changed = target.kind === 'planned'
      ? actions.replacePlannedExercise(target.type, target.index, id, chosenScope)
      : target.kind === 'template'
        ? actions.replaceTemplateExercise(target.type, target.index, id)
        : hasLoggedSets && chosenScope === 'program' && activeType
          ? actions.replaceTemplateExercise(activeType, target.index, id)
          : actions.replaceExercise(target.index, id, chosenScope)
    if (!changed) return
    actions.notify(chosenScope === 'session'
      ? L('Exercice remplacé pour cette séance.', 'Exercise replaced for this workout.')
      : L('Exercice remplacé dans le programme.', 'Exercise replaced in the program.'), 'good')
    onReplaced?.()
  }
  if (!all.length) return null

  return <section aria-label={L('Alternatives à cet exercice', 'Exercise alternatives')}>
    {showHeading && <SectionHeading icon={<Replace size={18} aria-hidden />}>{L('Remplacer cet exercice', 'Replace this exercise')}</SectionHeading>}
    <p className={cx('text-[13px] leading-[1.5] text-text-2', showHeading && 'mt-2')}>{L('Choisis une alternative, ou ouvre sa démo pour comparer le mouvement.', 'Choose a replacement exercise, or open its demo to compare the movement.')}</p>
    {target && <div className="mt-3 space-y-3">
      {targets.length > 1 ? <Field label={L('Séance à modifier', 'Workout to change')}>
        <select className={inputClass} value={targetKey(target)} onChange={event => { setSelected(event.target.value); setScope('session') }}>
          {targets.map(item => <option key={targetKey(item)} value={targetKey(item)}>{targetLabel(item)}</option>)}
        </select>
      </Field> : !replacement && <p className="text-[13px] font-medium text-text-2">{targetLabel(target)}</p>}
      {target.kind !== 'template' && canRemember && <Segmented layout="fit" label={L('Appliquer le remplacement', 'Apply replacement')} value={chosenScope} onChange={setScope} options={[
        { value: 'session', label: L('Cette séance', 'This workout') },
        { value: 'program', label: hasLoggedSets ? L('Prochaines séances', 'Future workouts') : L('Garder au programme', 'Keep in program') },
      ]} />}
      <p className="text-[12px] leading-[1.5] text-muted">{chosenScope === 'session'
        ? L('Uniquement cette séance. Ton programme reste le même.', 'Only this workout. Your program stays the same.')
        : target.kind === 'active' && !hasLoggedSets
          ? L('Cette séance et les prochaines de ce type.', 'This workout and future workouts of this type.')
          : L('Pour les prochaines séances de ce type. Les séances déjà enregistrées restent intactes.', 'For future workouts of this type. Recorded workouts stay unchanged.')}
        {' '}{L('La charge est celle du nouvel exercice, si elle est connue.', 'The load comes from the new exercise, if known.')}</p>
      {locked && <p role="status" className="text-[13px] leading-[1.5] text-text-2">{L('Des séries sont déjà validées : elles restent liées à cet exercice.', 'Sets are already logged: they stay linked to this exercise.')}</p>}
    </div>}
    {!target && <p className="mt-3 text-[13px] leading-[1.5] text-muted">{L('Cet exercice n’est plus dans ton programme actuel. Les alternatives restent disponibles à consulter.', 'This exercise is no longer in your current program. You can still browse its alternatives.')}</p>}
    {setup?.place === 'home' && <div className="mt-3">
      <Segmented label={L('Matériel des alternatives', 'Alternative equipment')} value={equipment} onChange={value => { setEquipment(value); setExpanded(null) }} options={[
        { value: 'mine', label: L('Mon matériel', 'My equipment') }, { value: 'all', label: L('Tout le matériel', 'All equipment') },
      ]} />
    </div>}
    <div className="mt-3 divide-y divide-line border-t border-line">
      {choices.map(choice => {
        const open = expanded === choice.id
        const duplicate = alreadyUsed(choice.id)
        const panelId = `${uid}-${choice.id}`
        return <div key={choice.id}>
          <div className="flex items-center gap-2 py-2">
            <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={open ? L(`Masquer la démonstration : ${choice.name}`, `Hide demo: ${choice.name}`) : L(`Voir la démonstration : ${choice.name}`, `View demo: ${choice.name}`)} onClick={() => setExpanded(open ? null : choice.id)} className="pressable flex min-h-16 min-w-0 flex-1 items-center gap-2 py-1 text-left">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{choice.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted">{alternativeEquipment(choice.id)}</span>
                {duplicate && <span className="mt-1 block text-[12px] text-muted">{chosenScope === 'session' ? L('Déjà dans cette séance', 'Already in this workout') : L('Déjà dans cette séance du programme', 'Already in this workout plan')}</span>}
              </span>
              <ChevronDown size={16} className={cx('shrink-0 text-text-2', open && 'rotate-180')} aria-hidden />
            </button>
            {target && <Button size="sm" variant="outline" className="shrink-0" disabled={locked || duplicate} aria-label={L(`Remplacer par ${choice.name}`, `Replace with ${choice.name}`)} icon={<Replace size={15} aria-hidden />} onClick={() => choose(choice.id)}>{L('Remplacer', 'Replace')}</Button>}
          </div>
          <div id={panelId} hidden={!open}>
            {open && <div className="pb-4">
              <ExerciseDemo id={choice.id} name={choice.name} />
              <p className="mt-3 text-[13px] leading-[1.5] text-text-2">{choice.cues[0]}</p>
            </div>}
          </div>
        </div>
      })}
    </div>
    {!choices.length && <Empty art="dumbbell" title={L('Pas d’alternative avec ce matériel', 'No alternative with this equipment')}
      action={<Button variant="outline" onClick={() => setEquipment('all')}>{L('Voir tout le matériel', 'View all equipment')}</Button>}
    >{L('D’autres mouvements existent avec un équipement différent. Tu peux les consulter avant de choisir.', 'Other movements use different equipment. You can explore them before choosing.')}</Empty>}
  </section>
}
