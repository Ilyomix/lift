import { LIBRARY, MUSCLES, type ExerciseInfo, type MuscleGroup } from './library'

/** Where an exercise can be done: gym equipment (machines, cables, bars) or home equipment. */
export type Place = 'all' | 'gym' | 'home'

/** 'other': muscles the program does not count, such as the adductors. */
export interface ExerciseGroup { muscle: MuscleGroup | 'other'; items: ExerciseInfo[] }

/** Lower case, without accents: « développé » matches « developpe ». */
const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** The muscle an exercise is filed under: its first directly trained group, in the app's muscle order. */
export function primaryMuscle(info: ExerciseInfo): MuscleGroup | undefined {
  return MUSCLES.find(m => info.groups[m.id] === 1)?.id ?? MUSCLES.find(m => info.groups[m.id])?.id
}

/**
 * The encyclopedia's list. Every word of the query must appear in the name, the
 * muscle or the English identifier. A muscle filter keeps the exercises that
 * train it directly, under that muscle; without one, each exercise sits under
 * its primary muscle.
 */
export function browseExercises(query: string, muscle: MuscleGroup | 'all' = 'all', place: Place = 'all'): ExerciseGroup[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const found = Object.values(LIBRARY).filter(x => {
    if (muscle !== 'all' && x.groups[muscle] !== 1) return false
    if (place === 'gym' && x.requires) return false
    if (place === 'home' && !x.requires) return false
    const haystack = fold(`${x.name} ${x.muscle} ${x.id.replace(/-/g, ' ')}`)
    return words.every(w => haystack.includes(w))
  }).sort((a, b) => a.name.localeCompare(b.name))
  if (muscle !== 'all') return found.length ? [{ muscle, items: found }] : []
  const groups: ExerciseGroup[] = MUSCLES.map(m => ({ muscle: m.id, items: found.filter(x => primaryMuscle(x) === m.id) }))
  groups.push({ muscle: 'other', items: found.filter(x => !primaryMuscle(x)) })
  return groups.filter(g => g.items.length)
}
