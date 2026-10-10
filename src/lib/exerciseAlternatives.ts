import { L } from './i18n'
import { LIBRARY } from './library'
import { doableAt } from './program'
import type { TrainingSetup } from './types'

// Curated movement families: a shared muscle alone does not make a useful swap.
// All entries have their own instructions, load history and demonstration.
const FAMILIES: readonly (readonly string[])[] = [
  ['chest-press', 'bench-press', 'incline-bench-press', 'db-bench-press', 'incline-db-press', 'db-floor-press', 'push-up', 'feet-elevated-push-up'],
  ['pec-deck', 'cable-fly', 'db-fly', 'band-fly'],
  ['dips', 'close-grip-bench-press', 'close-grip-push-up', 'chest-press', 'db-floor-press'],
  ['lat-pulldown', 'pull-up', 'chin-up', 'band-pulldown'],
  ['low-cable-row', 'chest-supported-row', 'barbell-row', 'one-arm-db-row', 'band-row', 'inverted-row', 'doorframe-row'],
  ['cable-pullover', 'single-arm-pulldown', 'db-pullover', 'band-straight-arm-pulldown'],
  ['reverse-pec-deck', 'face-pull', 'db-rear-delt-fly', 'band-pull-apart', 'prone-y-raise'],
  ['shoulder-press-machine', 'overhead-press', 'db-shoulder-press', 'pike-push-up'],
  ['lateral-raise', 'cable-lateral-raise', 'band-lateral-raise'],
  ['triceps-overhead-rope', 'db-overhead-extension', 'band-overhead-extension', 'db-skull-crusher', 'triceps-rope', 'band-pushdown'],
  ['ez-curl', 'barbell-curl', 'preacher-curl', 'seated-db-curl', 'incline-db-curl', 'db-curl', 'hammer-curl', 'band-curl'],
  ['leg-press', 'hack-squat', 'barbell-squat', 'smith-squat', 'goblet-squat', 'bulgarian-split-squat'],
  ['leg-extension', 'sissy-squat'],
  ['leg-curl', 'lying-leg-curl', 'sliding-leg-curl', 'nordic-curl'],
  ['romanian-deadlift', 'db-romanian-deadlift', 'single-leg-rdl', 'back-extension-45'],
  // A taken hip thrust station: the Smith machine, the floor, a dumbbell on any bench, or the glute-focused back extension.
  ['hip-thrust', 'smith-hip-thrust', 'glute-bridge', 'db-hip-thrust', 'single-leg-hip-thrust', 'back-extension-45'],
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

/** Gym equipment other than a plate-loaded or selectorized machine. */
const GYM_KIT: Record<string, 'barbell' | 'smith' | 'cable' | 'dips' | 'bench45' | 'romanChair'> = {
  'ez-curl': 'barbell', 'romanian-deadlift': 'barbell', 'glute-bridge': 'barbell', 'hip-thrust': 'barbell',
  'bench-press': 'barbell', 'incline-bench-press': 'barbell', 'close-grip-bench-press': 'barbell', 'barbell-squat': 'barbell', 'barbell-curl': 'barbell', 'overhead-press': 'barbell', 'barbell-row': 'barbell',
  'smith-squat': 'smith', 'smith-hip-thrust': 'smith',
  'cable-fly': 'cable', 'lat-pulldown': 'cable', 'low-cable-row': 'cable', 'cable-pullover': 'cable', 'single-arm-pulldown': 'cable',
  'face-pull': 'cable', 'cable-lateral-raise': 'cable', 'triceps-overhead-rope': 'cable', 'triceps-rope': 'cable', 'cable-crunch': 'cable',
  dips: 'dips', 'back-extension-45': 'bench45', 'roman-chair-abs': 'romanChair',
}

export function alternativeEquipment(id: string): string {
  const exercise = LIBRARY[id]
  if (!exercise) return ''
  if (!exercise.requires) {
    switch (GYM_KIT[id]) {
      case 'barbell': return L('Barre', 'Barbell')
      case 'smith': return L('Barre guidée (Smith)', 'Smith machine')
      case 'cable': return L('Poulie', 'Cable')
      case 'dips': return L('Barres parallèles', 'Dip bars')
      case 'bench45': return L('Banc à 45°', '45° bench')
      case 'romanChair': return L('Chaise romaine', 'Roman chair')
      default: return L('Machine', 'Machine')
    }
  }
  const labels = {
    dumbbells: L('Haltères', 'Dumbbells'), bench: L('Banc', 'Bench'),
    bands: L('Élastique', 'Band'), pullupBar: L('Barre de traction', 'Pull-up bar'),
  }
  return exercise.requires.length ? exercise.requires.map(item => labels[item]).join(' · ') : L('Poids du corps', 'Bodyweight')
}
