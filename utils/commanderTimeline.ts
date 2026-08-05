import type { PlayerGameRecord, ProcessedGame } from '~/composables/useLeagueState'
import { getCommanderTierFromMMR, type CommanderMMRTier } from '~/composables/useCommanderMMR'

export interface PlacementTimelinePoint {
  gameId: string
  dateMs: number
  dateLabel: string
  placement: number
  playerCount: number
  gamesWithCommander: number
  tier: CommanderMMRTier
  tierLabel: string
  tierChange: 'rise' | 'drop' | null
  projectedTier: CommanderMMRTier | null
  projectedTierLabel: string | null
}

export interface CommanderMMRTimelinePoint {
  gameId: string
  dateMs: number
  dateLabel: string
  mmr: number
  delta: number
  tier: CommanderMMRTier
  tierLabel: string
  tierChange: "rise" | "drop" | null
}

export interface PlacementTimelineRange {
  startGameId: string
  endGameId: string
  startLabel: string
  endLabel: string
}

export function buildCommanderPlacementTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
  commanderName: string,
): PlacementTimelinePoint[] {
  let previousTier: CommanderMMRTier | null = null
  const timeline: PlacementTimelinePoint[] = []
  let gamesWithCommander = 0

  for (const game of games) {
    const targetRecord = gameRecords[playerName]?.[game.gameId]
    if (!targetRecord || targetRecord.commander !== commanderName) continue

    gamesWithCommander += 1
    const tier = getCommanderTierFromMMR(targetRecord.commanderMMRAfter)

    let tierChange: 'rise' | 'drop' | null = null
    if (previousTier) {
      const previousRank = COMMANDER_MMR_TIER_RANK[previousTier]
      const nextRank = COMMANDER_MMR_TIER_RANK[tier]
      if (nextRank < previousRank) tierChange = 'rise'
      if (nextRank > previousRank) tierChange = 'drop'
    }

    timeline.push({
      gameId: game.gameId,
      dateMs: new Date(game.date).getTime(),
      dateLabel: formatGameDate(game.date),
      placement: targetRecord.placement,
      playerCount: targetRecord.playerCount,
      gamesWithCommander,
      tier,
      tierLabel: commanderMmrTierLabel(tier),
      tierChange,
      projectedTier: null,
      projectedTierLabel: null,
    })

    previousTier = tier
  }

  return timeline
}

export function buildCommanderMMRTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
  commanderName: string,
): CommanderMMRTimelinePoint[] {
  let previousTier: CommanderMMRTier | null = null
  const timeline: CommanderMMRTimelinePoint[] = []

  for (const game of games) {
    const targetRecord = gameRecords[playerName]?.[game.gameId]
    if (!targetRecord || targetRecord.commander !== commanderName) continue

    const tier = getCommanderTierFromMMR(targetRecord.commanderMMRAfter)
    let tierChange: "rise" | "drop" | null = null

    if (previousTier) {
      const previousRank = COMMANDER_MMR_TIER_RANK[previousTier]
      const nextRank = COMMANDER_MMR_TIER_RANK[tier]
      if (nextRank < previousRank) tierChange = "rise"
      if (nextRank > previousRank) tierChange = "drop"
    }

    timeline.push({
      gameId: game.gameId,
      dateMs: new Date(game.date).getTime(),
      dateLabel: formatGameDate(game.date),
      mmr: targetRecord.commanderMMRAfter,
      delta: targetRecord.commanderMMRDelta,
      tier,
      tierLabel: commanderMmrTierLabel(tier),
      tierChange,
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

const COMMANDER_MMR_TIER_RANK: Record<CommanderMMRTier, number> = {
  god: 0,
  legend: 1,
  diamond: 2,
  platinum: 3,
  gold: 4,
  silver: 5,
  bronze: 6,
  trash: 7,
}

function commanderMmrTierLabel(tier: CommanderMMRTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}
