// Gyms: machine and cable loads are kept per gym, free weights are shared.
import { L } from './i18n'
import { gymBound } from './library'
import type { AppState, Gym, TemplateExercise } from './types'

export const HOME_GYM = 'main'
/** The name is a getter (current language): copy the entries with `{ ...g }` before storing them. */
export const DEFAULT_GYMS: Gym[] = [{ id: HOME_GYM, get name() { return L('Ma salle', 'My gym') } }]

export const gymOf = (w: { gymId?: string } | null | undefined): string => w?.gymId || HOME_GYM

export function gymName(state: Pick<AppState, 'gyms'>, id: string | undefined): string {
  return state.gyms.find((g) => g.id === (id || HOME_GYM))?.name ?? L('Salle supprimée', 'Deleted gym')
}

export function isGymBound(ex: Pick<TemplateExercise, 'exerciseId' | 'unit'>): boolean {
  return gymBound(ex.exerciseId, ex.unit)
}

/** Target load of an exercise at a gym; null when this machine has never been used there. */
export function loadAt(ex: Pick<TemplateExercise, 'exerciseId' | 'unit' | 'target' | 'gymLoads'>, gymId: string): number | null {
  if (!isGymBound(ex) || gymId === HOME_GYM) return ex.target.weight ?? null
  return ex.gymLoads?.[gymId] ?? null
}

/** A known load of the same exercise in another gym, offered as the starting point of a first session here. */
export function loadElsewhere(ex: TemplateExercise, gymId: string, gyms: Gym[]): { gym: Gym; weight: number } | null {
  const order = [HOME_GYM, ...gyms.map((g) => g.id).filter((id) => id !== HOME_GYM)]
  for (const id of order) {
    if (id === gymId) continue
    const w = id === HOME_GYM ? ex.target.weight : ex.gymLoads?.[id]
    const gym = gyms.find((g) => g.id === id)
    if (typeof w === 'number' && gym) return { gym, weight: w }
  }
  return null
}

export function newGymId(name: string): string {
  const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'salle'
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`
}
