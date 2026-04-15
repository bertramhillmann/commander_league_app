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

export function calcGameLoosterPoints(params: {
  placement: number
  eliminations: number
  commanderCasts: number
}): number {
  const placementBonus: Record<number, number> = { 1: 100, 2: 60, 3: 30, 4: 10 }
  const base = placementBonus[params.placement] ?? 0
  const eliminationBonus = params.eliminations * 15
  const castBonus = params.commanderCasts * 5
  return base + eliminationBonus + castBonus
}

export function totalLoosterPoints(transactions: LoosterPointTransaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0)
}

export function getMissedGameLoosterPoints(playerCount: number): number {
  return MISSED_GAME_LPOINTS_BY_PLAYER_COUNT[playerCount] ?? 0
}
