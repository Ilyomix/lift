import { L } from './i18n'
import { fmtLoad, fmtNum } from './format'
import type { Comparison, WorkoutExercise } from './types'

/** Stable, language-independent reasons returned by the training engine. */
export type ContextReason = 'unit-changed' | 'conditions-changed' | 'rep-range-changed' | 'rest-changed' | 'program-changed' | 'preceding-work-changed'
type Translation = readonly [fr: string, en: string]

/** Resolve through Lift's existing L(fr, en), at read/render time, never at module load. */
export const CONTEXT_MESSAGES = {
  'unit-changed': ['Unité différente : nouvelle référence.', 'Different unit: new baseline.'],
  'conditions-changed': ['Machine ou conditions signalées différentes : confirme une nouvelle référence.', 'A machine or condition change was flagged: confirm a new baseline.'],
  'rep-range-changed': ['Première séance dans cette fourchette de reps.', 'First session in this rep range.'],
  'rest-changed': ['Repos prescrit différent : performances non directement comparables.', 'Prescribed rest changed: performances are not directly comparable.'],
  'program-changed': ['Passage à un nouveau programme : établis une référence avec ses consignes.', 'Transition to a new program: establish a baseline under its instructions.'],
  'preceding-work-changed': ['Le travail précédent sur ces muscles a changé : ne pas conclure à une baisse de niveau.', 'Earlier work on these muscles changed: do not infer a loss of ability.'],
} as const satisfies Record<ContextReason, Translation>

export function contextReasonLabel(reason: ContextReason): string {
  const [fr, en] = CONTEXT_MESSAGES[reason]
  return L(fr, en)
}

// Compatibility with messages already stored by earlier versions. Only exact app-generated
// phrases are translated. Free-form notes and unknown messages must remain untouched.
const STORED_MESSAGES: readonly Translation[] = [
  ...Object.values(CONTEXT_MESSAGES),
  ['NON RÉALISÉ', 'NOT DONE'],
  ['NOUVELLE BASELINE', 'NEW BASELINE'],
  ['DÉCHARGE', 'DELOAD'],
  ['SÉANCE ALLÉGÉE', 'LIGHTER SESSION'],
  ['APRÈS SÉANCE ALLÉGÉE', 'AFTER A LIGHTER SESSION'],
  ['APRÈS UNE PAUSE', 'AFTER A BREAK'],
  ['MOINS DE REPS, PLUS DE MARGE', 'FEWER REPS, MORE IN RESERVE'],
  ['CONDITIONS DIFFÉRENTES', 'DIFFERENT CONDITIONS'],
  ['COMPARAISON À VÉRIFIER', 'COMPARISON TO CHECK'],
  ['NOMBRE DE SÉRIES DIFFÉRENT', 'DIFFERENT NUMBER OF SETS'],
  ['CHARGE SUPÉRIEURE', 'HEAVIER LOAD'],
  ['RÉPARTITION DES CHARGES MODIFIÉE', 'LOAD PATTERN CHANGED'],
  ['PERFORMANCE ÉGALE', 'SAME PERFORMANCE'],
  ['PROCHAINE CIBLE : AUGMENTER LA CHARGE', 'NEXT TARGET: INCREASE THE LOAD'],
  ['Aucune série comptabilisée', 'No sets logged'],
  ['Première performance enregistrée', 'First performance logged'],
  ['Première séance sur cette machine dans cette salle.', 'First session on this machine at this gym.'],
  ['Première séance dans cette fourchette de reps.', 'First session in this rep range.'],
  ['Semaine allégée : pas de comparaison.', 'Lighter week: no comparison.'],
  ['Charges allégées par le programme : pas de comparaison.', 'Loads lightened by the program: no comparison.'],
  ['Pas de comparaison avec une séance allégée.', 'No comparison with a lighter session.'],
  ['Deux semaines ou plus sans séance depuis : pas de comparaison.', 'Two weeks or more without a session since: no comparison.'],
  ['Charges différentes : comparé sur le niveau estimé.', 'Different loads: compared on the estimated level.'],
  ['Lest différent de la dernière fois.', 'Added load differs from last time.'],
  ['Progression à charge égale.', 'Progress at the same load.'],
  ['Niveau maintenu.', 'Level maintained.'],
  ['Niveau maintenu', 'Level maintained'],
  ['PROGRESSION', 'PROGRESS'],
  ['Variation ponctuelle', 'One-off variation'],
  ['Variation ponctuelle.', 'One-off variation.'],
  ['Plus de marge gardée que la dernière fois : pas une baisse.', 'More kept in reserve than last time: not a drop.'],
  ['Nette baisse : au-delà de la variation normale.', 'Clear drop: beyond normal variation.'],
  ['Plus de marge gardée que la dernière fois : le reste est une variation normale.', 'More kept in reserve than last time: the rest is normal variation.'],
  ['Variation normale d’une séance à l’autre.', 'Normal variation from one session to the next.'],
  ['Machine, tempo ou notes : vérifier les conditions avant de conclure.', 'Machine, tempo or notes: check the conditions before drawing a conclusion.'],
  ['Charge augmentée ; à confirmer à séries et conditions identiques.', 'Load increased; confirm with identical sets and conditions.'],
]

/** Translate an exact known phrase, preserving unknown/user-authored content. */
export function storedTrainingText(text: string): string {
  const pair = STORED_MESSAGES.find(([fr, en]) => text === fr || text === en)
  if (pair) return L(...pair)
  const down = text.match(/^(−\d+ REPS?) VS (?:DERNIÈRE FOIS|LAST TIME)$/u)
  if (down) return L(`${down[1]} VS DERNIÈRE FOIS`, `${down[1]} VS LAST TIME`)
  const level = text.match(/^(?:NIVEAU ESTIMÉ|ESTIMATED LEVEL) (−\d+) ?%$/u)
  return level ? L(`NIVEAU ESTIMÉ ${level[1]} %`, `ESTIMATED LEVEL ${level[1]}%`) : text
}

/** Localize both a stored explanation and its optional common-sets suffix. */
export function comparisonDetailLabel(c: Comparison): string {
  if (c.contextReason && Object.hasOwn(CONTEXT_MESSAGES, c.contextReason)) return contextReasonLabel(c.contextReason)
  const text = c.detail
  const common = text.match(/ (?:Sur (?:la série commune|les \d+ séries communes) \((\d+) contre (\d+) la dernière fois\)|On the (?:set|\d+ sets) both sessions have \((\d+) vs (\d+) last time\))\.$/u)
  const body = common ? text.slice(0, common.index) : text
  let known = STORED_MESSAGES.some(([fr, en]) => body === fr || body === en)
  let translated = storedTrainingText(body)
  if (/^(?:Volume propre : .+ contre .+|Clean volume: .+ vs .+) kg·reps\.(?: Comparaison de performance non directe\.| Performance is not directly comparable\.)?$/u.test(body)
      && c.previousSetReps && c.previousWeights && c.previousSetReps.length === c.previousWeights.length) {
    known = true
    const before = c.previousSetReps.reduce((total, reps, i) => total + reps * (c.previousWeights![i] ?? 0), 0)
    translated = L(`Volume propre : ${fmtNum(c.volume, 0)} contre ${fmtNum(before, 0)} kg·reps.`, `Clean volume: ${fmtNum(c.volume, 0)} vs ${fmtNum(before, 0)} kg·reps.`)
    if (body.includes('Comparaison de performance non directe.') || body.includes('Performance is not directly comparable.')) {
      translated += L(' Comparaison de performance non directe.', ' Performance is not directly comparable.')
    }
  }
  if (common && !known) return text
  if (!common) return translated
  const now = Number(common[1] ?? common[3])
  const before = Number(common[2] ?? common[4])
  const shared = c.comparedSets ?? Math.min(now, before)
  return translated + L(
    ` Sur ${shared === 1 ? 'la série commune' : `les ${shared} séries communes`} (${now} contre ${before} la dernière fois).`,
    ` On the ${shared === 1 ? 'set' : `${shared} sets`} both sessions have (${now} vs ${before} last time).`,
  )
}

/** Values are copied; measurements, flags and user-entered notes are never changed. */
export function localizeComparison(c: Comparison, userText?: string): Comparison {
  return {
    ...c,
    headline: storedTrainingText(c.headline),
    detail: userText?.trim() && c.detail === userText.trim() ? c.detail : comparisonDetailLabel(c),
    suggestion: c.suggestion ? storedTrainingText(c.suggestion) : c.suggestion,
  }
}

/** In-session hints are persisted too. Reformat their known templates after a language switch. */
export function localizeLoadHint(ex: WorkoutExercise): WorkoutExercise['hint'] {
  const hint = ex.hint
  if (!hint) return hint
  const easy = hint.text.match(/^(\d+) reps(?:(?: à| at) RIR ([\d.,]+)|(?: avec| with) ([\d.,]+) reps (?:en réserve|in reserve))?(?: : |: ).+(?: pour la suite| for the next sets)$/u)
  const hard = hint.text.match(/^(\d+) reps, (?:sous|under) (\d+)(?: : |: ).+(?: pour rester dans la fourchette| to stay in the range)$/u)
  const load = fmtLoad(hint.to, ex.unit)
  const reserve = easy?.[2] ?? easy?.[3]
  const rir = reserve ? fmtNum(Number(reserve.replace(',', '.'))) : null
  if (easy) return { ...hint, text: L(`${easy[1]} reps${rir !== null ? ` avec ${rir} reps en réserve` : ''} : ${load} pour la suite`, `${easy[1]} reps${rir !== null ? ` with ${rir} reps in reserve` : ''}: ${load} for the next sets`) }
  if (hard) return { ...hint, text: L(`${hard[1]} reps, sous ${hard[2]} : ${load} pour rester dans la fourchette`, `${hard[1]} reps, under ${hard[2]}: ${load} to stay in the range`) }
  return hint
}

/** Recognize only targets generated by nextTargetText, not free-form imported coach notes. */
export function isGeneratedTarget(text: string): boolean {
  return /^(?:Séance d’essai : trouve une charge pour \d+–\d+ reps (?:à RIR 3|avec 3 reps en réserve)\.|Trial session: find a load for \d+–\d+ reps (?:at RIR 3|with 3 reps in reserve)\.|.+ · viser \d+ × \d+–\d+ propres, puis augmenter\.|.+ · aim for \d+ × \d+–\d+ clean reps, then go heavier\.)$/u.test(text)
}
