import {
  computeGamePoints,
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MIN,
  PERF_MULT_MAX,
} from '~/utils/placements'
import { applyModifiers, type ModifierResult } from '~/utils/modifiers'
import { calculateXPGained, consumeCommanderRest, xpToLevel } from '~/utils/commanderExperience'
import { getAchievementDefinition, type EarnedAchievement } from '~/utils/achievements'
import { getMissedGameLoosterPoints, roundLoosterPoints } from '~/utils/loosterPoints'
import { formatPlayerName } from '~/utils/playerNames'
import { createArchEnemyTracker } from '~/utils/archEnemy'
import { getFeaturedPlayerName } from '~/utils/featuredPlayer'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'
import {
  buildLeagueSeasonRanges,
  getCachedResolvedLeagueSettings,
  getResolvedLeagueSettings,
  hasActiveSeasonalRanking,
  MIN_GAMES_FOR_PENALTY_MODE,
  setRuntimeLeagueSettings,
  type LeagueSeasonRange,
  type LeagueSettingsDocument,
  type PlayerRankingSystem,
  type StandingsAdjustmentMode,
} from '~/utils/leagueSettings'
import type { CommanderTitleId } from '~/utils/titles'
import {
  calculateCommanderMMRChanges,
  getCommanderTierFromMMR,
  getInitialCommanderMMR,
  type CommanderMMRTier,
} from '~/composables/useCommanderMMR'
import {
  calculatePlayerRatings,
  calculatePlayerRatingValues,
  type PlayerRatingResult,
} from '~/composables/usePlayerRating'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedGamePlayer {
  name: string
  commander: string
  placement: number
  points: number
  lPoints: number
  eliminations: number | null
  commanderCasts: number | null
  decklist?: {
    deckId: string
    name: string
    owner: string
    url: string
    cards: {
      name: string
      quantity: number
      categories: string[]
    }[]
  } | null
}

export interface ProcessedGame {
  gameId: string
  date: string | Date
  week: number
  hidden?: boolean
  players: ProcessedGamePlayer[]
}

export interface PlayerGameRecord {
  gameId: string
  playerName: string
  commander: string
  placement: number
  basePoints: number
  lPoints: number
  lPointModifier?: LPointModifierResult | null
  modifiers: ModifierResult[]
  finalPoints: number
  ratingBefore: number
  ratingAfter: number
  commanderMMRBefore: number
  commanderMMRAfter: number
  commanderMMRDelta: number
  rankBefore: number
  rankAfter: number
  commanderXpBefore: number
  commanderXpAfter: number
  commanderLevelBefore: number
  commanderLevelAfter: number
  playerCount: number
  /** Achievements earned in this specific game */
  achievements: EarnedAchievement[]
}

export interface LPointModifierResult {
  enabled: boolean
  baseLPoints: number
  adjustedLPoints: number
  multiplier: number
  percent: number
  playerRatingBefore: number
  podAveragePlayerRating: number
  commanderMmrBefore: number
  podAverageCommanderMmr: number
  combinedRatio: number
  reason: 'stronger_pod' | 'weaker_pod' | 'neutral_pod'
}

export interface PlayerState {
  name: string
  totalPoints: number
  totalLPoints: number
  totalBasePoints: number
  baseWins: number
  gamesPlayed: number
  wins: number
  commanderXP: Record<string, number>
  commanderRested: Record<string, number>
  commanderTiers: Record<string, CommanderMMRTier>
  earnedAchievements: EarnedAchievement[]
  achievementPoints: number
}

export type CommanderTitleSelectionMap = Record<string, Record<string, CommanderTitleId>>

export interface CommanderState {
  id: string
  playerName: string
  name: string
  totalPoints: number
  totalBasePoints: number
  totalLPoints: number
  gamesPlayed: number
  wins: number
  uniquePlayers: string[]
  mmr: number
  tier: CommanderMMRTier
}

/** A deck's rating state belongs to its owner, never to a commander name globally. */
export function getCommanderId(playerName: string, commanderName: string) {
  return `${normalizeDeckIdentityKey(playerName)}_${normalizeDeckIdentityKey(commanderName)}`
}

export interface LeagueStanding {
  name: string
  totalScore: number
  rank: number
  rankingSystem?: PlayerRankingSystem
  playerRating?: number
  provisional?: boolean
  ratingBreakdown?: PlayerRatingResult['breakdown']
  totalPoints: number
  adjustmentMode: StandingsAdjustmentMode
  adjustmentPoints: number
  adjustmentDisplayPoints: number
  adjustedTotalPoints: number
  projectedPoints: number
  compensatedTotalPoints: number
  achievementPoints: number
  xpPoints: number
  perfMult: number
  gamesPlayed: number
  baseWins: number
  avgPerGame: number
  totalLPoints: number
  seasonScores?: Array<number | null>
  playedSeasonCount?: number
}

export interface LeagueSnapshotEntry {
  rank: number
  totalScore: number
}

export interface LeagueStandingMetrics {
  totalScore: number
  totalPoints: number
  adjustmentMode: StandingsAdjustmentMode
  adjustmentPoints: number
  adjustmentDisplayPoints: number
  adjustedTotalPoints: number
  projectedPoints: number
  compensatedTotalPoints: number
  achievementPoints: number
  xpPoints: number
  perfMult: number
  gamesPlayed: number
  baseWins: number
  avgPerGame: number
  totalLPoints: number
}

export interface PlayerCommanderMetrics {
  plays: number
  first: number
  second: number
  last: number
  winRate: number
  avgBasePoints: number
  avgPlacement: number
  bestGame: number
  totalBasePoints: number
  totalFinalPoints: number
  totalLPoints: number
  totalLosses: number
  achievementPoints: number
  xpPoints: number
}

export interface PlayerCommanderPerformanceEdgeMetrics {
  withGames: number
  withoutGames: number
  withAvg: number
  withoutAvg: number
  rawEdge: number
  weightedEdge: number
  confidence: number
  pickRate: number
  importanceScore: number
  hasLowCommanderSample: boolean
  hasLowPoolSample: boolean
  isReliable: boolean
}

function createEmptyPlayerState(name: string): PlayerState {
  return {
    name,
    totalPoints: 0,
    totalLPoints: 0,
    totalBasePoints: 0,
    baseWins: 0,
    gamesPlayed: 0,
    wins: 0,
    commanderXP: {},
    commanderRested: {},
    commanderTiers: {},
    earnedAchievements: [],
    achievementPoints: 0,
  }
}

function calculateLPointModifier(
  placement: number,
  baseLPoints: number,
  playerRatingBefore: number,
  podAveragePlayerRating: number,
  commanderMmrBefore: number,
  podAverageCommanderMmr: number,
  enabled: boolean,
): LPointModifierResult | null {
  if (!enabled || placement <= 1 || baseLPoints <= 0) return null

  const safePlayerAverage = podAveragePlayerRating > 0 ? podAveragePlayerRating : 1
  const safeCommanderAverage = podAverageCommanderMmr > 0 ? podAverageCommanderMmr : 1
  const playerRatio = playerRatingBefore / safePlayerAverage
  const commanderRatio = commanderMmrBefore / safeCommanderAverage
  const combinedRatio = round3((playerRatio + commanderRatio) / 2)

  let percent = 0
  let reason: LPointModifierResult['reason'] = 'neutral_pod'

  if (combinedRatio < 1) {
    percent = Math.min(100, ((1 - combinedRatio) / 0.5) * 100)
    reason = 'stronger_pod'
  } else if (combinedRatio > 1) {
    percent = -Math.min(100, ((combinedRatio - 1) / 1) * 100)
    reason = 'weaker_pod'
  }

  const multiplier = round3(Math.max(0, 1 + (percent / 100)))
  const adjustedLPoints = roundLoosterPoints(baseLPoints * multiplier)

  return {
    enabled,
    baseLPoints,
    adjustedLPoints,
    multiplier,
    percent: round3(percent),
    playerRatingBefore: round3(playerRatingBefore),
    podAveragePlayerRating: round3(podAveragePlayerRating),
    commanderMmrBefore: round3(commanderMmrBefore),
    podAverageCommanderMmr: round3(podAverageCommanderMmr),
    combinedRatio,
    reason,
  }
}

export function compareGameIdsAscending(a: string, b: string) {
  const aNum = extractGameIdNumber(a)
  const bNum = extractGameIdNumber(b)
  if (aNum !== bNum) return aNum - bNum
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function compareGamesChronological(
  a: Pick<ProcessedGame, 'date' | 'gameId'>,
  b: Pick<ProcessedGame, 'date' | 'gameId'>,
) {
  const dateDiff = gameDayValue(a.date) - gameDayValue(b.date)
  if (dateDiff !== 0) return dateDiff
  return compareGameIdsAscending(a.gameId, b.gameId)
}

export interface SeasonAverageCache {
  active: boolean
  seasons: LeagueSeasonRange[]
  timestampByGameId: Map<string, number | null>
}

function buildSeasonAverageCache(
  games: ProcessedGame[],
  resolvedSettings: ReturnType<typeof getResolvedLeagueSettings>,
): SeasonAverageCache {
  const seasonalRanking = resolvedSettings.standings.seasonalRanking
  const active = hasActiveSeasonalRanking(seasonalRanking)
  return {
    active,
    seasons: active ? buildLeagueSeasonRanges(seasonalRanking) : [],
    timestampByGameId: active ? buildGameTimestampMap(games) : new Map(),
  }
}

function buildGameTimestampMap(games: ProcessedGame[]) {
  return new Map(
    games.map((game) => {
      const timestamp = new Date(game.date).getTime()
      return [game.gameId, Number.isNaN(timestamp) ? null : timestamp] as const
    }),
  )
}

export function calculatePlayerSeasonAverages(
  playerName: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  settings?: LeagueSettingsDocument | null,
  referenceDate = new Date(),
  cache?: SeasonAverageCache,
) {
  const seasonalRanking = getResolvedLeagueSettings(settings).standings.seasonalRanking
  if (!(cache ? cache.active : hasActiveSeasonalRanking(seasonalRanking))) {
    return {
      enabled: false,
      totalAverage: 0,
      playedSeasonCount: 0,
      seasonScores: [] as Array<number | null>,
      seasons: [] as Array<{ label: string; startDate: string; endDate: string; started: boolean; score: number | null }>,
    }
  }

  const seasons = cache ? cache.seasons : buildLeagueSeasonRanges(seasonalRanking)
  const referenceMs = referenceDate.getTime()
  const playerRecords = gameRecords[playerName] ?? {}
  const playerRecordList = Object.values(playerRecords)
  const timestampByGameId = cache ? cache.timestampByGameId : buildGameTimestampMap(games)

  const seasonEntries = seasons.map((season) => {
    const started = season.startMs <= referenceMs
    if (!started) {
      return { ...season, started, score: null as number | null }
    }

    const seasonRecords = playerRecordList.filter((record) => {
      const timestamp = timestampByGameId.get(record.gameId)
      return timestamp !== null && timestamp !== undefined && timestamp >= season.startMs && timestamp <= season.endMs
    })
    const score = seasonRecords.length > 0
      ? round3(seasonRecords.reduce((sum, record) => sum + record.finalPoints, 0) / seasonRecords.length)
      : null

    return { ...season, started, score }
  })

  const playedSeasonScores = seasonEntries
    .filter((season): season is typeof season & { score: number } => season.started && season.score !== null)
    .map((season) => season.score)
  const totalAverage = playedSeasonScores.length > 0
    ? round3(playedSeasonScores.reduce((sum, score) => sum + score, 0) / playedSeasonScores.length)
    : 0

  return {
    enabled: true,
    totalAverage,
    playedSeasonCount: playedSeasonScores.length,
    seasonScores: seasonEntries.map((season) => season.score),
    seasons: seasonEntries.map((season) => ({
      label: season.label,
      startDate: season.startDate,
      endDate: season.endDate,
      started: season.started,
      score: season.score,
    })),
  }
}

export function compareGamesForDisplay(
  a: Pick<ProcessedGame, 'date' | 'gameId'>,
  b: Pick<ProcessedGame, 'date' | 'gameId'>,
) {
  const dateDiff = gameDayValue(b.date) - gameDayValue(a.date)
  if (dateDiff !== 0) return dateDiff
  return compareGameIdsAscending(b.gameId, a.gameId)
}

export function getXpPoints(player: PlayerState) {
  const { level } = getCachedResolvedLeagueSettings()
  return getXpPointsWithThresholds(player, level.thresholds, level.pointsPerLevel)
}

function getXpPointsWithThresholds(
  player: Pick<PlayerState, 'commanderXP'>,
  thresholds: number[],
  pointsPerLevel: number,
) {
  return Object.values(player.commanderXP).reduce(
    (sum, xp) => sum + (xpToLevelWithThresholds(xp, thresholds) * pointsPerLevel),
    0,
  )
}

function xpToLevelWithThresholds(xp: number, thresholds: number[]) {
  let level = 1
  for (let index = 1; index < thresholds.length; index++) {
    if (xp >= thresholds[index]) level = index + 1
    else break
  }
  return Math.min(level, 20)
}

export function getLeagueAveragePerGame(playerMap: Record<string, PlayerState>) {
  const allPlayers = Object.values(playerMap)
  const totalGames = allPlayers.reduce((sum, player) => sum + player.gamesPlayed, 0)
  const totalPoints = allPlayers.reduce((sum, player) => sum + player.totalPoints, 0)
  return totalGames > 0 ? totalPoints / totalGames : 1
}

const PROJECTED_GAMES_DECAY_FACTOR = 6
const PROJECTED_GAMES_MAX = 30
// const PROJECTED_GAME_VALUE_FACTOR = 0.7
// const PROJECTED_SAMPLE_SMOOTHING = 8

export interface ProjectedPointsResult {
  projectedPoints: number
  compensatedTotalPoints: number
  missingGames: number
  cappedMissingGames: number
  maxGamesPlayed: number
  leagueFloorScore: number
  averageScore: number
  sampleFactor: number
  decayFactor: number
  projectedGameValueFactor: number
  maxProjectedGames: number
  sampleSmoothingGames: number
}

export interface StandingAdjustmentContext {
  games?: ProcessedGame[]
  gameRecords?: Record<string, Record<string, PlayerGameRecord>>
  /** `games` sorted chronologically, shared by every player's free-games calculation. */
  orderedGames?: ProcessedGame[]
  seasonAverageCache?: SeasonAverageCache
}

export interface StandingAdjustmentResult {
  adjustmentMode: StandingsAdjustmentMode
  adjustmentPoints: number
  adjustmentDisplayPoints: number
  adjustedTotalPoints: number
  missingGames: number
  cappedMissingGames: number
  maxGamesPlayed: number
  leagueFloorScore: number
  averageScore: number
  sampleFactor: number
  decayFactor: number
  projectedGameValueFactor: number
  maxProjectedGames: number
  sampleSmoothingGames: number
  baselineAvgPoints: number
  consecutiveMissPenalty: number
  minimumAvgPoints: number
  graceMisses: number
  lowestGamesPlayed: number
  gameGap: number
  penaltyFactor: number
}

export interface FreeGameAwardEntry {
  playerName: string
  awardedPoints: number
  averagePointsAtTime: number
  consecutiveMissesBefore: number
  penaltyPoints: number
  inGracePeriod: boolean
  isPreParticipation: boolean
}

interface FreeGameProgress {
  playedGames: number
  playedPoints: number
  consecutiveMisses: number
}

export function calculateProjectedPoints(
  player: Pick<PlayerState, 'totalPoints' | 'gamesPlayed'>,
  playerMap: Record<string, Pick<PlayerState, 'totalPoints' | 'gamesPlayed'>>,
  options?: {
    decayFactor?: number
    maxProjectedGames?: number
    projectedGameValueFactor?: number
    sampleSmoothingGames?: number
  },
): ProjectedPointsResult {
  const decayFactor = Math.max(options?.decayFactor ?? PROJECTED_GAMES_DECAY_FACTOR, 0.001)
  const baseMaxProjectedGames = Math.max(0, Math.floor(options?.maxProjectedGames ?? PROJECTED_GAMES_MAX))
  // Temporary raw projection mode: missed games count at full value.
  const projectedGameValueFactor = 1
  const sampleSmoothingGames = 0

  const allPlayers = Object.values(playerMap)
  const maxGamesPlayed = allPlayers.reduce((maxGames, candidate) => Math.max(maxGames, candidate.gamesPlayed), 0)
  const activePlayers = allPlayers.filter((candidate) => candidate.gamesPlayed > 0)
  const leagueFloorScore = activePlayers.length > 0
    ? Math.min(...activePlayers.map((candidate) => candidate.totalPoints / candidate.gamesPlayed))
    : 0

  const missingGames = Math.max(0, maxGamesPlayed - player.gamesPlayed)
  const maxProjectedGames = Math.max(baseMaxProjectedGames, player.gamesPlayed)
  const cappedMissingGames = Math.min(missingGames, maxProjectedGames)
  const averageScore = player.gamesPlayed > 0 ? player.totalPoints / player.gamesPlayed : leagueFloorScore
  const sampleFactor = 1

  let projectedPoints = 0
  for (let i = 1; i <= cappedMissingGames; i++) {
    const confidence = Math.exp(-i / decayFactor)
    const projectedGameScore =
      (averageScore * confidence) +
      (leagueFloorScore * (1 - confidence))

    projectedPoints += projectedGameScore * projectedGameValueFactor * sampleFactor
  }

  const roundedProjectedPoints = round3(projectedPoints)
  return {
    projectedPoints: roundedProjectedPoints,
    compensatedTotalPoints: round3(player.totalPoints + roundedProjectedPoints),
    missingGames,
    cappedMissingGames,
    maxGamesPlayed,
    leagueFloorScore: round3(leagueFloorScore),
    averageScore: round3(averageScore),
    sampleFactor: round3(sampleFactor),
    decayFactor: round3(decayFactor),
    projectedGameValueFactor: round3(projectedGameValueFactor),
    maxProjectedGames,
    sampleSmoothingGames: round3(sampleSmoothingGames),
  }
}

export function calculateStandingsAdjustment(
  player: Pick<PlayerState, 'name' | 'totalPoints' | 'gamesPlayed'>,
  playerMap: Record<string, Pick<PlayerState, 'name' | 'totalPoints' | 'gamesPlayed'>>,
  settings?: LeagueSettingsDocument | null,
  context?: StandingAdjustmentContext,
): StandingAdjustmentResult {
  const resolvedSettings = getResolvedLeagueSettings(settings)
  if (resolvedSettings.playerRankingSystem === 'player_rating_based') {
    return {
      adjustmentMode: resolvedSettings.standings.adjustmentMode,
      adjustmentPoints: 0,
      adjustmentDisplayPoints: 0,
      adjustedTotalPoints: round3(player.totalPoints),
      missingGames: 0,
      cappedMissingGames: 0,
      maxGamesPlayed: 0,
      leagueFloorScore: 0,
      averageScore: player.gamesPlayed > 0 ? round3(player.totalPoints / player.gamesPlayed) : 0,
      sampleFactor: 0,
      decayFactor: 0,
      projectedGameValueFactor: 0,
      maxProjectedGames: 0,
      sampleSmoothingGames: 0,
      baselineAvgPoints: 0,
      consecutiveMissPenalty: 0,
      minimumAvgPoints: 0,
      graceMisses: 0,
      lowestGamesPlayed: 0,
      gameGap: 0,
      penaltyFactor: 0,
    }
  }
  const mode = resolvedSettings.standings.adjustmentMode

  if (mode === 'freeGames') {
    const freeGamesPoints = calculateFreeGamesPoints(player.name, resolvedSettings, context)
    return {
      adjustmentMode: mode,
      adjustmentPoints: freeGamesPoints,
      adjustmentDisplayPoints: freeGamesPoints,
      adjustedTotalPoints: round3(player.totalPoints + freeGamesPoints),
      missingGames: 0,
      cappedMissingGames: 0,
      maxGamesPlayed: 0,
      leagueFloorScore: 0,
      averageScore: player.gamesPlayed > 0 ? round3(player.totalPoints / player.gamesPlayed) : 0,
      sampleFactor: 0,
      decayFactor: 0,
      projectedGameValueFactor: 0,
      maxProjectedGames: 0,
      sampleSmoothingGames: 0,
      baselineAvgPoints: resolvedSettings.standings.freeGamesBaselineAvg,
      consecutiveMissPenalty: resolvedSettings.standings.freeGamesConsecutivePenalty,
      minimumAvgPoints: resolvedSettings.standings.freeGamesMinimumAvg,
      graceMisses: resolvedSettings.standings.freeGamesGraceMisses,
      lowestGamesPlayed: 0,
      gameGap: 0,
      penaltyFactor: 0,
    }
  }

  if (mode === 'penaltyGames') {
    const penaltyPoints = calculatePenaltyPoints(player, playerMap, resolvedSettings.standings.penaltyFactor)
    return {
      adjustmentMode: mode,
      adjustmentPoints: -penaltyPoints,
      adjustmentDisplayPoints: penaltyPoints,
      adjustedTotalPoints: round3(player.totalPoints - penaltyPoints),
      missingGames: 0,
      cappedMissingGames: 0,
      maxGamesPlayed: 0,
      leagueFloorScore: 0,
      averageScore: player.gamesPlayed > 0 ? round3(player.totalPoints / player.gamesPlayed) : 0,
      sampleFactor: 0,
      decayFactor: 0,
      projectedGameValueFactor: 0,
      maxProjectedGames: 0,
      sampleSmoothingGames: 0,
      baselineAvgPoints: 0,
      consecutiveMissPenalty: 0,
      minimumAvgPoints: 0,
      graceMisses: 0,
      lowestGamesPlayed: getPenaltyBaselineGames(playerMap),
      gameGap: Math.max(0, player.gamesPlayed - getPenaltyBaselineGames(playerMap)),
      penaltyFactor: resolvedSettings.standings.penaltyFactor,
    }
  }

  const projection = calculateProjectedPoints(player, playerMap)
  return {
    adjustmentMode: mode,
    adjustmentPoints: projection.projectedPoints,
    adjustmentDisplayPoints: projection.projectedPoints,
    adjustedTotalPoints: projection.compensatedTotalPoints,
    missingGames: projection.missingGames,
    cappedMissingGames: projection.cappedMissingGames,
    maxGamesPlayed: projection.maxGamesPlayed,
    leagueFloorScore: projection.leagueFloorScore,
    averageScore: projection.averageScore,
    sampleFactor: projection.sampleFactor,
    decayFactor: projection.decayFactor,
    projectedGameValueFactor: projection.projectedGameValueFactor,
    maxProjectedGames: projection.maxProjectedGames,
    sampleSmoothingGames: projection.sampleSmoothingGames,
    baselineAvgPoints: 0,
    consecutiveMissPenalty: 0,
    minimumAvgPoints: 0,
    graceMisses: 0,
    lowestGamesPlayed: 0,
    gameGap: 0,
    penaltyFactor: 0,
  }
}

function calculateFreeGamesPoints(
  playerName: string,
  settings: ReturnType<typeof getResolvedLeagueSettings>,
  context?: StandingAdjustmentContext,
) {
  const orderedGames = context?.orderedGames ?? [...(context?.games ?? [])].sort(compareGamesChronological)
  const playerRecords = context?.gameRecords?.[playerName] ?? {}

  if (orderedGames.length === 0) return 0

  let playedGames = 0
  let playedPoints = 0
  let consecutiveMisses = 0
  let freeGamesPoints = 0

  for (const game of orderedGames) {
    const record = playerRecords[game.gameId]

    if (record) {
      playedPoints = round3(playedPoints + record.finalPoints)
      playedGames += 1
      consecutiveMisses = 0
      continue
    }

    const award = calculateFreeGameAward(
      { playedGames, playedPoints, consecutiveMisses },
      settings,
    )
    freeGamesPoints = round3(freeGamesPoints + award.awardedPoints)
    consecutiveMisses += 1
  }

  return round3(freeGamesPoints)
}

function calculateFreeGameAward(
  stats: FreeGameProgress,
  settings: ReturnType<typeof getResolvedLeagueSettings>,
) {
  const isPreParticipation = stats.playedGames === 0
  const averagePointsAtTime = isPreParticipation
    ? settings.standings.freeGamesBaselineAvg
    : (stats.playedPoints / stats.playedGames)
  const inGracePeriod = !isPreParticipation && stats.consecutiveMisses < settings.standings.freeGamesGraceMisses
  const penaltyPoints = isPreParticipation || inGracePeriod
    ? 0
    : (stats.consecutiveMisses * settings.standings.freeGamesConsecutivePenalty)
  const awardedPoints = isPreParticipation
    ? settings.standings.freeGamesBaselineAvg
    : inGracePeriod
      ? 0
      : Math.max(
        settings.standings.freeGamesMinimumAvg,
        averagePointsAtTime - penaltyPoints,
      )

  return {
    awardedPoints: round3(awardedPoints),
    averagePointsAtTime: round3(averagePointsAtTime),
    consecutiveMissesBefore: stats.consecutiveMisses,
    penaltyPoints: round3(penaltyPoints),
    inGracePeriod,
    isPreParticipation,
  }
}

export function getFreeGameAwardsForGame(
  gameId: string,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerNames: string[],
  settings?: LeagueSettingsDocument | null,
): FreeGameAwardEntry[] {
  const resolvedSettings = getResolvedLeagueSettings(settings)
  if (resolvedSettings.standings.adjustmentMode !== 'freeGames') return []

  const orderedGames = [...games].sort(compareGamesChronological)
  const playerStats = Object.fromEntries(
    playerNames.map((playerName) => [playerName, {
      playedGames: 0,
      playedPoints: 0,
      consecutiveMisses: 0,
    }]),
  ) as Record<string, { playedGames: number; playedPoints: number; consecutiveMisses: number }>

  for (const game of orderedGames) {
    const gamePlayerNames = new Set(game.players.map((player) => formatPlayerName(player.name)))

    if (game.gameId === gameId) {
      return playerNames
        .filter((playerName) => !gamePlayerNames.has(playerName))
        .map((playerName) => {
          const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
          const award = calculateFreeGameAward(stats, resolvedSettings)

          return {
            playerName,
            awardedPoints: award.awardedPoints,
            averagePointsAtTime: award.averagePointsAtTime,
            consecutiveMissesBefore: award.consecutiveMissesBefore,
            penaltyPoints: award.penaltyPoints,
            inGracePeriod: award.inGracePeriod,
            isPreParticipation: award.isPreParticipation,
          }
        })
        .sort((a, b) => b.awardedPoints - a.awardedPoints || a.playerName.localeCompare(b.playerName))
    }

    for (const playerName of playerNames) {
      const record = gameRecords[playerName]?.[game.gameId]
      if (record) {
        const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
        stats.playedGames += 1
        stats.playedPoints = round3(stats.playedPoints + record.finalPoints)
        stats.consecutiveMisses = 0
        playerStats[playerName] = stats
      } else {
        const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
        stats.consecutiveMisses += 1
        playerStats[playerName] = stats
      }
    }
  }

  return []
}

/**
 * `getFreeGameAwardsForGame` for every game in one chronological pass
 * (instead of one full replay per game card). Returns an empty map when the
 * active ranking system does not use free games.
 */
export function buildFreeGameAwardsByGame(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  playerNames: string[],
  settings?: LeagueSettingsDocument | null,
): Map<string, FreeGameAwardEntry[]> {
  const awardsByGame = new Map<string, FreeGameAwardEntry[]>()
  const resolvedSettings = getResolvedLeagueSettings(settings)
  if (resolvedSettings.standings.adjustmentMode !== 'freeGames') return awardsByGame

  const playerStats = Object.fromEntries(
    playerNames.map((playerName) => [playerName, {
      playedGames: 0,
      playedPoints: 0,
      consecutiveMisses: 0,
    }]),
  ) as Record<string, { playedGames: number; playedPoints: number; consecutiveMisses: number }>

  for (const game of [...games].sort(compareGamesChronological)) {
    const gamePlayerNames = new Set(game.players.map((player) => formatPlayerName(player.name)))

    // The per-game function returns at the first game with a matching id.
    if (!awardsByGame.has(game.gameId)) {
      awardsByGame.set(game.gameId, playerNames
        .filter((playerName) => !gamePlayerNames.has(playerName))
        .map((playerName) => {
          const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
          const award = calculateFreeGameAward(stats, resolvedSettings)

          return {
            playerName,
            awardedPoints: award.awardedPoints,
            averagePointsAtTime: award.averagePointsAtTime,
            consecutiveMissesBefore: award.consecutiveMissesBefore,
            penaltyPoints: award.penaltyPoints,
            inGracePeriod: award.inGracePeriod,
            isPreParticipation: award.isPreParticipation,
          }
        })
        .sort((a, b) => b.awardedPoints - a.awardedPoints || a.playerName.localeCompare(b.playerName)))
    }

    for (const playerName of playerNames) {
      const record = gameRecords[playerName]?.[game.gameId]
      if (record) {
        const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
        stats.playedGames += 1
        stats.playedPoints = round3(stats.playedPoints + record.finalPoints)
        stats.consecutiveMisses = 0
        playerStats[playerName] = stats
      } else {
        const stats = playerStats[playerName] ?? { playedGames: 0, playedPoints: 0, consecutiveMisses: 0 }
        stats.consecutiveMisses += 1
        playerStats[playerName] = stats
      }
    }
  }

  return awardsByGame
}

function getPenaltyBaselineGames(
  playerMap: Record<string, Pick<PlayerState, 'gamesPlayed'>>,
) {
  const eligibleGamesPlayed = Object.values(playerMap)
    .map((candidate) => candidate.gamesPlayed)
    .filter((gamesPlayed) => gamesPlayed >= MIN_GAMES_FOR_PENALTY_MODE)

  return eligibleGamesPlayed.length > 0 ? Math.min(...eligibleGamesPlayed) : 0
}

function calculatePenaltyPoints(
  player: Pick<PlayerState, 'totalPoints' | 'gamesPlayed'>,
  playerMap: Record<string, Pick<PlayerState, 'gamesPlayed'>>,
  penaltyFactor: number,
) {
  const lowestGamesPlayed = getPenaltyBaselineGames(playerMap)
  if (lowestGamesPlayed < MIN_GAMES_FOR_PENALTY_MODE || player.gamesPlayed <= lowestGamesPlayed) return 0

  const gameGap = player.gamesPlayed - lowestGamesPlayed
  const averageScore = player.gamesPlayed > 0 ? player.totalPoints / player.gamesPlayed : 0
  return round3(gameGap * averageScore * penaltyFactor)
}

export function getLeagueStandingMetrics(
  player: PlayerState,
  playerMap: Record<string, PlayerState>,
  settings?: LeagueSettingsDocument | null,
  context?: StandingAdjustmentContext,
): LeagueStandingMetrics {
  const resolvedSettings = getResolvedLeagueSettings(settings)
  const xpPoints = resolvedSettings.standings.includeCommanderXp
    ? getXpPointsWithThresholds(
      player,
      resolvedSettings.level.thresholds,
      resolvedSettings.level.pointsPerLevel,
    )
    : 0
  const achievementPoints = resolvedSettings.standings.includeAchievementPoints
    ? player.achievementPoints
    : 0
  const avgPerGame = player.gamesPlayed > 0 ? round3(player.totalPoints / player.gamesPlayed) : 0
  const leagueAvgPerGame = getLeagueAveragePerGame(playerMap)
  const adjustment = calculateStandingsAdjustment(player, playerMap, settings, context)
  const compensatedTotalPoints = adjustment.adjustedTotalPoints
  const winRateFraction = player.gamesPlayed > 0
    ? player.baseWins / player.gamesPlayed
    : EXPECTED_WIN_RATE
  const avgFraction = leagueAvgPerGame > 0 ? avgPerGame / leagueAvgPerGame : 1
  const winRateTerm = round3(PERF_WIN_RATE_WEIGHT * (winRateFraction / EXPECTED_WIN_RATE))
  const avgTerm = round3(PERF_AVG_WEIGHT * avgFraction)
  const perfMultRaw = round3(PERF_BASE_WEIGHT + winRateTerm + avgTerm)
  const usePerformanceModifier = resolvedSettings.standings.usePerformanceModifier
  const perfMult = usePerformanceModifier && player.gamesPlayed > 0
    ? Math.min(PERF_MULT_MAX, Math.max(PERF_MULT_MIN, perfMultRaw))
    : 1
  const multipliedScore = (player.totalPoints + achievementPoints + xpPoints) * perfMult
  const totalScore = round3(multipliedScore + adjustment.adjustmentPoints)

  return {
    totalScore,
    totalPoints: player.totalPoints,
    adjustmentMode: adjustment.adjustmentMode,
    adjustmentPoints: adjustment.adjustmentPoints,
    adjustmentDisplayPoints: adjustment.adjustmentDisplayPoints,
    adjustedTotalPoints: adjustment.adjustedTotalPoints,
    projectedPoints: adjustment.adjustmentPoints,
    compensatedTotalPoints,
    achievementPoints,
    xpPoints,
    perfMult: round3(perfMult),
    gamesPlayed: player.gamesPlayed,
    baseWins: player.baseWins,
    avgPerGame,
    totalLPoints: player.totalLPoints,
  }
}

export function getPlayerCommanderRecords(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  return Object.values(gameRecords[playerName] ?? {}).filter((record) => record.commander === commanderName)
}

export function getPlayerCommanderAchievementPoints(
  player: PlayerState | null | undefined,
  records: PlayerGameRecord[],
  commanderName: string,
) {
  const gameScopedPoints = records.reduce((sum, record) => sum + record.achievements.reduce((achievementSum, achievement) => {
    const achievementDef = getAchievementDefinition(achievement.id)
    if (!achievementDef || achievementDef.scope !== 'commander') return achievementSum
    if (achievement.commander !== commanderName) return achievementSum
    return achievementSum + achievementDef.points
  }, 0), 0)

  const postScopedPoints = (player?.earnedAchievements ?? [])
    .filter((achievement) => {
      const achievementDef = getAchievementDefinition(achievement.id)
      return achievement.gameId === 'post'
        && achievement.commander === commanderName
        && achievementDef?.scope === 'commander'
    })
    .reduce((sum, achievement) => sum + (getAchievementDefinition(achievement.id)?.points ?? 0), 0)

  return round3(gameScopedPoints + postScopedPoints)
}

export function getPlayerCommanderMetrics(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
): PlayerCommanderMetrics | null {
  const records = getPlayerCommanderRecords(playerName, commanderName, gameRecords)
  if (records.length === 0) return null

  const plays = records.length
  const first = records.filter((record) => record.placement === 1).length
  const second = records.filter((record) => record.placement === 2).length
  const last = records.filter((record) => record.placement === record.playerCount).length
  const totalBasePoints = round3(records.reduce((sum, record) => sum + record.basePoints, 0))
  const totalFinalPoints = round3(records.reduce((sum, record) => sum + record.finalPoints, 0))
  const totalLPoints = roundLoosterPoints(records.reduce((sum, record) => sum + record.lPoints, 0))
  const totalLosses = records.filter((record) => record.basePoints === 0).length
  const avgBasePoints = plays > 0 ? round3(totalBasePoints / plays) : 0
  const avgPlacement = plays > 0
    ? Math.round((records.reduce((sum, record) => sum + record.placement, 0) / plays) * 100) / 100
    : 0
  const bestGame = Math.max(...records.map((record) => record.basePoints), 0)
  const winRate = plays > 0 ? Math.round((first / plays) * 100) : 0
  const player = players[playerName]
  const achievementPoints = getPlayerCommanderAchievementPoints(player, records, commanderName)
  const xpPoints = xpToLevelWithThresholds(
    player?.commanderXP?.[commanderName] ?? 0,
    getCachedResolvedLeagueSettings().level.thresholds,
  )

  return {
    plays,
    first,
    second,
    last,
    winRate,
    avgBasePoints,
    avgPlacement,
    bestGame,
    totalBasePoints,
    totalFinalPoints,
    totalLPoints,
    totalLosses,
    achievementPoints,
    xpPoints,
  }
}

/**
 * Converts a placement into a normalized score so 3-, 4-, and 5-player games
 * can be compared on the same 0..1 scale.
 */
/**
 * Converts a finishing placement into a normalized 0..1 score so games with
 * different player counts can be compared on the same scale.
 */
function getNormalizedPlacementScore(placement: number, playerCount: number) {
  if (playerCount <= 1) return 0
  return (playerCount - placement) / (playerCount - 1)
}

/**
 * Computes the average normalized placement score for a set of records.
 */
function getAverageNormalizedPlacement(records: PlayerGameRecord[]) {
  if (records.length === 0) return 0

  const total = records.reduce(
    (sum, record) => sum + getNormalizedPlacementScore(record.placement, record.playerCount),
    0,
  )

  return total / records.length
}

/**
 * Shrinks a sample toward neutral as long as the sample is still small.
 */
function getSampleConfidence(sampleSize: number, k = 8) {
  if (sampleSize <= 0) return 0
  return sampleSize / (sampleSize + k)
}

/**
 * Combines weighted edge and pick rate into a simple importance score.
 */
function getCommanderImportanceScore(weightedEdge: number, pickRate: number) {
  return weightedEdge * (0.5 + 0.5 * pickRate)
}

/**
 * Rounds commander edge metrics only at the public return boundary.
 */
function roundCommanderEdgeMetrics(metrics: {
  withGames: number
  withoutGames: number
  withAvg: number
  withoutAvg: number
  rawEdge: number
  weightedEdge: number
  confidence: number
  pickRate: number
  importanceScore: number
  hasLowCommanderSample: boolean
  hasLowPoolSample: boolean
  isReliable: boolean
}): PlayerCommanderPerformanceEdgeMetrics {
  return {
    withGames: metrics.withGames,
    withoutGames: metrics.withoutGames,
    withAvg: round3(metrics.withAvg),
    withoutAvg: round3(metrics.withoutAvg),
    rawEdge: round3(metrics.rawEdge),
    weightedEdge: round3(metrics.weightedEdge),
    confidence: round3(metrics.confidence),
    pickRate: round3(metrics.pickRate),
    importanceScore: round3(metrics.importanceScore),
    hasLowCommanderSample: metrics.hasLowCommanderSample,
    hasLowPoolSample: metrics.hasLowPoolSample,
    isReliable: metrics.isReliable,
  }
}

/**
 * Calculates a player's commander edge versus the rest of their commander
 * pool using normalized placement and two-sided confidence shrinkage.
 */
export function getPlayerCommanderPerformanceEdgeMetrics(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): PlayerCommanderPerformanceEdgeMetrics | null {
  const allRecords = Object.values(gameRecords[playerName] ?? {})
  if (allRecords.length === 0) return null

  const withRecords = allRecords.filter((record) => record.commander === commanderName)
  const withoutRecords = allRecords.filter((record) => record.commander !== commanderName)
  if (withRecords.length === 0) return null

  const withGames = withRecords.length
  const withoutGames = withoutRecords.length
  const totalGames = allRecords.length
  const withAvg = getAverageNormalizedPlacement(withRecords)
  const withoutAvg = getAverageNormalizedPlacement(withoutRecords)
  const rawEdge = withAvg - withoutAvg
  const commanderConfidence = getSampleConfidence(withGames)
  const poolConfidence = getSampleConfidence(withoutGames)
  const confidence = Math.sqrt(commanderConfidence * poolConfidence)
  const weightedEdge = rawEdge * confidence
  const pickRate = totalGames > 0 ? withGames / totalGames : 0
  const importanceScore = getCommanderImportanceScore(weightedEdge, pickRate)
  const hasLowCommanderSample = withGames < 5
  const hasLowPoolSample = withoutGames < 5
  const isReliable = !hasLowPoolSample

  return roundCommanderEdgeMetrics({
    withGames,
    withoutGames,
    withAvg,
    withoutAvg,
    rawEdge,
    weightedEdge,
    confidence,
    pickRate,
    importanceScore,
    hasLowCommanderSample,
    hasLowPoolSample,
    isReliable,
  })
}


// ─── League replay ────────────────────────────────────────────────────────────

export interface RawLeagueGame {
  gameId: string
  date: string | Date
  players?: any[]
  [key: string]: any
}

export interface SavedCommanderTitle {
  playerName: string
  playerNameKey?: string
  commanderName: string
  commanderNameKey?: string
  selectedTitle: CommanderTitleId
}

export interface LeagueComputationInput {
  rawGames: RawLeagueGame[]
  roster: string[]
  savedCommanderTitles: SavedCommanderTitle[]
  rawSettings: LeagueSettingsDocument | null
}

export interface LeagueComputationResult {
  games: ProcessedGame[]
  players: Record<string, PlayerState>
  commanders: Record<string, CommanderState>
  gameRecords: Record<string, Record<string, PlayerGameRecord>>
  leagueSnapshots: Record<string, Record<string, LeagueSnapshotEntry>>
  commanderTitleSelections: CommanderTitleSelectionMap
}

export interface LeagueComputationOptions {
  onProgress?: (current: number, total: number) => void
  /** Yield to the event loop every N games (0 = never). Only useful on the main thread. */
  yieldEvery?: number
}

/**
 * Replays every game in chronological order and derives the full league state:
 * points, commander MMR/XP, achievements, and per-game league standings.
 * Pure: it only depends on its input (and the current date for season logic),
 * so it runs unchanged in a Web Worker, on the main thread, or in tests.
 */
export async function computeLeagueState(
  input: LeagueComputationInput,
  options: LeagueComputationOptions = {},
): Promise<LeagueComputationResult> {
  const { rawGames: raw, roster, savedCommanderTitles, rawSettings } = input
  const { onProgress, yieldEvery = 0 } = options
  // Hot paths resolve settings without an explicit argument.
  setRuntimeLeagueSettings(rawSettings)
        const canonicalPlayerNames = new Map<string, string>()
        for (const playerName of roster) {
          canonicalPlayerNames.set(playerName.trim().toLowerCase(), formatPlayerName(playerName.trim()))
        }

      const normalizePlayerName = (name: string) => {
        const trimmed = name.trim()
        const key = trimmed.toLowerCase()
        const canonical = canonicalPlayerNames.get(key)
        if (canonical) return canonical
        const fallbackName = formatPlayerName(trimmed)
        canonicalPlayerNames.set(key, fallbackName)
        return fallbackName
      }

      const normalizedRaw = raw.map((game) => ({
        ...game,
        players: (game.players ?? []).map((player: any) => ({
          ...player,
          name: normalizePlayerName(player.name),
        })),
      }))

      const sorted = [...normalizedRaw].sort(compareGamesChronological)
      onProgress?.(0, sorted.length)

      const processedGames: ProcessedGame[] = []
      const playerMap: Record<string, PlayerState> = {}
      const commanderMap: Record<string, CommanderState> = {}
      const recordsMap: Record<string, Record<string, PlayerGameRecord>> = {}
      const snapshotMap: Record<string, Record<string, LeagueSnapshotEntry>> = {}
      const allPlayerNames = new Set<string>(roster.map((n) => formatPlayerName(n.trim())))

      for (const game of sorted) {
        for (const player of game.players ?? []) allPlayerNames.add(player.name)
      }

      for (const playerName of allPlayerNames) {
        playerMap[playerName] = createEmptyPlayerState(playerName)
      }

      // ── Achievement tracking state ──────────────────────────────────────────

      // One-time player achievements already earned: playerName -> Set<achievementId>
      const playerOneTime: Record<string, Set<string>> = {}
      // One-time commander achievements: `playerName:commander:achievementId` -> true
      const cmdOneTime = new Set<string>()
      // Per-player per-week data
      interface WeekData {
        games: number
        commanders: Set<string>
        wins: number
        weeklyWinDone: boolean
        beatLeaderDone: boolean
        varietyDone: boolean
        grinderDone: boolean
      }
      const playerWeeks: Record<string, Record<string, WeekData>> = {}
      // Repeatable achievements already earned by this player in a given week
      const playerWeeklyRepeatables: Record<string, Record<string, Set<string>>> = {}
      // Absolute week (year*53+isoWeek) of each player's last game
      const playerLastAbsWeek: Record<string, number> = {}

      // Global game index (increments once per game, not per player)
      let globalGameIdx = 0
      // Per-player: global game index of their last played game (for returning_wanderer)
      const playerLastGlobalGameIdx: Record<string, number> = {}
      // Per-player: their own sequential game count (for old_memory)
      const playerOwnGameIdx: Record<string, number> = {}
      // Per-player per-commander: player's own game index of last appearance (for old_memory)
      const playerCommanderLastOwnIdx: Record<string, Record<string, number>> = {}
      // Per-player: { commander, count } of consecutive games with same commander (hyper_fixation)
      const playerConsecutiveCmd: Record<string, { commander: string; count: number }> = {}
      // Per-player: consecutive non-win count (losing_streak)
      const playerNonWinStreak: Record<string, number> = {}
      // Per-player: { commander, count } of consecutive wins with same commander (win_streak)
      const playerWinStreakData: Record<string, { commander: string; count: number }> = {}
      // Per-player per-commander: consecutive last-place finishes (cold_trail)
      const playerCommanderLastPlaceStreak: Record<string, Record<string, number>> = {}
      // Per-player per-commander: track 5 misses after a win without reaching top 2 (wither)
      const playerCommanderWitherData: Record<string, Record<string, { failures: number; active: boolean }>> = {}
      const resolvedLeagueSettings = getResolvedLeagueSettings(rawSettings)
      // Incrementally maintained views of `processedGames` (identical to rebuilding them per game).
      const gameOrderMap = new Map<string, number>()
      const archEnemyTracker = createArchEnemyTracker()
      // Standings are unchanged between one game's "after" and the next game's "before",
      // so the previous ranking is reused instead of being recomputed.
      let previousRankAfterList: LeagueRanking[] | null = null

      // ── Game loop ───────────────────────────────────────────────────────────

      for (const [gameIndex, game] of sorted.entries()) {
        const playerCount = game.players.length
        const gameDate = new Date(game.date)
        const gameWeek = isoWeek(gameDate)
        const gameAbsWeek = absWeek(gameDate)
        const weekKey = `${gameDate.getUTCFullYear()}_${gameWeek}`

        // Current leader before this game (highest totalPoints so far)
        const leaderEntry = Object.values(playerMap).reduce<PlayerState | null>(
          (best, p) => (!best || p.totalPoints > best.totalPoints ? p : best),
          null,
        )
        const leaderName = leaderEntry?.name ?? ''
        const featuredPlayerName = getFeaturedPlayerName(recordsMap, gameOrderMap)

        // Snapshot ratings before this game
        const ratingsBefore: Record<string, number> = {}
        for (const p of game.players) {
          ratingsBefore[p.name] = playerMap[p.name]?.totalPoints ?? 0
        }

        const computed = computeGamePoints(game.players) as ProcessedGamePlayer[]
        const commanderMMRParticipants = computed.map((player, index) => ({
          participantId: `${player.name}::${player.commander}::${index}`,
          commanderId: getCommanderId(player.name, player.commander),
          commanderName: player.commander,
          currentMMR: commanderMap[getCommanderId(player.name, player.commander)]?.mmr ?? getInitialCommanderMMR(),
          placement: player.placement,
        }))
        const commanderMMRChanges = calculateCommanderMMRChanges(
          commanderMMRParticipants.map((participant) => ({
            commanderId: participant.participantId,
            commanderName: participant.commanderName,
            currentMMR: participant.currentMMR,
            placement: participant.placement,
          })),
        )
        const commanderMMRChangeMap = Object.fromEntries(
          commanderMMRChanges.map((change) => [change.commanderId, change]),
        )
        const commanderMMRAggregateMap = commanderMMRParticipants.reduce<Record<string, {
          oldMMR: number
          delta: number
          newMMR: number
        }>>((acc, participant) => {
          const participantChange = commanderMMRChangeMap[participant.participantId]
          const existing = acc[participant.commanderId] ?? {
            oldMMR: participant.currentMMR,
            delta: 0,
            newMMR: participant.currentMMR,
          }

          existing.delta = round3(existing.delta + (participantChange?.delta ?? 0))
          existing.newMMR = round3(existing.oldMMR + existing.delta)
          acc[participant.commanderId] = existing
          return acc
        }, {})

        // All other players finished 2nd (killing the table check)
        const allOthers2nd = computed.every((p) => p.placement === 1 || p.placement === 2)

        // Snapshot league ranks before this game using the shared dashboard metric.
        const rankBeforeList = previousRankAfterList ?? buildLeagueRankings(
          playerMap,
          rawSettings,
          { games: processedGames, gameRecords: recordsMap },
        )
        const rankBeforeMap: Record<string, number> = {}
        const scoreBeforeMap: Record<string, number> = {}
        for (const p of game.players) {
          const entry = rankBeforeList.find((pl) => pl.name === p.name)
          rankBeforeMap[p.name] = entry?.rank ?? (rankBeforeList.length + 1)
          scoreBeforeMap[p.name] = entry?.totalScore ?? 0
        }
        const podAveragePlayerRating = game.players.length > 0
          ? round3(game.players.reduce((sum, player) => sum + (scoreBeforeMap[player.name] ?? 0), 0) / game.players.length)
          : 0
        const podAverageCommanderMmr = commanderMMRParticipants.length > 0
          ? round3(commanderMMRParticipants.reduce((sum, participant) => sum + participant.currentMMR, 0) / commanderMMRParticipants.length)
          : 0

        for (const [playerIndex, p] of computed.entries()) {
          const isWinner = p.placement === 1

          const commanderXpBefore = playerMap[p.name]?.commanderXP?.[p.commander] ?? 0
          const commanderRestedBefore = playerMap[p.name]?.commanderRested?.[p.commander] ?? 0
          const commanderXpGained = calculateXPGained(playerCount, isWinner, commanderRestedBefore)
          const commanderLevelBefore = xpToLevel(commanderXpBefore)
          const commanderLevelAfter = xpToLevel(commanderXpBefore + commanderXpGained)

          const modifiers = applyModifiers({
            playerName: p.name,
            basePoints: p.points,
            ratingsBefore,
            commanderXpBefore,
            commanderXpGained,
          })

          const modifierSum = modifiers.reduce((s, m) => s + (m.informational ? 0 : m.value), 0)
          const finalPoints = round3(p.points + modifierSum)
          const commanderMMRParticipantId = commanderMMRParticipants[playerIndex]?.participantId
          const commanderMMRChange = commanderMMRParticipantId
            ? commanderMMRChangeMap[commanderMMRParticipantId]
            : undefined
          const lPointModifier = calculateLPointModifier(
            p.placement,
            p.lPoints,
            scoreBeforeMap[p.name] ?? 0,
            podAveragePlayerRating,
            commanderMMRChange?.oldMMR ?? getInitialCommanderMMR(),
            podAverageCommanderMmr,
            resolvedLeagueSettings.playerRankingSystem === 'player_rating_based'
              && !resolvedLeagueSettings.playerRating.simpleMmr.enabled
              && resolvedLeagueSettings.playerRating.lPointMmrModifier.enabled,
          )
          const adjustedLPoints = lPointModifier?.adjustedLPoints ?? p.lPoints
          computed[playerIndex] = {
            ...p,
            lPoints: adjustedLPoints,
          }

          if (!playerMap[p.name]) playerMap[p.name] = createEmptyPlayerState(p.name)

          const commanderId = getCommanderId(p.name, p.commander)
          if (!commanderMap[commanderId]) {
            const initialCommanderMMR = getInitialCommanderMMR()
            commanderMap[commanderId] = {
              id: commanderId,
              playerName: p.name,
              name: p.commander,
              totalPoints: 0,
              totalBasePoints: 0,
              totalLPoints: 0,
              gamesPlayed: 0,
              wins: 0,
              uniquePlayers: [],
              mmr: initialCommanderMMR,
              tier: getCommanderTierFromMMR(initialCommanderMMR),
            }
          }

          if (!recordsMap[p.name]) recordsMap[p.name] = {}
          recordsMap[p.name][game.gameId] = {
            gameId: game.gameId,
            playerName: p.name,
            commander: p.commander,
            placement: p.placement,
            basePoints: p.points,
            lPoints: adjustedLPoints,
            lPointModifier,
            modifiers,
            finalPoints,
            ratingBefore: scoreBeforeMap[p.name] ?? 0,
            ratingAfter: 0,
            commanderMMRBefore: commanderMMRChange?.oldMMR ?? getInitialCommanderMMR(),
            commanderMMRAfter: commanderMMRChange?.newMMR ?? getInitialCommanderMMR(),
            commanderMMRDelta: commanderMMRChange?.delta ?? 0,
            rankBefore: rankBeforeMap[p.name] ?? 0,
            rankAfter: 0,
            commanderXpBefore,
            commanderXpAfter: commanderXpBefore + commanderXpGained,
            commanderLevelBefore,
            commanderLevelAfter,
            playerCount,
            achievements: [],
          }

          // ── Achievement checks ────────────────────────────────────────────

          if (!playerOneTime[p.name])   playerOneTime[p.name] = new Set()
          if (!playerWeeks[p.name])     playerWeeks[p.name] = {}
          if (!playerWeeklyRepeatables[p.name]) playerWeeklyRepeatables[p.name] = {}
          if (!playerOwnGameIdx[p.name])  playerOwnGameIdx[p.name] = 0
          if (!playerCommanderLastOwnIdx[p.name]) playerCommanderLastOwnIdx[p.name] = {}
          if (!playerCommanderLastPlaceStreak[p.name]) playerCommanderLastPlaceStreak[p.name] = {}
          if (!playerCommanderWitherData[p.name]) playerCommanderWitherData[p.name] = {}
          if (!playerWeeklyRepeatables[p.name][weekKey]) {
            playerWeeklyRepeatables[p.name][weekKey] = new Set()
          }
          if (!playerWeeks[p.name][weekKey]) {
            playerWeeks[p.name][weekKey] = {
              games: 0,
              commanders: new Set(),
              wins: 0,
              weeklyWinDone: false,
              beatLeaderDone: false,
              varietyDone: false,
              grinderDone: false,
            }
          }

          const wd = playerWeeks[p.name][weekKey]
          const weeklyRepeatables = playerWeeklyRepeatables[p.name][weekKey]
          const gameAchievements: EarnedAchievement[] = []
          const isLastPlace = p.placement === playerCount
          const lastPlaceStreak = playerCommanderLastPlaceStreak[p.name][p.commander] ?? 0
          const witherData = playerCommanderWitherData[p.name][p.commander] ?? { failures: 0, active: false }

          const earn = (id: string, commander?: string) => {
            const def = getAchievementDefinition(id)
            if (!def) return
            if (def.repeatable && weeklyRepeatables.has(id)) return

            const entry: EarnedAchievement = { id, gameId: game.gameId, commander }
            gameAchievements.push(entry)
            playerMap[p.name].earnedAchievements.push(entry)
            playerMap[p.name].achievementPoints = round3(
              playerMap[p.name].achievementPoints + def.points,
            )

            if (def.repeatable) weeklyRepeatables.add(id)
          }

          // Cold Trail: 5 last-place finishes in a row with this commander
          if (isLastPlace) {
            const nextStreak = lastPlaceStreak + 1
            if (nextStreak >= 5) {
              earn('cold_trail', p.commander)
              playerCommanderLastPlaceStreak[p.name][p.commander] = 0
            } else {
              playerCommanderLastPlaceStreak[p.name][p.commander] = nextStreak
            }
          } else {
            playerCommanderLastPlaceStreak[p.name][p.commander] = 0
          }

          // Wither: after a win, miss top 2 for the next 5 games with this commander
          if (isWinner) {
            playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: true }
          } else if (witherData.active) {
            if (p.placement <= 2) {
              playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: false }
            } else {
              const failures = witherData.failures + 1
              if (failures >= 5) {
                earn('wither', p.commander)
                playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: false }
              } else {
                playerCommanderWitherData[p.name][p.commander] = { failures, active: true }
              }
            }
          } else {
            playerCommanderWitherData[p.name][p.commander] = witherData
          }

          // Sleeper: 2+ week gap since last game
          const lastAbsWeek = playerLastAbsWeek[p.name]
          if (lastAbsWeek !== undefined && gameAbsWeek - lastAbsWeek >= 2) {
            earn('sleeper')
          }

          // Returning wanderer: 10+ global games played since this player last played
          const lastGlobal = playerLastGlobalGameIdx[p.name]
          if (lastGlobal !== undefined && globalGameIdx - lastGlobal >= 10) {
            earn('returning_wanderer')
          }

          // Old memory: played this commander 15+ of own games ago
          const ownIdx = playerOwnGameIdx[p.name]
          const cmdLastOwn = playerCommanderLastOwnIdx[p.name][p.commander]
          if (cmdLastOwn !== undefined && ownIdx - cmdLastOwn >= 10) {
            earn('forgotten_friend', p.commander)
          }
          if (cmdLastOwn !== undefined && ownIdx - cmdLastOwn >= 15) {
            earn('old_memory')
          }

          // Diversify: playing 5th unique commander (commander not yet in XP map = new)
          const isNewCommander = !(p.commander in (playerMap[p.name]?.commanderXP ?? {}))
          const uniqueCmdCount = Object.keys(playerMap[p.name]?.commanderXP ?? {}).length
          if (isNewCommander && uniqueCmdCount === 4 && !playerOneTime[p.name].has('diversify')) {
            playerOneTime[p.name].add('diversify')
            earn('diversify')
          }

          // Hyper fixation: 15 consecutive games with same commander
          if (!playerConsecutiveCmd[p.name]) playerConsecutiveCmd[p.name] = { commander: p.commander, count: 0 }
          const cc = playerConsecutiveCmd[p.name]
          if (cc.commander === p.commander) {
            cc.count++
            if (cc.count === 15 && !playerOneTime[p.name].has('hyper_fixation')) {
              playerOneTime[p.name].add('hyper_fixation')
              earn('hyper_fixation')
            }
          } else {
            cc.commander = p.commander
            cc.count = 1
          }

          // Losing streak: 15 games without first place
          if (!playerNonWinStreak[p.name]) playerNonWinStreak[p.name] = 0
          if (!isWinner) {
            playerNonWinStreak[p.name]++
            if (playerNonWinStreak[p.name] === 15 && !playerOneTime[p.name].has('losing_streak')) {
              playerOneTime[p.name].add('losing_streak')
              earn('losing_streak')
            }
          } else {
            playerNonWinStreak[p.name] = 0
          }

          // Update week stats
          wd.games++
          wd.commanders.add(p.commander)

          // Grinder: 10th game in a week
          if (wd.games === 10 && !wd.grinderDone) {
            wd.grinderDone = true
            earn('grinder')
          }

          // Variety: 3rd different commander this week
          if (wd.commanders.size === 3 && !wd.varietyDone) {
            wd.varietyDone = true
            earn('weekly_variety')
          }

          if (isWinner) {
            wd.wins++

            // Weekly win (once per week)
            if (!wd.weeklyWinDone) {
              wd.weeklyWinDone = true
              earn('weekly_win')
            }

            // First blood: first ever win with this commander
            const fbKey = `${p.name}:${p.commander}:first_blood`
            if (!cmdOneTime.has(fbKey)) {
              cmdOneTime.add(fbKey)
              earn('first_blood', p.commander)
            }

            // Killing the table: winner + all others are placement 2
            if (allOthers2nd && !playerOneTime[p.name].has('killing_the_table')) {
              playerOneTime[p.name].add('killing_the_table')
              earn('killing_the_table')
            }

            // Born a star: first win in a 5-player game
            if (playerCount === 5 && !playerOneTime[p.name].has('born_a_star')) {
              playerOneTime[p.name].add('born_a_star')
              earn('born_a_star')
            }

            // Beat leader: win against league leader (once per week)
            const leaderInGame = game.players.some((gp: any) => gp.name === leaderName)
            if (leaderInGame && leaderName !== p.name && !wd.beatLeaderDone) {
              wd.beatLeaderDone = true
              earn('beat_leader')
            }

            const archEnemy = archEnemyTracker.getSummary(p.name)
            const archEnemyPlayer = archEnemy.enemyName
              ? computed.find((participant) => participant.name === archEnemy.enemyName)
              : null
            const beatCurrentArchEnemy = Boolean(archEnemyPlayer && archEnemyPlayer.placement > 1)
            if (beatCurrentArchEnemy) {
              earn('beat_arch_enemy')
            }

            const featuredPlayer = featuredPlayerName
              ? computed.find((participant) => participant.name === featuredPlayerName)
              : null
            const beatCurrentFeaturedPlayer = Boolean(
              featuredPlayer && featuredPlayer.name !== p.name && featuredPlayer.placement > 1,
            )
            if (beatCurrentFeaturedPlayer) {
              earn('beat_featured_player')
            }

            // Straggler / Hyper Straggler: win against player with many more games
            const maxOpponentGames = game.players
              .filter((gp: any) => gp.name !== p.name)
              .reduce((max: number, gp: any) => Math.max(max, playerMap[gp.name]?.gamesPlayed ?? 0), 0)
            const myGames = playerMap[p.name]?.gamesPlayed ?? 0
            const diff = maxOpponentGames - myGames
            if (diff >= 20) earn('hyper_straggler')
            else if (diff >= 10) earn('straggler')

            // Win streak: 3 consecutive wins with same commander
            if (!playerWinStreakData[p.name]) playerWinStreakData[p.name] = { commander: p.commander, count: 0 }
            const ws = playerWinStreakData[p.name]
            if (ws.commander === p.commander) {
              ws.count++
              if (ws.count >= 3) {
                earn('win_streak')
                ws.count = 0 // reset after awarding
              }
            } else {
              ws.commander = p.commander
              ws.count = 1
            }
          } else {
            // Reset win streak on non-win
            if (playerWinStreakData[p.name]) {
              playerWinStreakData[p.name].count = 0
            }
          }

          recordsMap[p.name][game.gameId].achievements = gameAchievements

          // Update player totals
          const ps = playerMap[p.name]
          ps.totalPoints = round3(ps.totalPoints + finalPoints)
          ps.totalLPoints = roundLoosterPoints(ps.totalLPoints + adjustedLPoints)
          ps.totalBasePoints = round3(ps.totalBasePoints + p.points)
          if (p.placement === 1) ps.baseWins++
          ps.gamesPlayed++
          if (isWinner) ps.wins++
          ps.commanderXP[p.commander] = commanderXpBefore + commanderXpGained
          if (!(p.commander in ps.commanderRested)) ps.commanderRested[p.commander] = 0

          const cs = commanderMap[getCommanderId(p.name, p.commander)]
          cs.totalPoints = round3(cs.totalPoints + finalPoints)
          cs.totalBasePoints = round3(cs.totalBasePoints + p.points)
          cs.totalLPoints = roundLoosterPoints(cs.totalLPoints + adjustedLPoints)
          cs.gamesPlayed++
          if (isWinner) cs.wins++
          if (!cs.uniquePlayers.includes(p.name)) cs.uniquePlayers.push(p.name)
          cs.mmr = commanderMMRAggregateMap[getCommanderId(p.name, p.commander)]?.newMMR ?? cs.mmr
          cs.tier = getCommanderTierFromMMR(cs.mmr)

          // Update own game index and commander last-seen index
          playerCommanderLastOwnIdx[p.name][p.commander] = ownIdx
          playerOwnGameIdx[p.name] = ownIdx + 1
          playerLastGlobalGameIdx[p.name] = globalGameIdx
          playerLastAbsWeek[p.name] = gameAbsWeek

          // Level achievements (commander-scoped, once per commander per player)
          const levelMilestones: [number, string][] = [[7, 'reach_level_7'], [10, 'reach_level_10'], [20, 'reach_level_20']]
          for (const [lvl, achId] of levelMilestones) {
            if (commanderLevelAfter >= lvl && commanderLevelBefore < lvl) {
              const key = `${p.name}:${p.commander}:${achId}`
              if (!cmdOneTime.has(key)) {
                cmdOneTime.add(key)
                earn(achId, p.commander)
              }
            }
          }
        }

        const missedGameLPoints = getMissedGameLoosterPoints(playerCount)
        if (missedGameLPoints > 0) {
          const participants = new Set(computed.map((player) => player.name))
          for (const playerName of allPlayerNames) {
            if (participants.has(playerName)) continue
            if (!playerMap[playerName]) playerMap[playerName] = createEmptyPlayerState(playerName)
            playerMap[playerName].totalLPoints = roundLoosterPoints(playerMap[playerName].totalLPoints + missedGameLPoints)
          }
        }

        const playedCommanderKeys = new Set(computed.map((player) => `${player.name}::${player.commander}`))
        for (const [playerName, playerState] of Object.entries(playerMap)) {
          for (const commanderName of Object.keys(playerState.commanderXP)) {
            const key = `${playerName}::${commanderName}`
            const currentRest = playerState.commanderRested[commanderName] ?? 0
            playerState.commanderRested[commanderName] = playedCommanderKeys.has(key)
              ? consumeCommanderRest(currentRest)
              : currentRest + 1
          }
        }

        // King maker: a player who lost causes someone else to reach league #1
        // Check: for each non-winner, did their loss allow a winner's new total to surpass the pre-game leader?
        const newLeaderEntry = Object.values(playerMap).reduce<PlayerState | null>(
          (best, pl) => (!best || pl.totalPoints > best.totalPoints ? pl : best),
          null,
        )
        if (newLeaderEntry && newLeaderEntry.name !== leaderName) {
          // Someone new is now leading — credit all losers in this game
          for (const p of computed) {
            if (p.placement !== 1) {
              const achEntry: EarnedAchievement = { id: 'king_maker', gameId: game.gameId }
              recordsMap[p.name][game.gameId].achievements.push(achEntry)
              playerMap[p.name].earnedAchievements.push(achEntry)
              playerMap[p.name].achievementPoints = round3(
                playerMap[p.name].achievementPoints + (getAchievementDefinition('king_maker')?.points ?? 0),
              )
            }
          }
        }

        // Compute league ranks after this game with the centralized dashboard metric.
        const processedGame: ProcessedGame = {
          gameId: game.gameId,
          date: game.date,
          week: gameWeek,
          players: computed,
        }
        processedGames.push(processedGame)
        const rankAfterList = buildLeagueRankings(
          playerMap,
          rawSettings,
          { games: processedGames, gameRecords: recordsMap },
        )
        previousRankAfterList = rankAfterList
        snapshotMap[game.gameId] = Object.fromEntries(
          rankAfterList.map((entry) => [
            entry.name,
            { rank: entry.rank, totalScore: entry.totalScore },
          ]),
        )
        for (const p of computed) {
          recordsMap[p.name][game.gameId].ratingAfter =
            snapshotMap[game.gameId][p.name]?.totalScore ?? 0
          recordsMap[p.name][game.gameId].rankAfter =
            snapshotMap[game.gameId][p.name]?.rank ?? 0
        }

        globalGameIdx++

        gameOrderMap.set(processedGame.gameId, processedGames.length - 1)
        archEnemyTracker.addGame(processedGame, recordsMap)

        onProgress?.(gameIndex + 1, sorted.length)
        if (yieldEvery > 0 && (gameIndex + 1) % yieldEvery === 0) {
          await yieldToEventLoop()
        }
      }

      // ── Post-processing: tiers + tier/rock-bottom achievements ─────────────

      const gameOrder = new Map(processedGames.map((game, index) => [game.gameId, index]))

      const tierAchievements: Partial<Record<CommanderMMRTier, string>> = {
        god: 'god_tier',
        legend: 'legend_tier',
        diamond: 'diamond_tier',
        platinum: 'platinum_tier',
        gold: 'gold_tier',
        bronze: 'bronze_tier',
        trash: 'trash_tier',
      }

      for (const [playerName, records] of Object.entries(recordsMap)) {
        const byCommander: Record<string, {
          totalPoints: number
          games: number
          wins: number
          lasts: number
          firstGameWon: boolean
          records: PlayerGameRecord[]
        }> = {}

        const orderedRecords = Object.values(records)
          .sort((a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0))

        for (const record of orderedRecords) {
          if (!byCommander[record.commander])
            byCommander[record.commander] = {
              totalPoints: 0,
              games: 0,
              wins: 0,
              lasts: 0,
              firstGameWon: record.placement === 1,
              records: [],
            }
          byCommander[record.commander].totalPoints += record.basePoints
          byCommander[record.commander].games++
          if (record.placement === 1) byCommander[record.commander].wins++
          if (record.placement === record.playerCount) byCommander[record.commander].lasts++
          byCommander[record.commander].records.push(record)
        }

        const ps = playerMap[playerName]

        for (const [cmdName, data] of Object.entries(byCommander)) {
          const commanderState = commanderMap[getCommanderId(playerName, cmdName)]
          const mmrTier = commanderState?.tier ?? getCommanderTierFromMMR(getInitialCommanderMMR())
          playerMap[playerName].commanderTiers[cmdName] = mmrTier

          // Previous commander tiers were derived from blended score / global baseline.
          // That aggregate tier system has been retired in favor of per-game commander MMR.

          const cumulativeRecords: PlayerGameRecord[] = []
          let cumulativeLasts = 0
          let cumulativeWins = 0
          let cumulativeBasePoints = 0
          for (const record of data.records) {
            cumulativeRecords.push(record)
            const cumulativeGames = cumulativeRecords.length
            cumulativeBasePoints += record.basePoints
            if (record.placement === 1) cumulativeWins++
            if (record.placement === record.playerCount) cumulativeLasts++
            const currentTier = getCommanderTierFromMMR(record.commanderMMRAfter)
            const achId = tierAchievements[currentTier]
            if (!achId) continue

            const key = `${playerName}:${cmdName}:${achId}`
            if (cmdOneTime.has(key)) continue

            cmdOneTime.add(key)
            const entry: EarnedAchievement = { id: achId, gameId: record.gameId, commander: cmdName }
            recordsMap[playerName][record.gameId].achievements.push(entry)
            ps.earnedAchievements.push(entry)
            ps.achievementPoints = round3(ps.achievementPoints + (getAchievementDefinition(achId)?.points ?? 0))

            // Hit rock bottom: reaches 5 games with 0 total base points.
            if (cumulativeGames >= 5 && cumulativeBasePoints === 0) {
              const rockBottomKey = `${playerName}:${cmdName}:hit_rock_bottom`
              if (!cmdOneTime.has(rockBottomKey)) {
                cmdOneTime.add(rockBottomKey)
                const entry: EarnedAchievement = { id: 'hit_rock_bottom', gameId: record.gameId, commander: cmdName }
                recordsMap[playerName][record.gameId].achievements.push(entry)
                ps.earnedAchievements.push(entry)
                ps.achievementPoints = round3(ps.achievementPoints + (getAchievementDefinition('hit_rock_bottom')?.points ?? 0))
              }
            }

            // Cursed commander: reaches 10 last-place finishes with this commander.
            if (cumulativeLasts >= 10) {
              const cursedKey = `${playerName}:${cmdName}:cursed_commander`
              if (!cmdOneTime.has(cursedKey)) {
                cmdOneTime.add(cursedKey)
                const entry: EarnedAchievement = { id: 'cursed_commander', gameId: record.gameId, commander: cmdName }
                recordsMap[playerName][record.gameId].achievements.push(entry)
                ps.earnedAchievements.push(entry)
                ps.achievementPoints = round3(ps.achievementPoints + (getAchievementDefinition('cursed_commander')?.points ?? 0))
              }
            }

            // False promise: reaches 5 games while still only having the first-game win.
            if (data.firstGameWon && cumulativeGames >= 5 && cumulativeWins === 1) {
              const falsePromiseKey = `${playerName}:${cmdName}:false_promise`
              if (!cmdOneTime.has(falsePromiseKey)) {
                cmdOneTime.add(falsePromiseKey)
                const entry: EarnedAchievement = { id: 'false_promise', gameId: record.gameId, commander: cmdName }
                recordsMap[playerName][record.gameId].achievements.push(entry)
                ps.earnedAchievements.push(entry)
                ps.achievementPoints = round3(ps.achievementPoints + (getAchievementDefinition('false_promise')?.points ?? 0))
              }
            }

            // Lapdog: reaches 50 games with this commander.
            if (cumulativeGames >= 50) {
              const lapdogKey = `${playerName}:${cmdName}:lapdog`
              if (!cmdOneTime.has(lapdogKey)) {
                cmdOneTime.add(lapdogKey)
                const entry: EarnedAchievement = { id: 'lapdog', gameId: record.gameId, commander: cmdName }
                recordsMap[playerName][record.gameId].achievements.push(entry)
                ps.earnedAchievements.push(entry)
                ps.achievementPoints = round3(ps.achievementPoints + (getAchievementDefinition('lapdog')?.points ?? 0))
              }
            }
          }
        }
      }

  return {
    games: [...processedGames].sort(compareGamesForDisplay),
    players: playerMap,
    commanders: commanderMap,
    gameRecords: recordsMap,
    leagueSnapshots: snapshotMap,
    commanderTitleSelections: savedCommanderTitles.reduce<CommanderTitleSelectionMap>((acc, entry) => {
      const playerKey = entry.playerNameKey ?? normalizeDeckIdentityKey(entry.playerName)
      const commanderKey = entry.commanderNameKey ?? normalizeDeckIdentityKey(entry.commanderName)
      if (!acc[playerKey]) acc[playerKey] = {}
      acc[playerKey][commanderKey] = entry.selectedTitle
      return acc
    }, {}),
  }
}

function round3(n: number): number {
  // return Math.round(n * 1000) / 1000
  return n;
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function absWeek(date: Date): number {
  return date.getUTCFullYear() * 53 + isoWeek(date)
}

/**
 * Precomputes the lookups every player's standing needs, once per standings build,
 * instead of once per player (games sorted for free games, game timestamps for seasons).
 */
function withStandingsCaches(
  resolvedSettings: ReturnType<typeof getResolvedLeagueSettings>,
  context?: StandingAdjustmentContext,
): StandingAdjustmentContext | undefined {
  if (!context) return context

  const usesFreeGames = resolvedSettings.playerRankingSystem !== 'player_rating_based'
    && resolvedSettings.standings.adjustmentMode === 'freeGames'

  return {
    ...context,
    orderedGames: context.orderedGames
      ?? (usesFreeGames ? [...(context.games ?? [])].sort(compareGamesChronological) : undefined),
    seasonAverageCache: context.seasonAverageCache
      ?? (context.games ? buildSeasonAverageCache(context.games, resolvedSettings) : undefined),
  }
}

export function buildLeagueStandings(
  playerMap: Record<string, PlayerState>,
  settings?: LeagueSettingsDocument | null,
  context?: StandingAdjustmentContext,
): LeagueStanding[] {
  const resolvedSettings = getResolvedLeagueSettings(settings)
  const cachedContext = withStandingsCaches(resolvedSettings, context)
  const allPlayers = Object.values(playerMap)
  const playerRatingStates = resolvedSettings.playerRankingSystem === 'player_rating_based' && context
    ? buildPlayerRatingStatesFromRecords(playerMap, context.gameRecords)
    : null
  const playerRatings = resolvedSettings.playerRankingSystem === 'player_rating_based' && context
    ? calculatePlayerRatings(playerRatingStates ?? playerMap, context.gameRecords, context.games, settings)
    : null

  return allPlayers
    .map((player) => {
      const classicMetrics = getLeagueStandingMetrics(player, playerMap, settings, cachedContext)
      const ratingResult = playerRatings?.[player.name]
      const seasonAverages = cachedContext
        ? calculatePlayerSeasonAverages(
          player.name,
          cachedContext.games,
          cachedContext.gameRecords,
          settings,
          undefined,
          cachedContext.seasonAverageCache,
        )
        : null
      const totalScore = resolvedSettings.playerRankingSystem === 'player_rating_based'
        ? ratingResult?.rating ?? 0
        : seasonAverages?.enabled
          ? seasonAverages.totalAverage
        : classicMetrics.totalScore

      return {
        name: player.name,
        totalScore,
        rank: 0,
        rankingSystem: resolvedSettings.playerRankingSystem,
        playerRating: ratingResult?.rating,
        provisional: ratingResult?.provisional ?? false,
        ratingBreakdown: ratingResult?.breakdown,
        totalPoints: classicMetrics.totalPoints,
        adjustmentMode: classicMetrics.adjustmentMode,
        adjustmentPoints: classicMetrics.adjustmentPoints,
        adjustmentDisplayPoints: classicMetrics.adjustmentDisplayPoints,
        adjustedTotalPoints: classicMetrics.adjustedTotalPoints,
        projectedPoints: classicMetrics.projectedPoints,
        compensatedTotalPoints: classicMetrics.compensatedTotalPoints,
        achievementPoints: classicMetrics.achievementPoints,
        xpPoints: classicMetrics.xpPoints,
        perfMult: classicMetrics.perfMult,
        gamesPlayed: classicMetrics.gamesPlayed,
        baseWins: classicMetrics.baseWins,
        avgPerGame: classicMetrics.avgPerGame,
        totalLPoints: classicMetrics.totalLPoints,
        seasonScores: seasonAverages?.seasonScores ?? [],
        playedSeasonCount: seasonAverages?.playedSeasonCount ?? 0,
      }
    })
    .sort(compareStandingEntries)
    .map((player, index) => ({ ...player, rank: index + 1 }))
}

export interface LeagueRanking {
  name: string
  totalScore: number
  rank: number
}

/**
 * The `name`/`totalScore`/`rank` columns of `buildLeagueStandings`, computing only
 * the mechanism the active ranking system actually uses (player rating, seasonal
 * average, or classic score with its adjustment mode). Used by the per-game replay.
 */
export function buildLeagueRankings(
  playerMap: Record<string, PlayerState>,
  settings?: LeagueSettingsDocument | null,
  context?: StandingAdjustmentContext,
): LeagueRanking[] {
  const resolvedSettings = getResolvedLeagueSettings(settings)
  const allPlayers = Object.values(playerMap)
  let scoreOf: (player: PlayerState) => number

  if (resolvedSettings.playerRankingSystem === 'player_rating_based') {
    const ratings = context
      ? calculatePlayerRatingValues(
        buildPlayerRatingStatesFromRecords(playerMap, context.gameRecords ?? {}),
        context.gameRecords ?? {},
        context.games ?? [],
        settings,
      )
      : null
    scoreOf = (player) => ratings?.[player.name] ?? 0
  } else {
    const cachedContext = withStandingsCaches(resolvedSettings, context)
    scoreOf = (player) => {
      const seasonAverages = cachedContext
        ? calculatePlayerSeasonAverages(
          player.name,
          cachedContext.games ?? [],
          cachedContext.gameRecords ?? {},
          settings,
          undefined,
          cachedContext.seasonAverageCache,
        )
        : null
      return seasonAverages?.enabled
        ? seasonAverages.totalAverage
        : getLeagueStandingMetrics(player, playerMap, settings, cachedContext).totalScore
    }
  }

  return allPlayers
    .map((player) => ({ name: player.name, totalScore: scoreOf(player), rank: 0 }))
    .sort(compareStandingEntries)
    .map((player, index) => ({ ...player, rank: index + 1 }))
}

function compareStandingEntries(a: { name: string; totalScore: number }, b: { name: string; totalScore: number }) {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
  return a.name.localeCompare(b.name)
}

function buildPlayerRatingStatesFromRecords(
  playerMap: Record<string, PlayerState>,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  return Object.fromEntries(
    Object.keys(playerMap).map((playerName) => {
      const records = Object.values(gameRecords[playerName] ?? {})
      const earnedAchievements = records.flatMap((record) => record.achievements ?? [])

      return [playerName, {
        name: playerName,
        gamesPlayed: records.length,
        baseWins: records.filter((record) => record.placement === 1).length,
        totalPoints: round3(records.reduce((sum, record) => sum + record.finalPoints, 0)),
        achievementPoints: round3(earnedAchievements.reduce((sum, achievement) => sum + achievement.points, 0)),
        earnedAchievements,
      }]
    }),
  ) as Record<string, {
    name: string
    gamesPlayed: number
    baseWins: number
    totalPoints: number
    achievementPoints: number
    earnedAchievements: EarnedAchievement[]
  }>
}

// Game ids and dates are compared constantly while sorting; parsing them once
// per distinct value keeps sorts cheap. Both caches are bounded by distinct values.
const gameIdNumberCache = new Map<string, number>()
const gameDayValueCache = new Map<string | number, number>()

function extractGameIdNumber(gameId: string) {
  const cached = gameIdNumberCache.get(gameId)
  if (cached !== undefined) return cached
  const match = gameId.match(/\d+/)
  const value = match ? Number(match[0]) : Number.POSITIVE_INFINITY
  gameIdNumberCache.set(gameId, value)
  return value
}

function gameDayValue(date: string | Date) {
  const key = typeof date === 'string' ? date : new Date(date).getTime()
  const cached = gameDayValueCache.get(key)
  if (cached !== undefined) return cached
  const d = new Date(date)
  const value = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  gameDayValueCache.set(key, value)
  return value
}
