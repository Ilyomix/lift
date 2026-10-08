import { useState } from 'react'
import { Check, ChevronRight, House, MapPin, Plus } from 'lucide-react'
import { L } from '../lib/i18n'
import { useStore } from '../lib/store'
import { SetupSheet } from './Setup'
import { Button, cx, inputClass, Sheet, SheetAction } from './ui'

/**
 * Picks the gym of the next session (or of the session in progress). Machine loads
 * are kept per gym: a first session on a machine in a new gym starts from the load
 * known elsewhere, then the app learns the real one. Before a session, it is also the
 * way to switch between the gym and home: the sessions are rebuilt for the place.
 */
export function GymSheet({ onClose, session }: { onClose: () => void; session?: boolean }) {
  const gyms = useStore((s) => s.state.gyms)
  const current = useStore((s) => (session ? (s.state.activeWorkout?.gymId ?? s.state.gymId) : s.state.gymId))
  const { selectGym, setSessionGym, addGym, notify } = useStore.getState()
  const setup = useStore((s) => s.state.settings.setup)
  const home = setup?.place === 'home'
  const [name, setName] = useState('')
  const [placeOpen, setPlaceOpen] = useState(false)
  const pick = (id: string) => {
    if (session) setSessionGym(id)
    else selectGym(id)
    onClose()
  }
  const create = () => {
    const n = name.trim()
    if (!n) return
    const id = addGym(n)
    notify(L(`${n} ajoutée : les charges machine y seront suivies à part.`, `${n} added: machine loads will be tracked separately there.`), 'good')
    pick(id)
  }
  if (placeOpen || (home && !session)) return <SetupSheet onClose={onClose} />
  const place = (close: (action: () => void, validate?: () => boolean | Promise<boolean>) => void, confirmDiscard: () => Promise<boolean>) => !session && (
    <button type="button" onClick={() => close(() => setPlaceOpen(true), confirmDiscard)} className="pressable mt-4 flex w-full items-center gap-3 rounded-[12px] border border-line px-4 py-3.5 text-left hover:bg-surface-2">
      <House size={18} className="shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{L('S’entraîner à la maison', 'Train at home')}</span>
        <span className="block text-[13px] leading-[1.4] text-text-2">
          {L('Les séances sont recomposées pour ton matériel ; celles de salle reviennent telles quelles au retour.', 'Workouts are rebuilt for your equipment; your gym workouts come back as they were when you return.')}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
    </button>
  )
  return (
    <Sheet open dirty={name !== ''} onClose={onClose} icon={<MapPin size={18} aria-hidden />} title={session ? L('Salle de cette séance', 'Gym for this workout') : L('Lieu d’entraînement', 'Where you train')}>
      <SheetAction>{(close, confirmDiscard) => <>
      <div className="divide-y divide-line overflow-hidden rounded-[12px] border border-line">
        {gyms.map((g) => (
          <button key={g.id} type="button" onClick={() => close(() => pick(g.id), confirmDiscard)} aria-pressed={g.id === current} className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
            <MapPin size={18} className={cx('shrink-0', g.id === current ? 'text-signal-text' : 'text-muted')} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{g.name}</span>
            {g.id === current && <Check size={18} className="shrink-0 text-signal-text" aria-hidden />}
          </button>
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) close(create) }}>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={L('Nouvelle salle (ex. : Basic-Fit Nation)', 'New gym (e.g. Basic-Fit Nation)')} enterKeyHint="done" aria-label={L('Nom de la nouvelle salle', 'New gym name')} />
        <Button type="submit" variant="ink" size="lg" disabled={!name.trim()} aria-label={L('Ajouter la salle', 'Add gym')} icon={<Plus size={18} aria-hidden />} />
      </form>
      <p className="mt-3 text-[12px] leading-[1.45] text-muted">
        {L(
          'Machines, poulies et Smith : charges et historique propres à chaque salle. Haltères, barres et poids du corps : communs. Première fois sur une machine dans une salle : la charge connue ailleurs sert de départ, puis l’app retient la vraie.',
          'Machines, cables and Smith: loads and history are kept per gym. Dumbbells, barbells and bodyweight: shared. First time on a machine at a gym: the load known elsewhere is the starting point, then the app learns the real one.',
        )}
      </p>
      {place(close, confirmDiscard)}
      </>}</SheetAction>
    </Sheet>
  )
}
