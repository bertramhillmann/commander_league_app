// "Looster Points" — the in-app currency/scoring system

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
