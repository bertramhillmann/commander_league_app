import type {
  LeagueSnapshotEntry,
  PlayerGameRecord,
  ProcessedGame,
} from '~/composables/useLeagueState'

export interface LeagueRankTimelinePoint {
  gameId: string
  dateLabel: string
  rank: number
  playerCount: number
  totalPlayers: number
  totalScore: number
  participated: boolean
}

export function buildPlayerLeagueTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  leagueSnapshots: Record<string, Record<string, LeagueSnapshotEntry>>,
  playerName: string,
): LeagueRankTimelinePoint[] {
  const timeline: LeagueRankTimelinePoint[] = []

  for (const game of games) {
    const snapshot = leagueSnapshots[game.gameId] ?? {}
    const entry = snapshot[playerName]
    const participated = !!gameRecords[playerName]?.[game.gameId]

    timeline.push({
      gameId: game.gameId,
      dateLabel: formatGameDate(game.date),
      rank: entry?.rank ?? 0,
      playerCount: game.players.length,
      totalPlayers: Object.keys(snapshot).length,
      totalScore: entry?.totalScore ?? 0,
      participated,
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
