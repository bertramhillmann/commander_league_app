// "Looster Points" — the in-app currency/scoring system

export const MISSED_GAME_LPOINTS_3_PLAYER = 0.5
export const MISSED_GAME_LPOINTS_4_PLAYER = 0.6
export const MISSED_GAME_LPOINTS_5_PLAYER = 0.55

export const MISSED_GAME_LPOINTS_BY_PLAYER_COUNT: Record<number, number> = {
  3: MISSED_GAME_LPOINTS_3_PLAYER,
  4: MISSED_GAME_LPOINTS_4_PLAYER,
  5: MISSED_GAME_LPOINTS_5_PLAYER,
}

export interface LoosterPointTransaction {
  amount: number
  reason: string
  timestamp: Date
}

export function roundLoosterPoints(value: number): number {
  // L-Points can legitimately produce 4-decimal values from tied placement splits
  // (for example 0.1375), so we preserve 4 decimals while removing float drift.
  return Math.round(value * 10000) / 10000
}

export function formatLoosterPoints(value: number | null | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0'
  if (value === 0) return '0'
  return roundLoosterPoints(value).toFixed(4).replace(/\.?0+$/, '')
}

export function calcGameLoosterPoints(params: {
  placement: number
  eliminations: number
  commanderCasts: number
}): number {
  const placementBonus: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const base = placementBonus[params.placement] ?? 0
  const eliminationBonus = params.eliminations * 15
  const castBonus = params.commanderCasts * 5
  return base + eliminationBonus + castBonus
}

export function totalLoosterPoints(transactions: LoosterPointTransaction[]): number {
  return roundLoosterPoints(transactions.reduce((sum, t) => sum + t.amount, 0))
}

export function getMissedGameLoosterPoints(playerCount: number): number {
  return roundLoosterPoints(MISSED_GAME_LPOINTS_BY_PLAYER_COUNT[playerCount] ?? 0)
}
