import type { PlayerGameRecord, ProcessedGame } from '~/utils/league/engine'
import { calculateCommanderMMRChanges } from '~/composables/useCommanderMMR'

export interface ArchEnemyMatchup {
  enemyName: string
  mmrLost: number
  damagingGames: number
  lastLossGameId: string
  lastLossDate: string | Date
}

export interface ArchEnemySummary {
  playerName: string
  enemyName: string | null
  mmrLost: number
  damagingGames: number
  trackedMmrLost: number
  uniqueEnemies: number
  matchup: ArchEnemyMatchup | null
}

type ArchEnemyMap = Map<string, Map<string, ArchEnemyMatchup>>

export function buildArchEnemyMap(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const playerEnemyMap: ArchEnemyMap = new Map()

  for (const game of games) {
    addGameToArchEnemyMap(playerEnemyMap, game, gameRecords)
  }

  return playerEnemyMap
}

/**
 * Keeps the arch-enemy map in sync while games are appended in order, so the
 * league replay does not rebuild it from scratch for every winner.
 */
export function createArchEnemyTracker() {
  const playerEnemyMap: ArchEnemyMap = new Map()

  return {
    addGame(game: ProcessedGame, gameRecords: Record<string, Record<string, PlayerGameRecord>>) {
      addGameToArchEnemyMap(playerEnemyMap, game, gameRecords)
    },
    getSummary(playerName: string): ArchEnemySummary {
      return summarizeArchEnemies(playerName, playerEnemyMap)
    },
  }
}

function addGameToArchEnemyMap(
  playerEnemyMap: ArchEnemyMap,
  game: ProcessedGame,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const podEntries = game.players
    .map((participant, index) => {
      const record = gameRecords[participant.name]?.[game.gameId]
      if (!record) return null

      return {
        playerName: participant.name,
        commanderId: `${participant.name}::${participant.commander}::${index}`,
        commanderName: participant.commander,
        currentMMR: record.commanderMMRBefore,
        placement: participant.placement,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  if (podEntries.length < 2) return

  const mmrChanges = calculateCommanderMMRChanges(
    podEntries.map((entry) => ({
      commanderId: entry.commanderId,
      commanderName: entry.commanderName,
      currentMMR: entry.currentMMR,
      placement: entry.placement,
    })),
  )

  const playerByCommanderId = new Map(podEntries.map((entry) => [entry.commanderId, entry]))

  for (const change of mmrChanges) {
    const playerEntry = playerByCommanderId.get(change.commanderId)
    if (!playerEntry) continue

    for (const matchup of change.matchups) {
      if (matchup.result !== 'loss' || matchup.scaledDelta >= 0) continue

      const opponentEntry = playerByCommanderId.get(matchup.opponentCommanderId)
      if (!opponentEntry || opponentEntry.playerName === playerEntry.playerName) continue

      const mmrLost = Math.abs(matchup.scaledDelta)
      if (!Number.isFinite(mmrLost) || mmrLost <= 0) continue
      const playerMap = playerEnemyMap.get(playerEntry.playerName) ?? new Map<string, ArchEnemyMatchup>()
      const current = playerMap.get(opponentEntry.playerName)

      const next: ArchEnemyMatchup = current
        ? {
            ...current,
            mmrLost: round3(current.mmrLost + mmrLost),
            damagingGames: current.damagingGames + 1,
            lastLossGameId: game.gameId,
            lastLossDate: game.date,
          }
        : {
            enemyName: opponentEntry.playerName,
            mmrLost: round3(mmrLost),
            damagingGames: 1,
            lastLossGameId: game.gameId,
            lastLossDate: game.date,
          }

      playerMap.set(opponentEntry.playerName, next)
      playerEnemyMap.set(playerEntry.playerName, playerMap)
    }
  }
}

export function getArchEnemySummary(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): ArchEnemySummary {
  return summarizeArchEnemies(playerName, buildArchEnemyMap(games, gameRecords))
}

function summarizeArchEnemies(playerName: string, playerEnemyMap: ArchEnemyMap): ArchEnemySummary {
  const matchupMap = playerEnemyMap.get(playerName) ?? new Map<string, ArchEnemyMatchup>()
  const matchups = [...matchupMap.values()]
  const trackedMmrLost = round3(matchups.reduce((sum, matchup) => sum + matchup.mmrLost, 0))

  if (matchups.length === 0) {
    return {
      playerName,
      enemyName: null,
      mmrLost: 0,
      damagingGames: 0,
      trackedMmrLost,
      uniqueEnemies: 0,
      matchup: null,
    }
  }

  const matchup = matchups.sort(compareArchEnemyMatchups)[0]

  return {
    playerName,
    enemyName: matchup.enemyName,
    mmrLost: matchup.mmrLost,
    damagingGames: matchup.damagingGames,
    trackedMmrLost,
    uniqueEnemies: matchups.length,
    matchup,
  }
}

function compareArchEnemyMatchups(a: ArchEnemyMatchup, b: ArchEnemyMatchup) {
  return b.mmrLost - a.mmrLost
    || b.damagingGames - a.damagingGames
    || lossDayValue(b.lastLossDate) - lossDayValue(a.lastLossDate)
    || a.enemyName.localeCompare(b.enemyName)
}

function lossDayValue(value: string | Date) {
  return new Date(value).getTime()
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}
