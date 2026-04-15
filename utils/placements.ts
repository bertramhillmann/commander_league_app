// ─── Performance multiplier constants ────────────────────────────────────────

/** Expected win rate for a standard 4-player game (1 / playerCount) */
export const EXPECTED_WIN_RATE = 0.25

/**
 * Weights for the performance multiplier applied to total score.
 * base + winRate + avg must equal 1.
 *
 * Formula:
 *   mult = PERF_BASE_WEIGHT
 *        + PERF_WIN_RATE_WEIGHT × (playerWinRate / EXPECTED_WIN_RATE)
 *        + PERF_AVG_WEIGHT      × (playerAvgPerGame / leagueAvgPerGame)
 *
 * An exactly-average player (25 % wins, league-avg pts/game) gets mult = 1.0.
 */
export const PERF_BASE_WEIGHT     = 0.70
export const PERF_WIN_RATE_WEIGHT = 0.15
export const PERF_AVG_WEIGHT      = 0.15

/** Clamp range for the multiplier to prevent extreme swings */
export const PERF_MULT_MIN = 0.5
export const PERF_MULT_MAX = 1.5

// ─── Base ratings ────────────────────────────────────────────────────────────

export interface PlacementRating {
  points: number
  lPoints: number
}

/**
 * Base ratings indexed by player-count → placement (0 = 1st).
 * l-points are "looster points" (negative pressure / penalty currency).
 */
export const BASE_RATINGS: Record<number, PlacementRating[]> = {
  3: [
    { points: 1,    lPoints: 0 }, // 1st
    { points: 0.5, lPoints: 0.5 }, // 2nd
    { points: 0,    lPoints: 1 }, // 3rd
  ],
  4: [
    { points: 1.2, lPoints: 0 }, // 1st
    { points: 0.8, lPoints: 0.4 }, // 2nd
    { points: 0.4, lPoints: 0.8 }, // 3rd
    { points: 0,    lPoints: 1.2 }, // 4th
  ],
  5: [
    { points: 1.1, lPoints: 0 }, // 1st
    { points: 0.825,  lPoints: 0.275 }, // 2nd
    { points: 0.55, lPoints: 0.55 }, // 3rd
    { points: 0.275, lPoints: 0.825 }, // 4th
    { points: 0,    lPoints: 1.1 }, // 5th
  ],
}

// ─── Point computation ────────────────────────────────────────────────────────

export interface PlacementResult {
  points: number
  lPoints: number
}

/**
 * Computes points and l-points for every player in a single game.
 *
 * Tied placements: the tied players collectively "consume" the slots they
 * occupy (e.g. two players at 2nd in a 3-player game consume slots 2 and 3),
 * and the summed ratings are split evenly between them.
 */
export function computeGamePoints<T extends { placement: number }>(
  players: T[]
): (T & PlacementResult)[] {
  const n = players.length
  const ratings = BASE_RATINGS[n]

  if (!ratings) {
    // Unsupported player count — return zeros
    return players.map((p) => ({ ...p, points: 0, lPoints: 0 }))
  }

  // Group players by placement
  const byPlacement = new Map<number, T[]>();
  
  for (const p of players) {
    if (!byPlacement.has(p.placement)) byPlacement.set(p.placement, [])
    byPlacement.get(p.placement)!.push(p)
  }

  return players.map((player) => {
    const group = byPlacement.get(player.placement)!
    const count = group.length
    const startIdx = player.placement - 1 // to 0-based index

    let totalPoints = 0
    let totalLPoints = 0

    for (let i = startIdx; i < startIdx + count; i++) {
      if (ratings[i]) {
        totalPoints += ratings[i].points
        totalLPoints += ratings[i].lPoints
      }
    }

    return {
      ...player,
      points: round3(totalPoints / count),
      lPoints: round3(totalLPoints / count),
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function getPlacementLabel(placement: number): string {
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }
  return labels[placement] ?? `${placement}th`
}

export function rankPlayersByPoints(
  players: { name: string; points: number }[]
): { name: string; points: number; rank: number }[] {
  return [...players]
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }))
}
