import type { Role, Unit } from './types'
import type { EvidenceLevel } from './research'

export type MuscleGroup = 'chest' | 'back' | 'sideDelts' | 'rearDelts' | 'triceps' | 'biceps' | 'quads' | 'hams' | 'glutes' | 'calves' | 'abs'

export const MUSCLES: { id: MuscleGroup; label: string; priority?: boolean }[] = [
  { id: 'chest', label: 'Pectoraux', priority: true },
  { id: 'back', label: 'Dos', priority: true },
  { id: 'sideDelts', label: 'Deltoïdes latéraux', priority: true },
  { id: 'rearDelts', label: 'Deltoïdes postérieurs' },
  { id: 'triceps', label: 'Triceps', priority: true },
  { id: 'biceps', label: 'Biceps', priority: true },
  { id: 'quads', label: 'Quadriceps' },
  { id: 'hams', label: 'Ischios' },
  { id: 'glutes', label: 'Fessiers' },
  { id: 'calves', label: 'Mollets' },
  { id: 'abs', label: 'Abdominaux' },
]

export interface ExerciseInfo {
  id: string
  name: string
  muscle: string
  unit: Unit
  role: Role
  /** Fractional set counting: direct = 1, indirect = 0.5 (Pelland 2025). */
  groups: Partial<Record<MuscleGroup, number>>
  cues: string[]
  evidence: { level: EvidenceLevel; text: string; refs: string[] }
  demo: boolean
  query: string
  alternatives: string[]
  increment: number
}

const E = (x: ExerciseInfo) => x

export const LIBRARY: Record<string, ExerciseInfo> = Object.fromEntries(
  [
    E({
      id: 'chest-press', name: 'Chest press machine', muscle: 'Pectoraux', unit: 'kg', role: 'compound',
      groups: { chest: 1, triceps: 0.5 },
      cues: ['Omoplates serrées et basses, poitrine sortie.', 'Poignées à hauteur du bas des pectoraux.', 'Descente contrôlée jusqu’à l’étirement, sans décoller les épaules.'],
      evidence: { level: 'fort', text: 'Machines et poids libres donnent la même hypertrophie.', refs: ['haugen2023', 'schoenfeld2017vol'] },
      demo: true, query: 'machine chest press technique', alternatives: ['incline-db-press'], increment: 2.5,
    }),
    E({
      id: 'incline-db-press', name: 'Développé incliné haltères', muscle: 'Haut des pectoraux', unit: 'kg/main', role: 'compound',
      groups: { chest: 1, triceps: 0.5 },
      cues: ['Banc à 30°, omoplates rétractées.', 'Coudes à ~45° du buste.', 'Descendre jusqu’à sentir l’étirement des pectoraux.'],
      evidence: { level: 'fort', text: 'Principe validé (volume, machines = libres) ; incliné vs plat non vérifié.', refs: ['haugen2023', 'schoenfeld2017vol'] },
      demo: true, query: 'incline dumbbell press technique', alternatives: ['chest-press'], increment: 2,
    }),
    E({
      id: 'pec-deck', name: 'Pec deck', muscle: 'Pectoraux', unit: 'kg', role: 'isolation',
      groups: { chest: 1 },
      cues: ['Siège réglé pour les poignées à hauteur de poitrine.', 'Ouverture lente jusqu’à l’étirement contrôlé.', 'Coudes légèrement fléchis et fixes.'],
      evidence: { level: 'modere', text: 'Travail en position étirée, extrapolé des essais sur la longueur musculaire.', refs: ['wolf2023', 'pedrosa2022'] },
      demo: true, query: 'pec deck fly technique', alternatives: ['cable-fly'], increment: 2.5,
    }),
    E({
      id: 'cable-fly', name: 'Écarté poulie', muscle: 'Pectoraux', unit: 'kg', role: 'isolation',
      groups: { chest: 1 },
      cues: ['Poulies à hauteur d’épaules, un pas en avant.', 'Bras légèrement fléchis, ouverture jusqu’à l’étirement.', 'Rapprocher les mains devant le sternum.'],
      evidence: { level: 'modere', text: 'Même logique que le pec deck : tension en position étirée.', refs: ['wolf2023'] },
      demo: true, query: 'cable fly technique', alternatives: ['pec-deck'], increment: 2.5,
    }),
    E({
      id: 'dips', name: 'Dips', muscle: 'Pectoraux & triceps', unit: 'PDC', role: 'compound',
      groups: { chest: 1, triceps: 0.5 },
      cues: ['Buste légèrement penché en avant.', 'Descendre jusqu’à ce que l’épaule soit au niveau du coude, pas plus.', 'À remplacer par le pushdown si les épaules tirent.'],
      evidence: { level: 'opinion', text: 'Réduits à 2 séries : ils recoupent pectoraux et triceps déjà chargés, coût articulaire.', refs: [] },
      demo: true, query: 'chest dips technique', alternatives: ['triceps-rope'], increment: 0,
    }),
    E({
      id: 'lat-pulldown', name: 'Tirage vertical', muscle: 'Grand dorsal', unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5 },
      cues: ['Poitrine sortie, épaules basses.', 'Tirer avec les coudes vers les hanches.', 'Remonter jusqu’à l’étirement complet des dorsaux, sans balancer.'],
      evidence: { level: 'fort', text: 'Principe validé (volume, machines).', refs: ['haugen2023', 'pelland2025'] },
      demo: true, query: 'lat pulldown technique', alternatives: ['single-arm-pulldown'], increment: 2.5,
    }),
    E({
      id: 'low-cable-row', name: 'Rowing assis poulie', muscle: 'Dos', unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 },
      cues: ['Buste stable, pas de balancier.', 'Laisser les omoplates avancer à l’étirement.', 'Ramener les coudes le long du corps.'],
      evidence: { level: 'fort', text: 'Principe validé (volume, machines).', refs: ['haugen2023', 'pelland2025'] },
      demo: true, query: 'seated cable row technique', alternatives: ['chest-supported-row'], increment: 2.5,
    }),
    E({
      id: 'chest-supported-row', name: 'Rowing poitrine appuyée', muscle: 'Milieu du dos', unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 },
      cues: ['Poitrine contre le support pendant toute la série.', 'Amplitude complète, retour contrôlé.', 'Aucune impulsion des jambes.'],
      evidence: { level: 'fort', text: 'Principe validé (volume, machines).', refs: ['haugen2023', 'pelland2025'] },
      demo: true, query: 'chest supported row machine technique', alternatives: ['low-cable-row'], increment: 2.5,
    }),
    E({
      id: 'cable-pullover', name: 'Pull-over poulie', muscle: 'Grand dorsal', unit: 'kg', role: 'isolation',
      groups: { back: 1 },
      cues: ['Corde ou barre, bras presque tendus.', 'Laisser monter les bras jusqu’à l’étirement des dorsaux.', 'Ramener vers les cuisses sans plier les coudes.'],
      evidence: { level: 'modere', text: 'Choisi pour étirer les dorsaux sous charge.', refs: ['wolf2023', 'pelland2025'] },
      demo: true, query: 'cable straight arm pulldown pullover technique', alternatives: ['single-arm-pulldown'], increment: 2.5,
    }),
    E({
      id: 'single-arm-pulldown', name: 'Tirage unilatéral poulie', muscle: 'Grand dorsal', unit: 'kg', role: 'isolation',
      groups: { back: 1, biceps: 0.5 },
      cues: ['Un bras à la fois, buste légèrement incliné.', 'Grand étirement en haut.', 'Coude vers la hanche.'],
      evidence: { level: 'modere', text: 'Alternative au pull-over, même logique d’étirement.', refs: ['pelland2025'] },
      demo: true, query: 'single arm lat pulldown technique', alternatives: ['cable-pullover'], increment: 2.5,
    }),
    E({
      id: 'reverse-pec-deck', name: 'Reverse pec deck', muscle: 'Arrière d’épaules', unit: 'kg', role: 'isolation',
      groups: { rearDelts: 1 },
      cues: ['Poitrine contre le dossier.', 'Bras presque tendus, ouvrir en arc.', 'Aucun élan, retour lent.'],
      evidence: { level: 'opinion', text: 'Choix d’exercice fondé sur l’opinion d’experts.', refs: [] },
      demo: true, query: 'reverse pec deck rear delt fly technique', alternatives: ['face-pull'], increment: 2.5,
    }),
    E({
      id: 'face-pull', name: 'Face pull', muscle: 'Arrière d’épaules', unit: 'kg', role: 'isolation',
      groups: { rearDelts: 1 },
      cues: ['Poulie haute, corde.', 'Tirer vers le front en écartant les mains.', 'Coudes hauts.'],
      evidence: { level: 'opinion', text: 'Alternative au reverse pec deck.', refs: [] },
      demo: true, query: 'face pull technique', alternatives: ['reverse-pec-deck'], increment: 2.5,
    }),
    E({
      id: 'shoulder-press-machine', name: 'Développé épaules machine', muscle: 'Épaules', unit: 'kg', role: 'compound',
      groups: { sideDelts: 0.5, triceps: 0.5 },
      cues: ['Dos plaqué, poignées à hauteur d’oreilles au départ.', 'Pousser sans verrouiller brutalement.', 'Descente contrôlée.'],
      evidence: { level: 'fort', text: 'Principe validé (volume, machines).', refs: ['haugen2023'] },
      demo: true, query: 'machine shoulder press technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'lateral-raise', name: 'Élévations latérales', muscle: 'Deltoïdes latéraux', unit: 'kg/main', role: 'isolation',
      groups: { sideDelts: 1 },
      cues: ['Buste légèrement penché, coudes un peu fléchis.', 'Monter jusqu’à l’horizontale, en guidant avec les coudes.', 'Descente lente : pas d’élan.'],
      evidence: { level: 'faible', text: 'Volume passé de 5 à 10 séries/semaine (preuve forte sur le volume) ; le choix de l’exercice relève de l’opinion d’experts.', refs: ['schoenfeld2017vol', 'pelland2025'] },
      demo: true, query: 'dumbbell lateral raise technique', alternatives: ['cable-lateral-raise'], increment: 1,
    }),
    E({
      id: 'cable-lateral-raise', name: 'Élévations latérales poulie', muscle: 'Deltoïdes latéraux', unit: 'kg', role: 'isolation',
      groups: { sideDelts: 1 },
      cues: ['Poulie basse, câble derrière ou devant le corps.', 'Départ bras croisé devant la hanche : tension dès le bas.', 'Monter jusqu’à l’horizontale.'],
      evidence: { level: 'faible', text: 'Volume des deltoïdes latéraux (preuve forte) ; version poulie = tension en bas du mouvement.', refs: ['schoenfeld2017vol', 'pelland2025'] },
      demo: true, query: 'cable lateral raise technique', alternatives: ['lateral-raise'], increment: 1.25,
    }),
    E({
      id: 'triceps-overhead-rope', name: 'Extension triceps au-dessus de la tête', muscle: 'Triceps', unit: 'kg', role: 'isolation',
      groups: { triceps: 1 },
      cues: ['Dos à la poulie, corde derrière la tête.', 'Coudes fixes, pointés vers l’avant.', 'Descendre jusqu’à l’étirement maximal du triceps.'],
      evidence: { level: 'modere', text: '≈1,4× plus d’hypertrophie du triceps que l’extension poulie basse (+19,9 % vs +13,9 %).', refs: ['maeo2023'] },
      demo: true, query: 'overhead cable triceps extension technique', alternatives: ['triceps-rope'], increment: 2.5,
    }),
    E({
      id: 'triceps-rope', name: 'Pushdown corde', muscle: 'Triceps', unit: 'kg', role: 'isolation',
      groups: { triceps: 1 },
      cues: ['Coudes collés au buste.', 'Écarter la corde en bas.', 'Remonter jusqu’à 90° environ, sans élan.'],
      evidence: { level: 'modere', text: 'Conservé en complément ; l’essentiel du volume triceps passe au-dessus de la tête.', refs: ['maeo2023'] },
      demo: true, query: 'rope triceps pushdown technique', alternatives: ['triceps-overhead-rope'], increment: 2.5,
    }),
    E({
      id: 'ez-curl', name: 'Curl barre EZ', muscle: 'Biceps', unit: 'kg', role: 'isolation',
      groups: { biceps: 1 },
      cues: ['Buste fixe, pas d’impulsion des hanches.', 'Descente complète, bras presque tendus.', 'Coudes immobiles.'],
      evidence: { level: 'faible', text: 'Volume ; pas de comparaison d’exercices vérifiée.', refs: ['schoenfeld2017vol'] },
      demo: true, query: 'ez bar curl technique', alternatives: ['preacher-curl', 'seated-db-curl'], increment: 2.5,
    }),
    E({
      id: 'preacher-curl', name: 'Curl pupitre machine', muscle: 'Biceps', unit: 'kg', role: 'isolation',
      groups: { biceps: 1 },
      cues: ['Aisselles calées contre le pupitre.', 'Descendre jusqu’à l’extension presque complète.', 'Remonter sans décoller les coudes.'],
      evidence: { level: 'faible', text: 'Volume ; pas de comparaison d’exercices vérifiée.', refs: ['schoenfeld2017vol'] },
      demo: true, query: 'machine preacher curl technique', alternatives: ['seated-db-curl', 'ez-curl'], increment: 2.5,
    }),
    E({
      id: 'seated-db-curl', name: 'Curl haltères assis', muscle: 'Biceps', unit: 'kg/main', role: 'isolation',
      groups: { biceps: 1 },
      cues: ['Dos contre le dossier.', 'Amplitude complète, supination en haut.', 'Mouvement contrôlé.'],
      evidence: { level: 'faible', text: 'Volume ; pas de comparaison d’exercices vérifiée.', refs: ['schoenfeld2017vol'] },
      demo: true, query: 'seated dumbbell curl technique', alternatives: ['preacher-curl', 'incline-db-curl'], increment: 2,
    }),
    E({
      id: 'incline-db-curl', name: 'Curl incliné haltères', muscle: 'Biceps', unit: 'kg/main', role: 'isolation',
      groups: { biceps: 1 },
      cues: ['Banc à 45–60°, bras pendants derrière le buste.', 'Étirement du biceps en bas.', 'Coudes fixes.'],
      evidence: { level: 'faible', text: 'Variante en position étirée ; comparaison non vérifiée.', refs: ['wolf2023'] },
      demo: true, query: 'incline dumbbell curl technique', alternatives: ['seated-db-curl'], increment: 2,
    }),
    E({
      id: 'leg-press', name: 'Presse à cuisses', muscle: 'Quadriceps & fessiers', unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: ['Amplitude profonde, bassin plaqué.', 'Pieds largeur d’épaules.', 'Ne pas verrouiller les genoux en haut.'],
      evidence: { level: 'modere', text: 'Machines = libres ; amplitude complète légèrement supérieure.', refs: ['haugen2023', 'wolf2023'] },
      demo: true, query: 'leg press technique', alternatives: ['hack-squat'], increment: 5,
    }),
    E({
      id: 'hack-squat', name: 'Hack squat', muscle: 'Quadriceps', unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: ['Pieds au milieu ou bas de la plateforme.', 'Descendre profond, genoux vers l’avant.', 'Dos plaqué.'],
      evidence: { level: 'modere', text: 'Machines = libres ; amplitude complète.', refs: ['haugen2023', 'wolf2023'] },
      demo: true, query: 'hack squat machine technique', alternatives: ['smith-squat', 'leg-press'], increment: 5,
    }),
    E({
      id: 'smith-squat', name: 'Squat Smith machine', muscle: 'Quadriceps', unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: ['Pieds légèrement devant la barre.', 'Descendre sous le parallèle si la mobilité le permet.', 'Tronc gainé.'],
      evidence: { level: 'modere', text: 'Alternative au hack squat.', refs: ['haugen2023'] },
      demo: true, query: 'smith machine squat technique', alternatives: ['hack-squat', 'leg-press'], increment: 5,
    }),
    E({
      id: 'leg-extension', name: 'Leg extension', muscle: 'Quadriceps', unit: 'kg', role: 'isolation',
      groups: { quads: 1 },
      cues: ['Axe du genou aligné avec l’axe de la machine.', 'Insister sur le bas du mouvement, genou fléchi.', 'Descente contrôlée, pas de rebond.'],
      evidence: { level: 'modere', text: 'Travail genou fléchi (quadriceps étiré) : plus d’hypertrophie régionale.', refs: ['pedrosa2022'] },
      demo: true, query: 'leg extension technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'leg-curl', name: 'Leg curl assis', muscle: 'Ischio-jambiers', unit: 'kg', role: 'isolation',
      groups: { hams: 1 },
      cues: ['Version assise de préférence (hanches fléchies).', 'Rouleau au-dessus des chevilles.', 'Retour lent jusqu’à l’extension complète.'],
      evidence: { level: 'modere', text: 'Assis : +14 % de volume des ischios contre +9 % allongé.', refs: ['maeo2021'] },
      demo: true, query: 'seated leg curl technique', alternatives: ['lying-leg-curl'], increment: 2.5,
    }),
    E({
      id: 'lying-leg-curl', name: 'Leg curl allongé', muscle: 'Ischio-jambiers', unit: 'kg', role: 'isolation',
      groups: { hams: 1 },
      cues: ['Bassin plaqué contre le banc.', 'Amplitude complète.', 'Retour contrôlé.'],
      evidence: { level: 'modere', text: 'Variante pour varier ; la version assise est supérieure.', refs: ['maeo2021'] },
      demo: true, query: 'lying leg curl technique', alternatives: ['leg-curl'], increment: 2.5,
    }),
    E({
      id: 'romanian-deadlift', name: 'Soulevé de terre roumain', muscle: 'Ischios & fessiers', unit: 'kg', role: 'compound',
      groups: { hams: 1, glutes: 1 },
      cues: ['Genoux légèrement fléchis et fixes.', 'Hanches vers l’arrière, dos neutre.', 'Descendre jusqu’à l’étirement des ischios (mi-tibia environ).'],
      evidence: { level: 'faible', text: 'Position étirée des ischios ; choix fondé sur l’opinion d’experts.', refs: ['wolf2023'] },
      demo: true, query: 'romanian deadlift technique', alternatives: ['back-extension-45'], increment: 2.5,
    }),
    E({
      id: 'hip-thrust', name: 'Hip thrust', muscle: 'Fessiers', unit: 'kg', role: 'compound',
      groups: { glutes: 1, hams: 0.5 },
      cues: ['Haut du dos sur le banc, menton rentré.', 'Pousser par les talons jusqu’à l’extension de hanche.', 'Pause d’une seconde en haut.'],
      evidence: { level: 'faible', text: 'Ajouté pour combler l’absence de travail direct des fessiers (prépublication + opinion d’experts).', refs: [] },
      demo: true, query: 'hip thrust technique', alternatives: ['romanian-deadlift'], increment: 5,
    }),
    E({
      id: 'back-extension-45', name: 'Extension lombaire 45°', muscle: 'Fessiers & chaîne postérieure', unit: 'PDC', role: 'isolation',
      groups: { glutes: 1, hams: 0.5 },
      cues: ['Version orientée fessiers : dos légèrement arrondi, bassin qui pousse.', 'Pause de 3 s en haut.', 'Amplitude identique à chaque répétition.'],
      evidence: { level: 'opinion', text: 'Réduite à 1 fois/semaine : redondante avec le soulevé de terre roumain.', refs: [] },
      demo: true, query: '45 degree back extension glute technique', alternatives: ['romanian-deadlift'], increment: 0,
    }),
    E({
      id: 'calf-press', name: 'Mollets à la presse', muscle: 'Mollets', unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: ['Avant-pieds sur le bas de la plateforme.', 'Pause de 1–2 s en étirement complet.', 'Amplitude complète, sans rebond.'],
      evidence: { level: 'modere', text: 'Travail en étirement : +15,2 % vs +6,7 % pour le gastrocnémien.', refs: ['kassiano2023'] },
      demo: true, query: 'calf press on leg press technique', alternatives: ['standing-calf-raise'], increment: 5,
    }),
    E({
      id: 'standing-calf-raise', name: 'Mollets debout', muscle: 'Mollets', unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: ['Genoux tendus.', 'Pause de 1–2 s en bas, talons sous le niveau de la marche.', 'Monter haut sur les orteils.'],
      evidence: { level: 'modere', text: 'Debout > assis pour le triceps sural ; étirement sous charge.', refs: ['kinoshita2023', 'kassiano2023'] },
      demo: true, query: 'standing calf raise technique', alternatives: ['calf-press'], increment: 5,
    }),
    E({
      id: 'seated-calf-raise', name: 'Mollets assis', muscle: 'Mollets', unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: ['Genoux fléchis à 90°.', 'Pause en étirement.', 'Amplitude complète.'],
      evidence: { level: 'modere', text: 'Moins efficace que debout pour le triceps sural.', refs: ['kinoshita2023'] },
      demo: true, query: 'seated calf raise technique', alternatives: ['standing-calf-raise'], increment: 5,
    }),
    E({
      id: 'roman-chair-abs', name: 'Relevés de jambes chaise romaine', muscle: 'Abdominaux', unit: 'PDC', role: 'isolation',
      groups: { abs: 1 },
      cues: ['Dos plaqué contre le dossier.', 'Enrouler le bassin vers le haut.', 'Aucun élan.'],
      evidence: { level: 'opinion', text: 'Choix d’exercice fondé sur l’opinion d’experts.', refs: [] },
      demo: true, query: 'captains chair leg raise technique', alternatives: ['cable-crunch'], increment: 0,
    }),
    E({
      id: 'cable-crunch', name: 'Crunch poulie', muscle: 'Abdominaux', unit: 'kg', role: 'isolation',
      groups: { abs: 1 },
      cues: ['À genoux, corde derrière la tête.', 'Enrouler la colonne, pas les hanches.', 'Étirement en haut.'],
      evidence: { level: 'opinion', text: 'Alternative chargée aux relevés.', refs: [] },
      demo: true, query: 'cable crunch technique', alternatives: ['roman-chair-abs'], increment: 2.5,
    }),
    E({
      id: 'goblet-squat', name: 'Goblet squat', muscle: 'Quadriceps', unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: ['Haltère contre la poitrine.', 'Descendre entre les genoux.', 'Tronc droit.'],
      evidence: { level: 'modere', text: 'Alternative si les machines sont prises.', refs: ['haugen2023'] },
      demo: true, query: 'goblet squat technique', alternatives: ['hack-squat'], increment: 2,
    }),
    E({
      id: 'hip-adduction', name: 'Adducteurs machine', muscle: 'Adducteurs', unit: 'kg', role: 'isolation',
      groups: {},
      cues: ['Ouverture jusqu’à l’étirement.', 'Fermeture contrôlée.'],
      evidence: { level: 'opinion', text: 'Accessoire optionnel.', refs: [] },
      demo: true, query: 'hip adduction machine technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'hip-abduction', name: 'Abducteurs machine', muscle: 'Moyen fessier', unit: 'kg', role: 'isolation',
      groups: { glutes: 0.5 },
      cues: ['Buste légèrement penché en avant.', 'Ouvrir en poussant avec l’extérieur des genoux.'],
      evidence: { level: 'opinion', text: 'Accessoire optionnel.', refs: [] },
      demo: true, query: 'hip abduction machine technique', alternatives: [], increment: 2.5,
    }),
  ].map((x) => [x.id, x]),
)

/** Library entry for an exercise id, with a graceful fallback for imported custom exercises. */
export function infoFor(id: string, fallback?: { name?: string; muscle?: string; unit?: ExerciseInfo['unit'] }): ExerciseInfo {
  const known = LIBRARY[id]
  if (known) return known
  return {
    id,
    name: fallback?.name ?? id,
    muscle: fallback?.muscle ?? '',
    unit: fallback?.unit ?? 'kg',
    role: 'isolation',
    groups: guessGroups(fallback?.muscle ?? ''),
    cues: [],
    evidence: { level: 'opinion', text: 'Exercice personnalisé.', refs: [] },
    demo: false,
    query: `${fallback?.name ?? id} technique`,
    alternatives: [],
    increment: 2.5,
  }
}

function guessGroups(muscle: string): Partial<Record<MuscleGroup, number>> {
  const m = muscle.toLowerCase()
  if (m.includes('pector')) return { chest: 1 }
  if (m.includes('dors') || m.includes('dos')) return { back: 1 }
  if (m.includes('arrière')) return { rearDelts: 1 }
  if (m.includes('épaule') || m.includes('deltoïde')) return { sideDelts: 1 }
  if (m.includes('triceps')) return { triceps: 1 }
  if (m.includes('biceps')) return { biceps: 1 }
  if (m.includes('quadri') || m.includes('jambe')) return { quads: 1 }
  if (m.includes('ischio')) return { hams: 1 }
  if (m.includes('fess')) return { glutes: 1 }
  if (m.includes('mollet')) return { calves: 1 }
  if (m.includes('abdo')) return { abs: 1 }
  return {}
}

export function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

/** Extracts a YouTube video id from the usual URL shapes, for an embedded player. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null
    if (u.hostname.endsWith('youtube.com') || u.hostname.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{6,})/)
      if (m) return m[2]
    }
  } catch {
    /* not a URL */
  }
  return null
}
