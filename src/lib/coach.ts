// Coach loop with an AI assistant of the user's choice: export a precise brief, paste back a structured plan update.
// The brief is written in the interface language (the coach answers in it); the JSON
// protocol (keys, "golgoth-plan-update" type) is the same in both languages.
import { fmtDate, todayISO } from './date'
import { fmtLoad, fmtNum, plural } from './format'
import { gymName, gymOf, isGymBound } from './gyms'
import { L } from './i18n'
import { contextAt, daysFactor, GOAL_DATE, MAINTENANCE, nextTargetText, PLAN_DAYS, SESSION_MUSCLE_CAP, sessionPlan, sharePhrase, templateSets, TYPE_META, WEEK_DAYS, weekShape } from './program'
import { exerciseHistory, setsSummary } from './training'
import { weightStatus } from './stats'
import type { AppState, NutritionTargets, Target, TemplateExercise, Unit, Workout, WorkoutType } from './types'
import { WORKOUT_TYPES } from './types'

const FLAG_LABEL: Record<string, string> = {
  get failure() { return L('échec', 'failure') },
  get 'bad-technique'() { return L('technique', 'bad form') },
  get pain() { return L('douleur', 'pain') },
}

function exerciseLines(state: AppState, w: Workout): string[] {
  const lines: string[] = []
  for (const ex of w.exercises) {
    const t = ex.prescription ?? { sets: ex.target.sets, minReps: ex.target.minReps, maxReps: ex.target.maxReps, rir: ex.target.rir ?? '', weight: ex.target.weight }
    // The session's sets can differ from the sheet's (deload, priority set, fewer than five days): the coach answers on the sheet.
    const sheet = t.sets !== ex.target.sets ? L(` (fiche : ${ex.target.sets})`, ` (sheet: ${ex.target.sets})`) : ''
    const scheme = `${t.sets}${sheet} × ${t.minReps}–${t.maxReps}${t.rir ? `, RIR ${t.rir}` : ''}`
    lines.push(L(`- ${ex.name} [${ex.exerciseId}] · cible ${scheme} à ${fmtLoad(t.weight, ex.unit)}`, `- ${ex.name} [${ex.exerciseId}] · target ${scheme} at ${fmtLoad(t.weight, ex.unit)}`))
    if (ex.skipped) {
      const reason = ex.skipReason ? ` (${ex.skipReason})` : ''
      lines.push(L(`  non réalisé${reason}`, `  not done${reason}`))
      continue
    }
    const sets = ex.sets.filter((s) => s.completed)
    sets.forEach((s, i) => {
      const flags = s.flags.map((f) => FLAG_LABEL[f]).join(', ')
      const load = fmtLoad(s.weight, ex.unit)
      const clean = s.cleanReps ?? s.reps ?? 0
      const extra = `${typeof s.rir === 'number' ? `, RIR ${s.rir}` : ''}${flags ? `, ${flags}` : ''}${s.note ? ` — ${s.note}` : ''}`
      lines.push(L(`  S${i + 1} : ${load} × ${s.reps ?? 0} (${clean} propres)${extra}`, `  Set ${i + 1}: ${load} × ${s.reps ?? 0} (${clean} clean)${extra}`))
    })
    if (ex.comparison) {
      const verdict = `${ex.comparison.headline.toLowerCase()} — ${ex.comparison.detail}`
      lines.push(L(`  bilan : ${verdict}`, `  summary: ${verdict}`))
    }
    const hist = exerciseHistory(state.workouts.filter((x) => x.id !== w.id), ex.exerciseId, isGymBound(ex) ? gymOf(w) : undefined).slice(-3)
    if (hist.length) {
      const past = hist.map((h) => `${fmtDate(h.date)} ${setsSummary(h.sets, h.unit)}`).join(' | ')
      lines.push(L(`  historique : ${past}`, `  history: ${past}`))
    }
    if (ex.notes) lines.push(L(`  note : ${ex.notes}`, `  note: ${ex.notes}`))
  }
  return lines
}

/** Reply format asked from the coach: keys and type never change, only the sample texts follow the language. */
const schema = () => `{
  "type": "golgoth-plan-update",
  "version": 1,
  "summary": "${L('Une phrase de synthèse', 'One-sentence summary')}",
  "basedOnSession": 27,
  "changes": [
    { "template": "PUSH", "exerciseId": "incline-db-press", "target": { "weight": 22, "sets": 3, "minReps": 6, "maxReps": 10, "restSeconds": 150, "rir": "1–2" }, "nextTarget": "${L('Consigne courte pour la prochaine séance', 'Short cue for the next session')}" },
    { "template": "PUSH", "exerciseId": "cable-fly", "action": "add", "name": "${L('Écarté poulie', 'Cable fly')}", "muscle": "${L('Pectoraux', 'Chest')}", "unit": "kg", "target": { "weight": 15, "sets": 3, "minReps": 10, "maxReps": 15, "restSeconds": 90, "rir": "0–1" } },
    { "template": "UPPER", "exerciseId": "dips", "action": "remove" }
  ],
  "nutritionTargets": { "calories": 2300 }
}`

/** `share`: the part of the plan's weekly volume the week holds, with the user's sheets and training days. */
const rules = (share: number) =>
  [
    L('Règles du programme (rapport de recherche) :', 'Program rules (research report):'),
    L('- 10–20 séries difficiles par muscle et par semaine (comptage fractionnaire), 2 passages par muscle.', '- 10–20 hard sets per muscle per week (fractional counting), each muscle trained twice a week.'),
    ...(WEEK_DAYS < PLAN_DAYS
      ? [daysFactor() > 1
          ? L(
              `- Je m’entraîne ${plural(WEEK_DAYS, 'jour', 'jours')} par semaine : la rotation des 5 séances continue et l’app ajoute des séries en séance (×${fmtNum(daysFactor(), 2)} sur l’ensemble, au plus ${SESSION_MUSCLE_CAP} séries par muscle et par séance) : la semaine tient ${sharePhrase(share)}. Dans ta réponse JSON, « sets » est le nombre de séries de la fiche, avant cet ajout.`,
              `- I train ${plural(WEEK_DAYS, 'day', 'days')} a week: the 5-session rotation continues and the app adds sets in each session (×${fmtNum(daysFactor(), 2)} overall, ${SESSION_MUSCLE_CAP} sets per muscle per session at most): the week holds ${sharePhrase(share)}. In your JSON answer, "sets" is the sheet’s number of sets, before that addition.`,
            )
          : L(
              `- Je m’entraîne ${plural(WEEK_DAYS, 'jour', 'jours')} par semaine avec les séances de base : la rotation des 5 séances s’étale, la semaine tient ${sharePhrase(share)}.`,
              `- I train ${plural(WEEK_DAYS, 'day', 'days')} a week with the base sessions: the 5-session rotation spreads out, the week holds ${sharePhrase(share)}.`,
            )]
      : []),
    L('- RIR 1–2 en polyarticulaire, 0–1 en isolation ; S1 du bloc RIR 3, S2 RIR 2, dernière semaine RIR 0–1.', '- RIR 1–2 on compounds, 0–1 on isolation; block week 1 RIR 3, week 2 RIR 2, last week RIR 0–1.'),
    L('- Double progression : quand toutes les séries atteignent le haut de la fourchette au RIR visé, +2,5 % environ (plus petit incrément).', '- Double progression: when every set reaches the top of the rep range at the target RIR, about +2.5% (smallest increment).'),
    L('- Performance en baisse 2 séances de suite sur un exercice : retirer 1 série à ce muscle ; baisse générale : avancer la décharge.', '- Performance down 2 sessions in a row on an exercise: remove 1 set for that muscle; general drop: bring the deload forward.'),
    L('- L’app ajuste déjà les charges après chaque séance (double progression, baisse si toutes les séries restent sous la fourchette) : propose surtout ce qu’elle ne voit pas (technique, choix d’exercices, volume, récupération).', '- The app already adjusts loads after each session (double progression, lower when every set stays below the range): mostly suggest what it can’t see (technique, exercise choice, volume, recovery).'),
    L('- Décharge : moitié des séries, charges −10 %, RIR 3–4.', '- Deload: half the sets, loads −10%, RIR 3–4.'),
  ].join('\n')

export function sessionPrompt(state: AppState, w: Workout): string {
  const ctx = contextAt(w.date)
  const ws = weightStatus(state)
  const meta = TYPE_META[w.type]
  return [
    L('Tu es mon coach d’hypertrophie. Analyse ma séance et fixe mes prochaines cibles.', 'You are my hypertrophy coach. Analyze my session and set my next targets.'),
    '',
    L(
      `Séance n°${w.sessionNumber} · ${meta.label} (${meta.fr}) · ${fmtDate(w.date, { weekday: true, year: true })}${state.gyms.length > 1 ? ` · salle : ${gymName(state, w.gymId)} (charges machine propres à chaque salle)` : ''}`,
      `Session #${w.sessionNumber} · ${meta.fr === meta.label ? meta.label : `${meta.label} (${meta.fr})`} · ${fmtDate(w.date, { weekday: true, year: true })}${state.gyms.length > 1 ? ` · gym: ${gymName(state, w.gymId)} (machine loads are specific to each gym)` : ''}`,
    ),
    L(
      `Contexte : ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}${ctx.effort ? ` · ${ctx.effort}` : ''}${w.deload ? ' · semaine de décharge' : ''}`,
      `Context: ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}${ctx.effort ? ` · ${ctx.effort}` : ''}${w.deload ? ' · deload week' : ''}`,
    ),
    ws.current
      ? L(
          `Poids : ${fmtNum(ws.current)} kg${ws.isAverage ? ' (moyenne 7 j)' : ''}${ws.weeklyChangePct !== null ? `, tendance ${fmtNum(ws.weeklyChangePct, 2)} %/sem` : ''}`,
          `Weight: ${fmtNum(ws.current)} kg${ws.isAverage ? ' (7-day average)' : ''}${ws.weeklyChangePct !== null ? `, trend ${fmtNum(ws.weeklyChangePct, 2)}%/week` : ''}`,
        )
      : '',
    w.notes ? L(`Notes de séance : ${w.notes}`, `Session notes: ${w.notes}`) : '',
    '',
    ...exerciseLines(state, w),
    '',
    rules(weekShape(templateSets(state.templates)).share),
    '',
    L('Réponds en deux parties :', 'Answer in English, in two parts:'),
    L('1. Une analyse courte (5 lignes max).', '1. A short analysis (5 lines max).'),
    L(
      `2. Un bloc JSON unique, exactement à ce format (ne mets que les exercices qui changent ; ids existants ci-dessus ; types : ${WORKOUT_TYPES.join(', ')}) :`,
      `2. A single JSON block, exactly in this format (include only the exercises that change; existing ids above; types: ${WORKOUT_TYPES.join(', ')}):`,
    ),
    schema(),
  ].filter((l) => l !== '').join('\n')
}

export function globalPrompt(state: AppState): string {
  const today = todayISO()
  const ctx = contextAt(today)
  const ws = weightStatus(state, today)
  const plan = sessionPlan(state)
  const lines = [
    L('Tu es mon coach d’hypertrophie. Fais le point sur mon programme et propose des ajustements.', 'You are my hypertrophy coach. Review my program and suggest adjustments.'),
    '',
    MAINTENANCE
      ? L(
          `Date : ${fmtDate(today, { weekday: true, year: true })} · mode entretien, sans date objectif (blocs + décharges en continu, calories à maintenance)`,
          `Date: ${fmtDate(today, { weekday: true, year: true })} · maintenance mode, no goal date (blocks + deloads with no end, maintenance calories)`,
        )
      : L(
          `Date : ${fmtDate(today, { weekday: true, year: true })} · objectif le ${fmtDate(state.settings.goalDate, { year: true })}`,
          `Date: ${fmtDate(today, { weekday: true, year: true })} · goal on ${fmtDate(state.settings.goalDate, { year: true })}`,
        ),
    L(`Contexte : ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}`, `Context: ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}`),
    plan.cycle
      ? L(
          `Séances : ${state.workouts.length} faites au total ; cycle en cours (${plan.cycle.label}) : ${plan.done} faites, ${plan.planned} prévues d’ici le ${fmtDate(plan.cycle.end, { year: true })}`,
          `Sessions: ${state.workouts.length} done in total; current cycle (${plan.cycle.label}): ${plan.done} done, ${plan.planned} planned by ${fmtDate(plan.cycle.end, { year: true })}`,
        )
      : L(
          `Séances : ${plan.done} faites, ${plan.planned} prévues d’ici le ${fmtDate(GOAL_DATE, { year: true })}`,
          `Sessions: ${plan.done} done, ${plan.planned} planned by ${fmtDate(GOAL_DATE, { year: true })}`,
        ),
    ws.current
      ? L(
          `Poids : ${fmtNum(ws.current)} kg${ws.weeklyChangePct !== null ? `, tendance ${fmtNum(ws.weeklyChangePct, 2)} %/sem` : ''}`,
          `Weight: ${fmtNum(ws.current)} kg${ws.weeklyChangePct !== null ? `, trend ${fmtNum(ws.weeklyChangePct, 2)}%/week` : ''}`,
        )
      : L('Poids : non renseigné', 'Weight: not logged'),
    L(
      `Nutrition : ${state.nutritionTargets.calories} kcal, protéines ${state.nutritionTargets.proteinMin}–${state.nutritionTargets.proteinMax} g, créatine ${state.nutritionTargets.creatine} g`,
      `Nutrition: ${state.nutritionTargets.calories} kcal, protein ${state.nutritionTargets.proteinMin}–${state.nutritionTargets.proteinMax} g, creatine ${state.nutritionTargets.creatine} g`,
    ),
    '',
    L('Programme actuel :', 'Current program:'),
  ]
  for (const type of WORKOUT_TYPES) {
    lines.push(L(`${type} :`, `${type}:`))
    for (const e of state.templates[type].exercises) {
      lines.push(`- ${e.name} [${e.exerciseId}] ${e.target.sets} × ${e.target.minReps}–${e.target.maxReps}, RIR ${e.target.rir ?? '—'}, ${fmtLoad(e.target.weight, e.unit)}`)
    }
  }
  lines.push('', L('Dernières séances :', 'Recent sessions:'))
  for (const w of state.workouts.slice(-5)) {
    const done = w.exercises.filter((e) => !e.skipped).map((e) => `${e.name} ${setsSummary(e.sets, e.unit)}`)
    lines.push(L(`${fmtDate(w.date)} · ${w.type} : ${done.join(' ; ')}`, `${fmtDate(w.date)} · ${w.type}: ${done.join('; ')}`))
  }
  lines.push('', rules(weekShape(templateSets(state.templates)).share), '', L('Réponds avec une analyse courte puis un bloc JSON unique à ce format :', 'Answer in English with a short analysis, then a single JSON block in this format:'), schema())
  return lines.join('\n')
}

export interface PlanChange {
  template: WorkoutType
  exerciseId: string
  action?: 'update' | 'add' | 'remove'
  name?: string
  muscle?: string
  unit?: Unit
  target?: Partial<Target>
  nextTarget?: string
  technique?: string
  position?: number
}

export interface PlanUpdate {
  type: 'golgoth-plan-update'
  version: number
  summary: string
  updateId?: string
  basedOnSession?: number
  changes: PlanChange[]
  nutritionTargets?: Partial<NutritionTargets>
}

function* jsonCandidates(text: string): Generator<string> {
  const fence = /```(?:json)?\s*([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fence.exec(text))) yield m[1]
  // Balanced-brace scan for unfenced JSON.
  for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
    let depth = 0
    let inStr = false
    for (let j = i; j < text.length; j++) {
      const c = text[j]
      if (inStr) {
        if (c === '\\') j++
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '{') depth++
      else if (c === '}' && --depth === 0) {
        yield text.slice(i, j + 1)
        break
      }
    }
  }
}

export function parsePlanUpdate(text: string): PlanUpdate {
  for (const candidate of jsonCandidates(text)) {
    try {
      const j = JSON.parse(candidate.replace(/[“”]/g, '"'))
      if (j && j.type === 'golgoth-plan-update' && Array.isArray(j.changes)) {
        const changes = (j.changes as any[]).filter((c) => c && (WORKOUT_TYPES as string[]).includes(c.template) && typeof c.exerciseId === 'string')
        return { ...j, summary: typeof j.summary === 'string' ? j.summary : L('Mise à jour du coach', 'Coach update'), changes }
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(L('Aucun bloc « golgoth-plan-update » valide trouvé dans le texte collé.', 'No valid “golgoth-plan-update” block found in the pasted text.'))
}

export interface ChangePreview {
  template: WorkoutType
  label: string
  before: string
  after: string
  kind: 'update' | 'add' | 'remove'
}

const describe = (e: Pick<TemplateExercise, 'unit' | 'target'>) =>
  `${e.target.sets} × ${e.target.minReps}–${e.target.maxReps} · ${fmtLoad(e.target.weight, e.unit)}${e.target.rir ? ` · RIR ${e.target.rir}` : ''}`

export function previewPlanUpdate(state: AppState, u: PlanUpdate): ChangePreview[] {
  return u.changes.map((c) => {
    const tpl = state.templates[c.template]
    const cur = tpl.exercises.find((e) => e.exerciseId === c.exerciseId)
    const kind = c.action === 'remove' ? 'remove' : cur ? 'update' : 'add'
    if (kind === 'remove') return { template: c.template, label: cur?.name ?? c.exerciseId, before: cur ? describe(cur) : '—', after: L('Retiré', 'Removed'), kind }
    const merged = mergeExercise(cur, c)
    return { template: c.template, label: merged.name, before: cur ? describe(cur) : '—', after: describe(merged), kind }
  })
}

function mergeExercise(cur: TemplateExercise | undefined, c: PlanChange): TemplateExercise {
  const base: TemplateExercise = cur ?? {
    exerciseId: c.exerciseId,
    name: c.name ?? c.exerciseId,
    muscle: c.muscle ?? '',
    unit: c.unit ?? 'kg',
    target: { weight: null, sets: 3, minReps: 8, maxReps: 12, restSeconds: 120 },
  }
  const target = { ...base.target, ...(c.target ?? {}) }
  const merged: TemplateExercise = {
    ...base,
    name: c.name ?? base.name,
    muscle: c.muscle ?? base.muscle,
    unit: c.unit ?? base.unit,
    target,
    technique: c.technique ?? base.technique,
  }
  merged.nextTarget = c.nextTarget ?? nextTargetText(merged)
  return merged
}

export function applyPlanUpdate(state: AppState, u: PlanUpdate): AppState {
  const templates = { ...state.templates }
  for (const c of u.changes) {
    const tpl = templates[c.template]
    let exercises = [...tpl.exercises]
    const idx = exercises.findIndex((e) => e.exerciseId === c.exerciseId)
    if (c.action === 'remove') {
      if (idx >= 0) exercises.splice(idx, 1)
    } else if (idx >= 0) {
      exercises[idx] = mergeExercise(exercises[idx], c)
    } else {
      const add = mergeExercise(undefined, c)
      const pos = typeof c.position === 'number' ? Math.max(0, Math.min(exercises.length, c.position)) : exercises.length
      exercises = [...exercises.slice(0, pos), add, ...exercises.slice(pos)]
    }
    templates[c.template] = { ...tpl, exercises }
  }
  return {
    ...state,
    templates,
    nutritionTargets: { ...state.nutritionTargets, ...(u.nutritionTargets ?? {}) },
    appliedPlanUpdates: [
      ...state.appliedPlanUpdates,
      {
        updateId: u.updateId ?? `coach-${Date.now()}`,
        basedOnSession: u.basedOnSession ?? null,
        summary: u.summary,
        appliedAt: new Date().toISOString(),
        changeCount: u.changes.length,
        source: 'coach',
      },
    ],
  }
}
