/** Planning approximations, not a physiological guarantee of the actual energy deficit. */
export const KCAL_PER_KG = 7700
export const CUT_MAX_DEFICIT = 500
export const CONSERVATIVE_CUT_PCT = 0.5

/** Positive % of weight/week, bounded by the same energy budget as calorie advice. */
export function cutLossPct(weight: number, requestedPct: number): number {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(requestedPct)) return 0
  return Math.max(0, Math.min(requestedPct, CUT_MAX_DEFICIT * 7 / KCAL_PER_KG / weight * 100))
}

/** Days of active cutting required, with no assumed muscle gain or loss during recomposition. */
export function cutDaysNeeded(weight: number, target: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(target) || weight <= 0 || target <= 0) return Infinity
  let current = weight
  for (let days = 0; days <= 3650; days++) {
    if (current <= target) return days
    current *= 1 - cutLossPct(current, CONSERVATIVE_CUT_PCT) / 700
  }
  return Infinity
}
