import { regradeTrainingDiagnostics } from './training'
import type { AppState } from './types'

export const TRAINING_REVISION = 5

/** Repair stored diagnostics once, with the user's calendar already configured. */
export function upgradeTrainingDiagnostics(state: AppState): AppState {
  if (state.progressRevision >= TRAINING_REVISION) return state
  return { ...regradeTrainingDiagnostics(state), progressRevision: TRAINING_REVISION }
}
