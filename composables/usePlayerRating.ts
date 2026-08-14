import type { EarnedAchievement } from '~/utils/achievements'
import {
  buildLeagueSeasonRanges,
  getResolvedLeagueSettings,
  hasActiveSeasonalRanking,
  type LeagueSettingsDocument,
  type PlayerRatingConfig,
} from '~/utils/leagueSettings'

export type PlayerRatingSystemMode = 'composite' | 'simple_mmr'

export type PlayerRatingBreakdownKey =
  | 'recentPerformance'
  | 'allTimePerformance'
  | 'seasonPoints'
  | 'winRate'
  | 'commanderMMRContext'
  | 'averageCommanderMMR'
  | 'activityPoints'
  | 'achievements'
  | 'clutch'
  | 'commanderDiversity'

export type RatingBreakdownEntry = {
  rawValue: number
  normalizedScore: number
  weight: number
  weightedContribution: number
}

export type PlayerRatingResult = {
  playerId: string
  playerName?: string
  system: PlayerRatingSystemMode
  rating: number
  provisional: boolean
  weightedScore: number
  breakdown: Record<PlayerRatingBreakdownKey, RatingBreakdownEntry>
}

export type PlayerRatingFactorDetail = {
  key: PlayerRatingBreakdownKey
  label: string
  description: string
  formula: string
  rawValue: number
  normalizedScore: number
  weight: number
  weightedContribution: number
  detailLines: string[]
}

export type PlayerRatingSnapshot = {
  gameId: string
  date: string
  label: string
  system: PlayerRatingSystemMode
  commander: string
  placement: number
  rating: number
  weightedScore: number
  provisional: boolean
  gamesPlayed: number
  confidenceMultiplier: number
  breakdown: Record<PlayerRatingBreakdownKey, RatingBreakdownEntry>
  factors: Record<PlayerRatingBreakdownKey, PlayerRatingFactorDetail>
}

export type PlayerRatingDetail = {
  playerName: string
  system: PlayerRatingSystemMode
  rating: number
  weightedScore: number
  provisional: boolean
  gamesPlayed: number
  confidenceMultiplier: number
  minRating: number
  maxRating: number
  provisionalGames: number
  history: PlayerRatingSnapshot[]
  current: PlayerRatingSnapshot | null
}

export type PlayerRatingRecord = {
  gameId: string
  playerName: string
  commander: string
  placement: number
  basePoints: number
  finalPoints: number
  playerCount: number
  commanderMMRBefore: number
  commanderMMRAfter: number
  ratingBefore?: number
  achievements: EarnedAchievement[]
}

export type PlayerRatingPlayerState = {
  name: string
  gamesPlayed: number
  baseWins: number
  totalPoints: number
  achievementPoints: number
  earnedAchievements: EarnedAchievement[]
}

export type PlayerRatingGamePlayer = {
  name: string
  commander: string
  placement: number
}

export type PlayerRatingGame = {
  gameId: string
  date: string | Date
  players: PlayerRatingGamePlayer[]
}

export type CalculatePlayerRatingInput = {
  player: PlayerRatingPlayerState
  players: Record<string, PlayerRatingPlayerState>
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>
  games: PlayerRatingGame[]
  settings?: LeagueSettingsDocument | null
}

export type SimplePlayerMmrPodRecord = {
  playerName: string
  placement: number
}

export type SimplePlayerMmrUpdate = {
  playerName: string
  delta: number
  newRating: number
}

type RatingGameContext = {
  ownRecord: PlayerRatingRecord
  opponents: PlayerRatingRecord[]
  adjustedBaselinePoints: number
  expectedPlacement: number
  performanceDelta: number
  mmrGap: number
  averageOpponentCommanderMMR: number
  expectedPlayerPlacement: number
  playerPerformanceDelta: number
  playerRatingGap: number
  averageOpponentPlayerRating: number
}

type ScoreResult = {
  rawValue: number
  normalizedScore: number
}

type RatingComputation = {
  result: PlayerRatingResult
  confidenceMultiplier: number
  factors: Record<PlayerRatingBreakdownKey, PlayerRatingFactorDetail>
}

const ACHIEVEMENT_RARITY_MULTIPLIER = {
  common: 1,
  uncommon: 1.3,
  rare: 1.75,
  mythic: 2.4,
} as const

const SIMPLE_PLAYER_MMR_INITIAL_RATING = 1500
const SIMPLE_PLAYER_MMR_K_FACTOR = 32
const ACTIVITY_MIN_GAMES_FOR_SEASON = 10
const AVERAGE_COMMANDER_MMR_MIN = 0
const AVERAGE_COMMANDER_MMR_MAX = 3000
const AVERAGE_COMMANDER_MMR_LOGISTIC_STEEPNESS = 6

export function normalizeScore(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0
  if (max <= min) return value >= max ? 100 : 0
  return clamp(((value - min) / (max - min)) * 100, 0, 100)
}

export function normalizeLogisticScore(value: number, min: number, max: number, steepness = 6) {
  if (!Number.isFinite(value)) return 0
  if (max <= min) return value >= max ? 100 : 0
  if (value <= min) return 0
  if (value >= max) return 100

  const midpoint = (min + max) / 2
  const scale = steepness / (max - min)
  const sigmoid = (input: number) => 1 / (1 + Math.exp(-scale * (input - midpoint)))
  const lowerBound = sigmoid(min)
  const upperBound = sigmoid(max)
  return clamp(((sigmoid(value) - lowerBound) / (upperBound - lowerBound)) * 100, 0, 100)
}

export function applyDiminishingReturns(value: number, factor: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (factor <= 0) return value
  return value / (1 + factor * value)
}

export function calculatePlayerRating(input: CalculatePlayerRatingInput): PlayerRatingResult {
  return buildPlayerRatingComputation(input).result
}

export function buildPlayerRatingDetail(input: CalculatePlayerRatingInput): PlayerRatingDetail {
  const settings = getResolvedLeagueSettings(input.settings)
  const computation = buildPlayerRatingComputation(input)
  const records = getOrderedPlayerRecords(input.player.name, input.gameRecords, input.games)
  const gamesById = new Map(input.games.map((game) => [game.gameId, game]))
  const history = records.map((record, index) => {
    const includedRecords = records.slice(0, index + 1)
    const includedGameIds = new Set(includedRecords.map((entry) => entry.gameId))
    const partialGameRecords = filterGameRecords(input.gameRecords, includedGameIds)
    const partialGames = input.games.filter((game) => includedGameIds.has(game.gameId))
    const partialPlayer = buildPartialPlayer(input.player, includedRecords)
    const partialComputation = buildPlayerRatingComputation({
      ...input,
      player: partialPlayer,
      gameRecords: partialGameRecords,
      games: partialGames,
    })
    const gameDate = gamesById.get(record.gameId)?.date
    const date = formatSnapshotDate(gameDate)

    return {
      gameId: record.gameId,
      date,
      label: date,
      commander: record.commander,
      placement: record.placement,
      rating: partialComputation.result.rating,
      weightedScore: partialComputation.result.weightedScore,
      provisional: partialComputation.result.provisional,
      gamesPlayed: partialPlayer.gamesPlayed,
      confidenceMultiplier: partialComputation.confidenceMultiplier,
      breakdown: partialComputation.result.breakdown,
      factors: partialComputation.factors,
    } satisfies PlayerRatingSnapshot
  })

  return {
    playerName: input.player.name,
    system: computation.result.system,
    rating: computation.result.rating,
    weightedScore: computation.result.weightedScore,
    provisional: computation.result.provisional,
    gamesPlayed: input.player.gamesPlayed,
    confidenceMultiplier: computation.confidenceMultiplier,
    minRating: settings.playerRating.minRating,
    maxRating: settings.playerRating.maxRating,
    provisionalGames: settings.playerRating.provisionalGames,
    history,
    current: history.at(-1) ?? buildFallbackSnapshot(computation),
  }
}

function buildPlayerRatingComputation(input: CalculatePlayerRatingInput): RatingComputation {
  const settings = getResolvedLeagueSettings(input.settings)
  const config = settings.playerRating
  if (config.simpleMmr.enabled) {
    return buildSimplePlayerMmrComputation(input, settings)
  }
  const records = getOrderedPlayerRecords(input.player.name, input.gameRecords, input.games)
  const gamesById = new Map(input.games.map((game) => [game.gameId, game]))
  const gameContexts = buildGameContexts(input.player.name, input.gameRecords, input.games, config)

  const recentPerformance = calculateRecentPerformanceScore(records, gameContexts, settings, gamesById)
  const allTimePerformance = calculateAllTimePerformanceScore(records, gameContexts)
  const seasonPoints = calculateSeasonPointsScore(records, input.games, settings)
  const winRate = calculateWinRateScore(input.player)
  const commanderMMRContext = calculateCommanderMMRContextScore(gameContexts)
  const averageCommanderMMR = calculateAverageCommanderMMRScore(
    records,
    config.topCommandersForAverageMmr,
    config.minimumGamesForAverageCommanderMmr,
    config.missingCommanderMmr,
    config.usePeakCommanderMmrForAverage,
    calculateCommanderSlotReduction(records, input.games, settings),
  )
  const activityPoints = calculateActivityPointsScore(records, input.games, settings)
  const achievements = calculateAchievementScore(input.player, settings.achievements)
  const clutch = calculateClutchScore(gameContexts)
  const commanderDiversity = calculateCommanderDiversityScore(records)

  const weights = config.weights
  const breakdown = {
    recentPerformance: buildBreakdownEntry(recentPerformance.rawValue, recentPerformance.normalizedScore, weights.recentPerformance),
    allTimePerformance: buildBreakdownEntry(allTimePerformance.rawValue, allTimePerformance.normalizedScore, weights.allTimePerformance),
    seasonPoints: buildBreakdownEntry(seasonPoints.rawValue, seasonPoints.normalizedScore, weights.seasonPoints),
    winRate: buildBreakdownEntry(winRate.rawValue, winRate.normalizedScore, weights.winRate),
    commanderMMRContext: buildBreakdownEntry(commanderMMRContext.rawValue, commanderMMRContext.normalizedScore, weights.commanderMMRContext),
    averageCommanderMMR: buildBreakdownEntry(averageCommanderMMR.rawValue, averageCommanderMMR.normalizedScore, weights.averageCommanderMMR),
    activityPoints: buildBreakdownEntry(activityPoints.rawValue, activityPoints.normalizedScore, weights.commanderPoints),
    achievements: buildBreakdownEntry(achievements.rawValue, achievements.normalizedScore, weights.achievements),
    clutch: buildBreakdownEntry(clutch.rawValue, clutch.normalizedScore, weights.clutch),
    commanderDiversity: buildBreakdownEntry(commanderDiversity.rawValue, commanderDiversity.normalizedScore, weights.commanderDiversity),
  } satisfies PlayerRatingResult['breakdown']

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1
  const weightedScore = round3(
    Object.values(breakdown).reduce((sum, entry) => sum + entry.weightedContribution, 0) / totalWeight,
  )
  const activityConfidence = clamp(input.player.gamesPlayed / 12, 0.45, 1)
  const weightedWithConfidence = round3(weightedScore * activityConfidence)
  const ratingSpan = Math.max(0, config.maxRating - config.minRating)
  const rating = round3(config.minRating + (clamp(weightedWithConfidence, 0, 100) / 100) * ratingSpan)
  const factors = buildFactorDetails(
    input.player,
    breakdown,
    {
      recentPerformance,
      allTimePerformance,
      seasonPoints,
      winRate,
      commanderMMRContext,
      averageCommanderMMR,
      activityPoints,
      achievements,
      clutch,
      commanderDiversity,
    },
    settings,
  )

  return {
    result: {
      playerId: input.player.name,
      playerName: input.player.name,
      system: 'composite',
      rating,
      provisional: input.player.gamesPlayed < config.provisionalGames,
      weightedScore: clamp(weightedWithConfidence, 0, 100),
      breakdown,
    },
    confidenceMultiplier: activityConfidence,
    factors,
  }
}

function buildSimplePlayerMmrComputation(
  input: CalculatePlayerRatingInput,
  settings: ReturnType<typeof getResolvedLeagueSettings>,
): RatingComputation {
  const rating = calculateSimplePlayerMmrForPlayer(input.player.name, input.gameRecords, input.games)
  const confidenceMultiplier = clamp(input.player.gamesPlayed / settings.playerRating.provisionalGames, 0, 1)

  return {
    result: {
      playerId: input.player.name,
      playerName: input.player.name,
      system: 'simple_mmr',
      rating,
      provisional: input.player.gamesPlayed < settings.playerRating.provisionalGames,
      weightedScore: rating,
      breakdown: createZeroBreakdown(),
    },
    confidenceMultiplier,
    factors: createZeroFactorDetails(),
  }
}

export function calculatePlayerRatings(
  players: Record<string, PlayerRatingPlayerState>,
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  games: PlayerRatingGame[],
  settings?: LeagueSettingsDocument | null,
) {
  return Object.fromEntries(
    Object.values(players).map((player) => [
      player.name,
      calculatePlayerRating({ player, players, gameRecords, games, settings }),
    ]),
  ) as Record<string, PlayerRatingResult>
}

export function calculateRecentPerformanceScore(
  records: PlayerRatingRecord[],
  gameContexts: RatingGameContext[],
  settings: ReturnType<typeof getResolvedLeagueSettings>,
  gamesById: Map<string, PlayerRatingGame>,
) {
  const adjustedPoints = gameContexts.map((context) => context.adjustedBaselinePoints)
  const last10Average = average(adjustedPoints.slice(-10))
  const last25Average = average(adjustedPoints.slice(-25))
  const currentSeason = getCurrentSeasonRange(settings)
  const seasonAverage = average(
    records
      .filter((record) => {
        const game = gamesById.get(record.gameId)
        if (!game) return false
        const timestamp = new Date(game.date).getTime()
        if (Number.isNaN(timestamp)) return false
        if (currentSeason) {
          return timestamp >= currentSeason.startMs && timestamp <= currentSeason.endMs
        }
        const date = new Date(timestamp)
        const currentSeasonYear = getCurrentSeasonYear(gamesById)
        return currentSeasonYear !== null && date.getUTCFullYear() === currentSeasonYear
      })
      .map((record) => {
        const context = gameContexts.find((entry) => entry.ownRecord.gameId === record.gameId)
        return context?.adjustedBaselinePoints ?? record.basePoints
      }),
  )
  const rawValue = last10Average * 0.3 + last25Average * 0.6 + seasonAverage * 0.1
  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, 0, 1.8),
    last10Average: round3(last10Average),
    last25Average: round3(last25Average),
    seasonAverage: round3(seasonAverage),
  }
}

export function calculateAllTimePerformanceScore(
  records: PlayerRatingRecord[],
  gameContexts: RatingGameContext[],
) {
  const adjustedAverage = average(gameContexts.map((context) => context.adjustedBaselinePoints))
  const confidenceMultiplier = Math.min(1, records.length / 20)
  const rawValue = adjustedAverage * confidenceMultiplier
  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, 0, 1.7),
    adjustedAverage: round3(adjustedAverage),
    confidenceMultiplier: round3(confidenceMultiplier),
  }
}

export function calculateSeasonPointsScore(
  records: PlayerRatingRecord[],
  games: PlayerRatingGame[],
  settings: ReturnType<typeof getResolvedLeagueSettings>,
) {
  const gameTimeById = new Map(
    games.map((game) => {
      const timestamp = new Date(game.date).getTime()
      return [game.gameId, Number.isNaN(timestamp) ? null : timestamp] as const
    }),
  )
  const configuredSeasons = hasActiveSeasonalRanking(settings.standings.seasonalRanking)
    ? buildLeagueSeasonRanges(settings.standings.seasonalRanking)
    : []

  if (configuredSeasons.length > 0) {
    const now = Date.now()
    const startedSeasons = configuredSeasons.filter((season) => season.startMs <= now)
    const seasonAverages = startedSeasons.flatMap((season) => {
      const seasonRecords = records.filter((record) => {
        const timestamp = gameTimeById.get(record.gameId)
        return timestamp !== null && timestamp !== undefined && timestamp >= season.startMs && timestamp <= season.endMs
      })

      return seasonRecords.length > 0
        ? [seasonRecords.reduce((sum, record) => sum + record.finalPoints, 0) / seasonRecords.length]
        : []
    })
    const rawValue = average(seasonAverages)

    return {
      rawValue,
      normalizedScore: normalizeScore(rawValue, 0, 1),
      seasonAverage: round3(rawValue),
      playedSeasons: seasonAverages.length,
      configuredSeasons: configuredSeasons.length,
      usesConfiguredSeasons: 1,
    }
  }

  const gamesById = new Map(games.map((game) => [game.gameId, game]))
  const currentSeasonYear = getCurrentSeasonYear(gamesById)
  const currentSeasonRecords = records.filter((record) => {
    if (currentSeasonYear === null) return false
    const timestamp = gameTimeById.get(record.gameId)
    if (timestamp === null || timestamp === undefined) return false
    return new Date(timestamp).getUTCFullYear() === currentSeasonYear
  })
  const rawValue = currentSeasonRecords.length > 0
    ? currentSeasonRecords.reduce((sum, record) => sum + record.finalPoints, 0) / currentSeasonRecords.length
    : 0

  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, 0, 1.8),
    seasonAverage: round3(rawValue),
    playedSeasons: currentSeasonYear === null ? 0 : 1,
    configuredSeasons: 0,
    usesConfiguredSeasons: 0,
  }
}

export function calculateWinRateScore(player: PlayerRatingPlayerState) {
  const rawValue = player.gamesPlayed > 0 ? player.baseWins / player.gamesPlayed : 0
  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, -1, 0.45),
    wins: player.baseWins,
    gamesPlayed: player.gamesPlayed,
  }
}

export function calculateCommanderMMRContextScore(gameContexts: RatingGameContext[]) {
  const rawValue = average(gameContexts.map((context) => context.performanceDelta))
  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, -1.5, 1.5),
    averagePerformanceDelta: round3(rawValue),
    averageMmrGap: round3(average(gameContexts.map((context) => context.mmrGap))),
  }
}

export function calculateAverageCommanderMMRScore(
  records: PlayerRatingRecord[],
  topCommanderCount = 3,
  minimumGamesPerCommander = 1,
  missingCommanderMmr = 0,
  usePeakCommanderMmr = false,
  commanderSlotReduction = 0,
) {
  const commanderStats = new Map<string, { gamesPlayed: number; latestMmr: number; peakMmr: number }>()

  for (const record of records) {
    const current = commanderStats.get(record.commander)
    const mmrValue = record.commanderMMRAfter ?? record.commanderMMRBefore ?? 0
    commanderStats.set(record.commander, {
      gamesPlayed: (current?.gamesPlayed ?? 0) + 1,
      latestMmr: mmrValue,
      peakMmr: Math.max(current?.peakMmr ?? mmrValue, mmrValue),
    })
  }

  const configuredTopCommanderCount = Math.max(1, topCommanderCount)
  const sanitizedSlotReduction = Math.max(0, Math.floor(commanderSlotReduction))
  const sanitizedTopCommanderCount = Math.max(1, configuredTopCommanderCount - sanitizedSlotReduction)
  const sanitizedMinimumGames = Math.max(1, minimumGamesPerCommander)
  const sanitizedMissingCommanderMmr = Number.isFinite(missingCommanderMmr) ? missingCommanderMmr : 0
  const eligibleCommanders = [...commanderStats.values()]
    .filter((commander) => commander.gamesPlayed >= sanitizedMinimumGames)

  const bestCommanderMmrs = eligibleCommanders
    .map((commander) => usePeakCommanderMmr ? commander.peakMmr : commander.latestMmr)
    .sort((left, right) => right - left)
    .slice(0, sanitizedTopCommanderCount)
  const eligibleCommanderSlots = bestCommanderMmrs.length
  const fallbackSlots = sanitizedTopCommanderCount - eligibleCommanderSlots

  while (bestCommanderMmrs.length < sanitizedTopCommanderCount) {
    bestCommanderMmrs.push(sanitizedMissingCommanderMmr)
  }

  const rawValue = average(bestCommanderMmrs)
  return {
    rawValue,
    // Logistic option kept for easy reactivation:
    // normalizedScore: normalizeLogisticScore(
    //   rawValue,
    //   AVERAGE_COMMANDER_MMR_MIN,
    //   AVERAGE_COMMANDER_MMR_MAX,
    //   AVERAGE_COMMANDER_MMR_LOGISTIC_STEEPNESS,
    // ),
    normalizedScore: normalizeScore(rawValue, AVERAGE_COMMANDER_MMR_MIN, AVERAGE_COMMANDER_MMR_MAX),
    averageCommanderMMR: round3(rawValue),
    countedCommanders: eligibleCommanderSlots,
    fallbackSlots,
    configuredCommanderSlots: configuredTopCommanderCount,
    commanderSlotReduction: configuredTopCommanderCount - sanitizedTopCommanderCount,
    availableCommanders: commanderStats.size,
    eligibleCommanders: eligibleCommanders.length,
    minimumGamesPerCommander: sanitizedMinimumGames,
    missingCommanderMmr: round3(sanitizedMissingCommanderMmr),
    usePeakCommanderMmr: usePeakCommanderMmr ? 1 : 0,
  }
}

export function calculateCommanderSlotReduction(
  records: PlayerRatingRecord[],
  games: PlayerRatingGame[],
  settings: ReturnType<typeof getResolvedLeagueSettings>,
) {
  if (records.length === 0 || !hasActiveSeasonalRanking(settings.standings.seasonalRanking)) return 0

  const timestamps = new Map(games.map((game) => [game.gameId, new Date(game.date).getTime()]))
  const firstGameTimestamp = records.reduce((earliest, record) => {
    const timestamp = timestamps.get(record.gameId)
    return timestamp !== undefined && Number.isFinite(timestamp) ? Math.min(earliest, timestamp) : earliest
  }, Number.POSITIVE_INFINITY)
  if (!Number.isFinite(firstGameTimestamp)) return 0

  return buildLeagueSeasonRanges(settings.standings.seasonalRanking)
    .filter((season) => season.endMs < firstGameTimestamp)
    .length
}

export function calculateCommanderDiversityScore(records: PlayerRatingRecord[]) {
  if (records.length === 0) {
    return {
      rawValue: 0,
      normalizedScore: 0,
      uniqueCommanders: 0,
      mainCommanderShare: 0,
      entropyRatio: 0,
    }
  }
  const commanderCounts = new Map<string, number>()
  for (const record of records) {
    commanderCounts.set(record.commander, (commanderCounts.get(record.commander) ?? 0) + 1)
  }
  const uniqueCommanders = commanderCounts.size
  const mainCommanderShare = Math.max(...commanderCounts.values()) / records.length
  const entropy = calculateCommanderEntropy([...commanderCounts.values()], records.length)
  const entropyRatio = uniqueCommanders <= 1 ? 0 : entropy / Math.log2(uniqueCommanders)
  const rawValue = ((1 - mainCommanderShare) * 0.5 + entropyRatio * 0.3 + Math.min(1, uniqueCommanders / 10) * 0.2) * 100
  return {
    rawValue,
    normalizedScore: clamp(rawValue, 0, 100),
    uniqueCommanders,
    mainCommanderShare: round3(mainCommanderShare),
    entropyRatio: round3(entropyRatio),
  }
}

export function calculateActivityPointsScore(
  records: PlayerRatingRecord[],
  games: PlayerRatingGame[],
  settings: ReturnType<typeof getResolvedLeagueSettings>,
) {
  const configuredSeasons = hasActiveSeasonalRanking(settings.standings.seasonalRanking)
    ? buildLeagueSeasonRanges(settings.standings.seasonalRanking)
    : []
  const now = Date.now()

  if (records.length === 0) {
    const completedSeasons = configuredSeasons.filter((season) => season.endMs < now).length
    return {
      rawValue: 0,
      normalizedScore: 0,
      countingGames: 0,
      gamesForMax: completedSeasons > 0 ? 0 : settings.playerRating.activityGamesForMax,
      qualifyingSeasons: 0,
      totalSeasons: completedSeasons,
    }
  }

  const gameDates = new Map(games.map((game) => [game.gameId, new Date(game.date)]))
  const gamesBySeason = new Map<string, number>()

  for (const record of records) {
    const date = gameDates.get(record.gameId)
    const timestamp = date?.getTime()
    const configuredSeason = timestamp === undefined || Number.isNaN(timestamp)
      ? undefined
      : configuredSeasons.find((season) => timestamp >= season.startMs && timestamp <= season.endMs)
    const seasonKey = configuredSeason
      ? `configured-${configuredSeason.index}`
      : date && !Number.isNaN(date.getTime())
        ? `calendar-${date.getUTCFullYear()}`
        : 'unknown'
    gamesBySeason.set(seasonKey, (gamesBySeason.get(seasonKey) ?? 0) + 1)
  }

  const countingGames = records.length
  const qualifyingConfiguredSeasons = configuredSeasons.filter((season) =>
    (gamesBySeason.get(`configured-${season.index}`) ?? 0) >= ACTIVITY_MIN_GAMES_FOR_SEASON,
  )
  const relevantSeasons = configuredSeasons.filter((season) =>
    season.endMs < now || qualifyingConfiguredSeasons.includes(season),
  )
  const qualifyingSeasons = configuredSeasons.length > 0
    ? qualifyingConfiguredSeasons.length
    : gamesBySeason.size
  const gamesForMax = relevantSeasons.length > 0
    ? settings.playerRating.activityGamesForMax * (qualifyingSeasons / relevantSeasons.length)
    : settings.playerRating.activityGamesForMax
  return {
    rawValue: countingGames,
    normalizedScore: gamesForMax > 0 ? normalizeScore(countingGames, 0, gamesForMax) : 0,
    countingGames,
    gamesForMax,
    qualifyingSeasons,
    totalSeasons: relevantSeasons.length,
  }
}

export function calculateAchievementScore(
  player: PlayerRatingPlayerState,
  achievementDefs: ReturnType<typeof getResolvedLeagueSettings>['achievements'],
) {
  const counts = new Map<string, number>()
  for (const achievement of player.earnedAchievements) {
    counts.set(achievement.id, (counts.get(achievement.id) ?? 0) + 1)
  }

  let weightedValue = 0
  for (const [achievementId, count] of counts.entries()) {
    const definition = achievementDefs[achievementId]
    if (!definition) continue
    const rarityMultiplier = ACHIEVEMENT_RARITY_MULTIPLIER[definition.rarity] ?? 1
    const repetitionValue = definition.repeatable
      ? [...Array(count)].reduce((sum, _unused, index) => sum + definition.points / (1 + index * 0.8), 0)
      : definition.points
    weightedValue += repetitionValue * rarityMultiplier
  }

  const rawValue = Math.min(weightedValue, 18)
  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, 0, 18),
    weightedValue: round3(weightedValue),
    uniqueAchievements: counts.size,
    totalUnlocks: player.earnedAchievements.length,
  }
}

export function calculateClutchScore(gameContexts: RatingGameContext[]) {
  const clutchValues = gameContexts.map((context) => {
    const winBonus = context.ownRecord.placement === 1
      ? Math.max(0, context.playerRatingGap / 250) + Math.max(0, context.playerPerformanceDelta * 0.4)
      : 0
    const outperformBonus = Math.max(0, context.playerPerformanceDelta) * (1 + Math.max(0, context.playerRatingGap) / 600)
    return { winBonus, outperformBonus, total: winBonus + outperformBonus }
  })

  const rawValue = average(clutchValues.map((entry) => entry.total))

  return {
    rawValue,
    normalizedScore: normalizeScore(rawValue, 0, 2.5),
    averageWinBonus: round3(average(clutchValues.map((entry) => entry.winBonus))),
    averageOutperformBonus: round3(average(clutchValues.map((entry) => entry.outperformBonus))),
    averagePlayerRatingGap: round3(average(gameContexts.map((context) => context.playerRatingGap))),
    averagePlayerPerformanceDelta: round3(average(gameContexts.map((context) => context.playerPerformanceDelta))),
  }
}

function buildFactorDetails(
  player: PlayerRatingPlayerState,
  breakdown: Record<PlayerRatingBreakdownKey, RatingBreakdownEntry>,
  factors: Record<PlayerRatingBreakdownKey, ScoreResult & Record<string, number>>,
  settings: ReturnType<typeof getResolvedLeagueSettings>,
) {
  return {
    recentPerformance: buildFactorDetail(
      'recentPerformance',
      breakdown.recentPerformance,
      [
        `last 10 avg: ${round3(factors.recentPerformance.last10Average ?? 0)}`,
        `last 25 avg: ${round3(factors.recentPerformance.last25Average ?? 0)}`,
        `current season avg: ${round3(factors.recentPerformance.seasonAverage ?? 0)}`,
        'raw = last10*0.3 + last25*0.6 + season*0.1',
      ],
    ),
    allTimePerformance: buildFactorDetail(
      'allTimePerformance',
      breakdown.allTimePerformance,
      [
        `adjusted avg points: ${round3(factors.allTimePerformance.adjustedAverage ?? 0)}`,
        `sample confidence: ${Math.round((factors.allTimePerformance.confidenceMultiplier ?? 0) * 100)}%`,
        'raw = adjusted average * confidence',
      ],
    ),
    seasonPoints: buildFactorDetail(
      'seasonPoints',
      breakdown.seasonPoints,
      [
        `season avg points: ${round3(factors.seasonPoints.seasonAverage ?? 0)}`,
        `played seasons counted: ${Math.round(factors.seasonPoints.playedSeasons ?? 0)}`,
        (factors.seasonPoints.usesConfiguredSeasons ?? 0) > 0
          ? `configured seasons available: ${Math.round(factors.seasonPoints.configuredSeasons ?? 0)}`
          : 'falling back to the latest calendar-season average',
      ],
    ),
    winRate: buildFactorDetail(
      'winRate',
      breakdown.winRate,
      [
        `wins: ${Math.round(factors.winRate.wins ?? 0)}`,
        `games played: ${Math.round(factors.winRate.gamesPlayed ?? 0)}`,
        `raw win rate: ${Math.round((factors.winRate.rawValue ?? 0) * 100)}%`,
      ],
    ),
    commanderMMRContext: buildFactorDetail(
      'commanderMMRContext',
      breakdown.commanderMMRContext,
      [
        `avg placement over/under expectation: ${round3(factors.commanderMMRContext.averagePerformanceDelta ?? 0)}`,
        `avg MMR gap vs pod: ${round3(factors.commanderMMRContext.averageMmrGap ?? 0)}`,
        'positive values mean you beat MMR expectations',
      ],
    ),
    averageCommanderMMR: buildFactorDetail(
      'averageCommanderMMR',
      breakdown.averageCommanderMMR,
      [
        `average commander MMR: ${round3(factors.averageCommanderMMR.averageCommanderMMR ?? 0)}`,
        `best commanders counted: ${Math.round(factors.averageCommanderMMR.countedCommanders ?? 0)}`,
        `minimum games per commander: ${Math.round(factors.averageCommanderMMR.minimumGamesPerCommander ?? 0)}`,
        `fallback MMR for missing or lower-rated slots: ${round3(factors.averageCommanderMMR.missingCommanderMmr ?? 0)}`,
        `fallback slots used: ${Math.round(factors.averageCommanderMMR.fallbackSlots ?? 0)}`,
        `MMR source: ${(factors.averageCommanderMMR.usePeakCommanderMmr ?? 0) > 0 ? 'peak ever' : 'current'}`,
        `eligible commanders: ${Math.round(factors.averageCommanderMMR.eligibleCommanders ?? 0)}`,
        `commanders available: ${Math.round(factors.averageCommanderMMR.availableCommanders ?? 0)}`,
        'higher values mean your regular commander pool is stronger on average',
      ],
    ),
    activityPoints: buildFactorDetail(
      'activityPoints',
      breakdown.activityPoints,
      [
        `counting games: ${Math.round(factors.activityPoints.countingGames ?? 0)}`,
        `qualifying seasons: ${Math.round(factors.activityPoints.qualifyingSeasons ?? 0)}/${Math.round(factors.activityPoints.totalSeasons ?? 0)}`,
        `maximum at: ${Math.round(factors.activityPoints.gamesForMax ?? 0)} counting games`,
      ],
    ),
    achievements: buildFactorDetail(
      'achievements',
      breakdown.achievements,
      [
        `unique achievements: ${Math.round(factors.achievements.uniqueAchievements ?? 0)}`,
        `total unlocks: ${Math.round(factors.achievements.totalUnlocks ?? 0)}`,
        `weighted before cap: ${round3(factors.achievements.weightedValue ?? 0)}`,
        'repeat unlocks decay and the category caps at 18',
      ],
    ),
    clutch: buildFactorDetail(
      'clutch',
      breakdown.clutch,
      [
        `avg win bonus: ${round3(factors.clutch.averageWinBonus ?? 0)}`,
        `avg outperform bonus: ${round3(factors.clutch.averageOutperformBonus ?? 0)}`,
        `avg player-rating gap vs pod: ${round3(factors.clutch.averagePlayerRatingGap ?? 0)}`,
        'rewards wins and overperforming against stronger-rated players',
      ],
    ),
    commanderDiversity: buildFactorDetail(
      'commanderDiversity',
      breakdown.commanderDiversity,
      [
        `unique commanders: ${Math.round(factors.commanderDiversity.uniqueCommanders ?? 0)}`,
        `main commander share: ${Math.round((factors.commanderDiversity.mainCommanderShare ?? 0) * 100)}%`,
        `entropy ratio: ${round3(factors.commanderDiversity.entropyRatio ?? 0)}`,
        'mixes spread, entropy, and breadth of commander pool',
      ],
    ),
  } satisfies Record<PlayerRatingBreakdownKey, PlayerRatingFactorDetail>
}

function buildFactorDetail(
  key: PlayerRatingBreakdownKey,
  breakdown: RatingBreakdownEntry,
  detailLines: string[],
): PlayerRatingFactorDetail {
  return {
    key,
    label: FACTOR_META[key].label,
    description: FACTOR_META[key].description,
    formula: FACTOR_META[key].formula,
    rawValue: breakdown.rawValue,
    normalizedScore: breakdown.normalizedScore,
    weight: breakdown.weight,
    weightedContribution: breakdown.weightedContribution,
    detailLines,
  }
}

function buildPartialPlayer(
  player: PlayerRatingPlayerState,
  records: PlayerRatingRecord[],
): PlayerRatingPlayerState {
  const earnedAchievements = records.flatMap((record) => record.achievements)
  return {
    ...player,
    gamesPlayed: records.length,
    baseWins: records.filter((record) => record.placement === 1).length,
    totalPoints: round3(records.reduce((sum, record) => sum + record.finalPoints, 0)),
    achievementPoints: round3(earnedAchievements.reduce((sum, achievement) => sum + achievement.points, 0)),
    earnedAchievements,
  }
}

function filterGameRecords(
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  includedGameIds: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(gameRecords).map(([playerName, records]) => [
      playerName,
      Object.fromEntries(
        Object.entries(records).filter(([gameId]) => includedGameIds.has(gameId)),
      ),
    ]),
  ) as Record<string, Record<string, PlayerRatingRecord>>
}

function buildFallbackSnapshot(computation: RatingComputation) {
  return {
    gameId: '',
    date: 'Now',
    label: 'Now',
    system: computation.result.system,
    commander: '',
    placement: 0,
    rating: computation.result.rating,
    weightedScore: computation.result.weightedScore,
    provisional: computation.result.provisional,
    gamesPlayed: 0,
    confidenceMultiplier: computation.confidenceMultiplier,
    breakdown: computation.result.breakdown,
    factors: computation.factors,
  } satisfies PlayerRatingSnapshot
}

function calculateSimplePlayerMmrForPlayer(
  playerName: string,
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  games: PlayerRatingGame[],
) {
  const playerRecords = getOrderedPlayerRecords(playerName, gameRecords, games)
  if (playerRecords.length === 0) return 0
  const ratings = calculateSimplePlayerMmrRatings(gameRecords, games)
  return round3(ratings[playerName] ?? SIMPLE_PLAYER_MMR_INITIAL_RATING)
}

export function calculateSimplePlayerMmrRatings(
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  games: PlayerRatingGame[],
) {
  const ratings = new Map<string, number>()

  for (const game of games) {
    const podRecords = game.players
      .map((player) => gameRecords[player.name]?.[game.gameId])
      .filter((entry): entry is PlayerRatingRecord => Boolean(entry))
      .map((record) => ({
        playerName: record.playerName,
        placement: record.placement,
      }))

    if (podRecords.length < 2) continue

    const updates = calculateSimplePlayerMmrUpdates(
      Object.fromEntries(ratings.entries()),
      podRecords,
    )

    for (const update of updates) {
      ratings.set(update.playerName, update.newRating)
    }
  }

  return Object.fromEntries(ratings.entries()) as Record<string, number>
}

export function calculateSimplePlayerMmrUpdates(
  currentRatings: Record<string, number>,
  podRecords: SimplePlayerMmrPodRecord[],
): SimplePlayerMmrUpdate[] {
  if (podRecords.length < 2) return []

  return podRecords.map((record) => {
    const currentRating = currentRatings[record.playerName] ?? SIMPLE_PLAYER_MMR_INITIAL_RATING
    let actualScore = 0
    let expectedScore = 0

    for (const opponent of podRecords) {
      if (opponent.playerName === record.playerName) continue

      const opponentRating = currentRatings[opponent.playerName] ?? SIMPLE_PLAYER_MMR_INITIAL_RATING
      expectedScore += 1 / (1 + 10 ** ((opponentRating - currentRating) / 400))

      if (record.placement < opponent.placement) actualScore += 1
      else if (record.placement === opponent.placement) actualScore += 0.5
    }

    const perOpponentK = SIMPLE_PLAYER_MMR_K_FACTOR / Math.max(1, podRecords.length - 1)
    const delta = perOpponentK * (actualScore - expectedScore)

    return {
      playerName: record.playerName,
      delta: round3(delta),
      newRating: round3(currentRating + delta),
    }
  })
}

function createZeroBreakdown(): Record<PlayerRatingBreakdownKey, RatingBreakdownEntry> {
  return {
    recentPerformance: buildBreakdownEntry(0, 0, 0),
    allTimePerformance: buildBreakdownEntry(0, 0, 0),
    seasonPoints: buildBreakdownEntry(0, 0, 0),
    winRate: buildBreakdownEntry(0, 0, 0),
    commanderMMRContext: buildBreakdownEntry(0, 0, 0),
    averageCommanderMMR: buildBreakdownEntry(0, 0, 0),
    activityPoints: buildBreakdownEntry(0, 0, 0),
    achievements: buildBreakdownEntry(0, 0, 0),
    clutch: buildBreakdownEntry(0, 0, 0),
    commanderDiversity: buildBreakdownEntry(0, 0, 0),
  }
}

function createZeroFactorDetails(): Record<PlayerRatingBreakdownKey, PlayerRatingFactorDetail> {
  const breakdown = createZeroBreakdown()
  return {
    recentPerformance: buildFactorDetail('recentPerformance', breakdown.recentPerformance, ['Not used in simple player MMR mode.']),
    allTimePerformance: buildFactorDetail('allTimePerformance', breakdown.allTimePerformance, ['Not used in simple player MMR mode.']),
    seasonPoints: buildFactorDetail('seasonPoints', breakdown.seasonPoints, ['Not used in simple player MMR mode.']),
    winRate: buildFactorDetail('winRate', breakdown.winRate, ['Not used in simple player MMR mode.']),
    commanderMMRContext: buildFactorDetail('commanderMMRContext', breakdown.commanderMMRContext, ['Not used in simple player MMR mode.']),
    averageCommanderMMR: buildFactorDetail('averageCommanderMMR', breakdown.averageCommanderMMR, ['Not used in simple player MMR mode.']),
    activityPoints: buildFactorDetail('activityPoints', breakdown.activityPoints, ['Not used in simple player MMR mode.']),
    achievements: buildFactorDetail('achievements', breakdown.achievements, ['Not used in simple player MMR mode.']),
    clutch: buildFactorDetail('clutch', breakdown.clutch, ['Not used in simple player MMR mode.']),
    commanderDiversity: buildFactorDetail('commanderDiversity', breakdown.commanderDiversity, ['Not used in simple player MMR mode.']),
  }
}

function formatSnapshotDate(value: string | Date | undefined) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const FACTOR_META: Record<PlayerRatingBreakdownKey, { label: string, description: string, formula: string }> = {
  recentPerformance: {
    label: 'Recent Form',
    description: 'Recent games matter most, with current-season form still contributing.',
    formula: 'Normalize(last10*0.3 + last25*0.6 + season*0.1) × weight',
  },
  allTimePerformance: {
    label: 'All-Time Performance',
    description: 'Long-term adjusted point average, scaled up as your sample becomes trustworthy.',
    formula: 'Normalize(adjusted average * sample confidence) × weight',
  },
  seasonPoints: {
    label: 'Season Points',
    description: 'Rewards stronger average points across the configured league seasons.',
    formula: 'Normalize(average of started season point averages) x weight',
  },
  winRate: {
    label: 'Win Rate',
    description: 'How often you actually convert games into wins.',
    formula: 'Normalize(wins / games played) × weight',
  },
  commanderMMRContext: {
    label: 'Finishes Against Stronger Commanders',
    description: 'Rewards beating the placement your commander MMR predicted against the pod you faced.',
    formula: 'Normalize(avg(expected placement - actual placement)) × weight',
  },
  averageCommanderMMR: {
    label: 'Average Commander MMR',
    description: 'Rewards maintaining a stronger commander pool using linear normalization across the configured MMR range.',
    formula: 'Normalize(avg commander MMR) × weight',
  },
  activityPoints: {
    label: 'Activity',
    description: 'Rewards games played regardless of performance. Every game counts toward the configured maximum.',
    formula: 'Normalize(counting games / games for maximum) × weight',
  },
  achievements: {
    label: 'Achievements',
    description: 'Unique and rare achievements matter most, with repeatable ones decaying and a hard cap applied.',
    formula: 'Normalize(min(weighted achievement value, 18)) × weight',
  },
  clutch: {
    label: 'Finishes Against Stronger Players',
    description: 'Rewards wins and better-than-expected finishes against players with a higher pre-game rating.',
    formula: 'Normalize(avg(player win bonus + player outperform bonus)) × weight',
  },
  commanderDiversity: {
    label: 'Commander Diversity',
    description: 'Rewards breadth of commander choices instead of overfocusing on one deck.',
    formula: 'Normalize(diversity blend of spread, entropy, and breadth) × weight',
  },
}

function buildBreakdownEntry(rawValue: number, normalizedScore: number, weight: number): RatingBreakdownEntry {
  return {
    rawValue: round3(rawValue),
    normalizedScore: round3(normalizedScore),
    weight,
    weightedContribution: round3(normalizedScore * weight),
  }
}

function buildGameContexts(
  playerName: string,
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  games: PlayerRatingGame[],
  config: PlayerRatingConfig,
) {
  return getOrderedPlayerRecords(playerName, gameRecords, games)
    .map((record) => {
      const game = games.find((entry) => entry.gameId === record.gameId)
      if (!game) return null

      const podRecords = game.players
        .map((player) => gameRecords[player.name]?.[game.gameId])
        .filter((entry): entry is PlayerRatingRecord => Boolean(entry))
      const opponents = podRecords.filter((entry) => entry.playerName !== playerName)
      const averageOpponentCommanderMMR = average(opponents.map((entry) => entry.commanderMMRBefore))
      const mmrGap = averageOpponentCommanderMMR - record.commanderMMRBefore
      const modifierCap = config.commanderMMRPointModifier.maxModifierPercent
      const modifierPercent = config.commanderMMRPointModifier.enabled
        ? clamp((mmrGap / 600) * modifierCap, -modifierCap, modifierCap)
        : 0
      const adjustedBaselinePoints = round3(record.basePoints * (1 + modifierPercent / 100))
      const expectedPlacement = getExpectedPlacementFromCommanderMMR(record.commanderMMRBefore, podRecords)
      const performanceDelta = expectedPlacement - record.placement
      const averageOpponentPlayerRating = average(opponents.map((entry) => entry.ratingBefore ?? 0))
      const ownPlayerRating = record.ratingBefore ?? 0
      const playerRatingGap = averageOpponentPlayerRating - ownPlayerRating
      const expectedPlayerPlacement = getExpectedPlacementFromPlayerRating(record, podRecords)
      const playerPerformanceDelta = expectedPlayerPlacement - record.placement

      return {
        ownRecord: record,
        opponents,
        adjustedBaselinePoints,
        expectedPlacement,
        performanceDelta,
        mmrGap,
        averageOpponentCommanderMMR,
        expectedPlayerPlacement,
        playerPerformanceDelta,
        playerRatingGap,
        averageOpponentPlayerRating,
      } satisfies RatingGameContext
    })
    .filter((entry): entry is RatingGameContext => entry !== null)
}

function getOrderedPlayerRecords(
  playerName: string,
  gameRecords: Record<string, Record<string, PlayerRatingRecord>>,
  games: PlayerRatingGame[],
) {
  const order = new Map(games.map((game, index) => [game.gameId, index]))
  return Object.values(gameRecords[playerName] ?? {})
    .sort((a, b) => (order.get(a.gameId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.gameId) ?? Number.MAX_SAFE_INTEGER))
}

function getExpectedPlacementFromCommanderMMR(
  ownMmr: number,
  podRecords: PlayerRatingRecord[],
) {
  if (podRecords.length === 0) return 1
  const higher = podRecords.filter((record) => record.commanderMMRBefore > ownMmr).length
  const tied = podRecords.filter((record) => record.commanderMMRBefore === ownMmr).length
  return 1 + higher + Math.max(0, tied - 1) / 2
}

function getExpectedPlacementFromPlayerRating(
  ownRecord: PlayerRatingRecord,
  podRecords: PlayerRatingRecord[],
) {
  const ownRating = ownRecord.ratingBefore ?? 0
  const higher = podRecords.filter((record) => (record.ratingBefore ?? 0) > ownRating).length
  const tied = podRecords.filter((record) => (record.ratingBefore ?? 0) === ownRating).length
  return 1 + higher + Math.max(0, tied - 1) / 2
}

function calculateCommanderEntropy(counts: number[], total: number) {
  if (total <= 0) return 0
  return counts.reduce((sum, count) => {
    const probability = count / total
    return probability <= 0 ? sum : sum - probability * Math.log2(probability)
  }, 0)
}

function getCurrentSeasonYear(gamesById: Map<string, PlayerRatingGame>) {
  const latest = [...gamesById.values()].at(-1)
  if (!latest) return null
  const date = new Date(latest.date)
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear()
}

function getCurrentSeasonRange(settings: ReturnType<typeof getResolvedLeagueSettings>) {
  if (!hasActiveSeasonalRanking(settings.standings.seasonalRanking)) return null
  const seasons = buildLeagueSeasonRanges(settings.standings.seasonalRanking)
  const now = Date.now()
  return seasons.find((season) => now >= season.startMs && now <= season.endMs)
    ?? seasons.filter((season) => season.startMs <= now).at(-1)
    ?? null
}

function average(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value))
  if (finite.length === 0) return 0
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}
