import { type PlayerGameRecord, type PlayerState, type ProcessedGame, compareGamesChronological } from '~/composables/useLeagueState'
import { blendScore, smoothedTierScore } from '~/utils/tiers'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 5
const FAIRNESS_PULL = 0.85

export interface MatchmakingPlayerOption {
  name: string
  gamesPlayed: number
  overallStrength: number
  commanderCount: number
}

export interface MatchmakingCommanderSuggestion {
  playerName: string
  overallStrength: number
  targetStrength: number
  suggestedStrength: number
  adjustment: number
  commander: string
  commanderPlays: number
  commanderWinRate: number
  commanderAvgPoints: number
  commanderPlacement: number
  confidence: number
  explanation: string
}

export interface MatchmakingResult {
  selectedPlayers: string[]
  fairnessSpreadBefore: number
  fairnessSpreadAfter: number
  averageStrength: number
  suggestions: MatchmakingCommanderSuggestion[]
}

interface CommanderProfile {
  commander: string
  plays: number
  wins: number
  avgBasePoints: number
  avgPlacement: number
  strength: number
  confidence: number
}

export function buildMatchmakingPlayerOptions(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
): MatchmakingPlayerOption[] {
  const orderedGames = [...games].sort(compareGamesChronological)

  return Object.values(players)
    .map((player) => {
      const orderedRecords = getOrderedPlayerRecords(player.name, orderedGames, gameRecords)
      const profiles = buildCommanderProfiles(orderedRecords)
      const overallStrength = getOverallStrength(orderedRecords)

      return {
        name: player.name,
        gamesPlayed: orderedRecords.length,
        overallStrength,
        commanderCount: profiles.length,
      }
    })
    .filter((player) => player.gamesPlayed > 0 && player.commanderCount > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.overallStrength - a.overallStrength || a.name.localeCompare(b.name))
}

export function buildFairMatchmakingResult(
  selectedPlayers: string[],
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): MatchmakingResult | null {
  if (selectedPlayers.length < MIN_PLAYERS || selectedPlayers.length > MAX_PLAYERS) return null

  const orderedGames = [...games].sort(compareGamesChronological)
  const playerPools = selectedPlayers
    .map((playerName) => {
      const orderedRecords = getOrderedPlayerRecords(playerName, orderedGames, gameRecords)
      const overallStrength = getOverallStrength(orderedRecords)
      const commanders = buildCommanderProfiles(orderedRecords)

      if (orderedRecords.length === 0 || commanders.length === 0) return null

      return {
        playerName,
        overallStrength,
        commanders,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (playerPools.length < MIN_PLAYERS) return null

  const averageStrength = round3(
    playerPools.reduce((sum, player) => sum + player.overallStrength, 0) / playerPools.length,
  )

  const suggestions = playerPools.map((player) => {
    const targetStrength = clamp(
      averageStrength - ((player.overallStrength - averageStrength) * FAIRNESS_PULL),
      Math.min(...player.commanders.map((commander) => commander.strength)),
      Math.max(...player.commanders.map((commander) => commander.strength)),
    )

    const suggestedCommander = [...player.commanders]
      .sort((a, b) => {
        const distanceDiff = Math.abs(a.strength - targetStrength) - Math.abs(b.strength - targetStrength)
        if (distanceDiff !== 0) return distanceDiff
        if (b.confidence !== a.confidence) return b.confidence - a.confidence
        if (b.plays !== a.plays) return b.plays - a.plays
        return a.commander.localeCompare(b.commander)
      })[0]

    return {
      playerName: player.playerName,
      overallStrength: round3(player.overallStrength),
      targetStrength: round3(targetStrength),
      suggestedStrength: round3(suggestedCommander.strength),
      adjustment: round3(suggestedCommander.strength - player.overallStrength),
      commander: suggestedCommander.commander,
      commanderPlays: suggestedCommander.plays,
      commanderWinRate: round3(suggestedCommander.wins / suggestedCommander.plays),
      commanderAvgPoints: round3(suggestedCommander.avgBasePoints),
      commanderPlacement: round3(suggestedCommander.avgPlacement),
      confidence: round3(suggestedCommander.confidence),
      explanation: describeAdjustment(player.overallStrength, averageStrength, suggestedCommander, targetStrength),
    }
  })

  return {
    selectedPlayers: playerPools.map((player) => player.playerName),
    fairnessSpreadBefore: round3(getSpread(playerPools.map((player) => player.overallStrength))),
    fairnessSpreadAfter: round3(getSpread(suggestions.map((player) => player.suggestedStrength))),
    averageStrength,
    suggestions,
  }
}

function buildCommanderProfiles(records: PlayerGameRecord[]): CommanderProfile[] {
  const grouped = new Map<string, PlayerGameRecord[]>()

  for (const record of records) {
    const bucket = grouped.get(record.commander)
    if (bucket) bucket.push(record)
    else grouped.set(record.commander, [record])
  }

  const overallStrength = getOverallStrength(records)
  const overallAvgPoints = records.length > 0
    ? records.reduce((sum, record) => sum + record.basePoints, 0) / records.length
    : 0
  const overallWinRate = records.length > 0
    ? records.filter((record) => record.placement === 1).length / records.length
    : 0

  return [...grouped.entries()]
    .map(([commander, commanderRecords]) => {
      const plays = commanderRecords.length
      const wins = commanderRecords.filter((record) => record.placement === 1).length
      const avgBasePoints = commanderRecords.reduce((sum, record) => sum + record.basePoints, 0) / plays
      const avgPlacement = commanderRecords.reduce((sum, record) => sum + record.placement, 0) / plays
      const strength = smoothedTierScore(
        commanderRecords.reduce((sum, record) => sum + record.basePoints, 0),
        wins,
        plays,
        overallAvgPoints,
        overallWinRate,
      )

      return {
        commander,
        plays,
        wins,
        avgBasePoints: round3(avgBasePoints),
        avgPlacement: round3(avgPlacement),
        strength: round3(Math.max(strength, overallStrength - 0.5)),
        confidence: round3(Math.min(1, plays / 6)),
      }
    })
    .sort((a, b) => b.strength - a.strength || b.plays - a.plays || a.commander.localeCompare(b.commander))
}

function getOrderedPlayerRecords(
  playerName: string,
  orderedGames: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const records = gameRecords[playerName] ?? {}

  return orderedGames
    .map((game) => records[game.gameId])
    .filter((record): record is PlayerGameRecord => Boolean(record))
}

function getOverallStrength(records: PlayerGameRecord[]) {
  if (records.length === 0) return 0

  const avgBasePoints = records.reduce((sum, record) => sum + record.basePoints, 0) / records.length
  const winRate = records.filter((record) => record.placement === 1).length / records.length
  return round3(blendScore(avgBasePoints, winRate))
}

function getSpread(values: number[]) {
  if (values.length === 0) return 0
  const min = Math.min(...values)
  const max = Math.max(...values)
  return max - min
}

function describeAdjustment(
  playerStrength: number,
  averageStrength: number,
  commander: CommanderProfile,
  targetStrength: number,
) {
  if (playerStrength > averageStrength + 0.03) {
    return `${commander.commander} reins this player in toward the pod average without forcing a completely cold pick.`
  }

  if (playerStrength < averageStrength - 0.03) {
    return `${commander.commander} is one of this player's better-performing lanes, which helps lift them closer to the pod average.`
  }

  if (Math.abs(commander.strength - targetStrength) <= 0.03) {
    return `${commander.commander} lands almost exactly on the target strength for this pod.`
  }

  return `${commander.commander} keeps this player close to their normal level while still smoothing the pod matchup.`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}
