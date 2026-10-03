import { L } from './i18n'
import type { Equipment, Role, Unit } from './types'
import type { EvidenceLevel } from './research'

export type MuscleGroup = 'chest' | 'back' | 'sideDelts' | 'rearDelts' | 'triceps' | 'biceps' | 'quads' | 'hams' | 'glutes' | 'calves' | 'abs'

export const MUSCLES: { id: MuscleGroup; label: string; priority?: boolean }[] = [
  { id: 'chest', get label() { return L('Pectoraux', 'Chest') }, priority: true },
  { id: 'back', get label() { return L('Dos', 'Back') }, priority: true },
  { id: 'sideDelts', get label() { return L('Deltoïdes latéraux', 'Side delts') }, priority: true },
  { id: 'rearDelts', get label() { return L('Deltoïdes postérieurs', 'Rear delts') } },
  { id: 'triceps', get label() { return L('Triceps', 'Triceps') }, priority: true },
  { id: 'biceps', get label() { return L('Biceps', 'Biceps') }, priority: true },
  { id: 'quads', get label() { return L('Quadriceps', 'Quads') } },
  { id: 'hams', get label() { return L('Ischios', 'Hamstrings') } },
  { id: 'glutes', get label() { return L('Fessiers', 'Glutes') } },
  { id: 'calves', get label() { return L('Mollets', 'Calves') } },
  { id: 'abs', get label() { return L('Abdominaux', 'Abs') } },
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
  /** Home equipment needed; absent for gym machines (listed in HOME_SLOTS only when doable at home). */
  requires?: Equipment[]
  /** Rep range used at home when it differs from the gym slot (body weight and bands: more reps). */
  reps?: [number, number]
}

/** French first, English second. */
type Bi = [string, string]

/** A library entry as written below: every text in French and English. */
interface Spec extends Omit<ExerciseInfo, 'name' | 'muscle' | 'cues' | 'evidence'> {
  name: Bi
  muscle: Bi
  cues: Bi[]
  evidence: { level: EvidenceLevel; text: Bi; refs: string[] }
}

/** Texts are getters: they follow the interface language, which can change after import. */
const E = (x: Spec): ExerciseInfo => {
  const { name, muscle, cues, evidence, ...rest } = x
  return {
    ...rest,
    get name() { return L(...name) },
    get muscle() { return L(...muscle) },
    get cues() { return cues.map((c) => L(...c)) },
    evidence: { level: evidence.level, get text() { return L(...evidence.text) }, refs: evidence.refs },
  }
}

export const LIBRARY: Record<string, ExerciseInfo> = Object.fromEntries(
  [
    E({
      id: 'chest-press', name: ['Chest press machine', 'Machine chest press'], muscle: ['Pectoraux', 'Chest'], unit: 'kg', role: 'compound',
      groups: { chest: 1, triceps: 0.5 },
      cues: [
        ['Omoplates serrées et basses, poitrine sortie.', 'Shoulder blades pinched and down, chest up.'],
        ['Poignées à hauteur du bas des pectoraux.', 'Handles level with your lower chest.'],
        ['Descente contrôlée jusqu’à l’étirement, sans décoller les épaules.', 'Controlled return into the stretch, shoulders staying on the backrest.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'schoenfeld2017vol'],
        text: ['Machines et poids libres donnent la même hypertrophie.', 'Machines and free weights produce the same hypertrophy.'],
      },
      demo: true, query: 'machine chest press technique', alternatives: ['incline-db-press'], increment: 2.5,
    }),
    E({
      id: 'incline-db-press', name: ['Développé incliné haltères', 'Incline dumbbell press'], muscle: ['Haut des pectoraux', 'Upper chest'], unit: 'kg/main', role: 'compound',
      groups: { chest: 1, triceps: 0.5 }, requires: ['dumbbells', 'bench'],
      cues: [
        ['Banc à 30°, omoplates rétractées.', 'Bench at 30°, shoulder blades retracted.'],
        ['Coudes à ~45° du buste.', 'Elbows at ~45° from your torso.'],
        ['Descendre jusqu’à sentir l’étirement des pectoraux.', 'Lower until you feel your chest stretch.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'schoenfeld2017vol'],
        text: ['Principe validé (volume, machines = libres) ; incliné vs plat non vérifié.', 'Validated principle (volume, machines = free weights); incline vs flat not verified.'],
      },
      demo: true, query: 'incline dumbbell press technique', alternatives: ['chest-press'], increment: 2,
    }),
    E({
      id: 'pec-deck', name: ['Pec deck', 'Pec deck'], muscle: ['Pectoraux', 'Chest'], unit: 'kg', role: 'isolation',
      groups: { chest: 1 },
      cues: [
        ['Siège réglé pour les poignées à hauteur de poitrine.', 'Seat set so the handles are at chest height.'],
        ['Ouverture lente jusqu’à l’étirement contrôlé.', 'Open slowly into a controlled stretch.'],
        ['Coudes légèrement fléchis et fixes.', 'Elbows slightly bent and held still.'],
      ],
      evidence: {
        level: 'modere', refs: ['wolf2023', 'pedrosa2022'],
        text: ['Travail en position étirée, extrapolé des essais sur la longueur musculaire.', 'Work in the stretched position, extrapolated from muscle-length trials.'],
      },
      demo: true, query: 'pec deck fly technique', alternatives: ['cable-fly'], increment: 2.5,
    }),
    E({
      id: 'cable-fly', name: ['Écarté poulie', 'Cable fly'], muscle: ['Pectoraux', 'Chest'], unit: 'kg', role: 'isolation',
      groups: { chest: 1 },
      cues: [
        ['Poulies à hauteur d’épaules, un pas en avant.', 'Pulleys at shoulder height, one step forward.'],
        ['Bras légèrement fléchis, ouverture jusqu’à l’étirement.', 'Arms slightly bent, open into the stretch.'],
        ['Rapprocher les mains devant le sternum.', 'Bring your hands together in front of your sternum.'],
      ],
      evidence: {
        level: 'modere', refs: ['wolf2023'],
        text: ['Même logique que le pec deck : tension en position étirée.', 'Same logic as the pec deck: tension in the stretched position.'],
      },
      demo: true, query: 'cable fly technique', alternatives: ['pec-deck'], increment: 2.5,
    }),
    E({
      id: 'dips', name: ['Dips', 'Dips'], muscle: ['Pectoraux & triceps', 'Chest & triceps'], unit: 'PDC', role: 'compound',
      groups: { chest: 1, triceps: 0.5 },
      cues: [
        ['Buste légèrement penché en avant.', 'Torso leaning slightly forward.'],
        ['Descendre jusqu’à ce que l’épaule soit au niveau du coude, pas plus.', 'Lower until your shoulder is level with your elbow, no deeper.'],
        ['À remplacer par le pushdown si les épaules tirent.', 'Switch to pushdowns if your shoulders feel strained.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Réduits à 2 séries : ils recoupent pectoraux et triceps déjà chargés, coût articulaire.', 'Cut to 2 sets: they overlap with chest and triceps already worked, at a cost to the joints.'],
      },
      demo: true, query: 'chest dips technique', alternatives: ['triceps-rope'], increment: 2.5,
    }),
    E({
      id: 'lat-pulldown', name: ['Tirage vertical', 'Lat pulldown'], muscle: ['Grand dorsal', 'Lats'], unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5 },
      cues: [
        ['Poitrine sortie, épaules basses.', 'Chest up, shoulders down.'],
        ['Tirer avec les coudes vers les hanches.', 'Pull with your elbows toward your hips.'],
        ['Remonter jusqu’à l’étirement complet des dorsaux, sans balancer.', 'Go back up to a full lat stretch, without swinging.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'pelland2025'],
        text: ['Principe validé (volume, machines).', 'Validated principle (volume, machines).'],
      },
      demo: true, query: 'lat pulldown technique', alternatives: ['single-arm-pulldown'], increment: 2.5,
    }),
    E({
      id: 'low-cable-row', name: ['Rowing assis poulie', 'Seated cable row'], muscle: ['Dos', 'Back'], unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 },
      cues: [
        ['Buste stable, pas de balancier.', 'Torso steady, no rocking.'],
        ['Laisser les omoplates avancer à l’étirement.', 'Let your shoulder blades move forward in the stretch.'],
        ['Ramener les coudes le long du corps.', 'Pull your elbows back along your sides.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'pelland2025'],
        text: ['Principe validé (volume, machines).', 'Validated principle (volume, machines).'],
      },
      demo: true, query: 'seated cable row technique', alternatives: ['chest-supported-row'], increment: 2.5,
    }),
    E({
      id: 'chest-supported-row', name: ['Rowing poitrine appuyée', 'Chest-supported row'], muscle: ['Milieu du dos', 'Mid back'], unit: 'kg', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 },
      cues: [
        ['Poitrine contre le support pendant toute la série.', 'Chest on the pad for the whole set.'],
        ['Amplitude complète, retour contrôlé.', 'Full range of motion, controlled return.'],
        ['Aucune impulsion des jambes.', 'No push from the legs.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'pelland2025'],
        text: ['Principe validé (volume, machines).', 'Validated principle (volume, machines).'],
      },
      demo: true, query: 'chest supported row machine technique', alternatives: ['low-cable-row'], increment: 2.5,
    }),
    E({
      id: 'cable-pullover', name: ['Pull-over poulie', 'Cable pullover'], muscle: ['Grand dorsal', 'Lats'], unit: 'kg', role: 'isolation',
      groups: { back: 1 },
      cues: [
        ['Corde ou barre, bras presque tendus.', 'Rope or bar, arms almost straight.'],
        ['Laisser monter les bras jusqu’à l’étirement des dorsaux.', 'Let your arms rise until your lats stretch.'],
        ['Ramener vers les cuisses sans plier les coudes.', 'Pull down to your thighs without bending your elbows.'],
      ],
      evidence: {
        level: 'modere', refs: ['wolf2023', 'pelland2025'],
        text: ['Choisi pour étirer les dorsaux sous charge.', 'Chosen to stretch the lats under load.'],
      },
      demo: true, query: 'cable straight arm pulldown pullover technique', alternatives: ['single-arm-pulldown'], increment: 2.5,
    }),
    E({
      id: 'single-arm-pulldown', name: ['Tirage unilatéral poulie', 'Single-arm cable pulldown'], muscle: ['Grand dorsal', 'Lats'], unit: 'kg', role: 'isolation',
      groups: { back: 1, biceps: 0.5 },
      cues: [
        ['Un bras à la fois, buste légèrement incliné.', 'One arm at a time, torso leaning slightly.'],
        ['Grand étirement en haut.', 'Big stretch at the top.'],
        ['Coude vers la hanche.', 'Elbow toward your hip.'],
      ],
      evidence: {
        level: 'modere', refs: ['pelland2025'],
        text: ['Alternative au pull-over, même logique d’étirement.', 'Alternative to the pullover, same stretch logic.'],
      },
      demo: true, query: 'single arm lat pulldown technique', alternatives: ['cable-pullover'], increment: 2.5,
    }),
    E({
      id: 'reverse-pec-deck', name: ['Reverse pec deck', 'Reverse pec deck'], muscle: ['Arrière d’épaules', 'Rear delts'], unit: 'kg', role: 'isolation',
      groups: { rearDelts: 1 },
      cues: [
        ['Poitrine contre le dossier.', 'Chest against the pad.'],
        ['Bras presque tendus, ouvrir en arc.', 'Arms almost straight, open in an arc.'],
        ['Aucun élan, retour lent.', 'No momentum, slow return.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'reverse pec deck rear delt fly technique', alternatives: ['face-pull'], increment: 2.5,
    }),
    E({
      id: 'face-pull', name: ['Face pull', 'Face pull'], muscle: ['Arrière d’épaules', 'Rear delts'], unit: 'kg', role: 'isolation',
      groups: { rearDelts: 1 },
      cues: [
        ['Poulie haute, corde.', 'High pulley, rope.'],
        ['Tirer vers le front en écartant les mains.', 'Pull toward your forehead, spreading your hands apart.'],
        ['Coudes hauts.', 'Elbows high.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Alternative au reverse pec deck.', 'Alternative to the reverse pec deck.'],
      },
      demo: true, query: 'face pull technique', alternatives: ['reverse-pec-deck'], increment: 2.5,
    }),
    E({
      id: 'shoulder-press-machine', name: ['Développé épaules machine', 'Machine shoulder press'], muscle: ['Épaules', 'Shoulders'], unit: 'kg', role: 'compound',
      groups: { sideDelts: 0.5, triceps: 0.5 },
      cues: [
        ['Dos plaqué, poignées à hauteur d’oreilles au départ.', 'Back against the pad, handles at ear height to start.'],
        ['Pousser sans verrouiller brutalement.', 'Press up without slamming into lockout.'],
        ['Descente contrôlée.', 'Controlled lowering.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023'],
        text: ['Principe validé (volume, machines).', 'Validated principle (volume, machines).'],
      },
      demo: true, query: 'machine shoulder press technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'lateral-raise', name: ['Élévations latérales', 'Lateral raise'], muscle: ['Deltoïdes latéraux', 'Side delts'], unit: 'kg/main', role: 'isolation',
      groups: { sideDelts: 1 }, requires: ['dumbbells'],
      cues: [
        ['Buste légèrement penché, coudes un peu fléchis.', 'Torso leaning slightly forward, elbows slightly bent.'],
        ['Monter jusqu’à l’horizontale, en guidant avec les coudes.', 'Raise to horizontal, leading with your elbows.'],
        ['Descente lente : pas d’élan.', 'Slow lowering: no momentum.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol', 'pelland2025'],
        text: [
          'Volume passé de 5 à 10 séries/semaine (preuve forte sur le volume) ; le choix de l’exercice relève de l’opinion d’experts.',
          'Volume raised from 5 to 10 sets/week (strong evidence on volume); the exercise choice is expert opinion.',
        ],
      },
      demo: true, query: 'dumbbell lateral raise technique', alternatives: ['cable-lateral-raise'], increment: 1,
    }),
    E({
      id: 'cable-lateral-raise', name: ['Élévations latérales poulie', 'Cable lateral raise'], muscle: ['Deltoïdes latéraux', 'Side delts'], unit: 'kg', role: 'isolation',
      groups: { sideDelts: 1 },
      cues: [
        ['Poulie basse, câble derrière ou devant le corps.', 'Low pulley, cable behind or in front of your body.'],
        ['Départ bras croisé devant la hanche : tension dès le bas.', 'Start with your arm across in front of your hip: tension from the very bottom.'],
        ['Monter jusqu’à l’horizontale.', 'Raise to horizontal.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol', 'pelland2025'],
        text: ['Volume des deltoïdes latéraux (preuve forte) ; version poulie = tension en bas du mouvement.', 'Side delt volume (strong evidence); cable version = tension at the bottom of the movement.'],
      },
      demo: true, query: 'cable lateral raise technique', alternatives: ['lateral-raise'], increment: 1.25,
    }),
    E({
      id: 'triceps-overhead-rope', name: ['Extension triceps au-dessus de la tête', 'Overhead cable triceps extension'], muscle: ['Triceps', 'Triceps'], unit: 'kg', role: 'isolation',
      groups: { triceps: 1 },
      cues: [
        ['Dos à la poulie, corde derrière la tête.', 'Back to the pulley, rope behind your head.'],
        ['Coudes fixes, pointés vers l’avant.', 'Elbows still, pointing forward.'],
        ['Descendre jusqu’à l’étirement maximal du triceps.', 'Lower until your triceps are fully stretched.'],
      ],
      evidence: {
        level: 'modere', refs: ['maeo2023'],
        text: ['≈1,4× plus d’hypertrophie du triceps que l’extension poulie basse (+19,9 % vs +13,9 %).', '≈1.4× more triceps growth than the pushdown (+19.9% vs +13.9%).'],
      },
      demo: true, query: 'overhead cable triceps extension technique', alternatives: ['triceps-rope'], increment: 2.5,
    }),
    E({
      id: 'triceps-rope', name: ['Pushdown corde', 'Rope pushdown'], muscle: ['Triceps', 'Triceps'], unit: 'kg', role: 'isolation',
      groups: { triceps: 1 },
      cues: [
        ['Coudes collés au buste.', 'Elbows pinned to your sides.'],
        ['Écarter la corde en bas.', 'Spread the rope apart at the bottom.'],
        ['Remonter jusqu’à 90° environ, sans élan.', 'Come back up to about 90°, no momentum.'],
      ],
      evidence: {
        level: 'modere', refs: ['maeo2023'],
        text: ['Conservé en complément ; l’essentiel du volume triceps passe au-dessus de la tête.', 'Kept as a complement; most triceps volume is done overhead.'],
      },
      demo: true, query: 'rope triceps pushdown technique', alternatives: ['triceps-overhead-rope'], increment: 2.5,
    }),
    E({
      id: 'ez-curl', name: ['Curl barre EZ', 'EZ-bar curl'], muscle: ['Biceps', 'Biceps'], unit: 'kg', role: 'isolation',
      groups: { biceps: 1 },
      cues: [
        ['Buste fixe, pas d’impulsion des hanches.', 'Torso still, no hip drive.'],
        ['Descente complète, bras presque tendus.', 'Lower all the way, arms almost straight.'],
        ['Coudes immobiles.', 'Elbows still.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol'],
        text: ['Volume ; pas de comparaison d’exercices vérifiée.', 'Volume; no verified exercise comparison.'],
      },
      demo: true, query: 'ez bar curl technique', alternatives: ['preacher-curl', 'seated-db-curl'], increment: 2.5,
    }),
    E({
      id: 'preacher-curl', name: ['Curl pupitre machine', 'Machine preacher curl'], muscle: ['Biceps', 'Biceps'], unit: 'kg', role: 'isolation',
      groups: { biceps: 1 },
      cues: [
        ['Aisselles calées contre le pupitre.', 'Armpits snug against the pad.'],
        ['Descendre jusqu’à l’extension presque complète.', 'Lower to almost full extension.'],
        ['Remonter sans décoller les coudes.', 'Curl up without lifting your elbows off the pad.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol'],
        text: ['Volume ; pas de comparaison d’exercices vérifiée.', 'Volume; no verified exercise comparison.'],
      },
      demo: true, query: 'machine preacher curl technique', alternatives: ['seated-db-curl', 'ez-curl'], increment: 2.5,
    }),
    E({
      id: 'seated-db-curl', name: ['Curl haltères assis', 'Seated dumbbell curl'], muscle: ['Biceps', 'Biceps'], unit: 'kg/main', role: 'isolation',
      groups: { biceps: 1 }, requires: ['dumbbells'],
      cues: [
        ['Dos contre le dossier.', 'Back against the backrest.'],
        ['Amplitude complète, supination en haut.', 'Full range of motion, turn your palms up at the top.'],
        ['Mouvement contrôlé.', 'Controlled movement.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol'],
        text: ['Volume ; pas de comparaison d’exercices vérifiée.', 'Volume; no verified exercise comparison.'],
      },
      demo: true, query: 'seated dumbbell curl technique', alternatives: ['preacher-curl', 'incline-db-curl'], increment: 2,
    }),
    E({
      id: 'incline-db-curl', name: ['Curl incliné haltères', 'Incline dumbbell curl'], muscle: ['Biceps', 'Biceps'], unit: 'kg/main', role: 'isolation',
      groups: { biceps: 1 }, requires: ['dumbbells', 'bench'],
      cues: [
        ['Banc à 45–60°, bras pendants derrière le buste.', 'Bench at 45–60°, arms hanging behind your torso.'],
        ['Étirement du biceps en bas.', 'Biceps stretched at the bottom.'],
        ['Coudes fixes.', 'Elbows still.'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: ['Variante en position étirée ; comparaison non vérifiée.', 'Stretched-position variation; comparison not verified.'],
      },
      demo: true, query: 'incline dumbbell curl technique', alternatives: ['seated-db-curl'], increment: 2,
    }),
    E({
      id: 'leg-press', name: ['Presse à cuisses', 'Leg press'], muscle: ['Quadriceps & fessiers', 'Quads & glutes'], unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: [
        ['Amplitude profonde, bassin plaqué.', 'Deep range, hips pressed into the seat.'],
        ['Pieds largeur d’épaules.', 'Feet shoulder-width apart.'],
        ['Ne pas verrouiller les genoux en haut.', 'Don’t lock your knees at the top.'],
      ],
      evidence: {
        level: 'modere', refs: ['haugen2023', 'wolf2023'],
        text: ['Machines = libres ; amplitude complète légèrement supérieure.', 'Machines = free weights; full range of motion slightly better.'],
      },
      demo: true, query: 'leg press technique', alternatives: ['hack-squat'], increment: 5,
    }),
    E({
      id: 'hack-squat', name: ['Hack squat', 'Hack squat'], muscle: ['Quadriceps', 'Quads'], unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: [
        ['Pieds au milieu ou bas de la plateforme.', 'Feet in the middle or low on the platform.'],
        ['Descendre profond, genoux vers l’avant.', 'Go deep, knees traveling forward.'],
        ['Dos plaqué.', 'Back flat against the pad.'],
      ],
      evidence: {
        level: 'modere', refs: ['haugen2023', 'wolf2023'],
        text: ['Machines = libres ; amplitude complète.', 'Machines = free weights; full range of motion.'],
      },
      demo: true, query: 'hack squat machine technique', alternatives: ['smith-squat', 'leg-press'], increment: 5,
    }),
    E({
      id: 'smith-squat', name: ['Squat Smith machine', 'Smith machine squat'], muscle: ['Quadriceps', 'Quads'], unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 },
      cues: [
        ['Pieds légèrement devant la barre.', 'Feet slightly in front of the bar.'],
        ['Descendre sous le parallèle si la mobilité le permet.', 'Go below parallel if your mobility allows.'],
        ['Tronc gainé.', 'Core braced.'],
      ],
      evidence: {
        level: 'modere', refs: ['haugen2023'],
        text: ['Alternative au hack squat.', 'Alternative to the hack squat.'],
      },
      demo: true, query: 'smith machine squat technique', alternatives: ['hack-squat', 'leg-press'], increment: 5,
    }),
    E({
      id: 'leg-extension', name: ['Leg extension', 'Leg extension'], muscle: ['Quadriceps', 'Quads'], unit: 'kg', role: 'isolation',
      groups: { quads: 1 },
      cues: [
        ['Axe du genou aligné avec l’axe de la machine.', 'Knee lined up with the machine’s pivot.'],
        ['Insister sur le bas du mouvement, genou fléchi.', 'Emphasize the bottom of the movement, knee bent.'],
        ['Descente contrôlée, pas de rebond.', 'Controlled lowering, no bouncing.'],
      ],
      evidence: {
        level: 'modere', refs: ['pedrosa2022'],
        text: ['Travail genou fléchi (quadriceps étiré) : plus d’hypertrophie régionale.', 'Work with the knee bent (quads stretched): more regional hypertrophy.'],
      },
      demo: true, query: 'leg extension technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'leg-curl', name: ['Leg curl assis', 'Seated leg curl'], muscle: ['Ischio-jambiers', 'Hamstrings'], unit: 'kg', role: 'isolation',
      groups: { hams: 1 },
      cues: [
        ['Version assise de préférence (hanches fléchies).', 'Seated version preferred (hips flexed).'],
        ['Rouleau au-dessus des chevilles.', 'Pad just above your ankles.'],
        ['Retour lent jusqu’à l’extension complète.', 'Slow return to full extension.'],
      ],
      evidence: {
        level: 'modere', refs: ['maeo2021'],
        text: ['Assis : +14 % de volume des ischios contre +9 % allongé.', 'Seated: +14% hamstring volume vs +9% lying.'],
      },
      demo: true, query: 'seated leg curl technique', alternatives: ['lying-leg-curl'], increment: 2.5,
    }),
    E({
      id: 'lying-leg-curl', name: ['Leg curl allongé', 'Lying leg curl'], muscle: ['Ischio-jambiers', 'Hamstrings'], unit: 'kg', role: 'isolation',
      groups: { hams: 1 },
      cues: [
        ['Bassin plaqué contre le banc.', 'Hips pressed into the bench.'],
        ['Amplitude complète.', 'Full range of motion.'],
        ['Retour contrôlé.', 'Controlled return.'],
      ],
      evidence: {
        level: 'modere', refs: ['maeo2021'],
        text: ['Variante pour varier ; la version assise est supérieure.', 'A variation for variety; the seated version is better.'],
      },
      demo: true, query: 'lying leg curl technique', alternatives: ['leg-curl'], increment: 2.5,
    }),
    E({
      id: 'romanian-deadlift', name: ['Soulevé de terre roumain', 'Romanian deadlift'], muscle: ['Ischios & fessiers', 'Hamstrings & glutes'], unit: 'kg', role: 'compound',
      groups: { hams: 1, glutes: 1 },
      cues: [
        ['Genoux légèrement fléchis et fixes.', 'Knees slightly bent and fixed.'],
        ['Hanches vers l’arrière, dos neutre.', 'Hips back, neutral spine.'],
        ['Descendre jusqu’à l’étirement des ischios (mi-tibia environ).', 'Lower until your hamstrings stretch (about mid-shin).'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: ['Position étirée des ischios ; choix fondé sur l’opinion d’experts.', 'Stretched hamstring position; choice based on expert opinion.'],
      },
      demo: true, query: 'romanian deadlift technique', alternatives: ['back-extension-45'], increment: 2.5,
    }),
    E({
      id: 'hip-thrust', name: ['Hip thrust', 'Hip thrust'], muscle: ['Fessiers', 'Glutes'], unit: 'kg', role: 'compound',
      groups: { glutes: 1, hams: 0.5 },
      cues: [
        ['Haut du dos sur le banc, menton rentré.', 'Upper back on the bench, chin tucked.'],
        ['Pousser par les talons jusqu’à l’extension de hanche.', 'Drive through your heels to full hip extension.'],
        ['Pause d’une seconde en haut.', 'One-second pause at the top.'],
      ],
      evidence: {
        level: 'faible', refs: [],
        text: ['Ajouté pour combler l’absence de travail direct des fessiers (prépublication + opinion d’experts).', 'Added to fill the lack of direct glute work (preprint + expert opinion).'],
      },
      demo: true, query: 'hip thrust technique', alternatives: ['romanian-deadlift'], increment: 5,
    }),
    E({
      id: 'back-extension-45', name: ['Extension lombaire 45°', '45° back extension'], muscle: ['Fessiers & chaîne postérieure', 'Glutes & posterior chain'], unit: 'PDC', role: 'isolation',
      groups: { glutes: 1, hams: 0.5 },
      cues: [
        ['Version orientée fessiers : dos légèrement arrondi, bassin qui pousse.', 'Glute-focused version: back slightly rounded, drive with your hips.'],
        ['Pause de 3 s en haut.', 'Pause 3 s at the top.'],
        ['Amplitude identique à chaque répétition.', 'Same range of motion on every rep.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Réduite à 1 fois/semaine : redondante avec le soulevé de terre roumain.', 'Cut to once a week: redundant with the Romanian deadlift.'],
      },
      demo: true, query: '45 degree back extension glute technique', alternatives: ['romanian-deadlift'], increment: 2.5,
    }),
    E({
      id: 'calf-press', name: ['Mollets à la presse', 'Calf press on leg press'], muscle: ['Mollets', 'Calves'], unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: [
        ['Avant-pieds sur le bas de la plateforme.', 'Balls of your feet on the bottom edge of the platform.'],
        ['Pause de 1–2 s en étirement complet.', 'Pause 1–2 s in the full stretch.'],
        ['Amplitude complète, sans rebond.', 'Full range of motion, no bouncing.'],
      ],
      evidence: {
        level: 'modere', refs: ['kassiano2023'],
        text: ['Travail en étirement : +15,2 % vs +6,7 % pour le gastrocnémien.', 'Work in the stretch: +15.2% vs +6.7% for the gastrocnemius.'],
      },
      demo: true, query: 'calf press on leg press technique', alternatives: ['standing-calf-raise'], increment: 5,
    }),
    E({
      id: 'standing-calf-raise', name: ['Mollets debout', 'Standing calf raise'], muscle: ['Mollets', 'Calves'], unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: [
        ['Genoux tendus.', 'Knees straight.'],
        ['Pause de 1–2 s en bas, talons sous le niveau de la marche.', 'Pause 1–2 s at the bottom, heels below the step.'],
        ['Monter haut sur les orteils.', 'Rise high onto your toes.'],
      ],
      evidence: {
        level: 'modere', refs: ['kinoshita2023', 'kassiano2023'],
        text: ['Debout > assis pour le triceps sural ; étirement sous charge.', 'Standing > seated for the triceps surae; stretch under load.'],
      },
      demo: true, query: 'standing calf raise technique', alternatives: ['calf-press'], increment: 5,
    }),
    E({
      id: 'seated-calf-raise', name: ['Mollets assis', 'Seated calf raise'], muscle: ['Mollets', 'Calves'], unit: 'kg', role: 'isolation',
      groups: { calves: 1 },
      cues: [
        ['Genoux fléchis à 90°.', 'Knees bent at 90°.'],
        ['Pause en étirement.', 'Pause in the stretch.'],
        ['Amplitude complète.', 'Full range of motion.'],
      ],
      evidence: {
        level: 'modere', refs: ['kinoshita2023'],
        text: ['Moins efficace que debout pour le triceps sural.', 'Less effective than standing for the triceps surae.'],
      },
      demo: true, query: 'seated calf raise technique', alternatives: ['standing-calf-raise'], increment: 5,
    }),
    E({
      id: 'roman-chair-abs', name: ['Relevés de jambes chaise romaine', 'Captain’s chair leg raise'], muscle: ['Abdominaux', 'Abs'], unit: 'PDC', role: 'isolation',
      groups: { abs: 1 },
      cues: [
        ['Dos plaqué contre le dossier.', 'Back pressed against the pad.'],
        ['Enrouler le bassin vers le haut.', 'Curl your pelvis up.'],
        ['Aucun élan.', 'No swinging.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'captains chair leg raise technique', alternatives: ['cable-crunch'], increment: 0,
    }),
    E({
      id: 'cable-crunch', name: ['Crunch poulie', 'Cable crunch'], muscle: ['Abdominaux', 'Abs'], unit: 'kg', role: 'isolation',
      groups: { abs: 1 },
      cues: [
        ['À genoux, corde derrière la tête.', 'Kneeling, rope behind your head.'],
        ['Enrouler la colonne, pas les hanches.', 'Curl your spine; don’t hinge at the hips.'],
        ['Étirement en haut.', 'Stretch at the top.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Alternative chargée aux relevés.', 'Loaded alternative to leg raises.'],
      },
      demo: true, query: 'cable crunch technique', alternatives: ['roman-chair-abs'], increment: 2.5,
    }),
    E({
      id: 'goblet-squat', name: ['Goblet squat', 'Goblet squat'], muscle: ['Quadriceps', 'Quads'], unit: 'kg', role: 'compound',
      groups: { quads: 1, glutes: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Haltère contre la poitrine.', 'Dumbbell held against your chest.'],
        ['Descendre entre les genoux.', 'Sit down between your knees.'],
        ['Tronc droit.', 'Torso upright.'],
      ],
      evidence: {
        level: 'modere', refs: ['haugen2023'],
        text: ['Alternative si les machines sont prises.', 'Alternative when the machines are taken.'],
      },
      demo: true, query: 'goblet squat technique', alternatives: ['hack-squat'], increment: 2,
    }),
    E({
      id: 'hip-adduction', name: ['Adducteurs machine', 'Machine hip adduction'], muscle: ['Adducteurs', 'Adductors'], unit: 'kg', role: 'isolation',
      groups: {},
      cues: [
        ['Ouverture jusqu’à l’étirement.', 'Open into the stretch.'],
        ['Fermeture contrôlée.', 'Close under control.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Accessoire optionnel.', 'Optional accessory.'],
      },
      demo: true, query: 'hip adduction machine technique', alternatives: [], increment: 2.5,
    }),
    E({
      id: 'hip-abduction', name: ['Abducteurs machine', 'Machine hip abduction'], muscle: ['Moyen fessier', 'Glute medius'], unit: 'kg', role: 'isolation',
      groups: { glutes: 0.5 },
      cues: [
        ['Buste légèrement penché en avant.', 'Torso leaning slightly forward.'],
        ['Ouvrir en poussant avec l’extérieur des genoux.', 'Push out with the outside of your knees.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Accessoire optionnel.', 'Optional accessory.'],
      },
      demo: true, query: 'hip abduction machine technique', alternatives: [], increment: 2.5,
    }),

    // ───────── Home: body weight, dumbbells, bench, pull-up bar, bands ─────────

    E({
      id: 'db-bench-press', name: ['Développé couché haltères', 'Dumbbell bench press'], muscle: ['Pectoraux', 'Chest'], unit: 'kg/main', role: 'compound',
      groups: { chest: 1, triceps: 0.5 }, requires: ['dumbbells', 'bench'],
      cues: [
        ['Omoplates serrées, pieds bien à plat au sol.', 'Shoulder blades pinched, feet flat on the floor.'],
        ['Coudes à ~45° du buste.', 'Elbows at ~45° from your torso.'],
        ['Descendre jusqu’à sentir l’étirement des pectoraux.', 'Lower until you feel your chest stretch.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'schoenfeld2017vol'],
        text: ['Poids libres et machines donnent la même hypertrophie.', 'Free weights and machines produce the same hypertrophy.'],
      },
      demo: true, query: 'dumbbell bench press technique', alternatives: ['db-floor-press', 'push-up'], increment: 2,
    }),
    E({
      id: 'db-floor-press', name: ['Développé au sol haltères', 'Dumbbell floor press'], muscle: ['Pectoraux', 'Chest'], unit: 'kg/main', role: 'compound',
      groups: { chest: 1, triceps: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Allongé au sol, genoux fléchis, pieds à plat.', 'Lie on the floor, knees bent, feet flat.'],
        ['Coudes à ~45° du buste.', 'Elbows at ~45° from your torso.'],
        ['Poser les triceps au sol une seconde, sans rebond, puis pousser.', 'Rest your upper arms on the floor for a second, no bounce, then press.'],
      ],
      evidence: {
        level: 'faible', refs: ['haugen2023', 'wolf2023'],
        text: ['Poids libres = machines ; amplitude plus courte que sur un banc, donc moins d’étirement.', 'Free weights = machines; shorter range than on a bench, so less stretch.'],
      },
      demo: true, query: 'dumbbell floor press technique', alternatives: ['db-bench-press', 'push-up'], increment: 2,
    }),
    E({
      id: 'push-up', name: ['Pompes', 'Push-ups'], muscle: ['Pectoraux & triceps', 'Chest & triceps'], unit: 'PDC', role: 'compound',
      groups: { chest: 1, triceps: 0.5 }, requires: [], reps: [8, 25],
      cues: [
        ['Corps gainé et droit, mains un peu plus larges que les épaules.', 'Body braced and straight, hands slightly wider than your shoulders.'],
        ['Descendre la poitrine près du sol, coudes à ~45°.', 'Lower your chest close to the floor, elbows at ~45°.'],
        ['Plus de 25 reps : mains sur des livres (plus d’amplitude), pieds surélevés ou sac à dos lesté.', 'Over 25 reps: hands on books (more range), feet raised, or a loaded backpack.'],
      ],
      evidence: {
        level: 'modere', refs: ['kikuchi2017', 'schoenfeld2017load'],
        text: [
          'Pompes = développé couché à 40 % du 1RM pour l’hypertrophie en 8 semaines (petit essai). Charges légères efficaces si la série finit près de l’échec.',
          'Push-ups = bench press at 40% of 1RM for hypertrophy over 8 weeks (small trial). Light loads work when the set ends close to failure.',
        ],
      },
      demo: true, query: 'push up proper form', alternatives: ['db-bench-press', 'feet-elevated-push-up'], increment: 0,
    }),
    E({
      id: 'feet-elevated-push-up', name: ['Pompes pieds surélevés', 'Feet-elevated push-ups'], muscle: ['Haut des pectoraux', 'Upper chest'], unit: 'PDC', role: 'compound',
      groups: { chest: 1, triceps: 0.5 }, requires: [], reps: [8, 25],
      cues: [
        ['Pieds sur une chaise ou un canapé, mains au sol.', 'Feet on a chair or sofa, hands on the floor.'],
        ['Corps gainé, bassin aligné.', 'Body braced, hips in line.'],
        ['Descendre le haut de la poitrine vers le sol, coudes à ~45°.', 'Lower your upper chest toward the floor, elbows at ~45°.'],
      ],
      evidence: {
        level: 'faible', refs: ['kikuchi2017', 'schoenfeld2017load'],
        text: ['Extrapolé des pompes classiques ; l’accent sur le haut des pectoraux n’est pas vérifié.', 'Extrapolated from regular push-ups; the upper-chest emphasis is not verified.'],
      },
      demo: true, query: 'decline push up technique', alternatives: ['push-up', 'incline-db-press'], increment: 0,
    }),
    E({
      id: 'db-fly', name: ['Écarté haltères', 'Dumbbell fly'], muscle: ['Pectoraux', 'Chest'], unit: 'kg/main', role: 'isolation',
      groups: { chest: 1 }, requires: ['dumbbells'],
      cues: [
        ['Sur un banc ou au sol, coudes légèrement fléchis et fixes.', 'On a bench or the floor, elbows slightly bent and held still.'],
        ['Ouvrir lentement jusqu’à l’étirement des pectoraux.', 'Open slowly until your chest stretches.'],
        ['Remonter en arc, haltères au-dessus de la poitrine.', 'Bring the dumbbells back up in an arc over your chest.'],
      ],
      evidence: {
        level: 'modere', refs: ['wolf2023'],
        text: [
          'Travail en position étirée, extrapolé des essais sur l’amplitude ; au sol, l’amplitude est plus courte.',
          'Work in the stretched position, extrapolated from range-of-motion trials; on the floor, the range is shorter.',
        ],
      },
      demo: true, query: 'dumbbell fly technique', alternatives: ['band-fly'], increment: 2,
    }),
    E({
      id: 'band-fly', name: ['Écarté élastique', 'Band chest fly'], muscle: ['Pectoraux', 'Chest'], unit: 'PDC', role: 'isolation',
      groups: { chest: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique fixé derrière soi à hauteur de poitrine (porte, poteau).', 'Band anchored behind you at chest height (door, post).'],
        ['Bras légèrement fléchis, ouvrir jusqu’à l’étirement.', 'Arms slightly bent, open into the stretch.'],
        ['Rapprocher les mains devant le sternum, retour lent.', 'Bring your hands together in front of your sternum, return slowly.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Charge légère : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Light load: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: true, query: 'resistance band chest fly', alternatives: ['db-fly', 'push-up'], increment: 0,
    }),
    E({
      id: 'close-grip-push-up', name: ['Pompes serrées', 'Close-grip push-ups'], muscle: ['Triceps & pectoraux', 'Triceps & chest'], unit: 'PDC', role: 'compound',
      groups: { triceps: 1, chest: 0.5 }, requires: [], reps: [8, 25],
      cues: [
        ['Mains sous les épaules, coudes le long du corps.', 'Hands under your shoulders, elbows close to your sides.'],
        ['Corps gainé, descendre la poitrine vers les mains.', 'Body braced, lower your chest toward your hands.'],
        ['Plus de 25 reps : pieds surélevés ou sac à dos lesté.', 'Over 25 reps: feet raised or a loaded backpack.'],
      ],
      evidence: {
        level: 'faible', refs: ['kikuchi2017'],
        text: ['Extrapolé de l’essai sur les pompes ; l’accent sur les triceps n’est pas vérifié.', 'Extrapolated from the push-up trial; the triceps emphasis is not verified.'],
      },
      demo: true, query: 'close grip push up technique', alternatives: ['push-up'], increment: 0,
    }),
    E({
      id: 'pull-up', name: ['Tractions', 'Pull-ups'], muscle: ['Grand dorsal', 'Lats'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5 }, requires: ['pullupBar'], reps: [5, 15],
      cues: [
        ['Mains en pronation, un peu plus larges que les épaules ; partir bras tendus.', 'Overhand grip, slightly wider than your shoulders; start from straight arms.'],
        ['Tirer les coudes vers les hanches, poitrine vers la barre.', 'Drive your elbows toward your hips, chest toward the bar.'],
        ['Moins de 5 reps : aide d’un élastique ou négatives lentes (3–5 s).', 'Under 5 reps: use band assistance or slow negatives (3–5 s).'],
      ],
      evidence: {
        level: 'modere', refs: ['pelland2025'],
        text: ['Même mouvement que le tirage vertical ; la croissance suit le nombre de séries difficiles par semaine.', 'Same movement as the lat pulldown; growth follows the number of hard sets per week.'],
      },
      demo: true, query: 'pull up technique', alternatives: ['chin-up', 'band-pulldown'], increment: 2.5,
    }),
    E({
      id: 'chin-up', name: ['Tractions supination', 'Chin-ups'], muscle: ['Dos & biceps', 'Back & biceps'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5 }, requires: ['pullupBar'], reps: [5, 15],
      cues: [
        ['Paumes vers soi, mains largeur d’épaules.', 'Palms facing you, hands shoulder-width apart.'],
        ['Partir bras tendus, monter le menton au-dessus de la barre.', 'Start from straight arms, pull your chin over the bar.'],
        ['Descente contrôlée, sans balancer.', 'Controlled descent, no swinging.'],
      ],
      evidence: {
        level: 'faible', refs: ['pelland2025'],
        text: ['Volume du dos (preuve forte) ; supination vs pronation non vérifié.', 'Back volume (strong evidence); underhand vs overhand grip not verified.'],
      },
      demo: true, query: 'chin up technique', alternatives: ['pull-up'], increment: 2.5,
    }),
    E({
      id: 'band-pulldown', name: ['Tirage vertical élastique', 'Band lat pulldown'], muscle: ['Grand dorsal', 'Lats'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique fixé en hauteur (haut de porte), à genoux ou assis.', 'Band anchored high (top of a door), kneeling or seated.'],
        ['Tirer les coudes vers les hanches, poitrine sortie.', 'Drive your elbows toward your hips, chest up.'],
        ['Remonter lentement jusqu’à l’étirement des dorsaux.', 'Return slowly until your lats stretch.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Charge légère : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Light load: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: false, query: 'resistance band lat pulldown', alternatives: ['pull-up'], increment: 0,
    }),
    E({
      id: 'one-arm-db-row', name: ['Rowing unilatéral haltère', 'One-arm dumbbell row'], muscle: ['Dos', 'Back'], unit: 'kg/main', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Main et genou sur un banc ou une chaise, dos plat.', 'Hand and knee on a bench or chair, back flat.'],
        ['Tirer le coude vers la hanche.', 'Pull your elbow toward your hip.'],
        ['Laisser l’épaule descendre à l’étirement, sans tourner le buste.', 'Let your shoulder drop into the stretch without twisting your torso.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023', 'pelland2025'],
        text: ['Principe validé (volume, poids libres = machines).', 'Validated principle (volume, free weights = machines).'],
      },
      demo: true, query: 'one arm dumbbell row technique', alternatives: ['band-row', 'inverted-row'], increment: 2,
    }),
    E({
      id: 'band-row', name: ['Rowing élastique', 'Band row'], muscle: ['Dos', 'Back'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Assis jambes tendues, élastique autour des pieds, ou fixé à hauteur de poitrine.', 'Sit with legs straight and the band around your feet, or anchor it at chest height.'],
        ['Ramener les coudes le long du corps, omoplates serrées.', 'Pull your elbows back along your sides, shoulder blades squeezed.'],
        ['Retour lent jusqu’aux bras tendus.', 'Return slowly to straight arms.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Charge légère : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Light load: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: false, query: 'resistance band seated row', alternatives: ['one-arm-db-row'], increment: 0,
    }),
    E({
      id: 'doorframe-row', name: ['Tirage au cadre de porte', 'Doorframe row'], muscle: ['Dos', 'Back'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 }, requires: [], reps: [8, 20],
      cues: [
        ['Une main sur le montant d’un cadre de porte solide, pieds proches du mur, corps penché en arrière.', 'One hand on the edge of a sturdy doorframe, feet close to the wall, body leaning back.'],
        ['Tirer le coude vers la hanche, épaule basse, sans tourner le buste.', 'Drive the elbow to the hip, shoulder down, without twisting.'],
        ['Plus dur : pieds plus près du cadre, corps plus incliné. Reps par bras.', 'Harder: feet closer to the frame, body more inclined. Reps per arm.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Au poids du corps : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Bodyweight: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: false, query: 'doorframe row bodyweight', alternatives: ['inverted-row', 'one-arm-db-row'], increment: 0,
    }),
    E({
      id: 'prone-y-raise', name: ['Y allongé au sol', 'Prone Y raise'], muscle: ['Arrière d’épaules', 'Rear delts'], unit: 'PDC', role: 'isolation',
      groups: { rearDelts: 1 }, requires: [], reps: [10, 25],
      cues: [
        ['À plat ventre, bras tendus en Y, pouces vers le haut.', 'Face down, arms straight in a Y, thumbs up.'],
        ['Décoller les bras en serrant le bas des omoplates, sans cambrer.', 'Lift the arms by squeezing the lower shoulder blades, without arching.'],
        ['Tenir 1 s en haut ; plus dur avec des bouteilles d’eau.', 'Hold 1 s at the top; harder with water bottles.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: [
          'Choix d’exercice fondé sur l’opinion d’experts ; faute de matériel, c’est le travail direct des deltoïdes postérieurs le plus accessible.',
          'Exercise choice based on expert opinion; without equipment it is the most accessible direct rear-delt work.',
        ],
      },
      demo: false, query: 'prone y raise floor', alternatives: ['band-pull-apart', 'db-rear-delt-fly'], increment: 0,
    }),
    E({
      id: 'inverted-row', name: ['Rowing inversé', 'Inverted row'], muscle: ['Dos', 'Back'], unit: 'PDC', role: 'compound',
      groups: { back: 1, biceps: 0.5, rearDelts: 0.5 }, requires: [], reps: [6, 20],
      cues: [
        ['Uniquement sous une table solide et stable ou une barre basse : vérifier qu’elle ne peut pas basculer.', 'Only under a sturdy, stable table or a low bar: check that it can’t tip over.'],
        ['Corps gainé et droit, talons au sol.', 'Body braced and straight, heels on the floor.'],
        ['Tirer la poitrine vers le bord de la table ou la barre, coudes à ~45°.', 'Pull your chest to the table edge or bar, elbows at ~45°.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Au poids du corps : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Bodyweight: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: true, query: 'inverted row under table', alternatives: ['one-arm-db-row'], increment: 0,
    }),
    E({
      id: 'db-pullover', name: ['Pull-over haltère', 'Dumbbell pullover'], muscle: ['Grand dorsal', 'Lats'], unit: 'kg', role: 'isolation',
      groups: { back: 1, chest: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Haut du dos en travers d’un banc, ou allongé au sol ; un haltère à deux mains.', 'Upper back across a bench, or lying on the floor; one dumbbell in both hands.'],
        ['Bras presque tendus, descendre derrière la tête jusqu’à l’étirement.', 'Arms almost straight, lower behind your head into the stretch.'],
        ['Ramener l’haltère au-dessus de la poitrine sans plier les coudes.', 'Bring the dumbbell back over your chest without bending your elbows.'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: ['Étirement des dorsaux sous charge, extrapolé des essais sur l’amplitude ; choix fondé sur l’opinion d’experts.', 'Loaded lat stretch, extrapolated from range-of-motion trials; choice based on expert opinion.'],
      },
      demo: true, query: 'dumbbell pullover technique', alternatives: ['band-straight-arm-pulldown'], increment: 2,
    }),
    E({
      id: 'band-straight-arm-pulldown', name: ['Pull-over élastique', 'Band straight-arm pulldown'], muscle: ['Grand dorsal', 'Lats'], unit: 'PDC', role: 'isolation',
      groups: { back: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique fixé en hauteur, buste légèrement penché en avant.', 'Band anchored high, torso leaning slightly forward.'],
        ['Bras presque tendus, ramener les mains vers les cuisses.', 'Arms almost straight, sweep your hands down to your thighs.'],
        ['Remonter lentement jusqu’à l’étirement des dorsaux.', 'Return slowly until your lats stretch.'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: [
          'Même logique que le pull-over poulie : amplitude complète jusqu’à l’étirement des dorsaux ; choix fondé sur l’opinion d’experts.',
          'Same logic as the cable pullover: full range into the lat stretch; choice based on expert opinion.',
        ],
      },
      demo: false, query: 'band straight arm pulldown', alternatives: ['db-pullover'], increment: 0,
    }),
    E({
      id: 'db-rear-delt-fly', name: ['Oiseau haltères', 'Dumbbell rear delt fly'], muscle: ['Arrière d’épaules', 'Rear delts'], unit: 'kg/main', role: 'isolation',
      groups: { rearDelts: 1 }, requires: ['dumbbells'],
      cues: [
        ['Buste penché en avant, dos plat.', 'Hinge forward, back flat.'],
        ['Bras presque tendus, ouvrir en arc vers l’extérieur.', 'Arms almost straight, open out in an arc.'],
        ['Aucun élan, retour lent.', 'No momentum, slow return.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'dumbbell rear delt fly technique', alternatives: ['band-pull-apart'], increment: 1,
    }),
    E({
      id: 'band-pull-apart', name: ['Écartés arrière élastique', 'Band pull-apart'], muscle: ['Arrière d’épaules', 'Rear delts'], unit: 'PDC', role: 'isolation',
      groups: { rearDelts: 1 }, requires: ['bands'], reps: [15, 30],
      cues: [
        ['Bras tendus devant soi à hauteur d’épaules, mains largeur d’épaules.', 'Arms straight out in front at shoulder height, hands shoulder-width apart.'],
        ['Écarter l’élastique jusqu’à la poitrine en ouvrant les bras.', 'Pull the band apart to your chest by opening your arms.'],
        ['Retour lent, sans hausser les épaules.', 'Slow return, no shrugging.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Alternative à l’oiseau, fondée sur l’opinion d’experts.', 'Alternative to the rear delt fly, based on expert opinion.'],
      },
      demo: true, query: 'band pull apart technique', alternatives: ['db-rear-delt-fly'], increment: 0,
    }),
    E({
      id: 'db-shoulder-press', name: ['Développé épaules haltères', 'Dumbbell shoulder press'], muscle: ['Épaules', 'Shoulders'], unit: 'kg/main', role: 'compound',
      groups: { sideDelts: 0.5, triceps: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Assis ou debout, tronc gainé, haltères à hauteur d’oreilles.', 'Seated or standing, core braced, dumbbells at ear height.'],
        ['Pousser au-dessus de la tête sans cambrer.', 'Press overhead without arching your lower back.'],
        ['Descente contrôlée.', 'Controlled lowering.'],
      ],
      evidence: {
        level: 'fort', refs: ['haugen2023'],
        text: ['Poids libres et machines donnent la même hypertrophie.', 'Free weights and machines produce the same hypertrophy.'],
      },
      demo: true, query: 'dumbbell shoulder press technique', alternatives: ['pike-push-up'], increment: 2,
    }),
    E({
      id: 'pike-push-up', name: ['Pompes piquées', 'Pike push-ups'], muscle: ['Épaules', 'Shoulders'], unit: 'PDC', role: 'compound',
      groups: { sideDelts: 0.5, triceps: 0.5 }, requires: [], reps: [6, 20],
      cues: [
        ['Hanches hautes, corps en V inversé, mains largeur d’épaules.', 'Hips high, body in an upside-down V, hands shoulder-width apart.'],
        ['Descendre le sommet du crâne vers le sol, devant les mains.', 'Lower the top of your head toward the floor, just in front of your hands.'],
        ['Plus dur : pieds surélevés sur une chaise.', 'Harder: feet raised on a chair.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Au poids du corps : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Bodyweight: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: false, query: 'pike push up technique', alternatives: ['db-shoulder-press'], increment: 0,
    }),
    E({
      id: 'band-lateral-raise', name: ['Élévations latérales élastique', 'Band lateral raise'], muscle: ['Deltoïdes latéraux', 'Side delts'], unit: 'PDC', role: 'isolation',
      groups: { sideDelts: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique sous le pied, buste légèrement penché.', 'Band under your foot, torso leaning slightly forward.'],
        ['Monter jusqu’à l’horizontale, en guidant avec les coudes.', 'Raise to horizontal, leading with your elbows.'],
        ['Descente lente : garder la tension en bas.', 'Slow lowering: keep tension at the bottom.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol', 'schoenfeld2017load'],
        text: ['Volume des deltoïdes latéraux (preuve forte) ; charge légère efficace si la série finit près de l’échec.', 'Side delt volume (strong evidence); a light load works when the set ends close to failure.'],
      },
      demo: true, query: 'resistance band lateral raise', alternatives: ['lateral-raise'], increment: 0,
    }),
    E({
      id: 'db-overhead-extension', name: ['Extension triceps haltère au-dessus de la tête', 'Overhead dumbbell triceps extension'], muscle: ['Triceps', 'Triceps'], unit: 'kg', role: 'isolation',
      groups: { triceps: 1 }, requires: ['dumbbells'],
      cues: [
        ['Un haltère tenu à deux mains, assis ou debout.', 'One dumbbell held in both hands, seated or standing.'],
        ['Coudes pointés vers l’avant, aussi fixes que possible.', 'Elbows pointing forward, as still as possible.'],
        ['Descendre derrière la tête jusqu’à l’étirement maximal du triceps.', 'Lower behind your head until your triceps are fully stretched.'],
      ],
      evidence: {
        level: 'modere', refs: ['maeo2023'],
        text: ['Bras au-dessus de la tête : ≈1,4× plus d’hypertrophie du triceps que le pushdown (essai réalisé à la poulie).', 'Arms overhead: ≈1.4× more triceps growth than the pushdown (trial done with cables).'],
      },
      demo: true, query: 'overhead dumbbell triceps extension', alternatives: ['band-overhead-extension', 'db-skull-crusher'], increment: 2,
    }),
    E({
      id: 'band-overhead-extension', name: ['Extension triceps élastique au-dessus de la tête', 'Overhead band triceps extension'], muscle: ['Triceps', 'Triceps'], unit: 'PDC', role: 'isolation',
      groups: { triceps: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique fixé sur un point bas derrière toi, coudes vers l’avant.', 'Anchor the band low behind you, elbows pointing forward.'],
        ['Coudes pointés vers l’avant et fixes.', 'Elbows pointing forward and still.'],
        ['Tendre les bras au-dessus de la tête, retour lent jusqu’à l’étirement.', 'Extend your arms overhead, return slowly into the stretch.'],
      ],
      evidence: {
        level: 'faible', refs: ['maeo2023'],
        text: ['Position au-dessus de la tête favorable au triceps (essai à la poulie) ; version élastique non testée.', 'Overhead position favors triceps growth (cable trial); band version not tested.'],
      },
      demo: true, query: 'resistance band overhead triceps extension', alternatives: ['db-overhead-extension'], increment: 0,
    }),
    E({
      id: 'band-pushdown', name: ['Pushdown élastique', 'Band pushdown'], muscle: ['Triceps', 'Triceps'], unit: 'PDC', role: 'isolation',
      groups: { triceps: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique fixé en hauteur (haut de porte).', 'Band anchored high (top of a door).'],
        ['Coudes collés au buste.', 'Elbows pinned to your sides.'],
        ['Tendre complètement, remonter jusqu’à 90° environ sans élan.', 'Extend fully, come back up to about 90° without momentum.'],
      ],
      evidence: {
        level: 'faible', refs: ['maeo2023'],
        text: ['Complément : le pushdown fait progresser le triceps, mais moins que le travail au-dessus de la tête.', 'A complement: pushdowns grow the triceps, but less than overhead work.'],
      },
      demo: false, query: 'resistance band triceps pushdown', alternatives: ['close-grip-push-up'], increment: 0,
    }),
    E({
      id: 'db-skull-crusher', name: ['Barre au front haltères', 'Dumbbell skull crusher'], muscle: ['Triceps', 'Triceps'], unit: 'kg/main', role: 'isolation',
      groups: { triceps: 1 }, requires: ['dumbbells'],
      cues: [
        ['Allongé sur un banc ou au sol, bras verticaux, paumes face à face.', 'Lying on a bench or the floor, arms vertical, palms facing each other.'],
        ['Plier les coudes pour descendre les haltères de chaque côté de la tête.', 'Bend your elbows to lower the dumbbells on either side of your head.'],
        ['Coudes fixes, pointés vers le plafond.', 'Elbows still, pointing at the ceiling.'],
      ],
      evidence: {
        level: 'faible', refs: ['maeo2023'],
        text: ['Bras à la verticale : position entre le pushdown et le travail au-dessus de la tête, non testée directement.', 'Arms vertical: a position between the pushdown and overhead work, not tested directly.'],
      },
      demo: true, query: 'dumbbell skull crusher technique', alternatives: ['db-overhead-extension'], increment: 2,
    }),
    E({
      id: 'db-curl', name: ['Curl haltères', 'Dumbbell curl'], muscle: ['Biceps', 'Biceps'], unit: 'kg/main', role: 'isolation',
      groups: { biceps: 1 }, requires: ['dumbbells'],
      cues: [
        ['Debout, coudes le long du corps et immobiles.', 'Standing, elbows at your sides and still.'],
        ['Amplitude complète, supination en haut.', 'Full range of motion, turn your palms up at the top.'],
        ['Aucun élan du buste, descente contrôlée.', 'No torso swing, controlled lowering.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017vol'],
        text: ['Volume ; pas de comparaison d’exercices vérifiée.', 'Volume; no verified exercise comparison.'],
      },
      demo: true, query: 'dumbbell curl technique', alternatives: ['band-curl', 'incline-db-curl'], increment: 2,
    }),
    E({
      id: 'band-curl', name: ['Curl élastique', 'Band curl'], muscle: ['Biceps', 'Biceps'], unit: 'PDC', role: 'isolation',
      groups: { biceps: 1 }, requires: ['bands'], reps: [12, 25],
      cues: [
        ['Élastique sous les pieds, coudes le long du corps.', 'Band under your feet, elbows at your sides.'],
        ['Monter complètement, paumes vers le haut.', 'Curl all the way up, palms up.'],
        ['Descente lente jusqu’aux bras tendus.', 'Lower slowly to straight arms.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Charge légère : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; pas de comparaison d’exercices vérifiée.',
          'Light load: similar hypertrophy to a heavy load when the set ends close to failure; no verified exercise comparison.',
        ],
      },
      demo: false, query: 'resistance band bicep curl', alternatives: ['db-curl'], increment: 0,
    }),
    E({
      id: 'bulgarian-split-squat', name: ['Fente bulgare', 'Bulgarian split squat'], muscle: ['Quadriceps & fessiers', 'Quads & glutes'], unit: 'PDC', role: 'compound',
      groups: { quads: 1, glutes: 0.5 }, requires: [], reps: [8, 20],
      cues: [
        ['Pied arrière sur une chaise ou un canapé ; reps comptées par jambe.', 'Rear foot on a chair or sofa; reps count per leg.'],
        ['Descendre jusqu’à ce que le genou arrière frôle le sol, buste légèrement penché.', 'Lower until your back knee nearly touches the floor, torso leaning slightly forward.'],
        ['Plus de 20 reps : tenir des haltères.', 'Over 20 reps: hold dumbbells.'],
      ],
      evidence: {
        level: 'modere', refs: ['schoenfeld2017load', 'haugen2023'],
        text: ['Charge légère ou lourde : hypertrophie similaire si la série finit près de l’échec ; poids libres = machines.', 'Light or heavy load: similar hypertrophy when the set ends close to failure; free weights = machines.'],
      },
      demo: false, query: 'bulgarian split squat technique', alternatives: ['goblet-squat'], increment: 0,
    }),
    E({
      id: 'sissy-squat', name: ['Sissy squat', 'Sissy squat'], muscle: ['Quadriceps', 'Quads'], unit: 'PDC', role: 'isolation',
      groups: { quads: 1 }, requires: [], reps: [8, 20],
      cues: [
        ['Tenir un support stable (cadre de porte, dossier de chaise).', 'Hold a stable support (door frame, chair back).'],
        ['Sur la pointe des pieds, genoux vers l’avant, hanches tendues : le buste part en arrière.', 'On your toes, knees forward, hips extended: your torso leans back.'],
        ['Descendre aussi bas que les genoux le tolèrent, remonter sans à-coup.', 'Go as low as your knees tolerate, come up smoothly.'],
      ],
      evidence: {
        level: 'faible', refs: ['pedrosa2022'],
        text: [
          'Quadriceps travaillé en position étirée, extrapolé de l’essai sur la leg extension ; choix fondé sur l’opinion d’experts.',
          'Quads worked in the stretched position, extrapolated from the leg extension trial; choice based on expert opinion.',
        ],
      },
      demo: false, query: 'sissy squat technique beginner', alternatives: ['bulgarian-split-squat'], increment: 0,
    }),
    E({
      id: 'sliding-leg-curl', name: ['Leg curl glissé', 'Sliding leg curl'], muscle: ['Ischio-jambiers', 'Hamstrings'], unit: 'PDC', role: 'isolation',
      groups: { hams: 1, glutes: 0.5 }, requires: [], reps: [8, 20],
      cues: [
        ['Sur le dos, talons sur une serviette ou en chaussettes sur un parquet.', 'On your back, heels on a towel, or in socks on a wooden floor.'],
        ['Hanches levées, ramener les talons vers les fesses.', 'Hips up, pull your heels toward your glutes.'],
        ['Repousser lentement jusqu’aux jambes presque tendues, hanches hautes.', 'Slide out slowly until your legs are almost straight, hips staying up.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Au poids du corps : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Bodyweight: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: false, query: 'sliding leg curl towel', alternatives: ['nordic-curl'], increment: 0,
    }),
    E({
      id: 'nordic-curl', name: ['Nordic curl', 'Nordic hamstring curl'], muscle: ['Ischio-jambiers', 'Hamstrings'], unit: 'PDC', role: 'isolation',
      groups: { hams: 1 }, requires: [], reps: [3, 10],
      cues: [
        ['À genoux sur un coussin, pieds calés sous un meuble lourd.', 'Kneel on a cushion, feet anchored under heavy furniture.'],
        ['Corps droit des genoux à la tête, descendre en 3–5 s.', 'Body straight from knees to head, lower over 3–5 s.'],
        ['Se rattraper avec les mains, repousser pour remonter.', 'Catch yourself with your hands, push off to come back up.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts ; très exigeant, d’où la fourchette de reps basse.', 'Exercise choice based on expert opinion; very demanding, hence the low rep range.'],
      },
      demo: true, query: 'nordic hamstring curl beginner', alternatives: ['sliding-leg-curl'], increment: 0,
    }),
    E({
      id: 'db-romanian-deadlift', name: ['Soulevé de terre roumain haltères', 'Dumbbell Romanian deadlift'], muscle: ['Ischios & fessiers', 'Hamstrings & glutes'], unit: 'kg/main', role: 'compound',
      groups: { hams: 1, glutes: 1 }, requires: ['dumbbells'],
      cues: [
        ['Haltères devant les cuisses, genoux légèrement fléchis et fixes.', 'Dumbbells in front of your thighs, knees slightly bent and fixed.'],
        ['Hanches vers l’arrière, dos neutre, haltères près des jambes.', 'Hips back, neutral spine, dumbbells close to your legs.'],
        ['Descendre jusqu’à l’étirement des ischios (mi-tibia environ).', 'Lower until your hamstrings stretch (about mid-shin).'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: ['Position étirée des ischios ; choix fondé sur l’opinion d’experts.', 'Stretched hamstring position; choice based on expert opinion.'],
      },
      demo: true, query: 'dumbbell romanian deadlift technique', alternatives: ['single-leg-rdl'], increment: 2,
    }),
    E({
      id: 'single-leg-rdl', name: ['Soulevé de terre roumain unilatéral', 'Single-leg Romanian deadlift'], muscle: ['Ischios & fessiers', 'Hamstrings & glutes'], unit: 'PDC', role: 'compound',
      groups: { hams: 1, glutes: 1 }, requires: [], reps: [8, 15],
      cues: [
        ['Sur une jambe, genou légèrement fléchi ; une main au mur si besoin.', 'On one leg, knee slightly bent; one hand on a wall if needed.'],
        ['Pencher le buste en envoyant la jambe libre vers l’arrière, dos neutre.', 'Hinge forward as your free leg reaches back, neutral spine.'],
        ['Descendre jusqu’à l’étirement des ischios ; reps comptées par jambe.', 'Lower until your hamstring stretches; reps count per leg.'],
      ],
      evidence: {
        level: 'faible', refs: ['wolf2023'],
        text: ['Position étirée des ischios ; choix fondé sur l’opinion d’experts.', 'Stretched hamstring position; choice based on expert opinion.'],
      },
      demo: true, query: 'single leg romanian deadlift technique', alternatives: ['db-romanian-deadlift'], increment: 0,
    }),
    E({
      id: 'db-hip-thrust', name: ['Hip thrust haltère', 'Dumbbell hip thrust'], muscle: ['Fessiers', 'Glutes'], unit: 'kg', role: 'compound',
      groups: { glutes: 1, hams: 0.5 }, requires: ['dumbbells'],
      cues: [
        ['Haut du dos sur un canapé ou un banc, haltère posé sur les hanches.', 'Upper back on a sofa or bench, dumbbell resting on your hips.'],
        ['Pousser par les talons jusqu’à l’extension de hanche, menton rentré.', 'Drive through your heels to full hip extension, chin tucked.'],
        ['Pause d’une seconde en haut.', 'One-second pause at the top.'],
      ],
      evidence: {
        level: 'faible', refs: [],
        text: ['Même rôle que le hip thrust : travail direct des fessiers (prépublication + opinion d’experts).', 'Same role as the hip thrust: direct glute work (preprint + expert opinion).'],
      },
      demo: true, query: 'dumbbell hip thrust', alternatives: ['single-leg-hip-thrust'], increment: 2,
    }),
    E({
      id: 'single-leg-hip-thrust', name: ['Hip thrust unilatéral', 'Single-leg hip thrust'], muscle: ['Fessiers', 'Glutes'], unit: 'PDC', role: 'compound',
      groups: { glutes: 1, hams: 0.5 }, requires: [], reps: [8, 20],
      cues: [
        ['Haut du dos sur un canapé ou un banc, un pied au sol, l’autre jambe levée.', 'Upper back on a sofa or bench, one foot on the floor, the other leg raised.'],
        ['Pousser par le talon jusqu’à l’extension de hanche, bassin de niveau.', 'Drive through your heel to full hip extension, hips level.'],
        ['Pause d’une seconde en haut ; reps comptées par jambe.', 'One-second pause at the top; reps count per leg.'],
      ],
      evidence: {
        level: 'faible', refs: ['schoenfeld2017load'],
        text: [
          'Au poids du corps : hypertrophie similaire à une charge lourde si la série finit près de l’échec ; le choix de l’exercice relève de l’opinion d’experts.',
          'Bodyweight: similar hypertrophy to a heavy load when the set ends close to failure; the exercise choice is expert opinion.',
        ],
      },
      demo: true, query: 'single leg hip thrust technique', alternatives: ['db-hip-thrust'], increment: 0,
    }),
    E({
      id: 'single-leg-calf-raise', name: ['Mollets unilatéral sur marche', 'Single-leg calf raise on a step'], muscle: ['Mollets', 'Calves'], unit: 'PDC', role: 'isolation',
      groups: { calves: 1 }, requires: [], reps: [10, 20],
      cues: [
        ['Avant-pied sur une marche, une main au mur.', 'Ball of your foot on a step, one hand on the wall.'],
        ['Genou tendu, talon sous le niveau de la marche : pause de 1–2 s en étirement.', 'Knee straight, heel below the step: pause 1–2 s in the stretch.'],
        ['Monter haut sur les orteils ; reps comptées par jambe.', 'Rise high onto your toes; reps count per leg.'],
      ],
      evidence: {
        level: 'modere', refs: ['kassiano2023', 'kinoshita2023'],
        text: ['Genou tendu (debout > assis) et travail en étirement : plus d’hypertrophie des mollets dans les essais.', 'Straight knee (standing > seated) and work in the stretch: more calf growth in the trials.'],
      },
      demo: true, query: 'single leg calf raise on step', alternatives: ['standing-calf-raise'], increment: 0,
    }),
    E({
      id: 'hanging-leg-raise', name: ['Relevés de jambes suspendu', 'Hanging leg raise'], muscle: ['Abdominaux', 'Abs'], unit: 'PDC', role: 'isolation',
      groups: { abs: 1 }, requires: ['pullupBar'], reps: [8, 15],
      cues: [
        ['Suspendu à la barre, épaules actives.', 'Hang from the bar, shoulders engaged.'],
        ['Enrouler le bassin pour monter les genoux ou les jambes.', 'Curl your pelvis up to raise your knees or legs.'],
        ['Aucun balancement, descente lente.', 'No swinging, slow lowering.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'hanging leg raise technique', alternatives: ['reverse-crunch'], increment: 0,
    }),
    E({
      id: 'reverse-crunch', name: ['Crunch inversé', 'Reverse crunch'], muscle: ['Abdominaux', 'Abs'], unit: 'PDC', role: 'isolation',
      groups: { abs: 1 }, requires: [], reps: [10, 20],
      cues: [
        ['Sur le dos, genoux fléchis à 90°, mains au sol.', 'On your back, knees bent at 90°, hands on the floor.'],
        ['Enrouler le bassin pour décoller les fesses du sol.', 'Curl your pelvis to lift your hips off the floor.'],
        ['Redescendre lentement, sans élan.', 'Lower slowly, no momentum.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'reverse crunch technique', alternatives: ['crunch'], increment: 0,
    }),
    E({
      id: 'crunch', name: ['Crunch', 'Crunch'], muscle: ['Abdominaux', 'Abs'], unit: 'PDC', role: 'isolation',
      groups: { abs: 1 }, requires: [], reps: [10, 25],
      cues: [
        ['Sur le dos, genoux fléchis, pieds au sol.', 'On your back, knees bent, feet on the floor.'],
        ['Enrouler la colonne pour décoller les épaules, bas du dos au sol.', 'Curl your spine to lift your shoulders, lower back on the floor.'],
        ['Expirer en haut, redescendre lentement.', 'Breathe out at the top, lower slowly.'],
      ],
      evidence: {
        level: 'opinion', refs: [],
        text: ['Choix d’exercice fondé sur l’opinion d’experts.', 'Exercise choice based on expert opinion.'],
      },
      demo: true, query: 'crunch proper form', alternatives: ['reverse-crunch'], increment: 0,
    }),
  ].map((x) => [x.id, x]),
)

/** Free weights: a dumbbell or a bar weighs the same in every gym. */
const FREE_WEIGHTS = new Set([
  'incline-db-press', 'lateral-raise', 'ez-curl', 'seated-db-curl', 'incline-db-curl', 'romanian-deadlift', 'goblet-squat',
  'db-pullover', 'db-overhead-extension', 'db-hip-thrust',
])

/**
 * Machines, cables and Smith machines differ from one gym to another (lever arms,
 * pulleys, stack weights): their loads are kept per gym. Free weights and body
 * weight are shared.
 */
export function gymBound(id: string, unit?: Unit): boolean {
  const u = unit ?? LIBRARY[id]?.unit ?? 'kg'
  if (u === 'PDC' || u === 'kg/main') return false
  return !FREE_WEIGHTS.has(id)
}

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
    evidence: { level: 'opinion', text: L('Exercice personnalisé.', 'Custom exercise.'), refs: [] },
    demo: false,
    query: `${fallback?.name ?? id} technique`,
    alternatives: [],
    increment: 2.5,
  }
}

/** Muscle groups guessed from a muscle label typed in French or English. */
function guessGroups(muscle: string): Partial<Record<MuscleGroup, number>> {
  const m = muscle.toLowerCase()
  // Whole words only for short English keys: "lat" must not match "latéraux" or "lateral", "rear" not "forearms".
  const words = m.split(/[^\p{L}]+/u)
  const has = (...keys: string[]) => keys.some((k) => m.includes(k))
  const word = (...keys: string[]) => keys.some((k) => words.includes(k))
  // Before the back: "abdos" contains "dos".
  if (has('abdo') || word('abs')) return { abs: 1 }
  if (has('pector', 'chest')) return { chest: 1 }
  if (has('dors', 'dos', 'back') || word('lat', 'lats')) return { back: 1 }
  // "Deltoïdes postérieurs" are rear delts; "chaîne postérieure" alone is not.
  if (has('arrière') || word('rear') || (has('postérieur', 'posterior') && has('épaule', 'deltoïde', 'shoulder', 'delt'))) return { rearDelts: 1 }
  if (has('épaule', 'deltoïde', 'shoulder', 'delt')) return { sideDelts: 1 }
  if (has('triceps')) return { triceps: 1 }
  if (has('biceps')) return { biceps: 1 }
  if (has('quadri', 'jambe', 'quad', 'leg')) return { quads: 1 }
  if (has('ischio', 'hamstring')) return { hams: 1 }
  if (has('fess', 'glute')) return { glutes: 1 }
  if (has('mollet', 'calf', 'calves')) return { calves: 1 }
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
