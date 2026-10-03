import { useState } from 'react'
import { Check, Dumbbell, House } from 'lucide-react'
import { L } from '../lib/i18n'
import { LIBRARY } from '../lib/library'
import { sessionItems } from '../lib/program'
import { useStore } from '../lib/store'
import type { Equipment, TrainingSetup } from '../lib/types'
import { Button, cx, Disclosure, Sheet } from './ui'

/** Home equipment, in the order people usually own it. */
export const EQUIPMENT: { id: Equipment; readonly label: string; readonly hint: string }[] = [
  { id: 'dumbbells', get label() { return L('Haltères', 'Dumbbells') }, get hint() { return L('Réglables, idéalement', 'Adjustable, ideally') } },
  { id: 'bench', get label() { return L('Banc', 'Bench') }, get hint() { return L('Inclinable, idéalement', 'Adjustable, ideally') } },
  { id: 'pullupBar', get label() { return L('Barre de traction', 'Pull-up bar') }, get hint() { return L('De porte ou fixée', 'Doorway or fixed') } },
  { id: 'bands', get label() { return L('Élastiques', 'Bands') }, get hint() { return L('Avec ancrage de porte', 'With a door anchor') } },
]

/** « Salle de sport », « Maison · haltères, banc » … */
export function setupLabel(s: TrainingSetup | undefined): string {
  if (!s || s.place === 'gym') return L('Salle de sport', 'Gym')
  const items = EQUIPMENT.filter((e) => s.equipment.includes(e.id)).map((e) => e.label.toLowerCase())
  return items.length ? L(`Maison · ${items.join(', ')}`, `Home · ${items.join(', ')}`) : L('Maison · poids du corps', 'Home · bodyweight')
}

/** Gym or home, and the home equipment, with the Upper session it gives as an example. */
export function SetupPicker({ value, onChange }: { value: TrainingSetup; onChange: (s: TrainingSetup) => void }) {
  const places = [
    { id: 'gym' as const, icon: Dumbbell, title: L('Salle de sport', 'Gym'), text: L('Des séances avec machines, poulies et haltères.', 'Sessions using machines, cables and dumbbells.') },
    { id: 'home' as const, icon: House, title: L('À la maison', 'At home'), text: L('Des exercices adaptés au matériel que tu possèdes.', 'Exercises matched to the equipment you own.') },
  ]
  const toggle = (e: Equipment) =>
    onChange({ ...value, equipment: value.equipment.includes(e) ? value.equipment.filter((x) => x !== e) : [...value.equipment, e] })
  const example = sessionItems('UPPER', value).map((i) => LIBRARY[i.id]?.name ?? i.id)
  return (
    <div>
      <div className="grid gap-2" role="radiogroup" aria-label={L('Lieu d’entraînement', 'Where you train')}>
        {places.map((p) => {
          const on = value.place === p.id
          const Icon = p.icon
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...value, place: p.id })}
              className={cx('pressable card flex items-start gap-3 p-4 text-left', on ? 'border-signal shadow-[0_0_0_1px_var(--signal)]' : 'hover:border-line-strong')}
            >
              <Icon size={20} className={cx('mt-0.5 shrink-0', on ? 'text-signal-text' : 'text-text-2')} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{p.title}</span>
                <span className="mt-0.5 block text-[13px] leading-[1.45] text-text-2">{p.text}</span>
              </span>
              <span className={cx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-signal bg-signal text-signal-ink' : 'border-line-strong')}>
                {on && <Check size={12} strokeWidth={3} aria-hidden />}
              </span>
            </button>
          )
        })}
      </div>
      {value.place === 'home' && (
        <div className="mt-5">
          <p className="text-[13px] font-medium text-text-2">{L('Ton matériel', 'Your equipment')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={L('Ton matériel', 'Your equipment')}>
            {EQUIPMENT.map((e) => {
              const on = value.equipment.includes(e.id)
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(e.id)}
                  className={cx('pressable flex min-h-14 flex-col items-start justify-center rounded-[10px] border px-3 py-2 text-left', on ? 'border-signal bg-signal-soft' : 'border-line-strong')}
                >
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold">
                    {on && <Check size={14} strokeWidth={3} className="text-signal-text" aria-hidden />}
                    {e.label}
                  </span>
                  <span className="text-[12px] text-muted">{e.hint}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[12px] leading-[1.45] text-muted">
            {L(
              'Le poids du corps est toujours là. Plus tu as de matériel, plus les séances se rapprochent du programme en salle.',
              'Bodyweight is always there. The more equipment you have, the closer the sessions get to the gym program.',
            )}
          </p>
        </div>
      )}
      <Disclosure title={L('Voir les exercices prévus', 'See the planned exercises')} className="mt-5" contentClassName="text-[13px] leading-[1.5] text-text-2">
        <p className="mt-2">{L('Première séance : haut du corps.', 'First session: upper body.')}</p>
        <ul className="mt-2 space-y-1">{example.map((name, i) => <li key={name}>{i + 1}. {name}</li>)}</ul>
      </Disclosure>
    </div>
  )
}

/** Settings: change where you train. Sessions are rebuilt; known loads are kept. */
export function SetupSheet({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.state.settings.setup) ?? { place: 'gym', equipment: [] }
  const [draft, setDraft] = useState<TrainingSetup>(current)
  const changed = draft.place !== current.place || draft.equipment.slice().sort().join() !== current.equipment.slice().sort().join()
  const save = () => {
    useStore.getState().setSetup(draft)
    useStore.getState().notify(L(`Séances recomposées : ${setupLabel(draft)}.`, `Sessions rebuilt: ${setupLabel(draft)}.`), 'good')
    onClose()
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={L('Lieu d’entraînement', 'Where you train')}
      tall
      footer={<Button variant="primary" size="lg" full disabled={!changed} onClick={save}>{L('Enregistrer', 'Save')}</Button>}
    >
      <SetupPicker value={draft} onChange={setDraft} />
      <p className="mt-4 text-[12px] leading-[1.45] text-muted">
        {L(
          'Les séances sont recomposées pour ce lieu. Les charges déjà connues sont gardées, et tes séances de salle reviennent telles quelles si tu y retournes.',
          'Sessions are rebuilt for this place. Loads you already know are kept, and your gym sessions come back as they were if you switch back.',
        )}
      </p>
    </Sheet>
  )
}
