import { blendScore, computeGlobalCommanderBaselineFromRecords, getTier, smoothedTierScore, type Tier } from '~/utils/tiers'
import type { PlayerGameRecord, ProcessedGame } from '~/composables/useLeagueState'

export interface PlacementTimelinePoint {
  gameId: string
  dateLabel: string
  placement: number
  playerCount: number
  gamesWithCommander: number
  tier: Tier
  tierLabel: string
  tierChange: 'rise' | 'drop' | null
  projectedTier: Tier | null
  projectedTierLabel: string | null
}

interface PairTotals {
  games: number
  wins: number
  totalBasePoints: number
}

interface PlayerTotals {
  games: number
  wins: number
  totalBasePoints: number
}

const TIER_RANK: Record<Tier, number> = {
  god: 0,
  legend: 1,
  diamond: 2,
  platinum: 3,
  gold: 4,
  silver: 5,
  bronze: 6,
  trash: 7,
}

export function buildCommanderPlacementTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
  commanderName: string,
): PlacementTimelinePoint[] {
  const playerTotals: Record<string, PlayerTotals> = {}
  const pairTotals: Record<string, Record<string, PairTotals>> = {}
  const globalBaseline = computeGlobalCommanderBaselineFromRecords(gameRecords)
  let previousTier: Tier | null = null
  const timeline: PlacementTimelinePoint[] = []

  for (const game of games) {
    for (const participant of game.players) {
      const record = gameRecords[participant.name]?.[game.gameId]
      if (!record) continue

      if (!playerTotals[participant.name]) {
        playerTotals[participant.name] = { games: 0, wins: 0, totalBasePoints: 0 }
      }
      if (!pairTotals[participant.name]) pairTotals[participant.name] = {}
      if (!pairTotals[participant.name][record.commander]) {
        pairTotals[participant.name][record.commander] = { games: 0, wins: 0, totalBasePoints: 0 }
      }

      const playerState = playerTotals[participant.name]
      const pairState = pairTotals[participant.name][record.commander]

      playerState.games++
      playerState.totalBasePoints += record.basePoints
      if (record.placement === 1) playerState.wins++

      pairState.games++
      pairState.totalBasePoints += record.basePoints
      if (record.placement === 1) pairState.wins++
    }

    const targetRecord = gameRecords[playerName]?.[game.gameId]
    if (!targetRecord || targetRecord.commander !== commanderName) continue

    const targetPlayer = playerTotals[playerName]
    const targetPair = pairTotals[playerName]?.[commanderName]
    if (!targetPlayer || !targetPair) continue

    const rawScore = targetPair.games > 0
      ? blendScore(targetPair.totalBasePoints / targetPair.games, targetPair.wins / targetPair.games)
      : 0
    const tier = getTier(rawScore, globalBaseline, targetPair.games)

    const playerAvgPoints = targetPlayer.games > 0 ? targetPlayer.totalBasePoints / targetPlayer.games : 0
    const playerWinRate = targetPlayer.games > 0 ? targetPlayer.wins / targetPlayer.games : 0
    const projectedScore = smoothedTierScore(
      targetPair.totalBasePoints,
      targetPair.wins,
      targetPair.games,
      playerAvgPoints,
      playerWinRate,
    )
    const projectedTier = getTier(projectedScore, globalBaseline, targetPair.games)

    let tierChange: 'rise' | 'drop' | null = null
    if (previousTier) {
      const previousRank = TIER_RANK[previousTier]
      const nextRank = TIER_RANK[tier]
      if (nextRank < previousRank) tierChange = 'rise'
      if (nextRank > previousRank) tierChange = 'drop'
    }

    timeline.push({
      gameId: game.gameId,
      dateLabel: formatGameDate(game.date),
      placement: targetRecord.placement,
      playerCount: targetRecord.playerCount,
      gamesWithCommander: targetPair.games,
      tier,
      tierLabel: tierLabel(tier),
      tierChange,
      projectedTier,
      projectedTierLabel: tierLabel(projectedTier),
    })

    previousTier = tier
  }

  return timeline
}

function formatGameDate(date: string | Date) {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function tierLabel(tier: Tier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}
