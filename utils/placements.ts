import { getResolvedLeagueSettings } from '~/utils/leagueSettings'
import { DEFAULT_BASE_RATINGS, type PlacementRating } from '~/utils/scoringDefaults'

export { type PlacementRating }

// Performance multiplier constants

/** Expected win rate for a standard 4-player game (1 / playerCount) */
export const EXPECTED_WIN_RATE = 0.25

/**
 * Weights for the performance multiplier applied to total score.
 * base + winRate + avg must equal 1.
 */
export const PERF_BASE_WEIGHT = 0.70
export const PERF_WIN_RATE_WEIGHT = 0.15
export const PERF_AVG_WEIGHT = 0.15

/** Clamp range for the multiplier to prevent extreme swings */
export const PERF_MULT_MIN = 0.5
export const PERF_MULT_MAX = 1.5

/** Base ratings indexed by player-count -> placement (0 = 1st). */
export const BASE_RATINGS: Record<number, PlacementRating[]> = DEFAULT_BASE_RATINGS

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
  players: T[],
): (T & PlacementResult)[] {
  const n = players.length
  const ratings = getResolvedLeagueSettings().points[n]

  if (!ratings) {
    return players.map((player) => ({ ...player, points: 0, lPoints: 0 }))
  }

  const byPlacement = new Map<number, T[]>()

  for (const player of players) {
    if (!byPlacement.has(player.placement)) byPlacement.set(player.placement, [])
    byPlacement.get(player.placement)!.push(player)
  }

  return players.map((player) => {
    const group = byPlacement.get(player.placement) ?? []
    const count = group.length || 1
    const startIdx = player.placement - 1

    let totalPoints = 0
    let totalLPoints = 0

    for (let index = startIdx; index < startIdx + count; index++) {
      if (!ratings[index]) continue
      totalPoints += ratings[index].points
      totalLPoints += ratings[index].lPoints
    }

    return {
      ...player,
      points: round3(totalPoints / count),
      lPoints: round3(totalLPoints / count),
    }
  })
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function getPlacementLabel(placement: number): string {
  const labels: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }
  return labels[placement] ?? `${placement}th`
}

export function rankPlayersByPoints(
  players: { name: string; points: number }[],
): { name: string; points: number; rank: number }[] {
  return [...players]
    .sort((a, b) => b.points - a.points)
    .map((player, index) => ({ ...player, rank: index + 1 }))
}
