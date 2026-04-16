import type { PlayerGameRecord, ProcessedGame } from '~/composables/useLeagueState'

export interface PlayerMatchTimelinePoint {
  gameId: string
  dateLabel: string
  placement: number
  playerCount: number
  commander: string
  basePoints: number
  finalPoints: number
  lPoints: number
  rankBefore: number
  rankAfter: number
}

export function buildPlayerMatchTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
): PlayerMatchTimelinePoint[] {
  const timeline: PlayerMatchTimelinePoint[] = []

  for (const game of games) {
    const record = gameRecords[playerName]?.[game.gameId]
    if (!record) continue

    timeline.push({
      gameId: game.gameId,
      dateLabel: formatGameDate(game.date),
      placement: record.placement,
      playerCount: record.playerCount,
      commander: record.commander,
      basePoints: record.basePoints,
      finalPoints: record.finalPoints,
      lPoints: record.lPoints,
      rankBefore: record.rankBefore,
      rankAfter: record.rankAfter,
    })
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
