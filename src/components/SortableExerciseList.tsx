import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors, type Modifier, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { fmtLoad, fmtRest } from '../lib/format'
import { L } from '../lib/i18n'
import type { TemplateExercise } from '../lib/types'
import { Card, cx } from './ui'

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

type Props = {
  exercises: TemplateExercise[]
  inSession: number[]
  onEdit: (index: number) => void
  onMove: (from: number, to: number) => void
}

/** Preview the move without changing the stored plan until the user drops it. */
export function SortableExerciseList({ exercises, inSession, onEdit, onMove }: Props) {
  const contextId = useId()
  // A repeated exercise can have different targets. Track the actual occurrence,
  // not its exerciseId or its current index, to retain focus after a move.
  const ids = useRef(new WeakMap<TemplateExercise, string>())
  const sequence = useRef(0)
  const rows = exercises.map((exercise, index) => {
    let id = ids.current.get(exercise)
    if (!id) {
      id = `${contextId}-${++sequence.current}`
      ids.current.set(exercise, id)
    }
    return { id, exercise, sets: inSession[index] }
  })
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const active = rows.find((row) => row.id === activeId)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const position = (id: UniqueIdentifier) => rows.findIndex((row) => row.id === id) + 1
  const name = (id: UniqueIdentifier) => rows.find((row) => row.id === id)?.exercise.name ?? ''
  const overlay = <DragOverlay dropAnimation={null} transition={undefined} zIndex={80}>
    {active && <div aria-hidden className="flex items-center gap-2 rounded-[14px] border border-signal bg-surface px-3 py-2.5 text-text">
      <div className="min-w-0 flex-1 px-1 py-1"><ExerciseSummary exercise={active.exercise} sets={active.sets} /></div>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-signal-text"><GripVertical size={20} /></span>
    </div>}
  </DragOverlay>
  return <>
    <p className="mb-3 text-[13px] leading-5 text-text-2">{L('Glisse la poignée pour changer l’ordre.', 'Drag the handle to change the order.')}</p>
    <DndContext
      id={contextId} sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]}
      accessibility={{
        screenReaderInstructions: { draggable: L('Appuie sur Espace ou Entrée pour déplacer cet exercice. Utilise les flèches haut et bas, puis Espace ou Entrée pour valider. Échap annule.', 'Press Space or Enter to move this exercise. Use the up and down arrows, then Space or Enter to confirm. Escape cancels.') },
        announcements: {
          onDragStart: ({ active }) => L(`${name(active.id)} sélectionné, position ${position(active.id)} sur ${rows.length}.`, `${name(active.id)} picked up, position ${position(active.id)} of ${rows.length}.`),
          onDragOver: ({ active, over }) => over ? L(`${name(active.id)}, position ${position(over.id)} sur ${rows.length}.`, `${name(active.id)}, position ${position(over.id)} of ${rows.length}.`) : undefined,
          onDragEnd: ({ active, over }) => over ? L(`${name(active.id)} placé en position ${position(over.id)} sur ${rows.length}.`, `${name(active.id)} placed at position ${position(over.id)} of ${rows.length}.`) : L('Déplacement annulé.', 'Move cancelled.'),
          onDragCancel: () => L('Déplacement annulé. Ordre inchangé.', 'Move cancelled. Order unchanged.'),
        },
      }}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null)
        const from = position(active.id) - 1
        const to = over ? position(over.id) - 1 : -1
        if (from >= 0 && to >= 0 && from !== to) onMove(from, to)
      }}
    >
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <Card role="list" aria-label={L('Ordre des exercices', 'Exercise order')} className="divide-y divide-line">
          {rows.map((row, index) => <SortableExerciseRow key={row.id} {...row} disabled={rows.length < 2} onEdit={() => onEdit(index)} />)}
        </Card>
      </SortableContext>
      {typeof document === 'undefined' ? null : createPortal(overlay, document.body)}
    </DndContext>
  </>
}

function SortableExerciseRow({ id, exercise, sets, disabled, onEdit }: { id: string; exercise: TemplateExercise; sets: number; disabled: boolean; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled, attributes: { roleDescription: L('Exercice déplaçable', 'Sortable exercise') } })
  return <div ref={setNodeRef} role="listitem" style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }} className={cx('relative flex items-center gap-2 bg-surface px-3 py-2.5 first:rounded-t-[14px] last:rounded-b-[14px]', isDragging && 'opacity-30')}>
    <button type="button" onClick={onEdit} className="pressable min-w-0 flex-1 rounded-[8px] px-1 py-1 text-left hover:bg-surface-2">
      <ExerciseSummary exercise={exercise} sets={sets} />
    </button>
    <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} disabled={disabled} aria-label={L(`Déplacer ${exercise.name}`, `Move ${exercise.name}`)} className="flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-[10px] text-text-2 select-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:opacity-35 cursor-grab active:cursor-grabbing">
      <GripVertical size={20} aria-hidden />
    </button>
  </div>
}

function ExerciseSummary({ exercise: e, sets }: { exercise: TemplateExercise; sets: number }) {
  return <>
    <span className="block text-[15px] font-medium">
      {e.name}{' '}
      {(e.volumeTag === 'priority' || e.focus) && <span className="ml-1 inline-block border border-signal/50 bg-signal-soft px-1.5 align-[2px] text-[11px] leading-4 font-semibold whitespace-nowrap text-signal-text">{L('Prioritaire', 'Priority')}</span>}
    </span>
    <span className="block text-[13px] text-text-2 tnum">{e.target.sets}{sets !== e.target.sets ? L(` (${sets} en séance)`, ` (${sets} in workout)`) : ''} × {e.target.minReps}–{e.target.maxReps} · <span>{L(`${e.target.rir ?? '—'} reps en réserve`, `${e.target.rir ?? '—'} reps in reserve`)}</span> · {fmtRest(e.target.restSeconds)} · {fmtLoad(e.target.weight, e.unit)}</span>
  </>
}
