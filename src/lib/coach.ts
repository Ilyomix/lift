// Coach loop with Claude: export a precise brief, paste back a structured plan update.
import { fmtDate, todayISO } from './date'
import { fmtLoad, fmtNum } from './format'
import { contextAt, nextTargetText, TYPE_META } from './program'
import { exerciseHistory, setsSummary } from './training'
import { weightStatus } from './stats'
import type { AppState, NutritionTargets, Target, TemplateExercise, Unit, Workout, WorkoutType } from './types'
import { WORKOUT_TYPES } from './types'

const FLAG_LABEL: Record<string, string> = { failure: 'échec', 'bad-technique': 'technique', pain: 'douleur' }

function exerciseLines(state: AppState, w: Workout): string[] {
  const lines: string[] = []
  for (const ex of w.exercises) {
    const t = ex.prescription ?? { sets: ex.target.sets, minReps: ex.target.minReps, maxReps: ex.target.maxReps, rir: ex.target.rir ?? '', weight: ex.target.weight }
    lines.push(`- ${ex.name} [${ex.exerciseId}] · cible ${t.sets} × ${t.minReps}–${t.maxReps}${t.rir ? `, RIR ${t.rir}` : ''} à ${fmtLoad(t.weight, ex.unit)}`)
    if (ex.skipped) {
      lines.push(`  non réalisé${ex.skipReason ? ` (${ex.skipReason})` : ''}`)
      continue
    }
    const sets = ex.sets.filter((s) => s.completed)
    sets.forEach((s, i) => {
      const flags = s.flags.map((f) => FLAG_LABEL[f]).join(', ')
      lines.push(`  S${i + 1} : ${ex.unit === 'PDC' ? 'PDC' : fmtLoad(s.weight, ex.unit)} × ${s.reps ?? 0} (${s.cleanReps ?? s.reps ?? 0} propres)${typeof s.rir === 'number' ? `, RIR ${s.rir}` : ''}${flags ? `, ${flags}` : ''}${s.note ? ` — ${s.note}` : ''}`)
    })
    if (ex.comparison) lines.push(`  bilan : ${ex.comparison.headline.toLowerCase()} — ${ex.comparison.detail}`)
    const hist = exerciseHistory(state.workouts.filter((x) => x.id !== w.id), ex.exerciseId).slice(-3)
    if (hist.length) lines.push(`  historique : ${hist.map((h) => `${fmtDate(h.date)} ${setsSummary(h.sets, h.unit)}`).join(' | ')}`)
    if (ex.notes) lines.push(`  note : ${ex.notes}`)
  }
  return lines
}

const SCHEMA = `{
  "type": "golgoth-plan-update",
  "version": 1,
  "summary": "Une phrase de synthèse",
  "basedOnSession": 27,
  "changes": [
    { "template": "PUSH", "exerciseId": "incline-db-press", "target": { "weight": 22, "sets": 3, "minReps": 6, "maxReps": 10, "restSeconds": 150, "rir": "1–2" }, "nextTarget": "Consigne courte pour la prochaine séance" },
    { "template": "PUSH", "exerciseId": "cable-fly", "action": "add", "name": "Écarté poulie", "muscle": "Pectoraux", "unit": "kg", "target": { "weight": 15, "sets": 3, "minReps": 10, "maxReps": 15, "restSeconds": 90, "rir": "0–1" } },
    { "template": "UPPER", "exerciseId": "dips", "action": "remove" }
  ],
  "nutritionTargets": { "calories": 2300 }
}`

const RULES = [
  'Règles du programme (rapport de recherche) :',
  '- 10–20 séries difficiles par muscle et par semaine (comptage fractionnaire), 2 passages par muscle.',
  '- RIR 1–2 en polyarticulaire, 0–1 en isolation ; S1 du bloc RIR 3, S2 RIR 2, dernière semaine RIR 0–1.',
  '- Double progression : quand toutes les séries atteignent le haut de la fourchette au RIR visé, +2,5 % environ (plus petit incrément).',
  '- Performance en baisse 2 séances de suite sur un exercice : retirer 1 série à ce muscle ; baisse générale : avancer la décharge.',
  '- Décharge : moitié des séries, charges −10 %, RIR 3–4.',
].join('\n')

export function sessionPrompt(state: AppState, w: Workout): string {
  const ctx = contextAt(w.date)
  const ws = weightStatus(state)
  return [
    'Tu es mon coach d’hypertrophie. Analyse ma séance et fixe mes prochaines cibles.',
    '',
    `Séance n°${w.sessionNumber} · ${TYPE_META[w.type].label} (${TYPE_META[w.type].fr}) · ${fmtDate(w.date, { weekday: true, year: true })}`,
    `Contexte : ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}${ctx.effort ? ` · ${ctx.effort}` : ''}${w.deload ? ' · semaine de décharge' : ''}`,
    ws.current ? `Poids : ${fmtNum(ws.current)} kg${ws.isAverage ? ' (moyenne 7 j)' : ''}${ws.weeklyChangePct !== null ? `, tendance ${fmtNum(ws.weeklyChangePct, 2)} %/sem` : ''}` : '',
    w.notes ? `Notes de séance : ${w.notes}` : '',
    '',
    ...exerciseLines(state, w),
    '',
    RULES,
    '',
    'Réponds en deux parties :',
    '1. Une analyse courte (5 lignes max).',
    `2. Un bloc JSON unique, exactement à ce format (ne mets que les exercices qui changent ; ids existants ci-dessus ; types : ${WORKOUT_TYPES.join(', ')}) :`,
    SCHEMA,
  ].filter((l) => l !== '').join('\n')
}

export function globalPrompt(state: AppState): string {
  const today = todayISO()
  const ctx = contextAt(today)
  const ws = weightStatus(state, today)
  const lines = [
    'Tu es mon coach d’hypertrophie. Fais le point sur mon programme et propose des ajustements.',
    '',
    `Date : ${fmtDate(today, { weekday: true, year: true })} · objectif le ${fmtDate(state.settings.goalDate, { year: true })}`,
    `Contexte : ${ctx.title}${ctx.phase ? ` · ${ctx.phase.label}` : ''}`,
    `Séances réalisées : ${state.workouts.length} / ${state.totalSessions}`,
    ws.current ? `Poids : ${fmtNum(ws.current)} kg${ws.weeklyChangePct !== null ? `, tendance ${fmtNum(ws.weeklyChangePct, 2)} %/sem` : ''}` : 'Poids : non renseigné',
    `Nutrition : ${state.nutritionTargets.calories} kcal, protéines ${state.nutritionTargets.proteinMin}–${state.nutritionTargets.proteinMax} g, créatine ${state.nutritionTargets.creatine} g`,
    '',
    'Programme actuel :',
  ]
  for (const type of WORKOUT_TYPES) {
    lines.push(`${type} :`)
    for (const e of state.templates[type].exercises) {
      lines.push(`- ${e.name} [${e.exerciseId}] ${e.target.sets} × ${e.target.minReps}–${e.target.maxReps}, RIR ${e.target.rir ?? '—'}, ${fmtLoad(e.target.weight, e.unit)}`)
    }
  }
  lines.push('', 'Dernières séances :')
  for (const w of state.workouts.slice(-5)) {
    lines.push(`${fmtDate(w.date)} · ${w.type} : ${w.exercises.filter((e) => !e.skipped).map((e) => `${e.name} ${setsSummary(e.sets, e.unit)}`).join(' ; ')}`)
  }
  lines.push('', RULES, '', 'Réponds avec une analyse courte puis un bloc JSON unique à ce format :', SCHEMA)
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
        return { ...j, summary: typeof j.summary === 'string' ? j.summary : 'Mise à jour du coach', changes }
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error('Aucun bloc « golgoth-plan-update » valide trouvé dans le texte collé.')
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
    if (kind === 'remove') return { template: c.template, label: cur?.name ?? c.exerciseId, before: cur ? describe(cur) : '—', after: 'Retiré', kind }
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
        updateId: u.updateId ?? `claude-${Date.now()}`,
        basedOnSession: u.basedOnSession ?? null,
        summary: u.summary,
        appliedAt: new Date().toISOString(),
        changeCount: u.changes.length,
        source: 'claude',
      },
    ],
  }
}
