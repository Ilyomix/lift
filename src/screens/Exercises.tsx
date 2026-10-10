import { useDeferredValue, useState } from 'react'
import { ArrowUpFromLine, ArrowUpRight, Backpack, BicepsFlexed, ChevronRight, ChevronsUp, Dumbbell, Footprints, Grid2x2, House, LayoutGrid, MoveHorizontal, PersonStanding, Search, Shirt, Undo2 } from 'lucide-react'
import { ExerciseSheet } from '../components/ExerciseSheet'
import { Button, Card, cx, Empty, Header, inputClass, Screen, Section, Segmented } from '../components/ui'
import { browseExercises, type Place } from '../lib/encyclopedia'
import { alternativeEquipment } from '../lib/exerciseAlternatives'
import { L } from '../lib/i18n'
import { LIBRARY, MUSCLES, type MuscleGroup } from '../lib/library'

const muscleIcons = {
  chest: Shirt, back: Backpack, sideDelts: MoveHorizontal, rearDelts: Undo2, triceps: ArrowUpRight, biceps: BicepsFlexed,
  quads: PersonStanding, hams: Footprints, glutes: ArrowUpFromLine, calves: ChevronsUp, abs: Grid2x2,
} satisfies Record<MuscleGroup, unknown>

/** Every exercise of the library, searchable, each opening its 3D sheet. */
export function ExercisesScreen() {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [place, setPlace] = useState<Place>('all')
  // The sheet keeps its last exercise while it closes.
  const [sheet, setSheet] = useState<{ id: string; open: boolean } | null>(null)
  const groups = browseExercises(useDeferredValue(query), muscle, place)
  const found = groups.reduce((n, g) => n + g.items.length, 0)
  const total = Object.keys(LIBRARY).length
  const muscleLabel = (id: MuscleGroup | 'other') => MUSCLES.find(m => m.id === id)?.label ?? L('Autres muscles', 'Other muscles')
  const reset = () => { setQuery(''); setMuscle('all'); setPlace('all') }

  return (
    <Screen>
      <Header art="dumbbell" backTo="plus" title={L('Encyclopédie des mouvements', 'Exercise encyclopedia')}
        sub={L(`${total} exercices en 3D, avec technique, preuves et alternatives.`, `${total} exercises in 3D, with technique, evidence and alternatives.`)} />
      <div role="search" className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} className={cx(inputClass, 'pl-10')}
          placeholder={L('Rechercher un exercice ou un muscle', 'Search an exercise or a muscle')} aria-label={L('Rechercher un exercice', 'Search an exercise')}
          autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="search" />
      </div>
      <Segmented className="mt-3" layout="scroll" label={L('Muscle', 'Muscle')} value={muscle} onChange={setMuscle}
        options={[{ value: 'all' as const, label: L('Tous', 'All'), icon: <LayoutGrid size={16} aria-hidden /> }, ...MUSCLES.map(m => {
          const Icon = muscleIcons[m.id]
          return { value: m.id, label: m.label, icon: <Icon size={16} aria-hidden /> }
        })]} />
      <Segmented className="mt-2" label={L('Matériel', 'Equipment')} value={place} onChange={setPlace}
        options={[
          { value: 'all', label: L('Tout', 'All'), icon: <LayoutGrid size={16} aria-hidden /> },
          { value: 'gym', label: L('Salle', 'Gym'), icon: <Dumbbell size={16} aria-hidden /> },
          { value: 'home', label: L('Maison', 'Home'), icon: <House size={16} aria-hidden /> },
        ]} />
      <p className="mt-3 text-[13px] text-text-2" aria-live="polite">
        {found === total ? L(`${total} exercices`, `${total} exercises`) : L(`${found} sur ${total} exercices`, `${found} of ${total} exercises`)}
      </p>

      {groups.length ? groups.map(group => (
        <Section key={group.muscle} title={muscleLabel(group.muscle)} className="mt-5">
          <Card className="divide-y divide-line">
            {group.items.map(x => (
              <button key={x.id} type="button" onClick={() => setSheet({ id: x.id, open: true })}
                className="pressable flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{x.name}</span>
                  <span className="block text-[13px] text-muted">
                    {[x.muscle, alternativeEquipment(x.id), x.role === 'compound' ? L('Polyarticulaire', 'Compound') : 'Isolation'].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
              </button>
            ))}
          </Card>
        </Section>
      )) : (
        <Empty art="dumbbell" title={L('Aucun exercice trouvé', 'No exercise found')} action={<Button onClick={reset}>{L('Tout afficher', 'Show all')}</Button>}>
          {L('Essayez un autre mot, un autre muscle ou tout le matériel.', 'Try another word, another muscle or all equipment.')}
        </Empty>
      )}

      {sheet && <ExerciseSheet exerciseId={sheet.id} open={sheet.open} onClose={() => setSheet({ ...sheet, open: false })} />}
    </Screen>
  )
}
