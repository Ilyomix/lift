import { L } from './i18n'
import { MUSCLES, type MuscleGroup } from './library'

/** Regions actually segmented in athlete.rig.json; never the aggregate volume group `back`. */
export type AnatomicalRegion = Exclude<MuscleGroup, 'back'> |
  'frontDelts' | 'adductors' | 'abductors' | 'lats' | 'upperBack' | 'lowerBack' | 'obliques' | 'forearms'
/** 1 = primary, 0.5 = secondary/stabilizer; ordinal display categories, never activation percentages. */
export type MuscleWeights = Partial<Record<AnatomicalRegion, number>>

function regions(primary: AnatomicalRegion[], secondary: AnatomicalRegion[] = []): MuscleWeights {
  return Object.fromEntries([
    ...secondary.map(region => [region, 0.5]),
    ...primary.map(region => [region, 1]),
  ])
}

/**
 * Qualitative exercise anatomy, independent of LIBRARY.groups (fractional set credits).
 * Broad segmented surfaces are labelled honestly: upperBack contains trapezius/rhomboids;
 * calves combines soleus/gastrocnemius. Deep hip flexors, serratus and rotator cuff are not
 * separately segmented, so we do not paint an unrelated surface to imply they are visible.
 */
export const EXERCISE_ANATOMY: Record<string, MuscleWeights> = {
  'chest-press': regions(['chest'], ['triceps', 'frontDelts']),
  'incline-db-press': regions(['chest'], ['frontDelts', 'triceps']),
  'pec-deck': regions(['chest'], ['frontDelts']),
  'cable-fly': regions(['chest'], ['frontDelts', 'abs']),
  dips: regions(['chest', 'triceps'], ['frontDelts']),
  'lat-pulldown': regions(['lats'], ['biceps', 'upperBack', 'forearms']),
  'low-cable-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts', 'forearms', 'lowerBack']),
  'chest-supported-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts', 'forearms']),
  'cable-pullover': regions(['lats'], ['triceps', 'abs']),
  'single-arm-pulldown': regions(['lats'], ['biceps', 'upperBack', 'obliques']),
  'reverse-pec-deck': regions(['rearDelts'], ['upperBack']),
  'face-pull': regions(['rearDelts', 'upperBack'], ['biceps']),
  'shoulder-press-machine': regions(['frontDelts', 'sideDelts'], ['triceps', 'upperBack']),
  'lateral-raise': regions(['sideDelts'], ['upperBack']),
  'cable-lateral-raise': regions(['sideDelts'], ['upperBack']),
  'triceps-overhead-rope': regions(['triceps'], ['abs']),
  'triceps-rope': regions(['triceps']),
  'ez-curl': regions(['biceps'], ['forearms']),
  'preacher-curl': regions(['biceps'], ['forearms']),
  'seated-db-curl': regions(['biceps'], ['forearms']),
  'incline-db-curl': regions(['biceps'], ['forearms']),
  'leg-press': regions(['quads'], ['glutes', 'adductors']),
  'hack-squat': regions(['quads'], ['glutes', 'adductors']),
  'smith-squat': regions(['quads'], ['glutes', 'adductors', 'abs', 'lowerBack']),
  'leg-extension': regions(['quads']),
  'leg-curl': regions(['hams'], ['calves']),
  'lying-leg-curl': regions(['hams'], ['calves']),
  'romanian-deadlift': regions(['hams', 'glutes'], ['adductors', 'lowerBack', 'forearms']),
  'hip-thrust': regions(['glutes'], ['hams', 'adductors', 'abs']),
  'smith-hip-thrust': regions(['glutes'], ['hams', 'adductors', 'abs']),
  'glute-bridge': regions(['glutes'], ['hams', 'adductors', 'abs']),
  'back-extension-45': regions(['glutes', 'hams'], ['lowerBack']),
  'calf-press': regions(['calves']),
  'standing-calf-raise': regions(['calves']),
  'seated-calf-raise': regions(['calves']),
  'roman-chair-abs': regions(['abs'], ['obliques']),
  'cable-crunch': regions(['abs'], ['obliques']),
  'goblet-squat': regions(['quads'], ['glutes', 'adductors', 'abs', 'lowerBack']),
  'hip-adduction': regions(['adductors']),
  'hip-abduction': regions(['abductors'], ['glutes']),
  'db-bench-press': regions(['chest'], ['triceps', 'frontDelts']),
  'db-floor-press': regions(['chest'], ['triceps', 'frontDelts']),
  'push-up': regions(['chest'], ['triceps', 'frontDelts', 'abs']),
  'feet-elevated-push-up': regions(['chest'], ['frontDelts', 'triceps', 'abs']),
  'db-fly': regions(['chest'], ['frontDelts']),
  'band-fly': regions(['chest'], ['frontDelts', 'abs']),
  'close-grip-push-up': regions(['triceps'], ['chest', 'frontDelts', 'abs']),
  'pull-up': regions(['lats'], ['biceps', 'upperBack', 'forearms', 'abs']),
  'chin-up': regions(['lats'], ['biceps', 'upperBack', 'forearms', 'abs']),
  'band-pulldown': regions(['lats'], ['biceps', 'upperBack']),
  'one-arm-db-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts', 'forearms', 'obliques']),
  'band-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts']),
  'doorframe-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts', 'obliques']),
  'prone-y-raise': regions(['upperBack'], ['rearDelts']),
  'inverted-row': regions(['lats', 'upperBack'], ['biceps', 'rearDelts', 'abs']),
  'db-pullover': regions(['lats', 'chest'], ['triceps']),
  'band-straight-arm-pulldown': regions(['lats'], ['triceps', 'abs']),
  'db-rear-delt-fly': regions(['rearDelts'], ['upperBack', 'lowerBack']),
  'band-pull-apart': regions(['rearDelts'], ['upperBack']),
  'db-shoulder-press': regions(['frontDelts', 'sideDelts'], ['triceps', 'upperBack', 'abs']),
  'pike-push-up': regions(['frontDelts'], ['sideDelts', 'triceps', 'upperBack', 'abs']),
  'band-lateral-raise': regions(['sideDelts'], ['upperBack']),
  'db-overhead-extension': regions(['triceps'], ['abs']),
  'band-overhead-extension': regions(['triceps'], ['abs']),
  'band-pushdown': regions(['triceps']),
  'db-skull-crusher': regions(['triceps']),
  'db-curl': regions(['biceps'], ['forearms']),
  'band-curl': regions(['biceps'], ['forearms']),
  'bulgarian-split-squat': regions(['quads', 'glutes'], ['abductors', 'adductors', 'abs']),
  'sissy-squat': regions(['quads'], ['calves', 'abs']),
  'sliding-leg-curl': regions(['hams'], ['glutes', 'abs']),
  'nordic-curl': regions(['hams'], ['calves', 'glutes', 'abs']),
  'db-romanian-deadlift': regions(['hams', 'glutes'], ['adductors', 'lowerBack', 'forearms']),
  'single-leg-rdl': regions(['hams', 'glutes'], ['abductors', 'adductors', 'lowerBack', 'obliques']),
  'db-hip-thrust': regions(['glutes'], ['hams', 'adductors', 'abs']),
  'single-leg-hip-thrust': regions(['glutes'], ['hams', 'abductors', 'obliques']),
  'single-leg-calf-raise': regions(['calves'], ['abductors']),
  'hanging-leg-raise': regions(['abs'], ['obliques', 'forearms', 'lats']),
  'reverse-crunch': regions(['abs'], ['obliques']),
  crunch: regions(['abs'], ['obliques']),
}

/** Every entry has a dedicated motion factory; visual review is tracked separately. */
export const ANIMATED_EXERCISES = new Set(Object.keys(EXERCISE_ANATOMY))

export function exerciseMuscles(id: string): MuscleWeights {
  return { ...EXERCISE_ANATOMY[id] }
}

export function anatomicalLabel(region: AnatomicalRegion) {
  if (region === 'frontDelts') return L('Deltoïdes antérieurs', 'Front delts')
  if (region === 'adductors') return L('Adducteurs', 'Adductors')
  if (region === 'abductors') return L('Moyens fessiers', 'Gluteus medius')
  if (region === 'lats') return L('Grands dorsaux', 'Latissimus dorsi')
  if (region === 'upperBack') return L('Trapèzes et rhomboïdes', 'Trapezius and rhomboids')
  if (region === 'lowerBack') return L('Érecteurs lombaires', 'Lumbar spinal erectors')
  if (region === 'obliques') return L('Obliques', 'Obliques')
  if (region === 'forearms') return L('Avant-bras', 'Forearms')
  return MUSCLES.find(muscle => muscle.id === region)?.label ?? region
}
