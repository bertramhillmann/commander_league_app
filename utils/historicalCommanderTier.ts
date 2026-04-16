import { compareGamesChronological, type PlayerGameRecord, type ProcessedGame } from '~/composables/useLeagueState'
import { blendScore, getTier, type Tier } from '~/utils/tiers'

type Totals = {
  games: number
  totalBasePoints: number
  wins: number
}

export function getHistoricalCommanderTierAtGame(
  playerName: string,
  commanderName: string,
  gameId: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): Tier | null {
  const chronologicalGames = [...games].sort(compareGamesChronological)
  const pairTotals: Record<string, Record<string, Totals>> = {}
  const commanderTotals: Record<string, Totals> = {}

  for (const game of chronologicalGames) {
    for (const participant of game.players) {
      const record = gameRecords[participant.name]?.[game.gameId]
      if (!record) continue

      if (!pairTotals[participant.name]) pairTotals[participant.name] = {}
      if (!pairTotals[participant.name][record.commander]) {
        pairTotals[participant.name][record.commander] = { games: 0, totalBasePoints: 0, wins: 0 }
      }
      if (!commanderTotals[record.commander]) {
        commanderTotals[record.commander] = { games: 0, totalBasePoints: 0, wins: 0 }
      }

      const pairState = pairTotals[participant.name][record.commander]
      pairState.games++
      pairState.totalBasePoints += record.basePoints
      if (record.placement === 1) pairState.wins++

      const commanderState = commanderTotals[record.commander]
      commanderState.games++
      commanderState.totalBasePoints += record.basePoints
      if (record.placement === 1) commanderState.wins++
    }

    if (game.gameId !== gameId) continue

    const targetPair = pairTotals[playerName]?.[commanderName]
    if (!targetPair || targetPair.games === 0) return null

    const globalScores = Object.values(commanderTotals)
      .filter((commander) => commander.games > 0)
      .map((commander) =>
        blendScore(commander.totalBasePoints / commander.games, commander.wins / commander.games),
      )

    const globalAverage = globalScores.length
      ? globalScores.reduce((sum, score) => sum + score, 0) / globalScores.length
      : 0

    const rawScore = blendScore(
      targetPair.totalBasePoints / targetPair.games,
      targetPair.wins / targetPair.games,
    )

    return getTier(rawScore, globalAverage, targetPair.games)
  }

  return null
}
