import { L } from './i18n'
import { LIBRARY } from './library'
import { doableAt } from './program'
import type { TrainingSetup } from './types'

// Curated movement families: a shared muscle alone does not make a useful swap.
// All entries have their own instructions, load history and demonstration.
const FAMILIES: readonly (readonly string[])[] = [
  ['chest-press', 'db-bench-press', 'incline-db-press', 'db-floor-press', 'push-up', 'feet-elevated-push-up'],
  ['pec-deck', 'cable-fly', 'db-fly', 'band-fly'],
  ['dips', 'close-grip-push-up', 'chest-press', 'db-floor-press'],
  ['lat-pulldown', 'pull-up', 'chin-up', 'band-pulldown'],
  ['low-cable-row', 'chest-supported-row', 'one-arm-db-row', 'band-row', 'inverted-row', 'doorframe-row'],
  ['cable-pullover', 'single-arm-pulldown', 'db-pullover', 'band-straight-arm-pulldown'],
  ['reverse-pec-deck', 'face-pull', 'db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise'],
  ['shoulder-press-machine', 'db-shoulder-press', 'pike-push-up'],
  ['lateral-raise', 'cable-lateral-raise', 'band-lateral-raise'],
  ['triceps-overhead-rope', 'db-overhead-extension', 'band-overhead-extension', 'db-skull-crusher', 'triceps-rope', 'band-pushdown'],
  ['ez-curl', 'preacher-curl', 'seated-db-curl', 'incline-db-curl', 'db-curl', 'band-curl'],
  ['leg-press', 'hack-squat', 'smith-squat', 'goblet-squat', 'bulgarian-split-squat'],
  ['leg-extension', 'sissy-squat'],
  ['leg-curl', 'lying-leg-curl', 'sliding-leg-curl', 'nordic-curl'],
  ['romanian-deadlift', 'db-romanian-deadlift', 'single-leg-rdl', 'back-extension-45'],
  ['hip-thrust', 'db-hip-thrust', 'single-leg-hip-thrust'],
  ['calf-press', 'standing-calf-raise', 'seated-calf-raise', 'single-leg-calf-raise'],
  ['roman-chair-abs', 'hanging-leg-raise', 'reverse-crunch', 'cable-crunch', 'crunch'],
]

/** An explicit setup filters choices; omitting it lets users browse all equipment. */
export function alternativesFor(id: string, setup?: TrainingSetup) {
  if (!LIBRARY[id]) return []
  const families = FAMILIES.filter(family => family.includes(id))
  const candidates = families.length ? families.flat() : LIBRARY[id].alternatives
  return [...new Set(candidates)].filter(candidate => candidate !== id && LIBRARY[candidate] && (!setup || doableAt(candidate, setup)))
    .map(candidate => LIBRARY[candidate])
}

export function alternativeEquipment(id: string): string {
  const exercise = LIBRARY[id]
  if (!exercise) return ''
  if (!exercise.requires) {
    if (id === 'ez-curl' || id === 'romanian-deadlift') return L('Barre', 'Barbell')
    return L('Machine ou poulie', 'Machine or cable')
  }
  const labels = {
    dumbbells: L('Haltères', 'Dumbbells'), bench: L('Banc', 'Bench'),
    bands: L('Élastique', 'Band'), pullupBar: L('Barre de traction', 'Pull-up bar'),
  }
  return exercise.requires.length ? exercise.requires.map(item => labels[item]).join(' · ') : L('Poids du corps', 'Bodyweight')
}
