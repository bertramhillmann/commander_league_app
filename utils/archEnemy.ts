import type { PlayerGameRecord, ProcessedGame, ProcessedGamePlayer } from '~/composables/useLeagueState'

export const ARCH_ENEMY_SAFE_PLACEMENT = 2
export const ARCH_ENEMY_ZERO_POINT_VALUE = 0

export interface ArchEnemyMatchup {
  enemyName: string
  losses: number
  zeroPointLosses: number
  lastLossGameId: string
  lastLossDate: string | Date
}

export interface ArchEnemySummary {
  playerName: string
  enemyName: string | null
  losses: number
  zeroPointLosses: number
  trackedLosses: number
  uniqueEnemies: number
  matchup: ArchEnemyMatchup | null
}

export function buildArchEnemyMap(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const playerEnemyMap = new Map<string, Map<string, ArchEnemyMatchup>>()

  for (const game of games) {
    const winner = getWinningPlayer(game.players)
    if (!winner) continue

    for (const participant of game.players) {
      if (participant.name === winner.name) continue
      if (participant.placement <= ARCH_ENEMY_SAFE_PLACEMENT) continue

      const playerRecord = gameRecords[participant.name]?.[game.gameId]
      const playerMap = playerEnemyMap.get(participant.name) ?? new Map<string, ArchEnemyMatchup>()
      const current = playerMap.get(winner.name)

      const next: ArchEnemyMatchup = current
        ? {
            ...current,
            losses: current.losses + 1,
            zeroPointLosses: current.zeroPointLosses + (madeZeroPoints(playerRecord, participant) ? 1 : 0),
            lastLossGameId: game.gameId,
            lastLossDate: game.date,
          }
        : {
            enemyName: winner.name,
            losses: 1,
            zeroPointLosses: madeZeroPoints(playerRecord, participant) ? 1 : 0,
            lastLossGameId: game.gameId,
            lastLossDate: game.date,
          }

      playerMap.set(winner.name, next)
      playerEnemyMap.set(participant.name, playerMap)
    }
  }

  return playerEnemyMap
}

export function getArchEnemySummary(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): ArchEnemySummary {
  const matchupMap = buildArchEnemyMap(games, gameRecords).get(playerName) ?? new Map<string, ArchEnemyMatchup>()
  const matchups = [...matchupMap.values()]
  const trackedLosses = matchups.reduce((sum, matchup) => sum + matchup.losses, 0)

  if (matchups.length === 0) {
    return {
      playerName,
      enemyName: null,
      losses: 0,
      zeroPointLosses: 0,
      trackedLosses,
      uniqueEnemies: 0,
      matchup: null,
    }
  }

  const matchup = matchups.sort(compareArchEnemyMatchups)[0]

  return {
    playerName,
    enemyName: matchup.enemyName,
    losses: matchup.losses,
    zeroPointLosses: matchup.zeroPointLosses,
    trackedLosses,
    uniqueEnemies: matchups.length,
    matchup,
  }
}

function getWinningPlayer(players: ProcessedGamePlayer[]) {
  return [...players]
    .filter((player) => player.placement === 1)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))[0] ?? null
}

function madeZeroPoints(
  playerRecord: PlayerGameRecord | undefined,
  participant: ProcessedGamePlayer,
) {
  return (playerRecord?.basePoints ?? participant.points) === ARCH_ENEMY_ZERO_POINT_VALUE
}

function compareArchEnemyMatchups(a: ArchEnemyMatchup, b: ArchEnemyMatchup) {
  return b.losses - a.losses
    || b.zeroPointLosses - a.zeroPointLosses
    || lossDayValue(b.lastLossDate) - lossDayValue(a.lastLossDate)
    || a.enemyName.localeCompare(b.enemyName)
}

function lossDayValue(value: string | Date) {
  return new Date(value).getTime()
}
