import type { PlayerGameRecord, ProcessedGame } from '~/composables/useLeagueState'
import { getCommanderTierFromMMR, type CommanderMMRTier } from '~/composables/useCommanderMMR'
import type { CommanderMMRTimelinePoint } from '~/utils/commanderTimeline'

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

export function buildPlayerMmrTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
): CommanderMMRTimelinePoint[] {
  const timeline: CommanderMMRTimelinePoint[] = []
  let previousTier: CommanderMMRTier | null = null

  for (const game of games) {
    const record = gameRecords[playerName]?.[game.gameId]
    if (!record) continue

    const tier = getCommanderTierFromMMR(record.commanderMMRAfter)
    let tierChange: 'rise' | 'drop' | null = null

    if (previousTier) {
      const previousRank = COMMANDER_MMR_TIER_RANK[previousTier]
      const nextRank = COMMANDER_MMR_TIER_RANK[tier]
      if (nextRank < previousRank) tierChange = 'rise'
      if (nextRank > previousRank) tierChange = 'drop'
    }

    timeline.push({
      gameId: game.gameId,
      dateLabel: formatGameDate(game.date),
      mmr: record.commanderMMRAfter,
      delta: record.commanderMMRDelta,
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

function commanderMmrTierLabel(tier: CommanderMMRTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}
