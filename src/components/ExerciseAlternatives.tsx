import { useId, useState } from 'react'
import { ChevronDown, Replace } from 'lucide-react'
import { alternativeEquipment, alternativesFor } from '../lib/exerciseAlternatives'
import { L } from '../lib/i18n'
import { useStore } from '../lib/store'
import { ExerciseDemo } from './ExerciseDemo'
import { Button, cx, Segmented } from './ui'

export function ExerciseAlternatives({ exerciseId, onChoose }: { exerciseId: string; onChoose?: (id: string) => void }) {
  const setup = useStore(s => s.state.settings.setup)
  const [equipment, setEquipment] = useState<'mine' | 'all'>(setup?.place === 'home' ? 'mine' : 'all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const uid = useId()
  const all = alternativesFor(exerciseId)
  const choices = equipment === 'mine' ? alternativesFor(exerciseId, setup) : all
  if (!all.length) return null

  return <section aria-label={L('Alternatives à cet exercice', 'Exercise alternatives')}>
    <h3 className="text-[16px] font-semibold">{L('Une autre option ?', 'Need another option?')}</h3>
    <p className="mt-1 text-[13px] leading-[1.5] text-text-2">{L('Machine occupée ou autre matériel : compare le mouvement avant de choisir.', 'Busy machine or different equipment: compare the movement before choosing.')}</p>
    {setup?.place === 'home' && <div className="mt-3">
      <Segmented label={L('Matériel des alternatives', 'Alternative equipment')} value={equipment} onChange={value => { setEquipment(value); setExpanded(null) }} options={[
        { value: 'mine', label: L('Mon matériel', 'My equipment') }, { value: 'all', label: L('Tout le matériel', 'All equipment') },
      ]} />
    </div>}
    <div className="mt-3 divide-y divide-line border-y border-line">
      {choices.map(choice => {
        const open = expanded === choice.id
        const panelId = `${uid}-${choice.id}`
        return <div key={choice.id}>
          <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setExpanded(open ? null : choice.id)} className="pressable flex min-h-16 w-full items-center gap-3 py-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{choice.name}</span>
              <span className="mt-0.5 block text-[12px] text-muted">{alternativeEquipment(choice.id)}</span>
            </span>
            <ChevronDown size={16} className={cx('shrink-0 text-text-2', open && 'rotate-180')} aria-hidden />
          </button>
          <div id={panelId} hidden={!open}>
            {open && <div className="pb-4">
              <ExerciseDemo id={choice.id} name={choice.name} />
              <p className="mt-3 text-[13px] leading-[1.5] text-text-2">{choice.cues[0]}</p>
              {onChoose && <>
                <Button variant="ink" full className="mt-3" icon={<Replace size={16} aria-hidden />} onClick={() => onChoose(choice.id)}>{L('Choisir cet exercice', 'Use this exercise')}</Button>
                <p className="mt-2 text-[12px] leading-[1.45] text-muted">{L('Pour cette séance. La charge de l’ancienne machine n’est pas reprise.', 'For this session. The previous machine’s load is not carried over.')}</p>
              </>}
            </div>}
          </div>
        </div>
      })}
    </div>
    {!choices.length && <p className="mt-3 text-[13px] text-text-2">{L('Pas d’autre option avec ton matériel actuel. Consulte « Tout le matériel » pour comparer.', 'No other option with your current equipment. Check “All equipment” to compare.')}</p>}
  </section>
}
