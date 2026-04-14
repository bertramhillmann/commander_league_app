import {
  getLeagueStandingMetrics,
  type PlayerGameRecord,
  type PlayerState,
  type ProcessedGame,
} from '~/composables/useLeagueState'
import type { CommanderState } from '~/composables/useLeagueState'
import {
  buildPlayerCommanderPickSuggestions,
  type PlayerCommanderPickSuggestion,
} from '~/utils/playerSuggestions'

export interface PrognosisSegment {
  games: number
  rating: number
  avgPoints: number
  winRate: number
}

export interface PlacementPrognosisExplanation {
  summary: string
  trend: string
  formula: string
  recencyNote: string
}

export interface PlacementPrognosisResult {
  hasEnoughData: boolean
  projectedRank: number | null
  totalPlayers: number
  weightedRating: number | null
  explanation: PlacementPrognosisExplanation
  commanderSuggestions: PlayerCommanderPickSuggestion[]
  segments: {
    last10: PrognosisSegment
    last20: PrognosisSegment
    overall: PrognosisSegment
  } | null
}

const MIN_GAMES_FOR_PROGNOSIS = 21
const PROGNOSIS_LAMBDA = 0.1

export function buildPlacementPrognosis(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
  commanders: Record<string, CommanderState>,
): PlacementPrognosisResult {
  const orderedRecordsByPlayer = buildOrderedRecordsByPlayer(games, gameRecords)
  const targetRecords = orderedRecordsByPlayer[playerName] ?? []

  if (targetRecords.length < MIN_GAMES_FOR_PROGNOSIS) {
    return {
      hasEnoughData: false,
      projectedRank: null,
      totalPlayers: Object.keys(orderedRecordsByPlayer).length,
      weightedRating: null,
      explanation: {
        summary: 'Not enough data for a prognosis yet.',
        trend: `This projection needs at least ${MIN_GAMES_FOR_PROGNOSIS} recorded games so the recent-form curve has enough history.`,
        formula: `Recent games are weighted with e^(-${PROGNOSIS_LAMBDA} * age), so newer results count more than older ones.`,
        recencyNote: 'Once the player reaches 21 games, the tooltip will explain whether recent form is lifting or lowering the projected rank.',
      },
      commanderSuggestions: [],
      segments: null,
    }
  }

  const overallMap = buildPlayerStateMap(orderedRecordsByPlayer, (records) => records)
  const last20Map = buildPlayerStateMap(orderedRecordsByPlayer, (records) => records.slice(-20))
  const last10Map = buildPlayerStateMap(orderedRecordsByPlayer, (records) => records.slice(-10))

  const playerRatings = Object.keys(orderedRecordsByPlayer)
    .map((name) => {
      const overall = buildSegment(overallMap, name)
      const last20 = buildSegment(last20Map, name)
      const last10 = buildSegment(last10Map, name)
      const weightedRating = computeExponentialWeightedScore(orderedRecordsByPlayer[name] ?? [])

      return { name, weightedRating, overall, last20, last10 }
    })
    .sort((a, b) => b.weightedRating - a.weightedRating || a.name.localeCompare(b.name))

  const projectedRank = playerRatings.findIndex((entry) => entry.name === playerName) + 1
  const target = playerRatings.find((entry) => entry.name === playerName)

  return {
    hasEnoughData: true,
    projectedRank: projectedRank > 0 ? projectedRank : null,
    totalPlayers: playerRatings.length,
    weightedRating: target?.weightedRating ?? null,
    explanation: buildExplanation(
      projectedRank > 0 ? projectedRank : null,
      playerRatings.length,
      target?.weightedRating ?? null,
      target?.last10 ?? null,
      target?.last20 ?? null,
      target?.overall ?? null,
    ),
    commanderSuggestions: buildCommanderSuggestions(
      playerName,
      games,
      players,
      gameRecords,
      commanders,
    ),
    segments: target
      ? {
          last10: target.last10,
          last20: target.last20,
          overall: target.overall,
        }
      : null,
  }
}

function buildOrderedRecordsByPlayer(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const orderedByPlayer: Record<string, PlayerGameRecord[]> = {}

  for (const game of games) {
    for (const [playerName, records] of Object.entries(gameRecords)) {
      const record = records[game.gameId]
      if (!record) continue
      if (!orderedByPlayer[playerName]) orderedByPlayer[playerName] = []
      orderedByPlayer[playerName].push(record)
    }
  }

  return orderedByPlayer
}

function buildPlayerStateMap(
  recordsByPlayer: Record<string, PlayerGameRecord[]>,
  pickRecords: (records: PlayerGameRecord[]) => PlayerGameRecord[],
) {
  const playerMap: Record<string, PlayerState> = {}

  for (const [playerName, records] of Object.entries(recordsByPlayer)) {
    const selectedRecords = pickRecords(records)
    if (selectedRecords.length === 0) continue
    playerMap[playerName] = buildPlayerState(playerName, selectedRecords)
  }

  return playerMap
}

function buildPlayerState(playerName: string, records: PlayerGameRecord[]): PlayerState {
  const totalPoints = round3(records.reduce((sum, record) => sum + record.finalPoints, 0))
  const totalBasePoints = round3(records.reduce((sum, record) => sum + record.basePoints, 0))
  const totalLPoints = round3(records.reduce((sum, record) => sum + record.lPoints, 0))
  const baseWins = records.filter((record) => record.placement === 1).length

  return {
    name: playerName,
    totalPoints,
    totalLPoints,
    totalBasePoints,
    baseWins,
    gamesPlayed: records.length,
    wins: baseWins,
    commanderXP: {},
    commanderTiers: {},
    earnedAchievements: [],
    achievementPoints: 0,
  }
}

function buildSegment(playerMap: Record<string, PlayerState>, playerName: string): PrognosisSegment {
  const player = playerMap[playerName]
  if (!player || player.gamesPlayed === 0) {
    return {
      games: 0,
      rating: 0,
      avgPoints: 0,
      winRate: 0,
    }
  }

  const metrics = getLeagueStandingMetrics(player, playerMap)

  return {
    games: player.gamesPlayed,
    rating: round3(metrics.totalScore / player.gamesPlayed),
    avgPoints: round3(player.totalPoints / player.gamesPlayed),
    winRate: Math.round((player.baseWins / player.gamesPlayed) * 100),
  }
}

function computeExponentialWeightedScore(records: PlayerGameRecord[]) {
  if (records.length === 0) return 0

  let weightedSum = 0
  let totalWeight = 0

  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    const age = records.length - 1 - index
    const weight = Math.exp(-PROGNOSIS_LAMBDA * age)
    weightedSum += weight * record.finalPoints
    totalWeight += weight
  }

  return totalWeight > 0 ? round3(weightedSum / totalWeight) : 0
}

function buildExplanation(
  projectedRank: number | null,
  totalPlayers: number,
  weightedRating: number | null,
  last10: PrognosisSegment | null,
  last20: PrognosisSegment | null,
  overall: PrognosisSegment | null,
): PlacementPrognosisExplanation {
  if (!projectedRank || weightedRating == null || !last10 || !last20 || !overall) {
    return {
      summary: 'No prognosis available.',
      trend: 'The player is missing enough completed data for a reliable projected placement.',
      formula: `Recent games are weighted with e^(-${PROGNOSIS_LAMBDA} * age), so newer results count more than older ones.`,
      recencyNote: 'More games will make the projection more stable.',
    }
  }

  const recentDelta = round3(weightedRating - overall.rating)
  const shortDelta = round3(last10.rating - overall.rating)
  const mediumDelta = round3(last20.rating - overall.rating)

  const direction =
    recentDelta > 0.075 ? 'above'
      : recentDelta < -0.075 ? 'below'
        : 'close to'

  const summary = `Projected at #${projectedRank} of ${totalPlayers} because the weighted score is ${round3(weightedRating)}.`
  const trend =
    direction === 'above'
      ? `Recent form is running above the long-term average: L10 ${last10.rating}, L20 ${last20.rating}, overall ${overall.rating}.`
      : direction === 'below'
        ? `Recent form is running below the long-term average: L10 ${last10.rating}, L20 ${last20.rating}, overall ${overall.rating}.`
        : `Recent form is close to the long-term average: L10 ${last10.rating}, L20 ${last20.rating}, overall ${overall.rating}.`

  const strongerSignal =
    Math.abs(shortDelta) >= Math.abs(mediumDelta)
      ? 'The last 10 games are the strongest signal.'
      : 'The last 20 games still shape the trend noticeably.'

  return {
    summary,
    trend,
    formula: `Each game gets weight e^(-${PROGNOSIS_LAMBDA} * age), so the newest results influence the projection the most.`,
    recencyNote: `${strongerSignal} Weighted score is ${round3(Math.abs(recentDelta))} ${direction === 'close to' ? 'away from' : direction} the overall rating.`,
  }
}

function buildCommanderSuggestions(
  playerName: string,
  games: ProcessedGame[],
  players: Record<string, PlayerState>,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  commanders: Record<string, CommanderState>,
) {
  return buildPlayerCommanderPickSuggestions(playerName, games, gameRecords, players, commanders)
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}
