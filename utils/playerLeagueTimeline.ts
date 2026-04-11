import type { PlayerGameRecord, ProcessedGame } from '~/composables/useLeagueState'

export interface LeagueRankTimelinePoint {
  gameId: string
  dateLabel: string
  rank: number
  playerCount: number
  totalPlayers: number
  totalPoints: number
  participated: boolean
}

export function buildPlayerLeagueTimeline(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerName: string,
): LeagueRankTimelinePoint[] {
  const allPlayers = Object.keys(gameRecords)
  const runningTotals = Object.fromEntries(allPlayers.map((name) => [name, 0])) as Record<string, number>
  const timeline: LeagueRankTimelinePoint[] = []

  for (const game of games) {
    for (const participant of game.players) {
      const record = gameRecords[participant.name]?.[game.gameId]
      if (!record) continue
      runningTotals[participant.name] = round3((runningTotals[participant.name] ?? 0) + record.finalPoints)
    }

    const sortedNames = [...allPlayers].sort((a, b) => {
      const pointsDiff = (runningTotals[b] ?? 0) - (runningTotals[a] ?? 0)
      if (pointsDiff !== 0) return pointsDiff
      return a.localeCompare(b)
    })

    const rank = sortedNames.findIndex((name) => name === playerName) + 1
    const participated = !!gameRecords[playerName]?.[game.gameId]

    timeline.push({
      gameId: game.gameId,
      dateLabel: formatGameDate(game.date),
      rank,
      playerCount: game.players.length,
      totalPlayers: allPlayers.length,
      totalPoints: runningTotals[playerName] ?? 0,
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

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}
