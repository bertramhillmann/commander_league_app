import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BASE_RATINGS,
  DEFAULT_LEVEL_THRESHOLDS,
  DEFAULT_MAX_LEVEL,
  DEFAULT_WIN_BONUS_XP,
  DEFAULT_XP_PER_GAME,
  type AchievementDef,
  type PlacementRating,
} from '~/utils/scoringDefaults'

export type StandingsAdjustmentMode = 'compensation' | 'freeGames' | 'penaltyGames'
export type PlayerRankingSystem = 'classic' | 'player_rating_based'

export const DEFAULT_FREE_GAMES_BASELINE_AVG = 0.5
export const DEFAULT_FREE_GAMES_CONSECUTIVE_PENALTY = 0.01
export const DEFAULT_FREE_GAMES_MIN_AVG = 0.3
export const DEFAULT_FREE_GAMES_GRACE_MISSES = 3
export const DEFAULT_PENALTY_FACTOR = 0.88
export const DEFAULT_LOOSTER_COST = 2.4
export const MIN_GAMES_FOR_PENALTY_MODE = 30
export const DEFAULT_PLAYER_RATING_MIN = 0
export const DEFAULT_PLAYER_RATING_MAX = 4000
export const DEFAULT_PLAYER_RATING_PROVISIONAL_GAMES = 10
export const DEFAULT_PLAYER_RATING_MMR_POINT_MODIFIER_MAX = 50
export const DEFAULT_PLAYER_RATING_LPOINT_MMR_MODIFIER_ENABLED = false
export const DEFAULT_PLAYER_RATING_SIMPLE_MMR_ENABLED = false
export const DEFAULT_PLAYER_RATING_TOP_COMMANDERS_FOR_AVERAGE_MMR = 3
export const DEFAULT_PLAYER_RATING_MIN_GAMES_FOR_AVERAGE_COMMANDER_MMR = 10
export const DEFAULT_PLAYER_RATING_MISSING_COMMANDER_MMR = 0
export const DEFAULT_STANDINGS_SEASON_COUNT = 4

export interface StandingsSeasonalRankingConfig {
  enabled: boolean
  leagueStartDate: string
  leagueEndDate: string
  seasonCount: number
}

export interface LeagueSeasonRange {
  index: number
  label: string
  startDate: string
  endDate: string
  startMs: number
  endMs: number
}

export interface PlayerRatingWeights {
  recentPerformance: number
  allTimePerformance: number
  seasonPoints: number
  winRate: number
  commanderMMRContext: number
  averageCommanderMMR: number
  commanderPoints: number
  achievements: number
  clutch: number
  commanderDiversity: number
}

export interface PlayerRatingConfig {
  minRating: number
  maxRating: number
  provisionalGames: number
  topCommandersForAverageMmr: number
  minimumGamesForAverageCommanderMmr: number
  missingCommanderMmr: number
  usePeakCommanderMmrForAverage: boolean
  simpleMmr: {
    enabled: boolean
  }
  lPointMmrModifier: {
    enabled: boolean
  }
  commanderMMRPointModifier: {
    enabled: boolean
    maxModifierPercent: number
  }
  weights: PlayerRatingWeights
}

const DEFAULT_PLAYER_RATING_WEIGHTS: PlayerRatingWeights = {
  recentPerformance: 0.28,
  allTimePerformance: 0.17,
  seasonPoints: 0,
  winRate: 0.12,
  commanderMMRContext: 0.10,
  averageCommanderMMR: 0.08,
  commanderPoints: 0.05,
  achievements: 0.08,
  clutch: 0.07,
  commanderDiversity: 0.05,
}

export interface LeagueSettingsDocument {
  points?: Partial<Record<number, PlacementRating[]>>
  achievements?: Record<string, number>
  playerRankingSystem?: PlayerRankingSystem
  playerRating?: {
    minRating?: number
    maxRating?: number
    provisionalGames?: number
    topCommandersForAverageMmr?: number
    minimumGamesForAverageCommanderMmr?: number
    missingCommanderMmr?: number
    usePeakCommanderMmrForAverage?: boolean
    simpleMmr?: {
      enabled?: boolean
    }
    lPointMmrModifier?: {
      enabled?: boolean
    }
    commanderMMRPointModifier?: {
      enabled?: boolean
      maxModifierPercent?: number
    }
      weights?: Partial<PlayerRatingWeights>
  }
  level?: {
    xpPerGame?: Partial<Record<number, number>>
    winBonusXp?: Partial<Record<number, number>>
    thresholds?: number[]
    pointsPerLevel?: number
  }
  standings?: {
    usePerformanceModifier?: boolean
    includeCommanderXp?: boolean
    includeAchievementPoints?: boolean
    adjustmentMode?: StandingsAdjustmentMode
    freeGamesBaselineAvg?: number
    freeGamesConsecutivePenalty?: number
    freeGamesMinimumAvg?: number
    freeGamesGraceMisses?: number
    penaltyFactor?: number
    seasonalRanking?: {
      enabled?: boolean
      leagueStartDate?: string
      leagueEndDate?: string
      seasonCount?: number
    }
  }
  shop?: {
    loosterCost?: number
  }
}

export interface ResolvedLeagueSettings {
  points: Record<number, PlacementRating[]>
  achievements: Record<string, AchievementDef>
  playerRankingSystem: PlayerRankingSystem
  playerRating: PlayerRatingConfig
  level: {
    xpPerGame: Record<number, number>
    winBonusXp: Record<number, number>
    thresholds: number[]
    maxLevel: number
    pointsPerLevel: number
  }
  standings: {
    usePerformanceModifier: boolean
    includeCommanderXp: boolean
    includeAchievementPoints: boolean
    adjustmentMode: StandingsAdjustmentMode
    freeGamesBaselineAvg: number
    freeGamesConsecutivePenalty: number
    freeGamesMinimumAvg: number
    freeGamesGraceMisses: number
    penaltyFactor: number
    seasonalRanking: StandingsSeasonalRankingConfig
  }
  shop: {
    loosterCost: number
  }
}

let runtimeLeagueSettings: LeagueSettingsDocument | null = null

export function setRuntimeLeagueSettings(settings: LeagueSettingsDocument | null | undefined) {
  runtimeLeagueSettings = settings ? clone(settings) : null
}

export function getRuntimeLeagueSettings() {
  return runtimeLeagueSettings
}

export function getResolvedLeagueSettings(settings?: LeagueSettingsDocument | null): ResolvedLeagueSettings {
  const source = settings ?? runtimeLeagueSettings ?? null
  const points = resolvePoints(source?.points)
  const achievements = resolveAchievements(source?.achievements)
  const thresholds = resolveThresholds(source?.level?.thresholds)

  return {
    points,
    achievements,
    playerRankingSystem: source?.playerRankingSystem ?? 'classic',
    playerRating: {
      minRating: toNumberOr(source?.playerRating?.minRating, DEFAULT_PLAYER_RATING_MIN),
      maxRating: toNumberOr(source?.playerRating?.maxRating, DEFAULT_PLAYER_RATING_MAX),
      provisionalGames: Math.max(1, Math.round(toNumberOr(
        source?.playerRating?.provisionalGames,
        DEFAULT_PLAYER_RATING_PROVISIONAL_GAMES,
      ))),
      topCommandersForAverageMmr: Math.max(1, Math.round(toNumberOr(
        source?.playerRating?.topCommandersForAverageMmr,
        DEFAULT_PLAYER_RATING_TOP_COMMANDERS_FOR_AVERAGE_MMR,
      ))),
      minimumGamesForAverageCommanderMmr: Math.max(1, Math.round(toNumberOr(
        source?.playerRating?.minimumGamesForAverageCommanderMmr,
        DEFAULT_PLAYER_RATING_MIN_GAMES_FOR_AVERAGE_COMMANDER_MMR,
      ))),
      missingCommanderMmr: toNumberOr(
        source?.playerRating?.missingCommanderMmr,
        DEFAULT_PLAYER_RATING_MISSING_COMMANDER_MMR,
      ),
      usePeakCommanderMmrForAverage: source?.playerRating?.usePeakCommanderMmrForAverage ?? false,
      simpleMmr: {
        enabled: source?.playerRating?.simpleMmr?.enabled ?? DEFAULT_PLAYER_RATING_SIMPLE_MMR_ENABLED,
      },
      lPointMmrModifier: {
        enabled: source?.playerRating?.lPointMmrModifier?.enabled ?? DEFAULT_PLAYER_RATING_LPOINT_MMR_MODIFIER_ENABLED,
      },
      commanderMMRPointModifier: {
        enabled: source?.playerRating?.commanderMMRPointModifier?.enabled ?? true,
        maxModifierPercent: Math.max(0, toNumberOr(
          source?.playerRating?.commanderMMRPointModifier?.maxModifierPercent,
          DEFAULT_PLAYER_RATING_MMR_POINT_MODIFIER_MAX,
        )),
      },
      weights: {
        recentPerformance: toNumberOr(
          source?.playerRating?.weights?.recentPerformance,
          DEFAULT_PLAYER_RATING_WEIGHTS.recentPerformance,
        ),
        allTimePerformance: toNumberOr(
          source?.playerRating?.weights?.allTimePerformance,
          DEFAULT_PLAYER_RATING_WEIGHTS.allTimePerformance,
        ),
        seasonPoints: toNumberOr(
          source?.playerRating?.weights?.seasonPoints,
          DEFAULT_PLAYER_RATING_WEIGHTS.seasonPoints,
        ),
        winRate: toNumberOr(
          source?.playerRating?.weights?.winRate,
          DEFAULT_PLAYER_RATING_WEIGHTS.winRate,
        ),
        commanderMMRContext: toNumberOr(
          source?.playerRating?.weights?.commanderMMRContext,
          DEFAULT_PLAYER_RATING_WEIGHTS.commanderMMRContext,
        ),
        averageCommanderMMR: toNumberOr(
          source?.playerRating?.weights?.averageCommanderMMR,
          DEFAULT_PLAYER_RATING_WEIGHTS.averageCommanderMMR,
        ),
        commanderPoints: toNumberOr(
          source?.playerRating?.weights?.commanderPoints,
          DEFAULT_PLAYER_RATING_WEIGHTS.commanderPoints,
        ),
        achievements: toNumberOr(
          source?.playerRating?.weights?.achievements,
          DEFAULT_PLAYER_RATING_WEIGHTS.achievements,
        ),
        clutch: toNumberOr(
          source?.playerRating?.weights?.clutch,
          DEFAULT_PLAYER_RATING_WEIGHTS.clutch,
        ),
        commanderDiversity: toNumberOr(
          source?.playerRating?.weights?.commanderDiversity,
          DEFAULT_PLAYER_RATING_WEIGHTS.commanderDiversity,
        ),
      },
    },
    level: {
      xpPerGame: resolveNumericMap(DEFAULT_XP_PER_GAME, source?.level?.xpPerGame),
      winBonusXp: resolveNumericMap(DEFAULT_WIN_BONUS_XP, source?.level?.winBonusXp),
      thresholds,
      maxLevel: DEFAULT_MAX_LEVEL,
      pointsPerLevel: toNumberOr(source?.level?.pointsPerLevel, 1),
    },
    standings: {
      usePerformanceModifier: source?.standings?.usePerformanceModifier ?? true,
      includeCommanderXp: source?.standings?.includeCommanderXp ?? true,
      includeAchievementPoints: source?.standings?.includeAchievementPoints ?? true,
      adjustmentMode: source?.standings?.adjustmentMode ?? 'compensation',
      freeGamesBaselineAvg: toNumberOr(source?.standings?.freeGamesBaselineAvg, DEFAULT_FREE_GAMES_BASELINE_AVG),
      freeGamesConsecutivePenalty: toNumberOr(source?.standings?.freeGamesConsecutivePenalty, DEFAULT_FREE_GAMES_CONSECUTIVE_PENALTY),
      freeGamesMinimumAvg: toNumberOr(source?.standings?.freeGamesMinimumAvg, DEFAULT_FREE_GAMES_MIN_AVG),
      freeGamesGraceMisses: Math.max(0, Math.round(toNumberOr(source?.standings?.freeGamesGraceMisses, DEFAULT_FREE_GAMES_GRACE_MISSES))),
      penaltyFactor: toNumberOr(source?.standings?.penaltyFactor, DEFAULT_PENALTY_FACTOR),
      seasonalRanking: {
        enabled: source?.standings?.seasonalRanking?.enabled ?? false,
        leagueStartDate: normalizeDateInput(source?.standings?.seasonalRanking?.leagueStartDate),
        leagueEndDate: normalizeDateInput(source?.standings?.seasonalRanking?.leagueEndDate),
        seasonCount: Math.max(1, Math.round(toNumberOr(
          source?.standings?.seasonalRanking?.seasonCount,
          DEFAULT_STANDINGS_SEASON_COUNT,
        ))),
      },
    },
    shop: {
      loosterCost: toNumberOr(source?.shop?.loosterCost, DEFAULT_LOOSTER_COST),
    },
  }
}

export function getResolvedAchievementDefinitions(settings?: LeagueSettingsDocument | null) {
  return getResolvedLeagueSettings(settings).achievements
}

export function getResolvedAchievementDefinition(id: string, settings?: LeagueSettingsDocument | null) {
  return getResolvedAchievementDefinitions(settings)[id]
}

export function buildLeagueSeasonRanges(config?: Partial<StandingsSeasonalRankingConfig> | null): LeagueSeasonRange[] {
  const seasonCount = Math.max(1, Math.round(toNumberOr(config?.seasonCount, DEFAULT_STANDINGS_SEASON_COUNT)))
  const start = parseDateInput(config?.leagueStartDate)
  const end = parseDateInput(config?.leagueEndDate)
  if (!start || !end || end.getTime() < start.getTime()) return []

  const dayMs = 86_400_000
  const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1
  if (totalDays <= 0) return []

  return Array.from({ length: seasonCount }, (_unused, index) => {
    const startOffset = Math.floor((index * totalDays) / seasonCount)
    const nextStartOffset = Math.floor(((index + 1) * totalDays) / seasonCount)
    const seasonStart = new Date(start.getTime() + startOffset * dayMs)
    const seasonEnd = new Date(start.getTime() + Math.max(startOffset, nextStartOffset - 1) * dayMs)

    return {
      index,
      label: `Season ${index + 1}`,
      startDate: formatDateInput(seasonStart),
      endDate: formatDateInput(seasonEnd),
      startMs: seasonStart.getTime(),
      endMs: seasonEnd.getTime() + dayMs - 1,
    }
  })
}

export function hasActiveSeasonalRanking(config?: Partial<StandingsSeasonalRankingConfig> | null) {
  return Boolean(config?.enabled) && buildLeagueSeasonRanges(config).length > 0
}

function resolvePoints(raw?: Partial<Record<number, PlacementRating[]>>) {
  const resolved: Record<number, PlacementRating[]> = {}

  for (const playerCount of [3, 4, 5]) {
    const defaults = DEFAULT_BASE_RATINGS[playerCount] ?? []
    const rawRatings = raw?.[playerCount] ?? []

    resolved[playerCount] = defaults.map((rating, index) => ({
      points: toNumberOr(rawRatings[index]?.points, rating.points),
      lPoints: toNumberOr(rawRatings[index]?.lPoints, rating.lPoints),
    }))
  }

  return resolved
}

function parseDateInput(value?: string | null) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function formatDateInput(date: Date) {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeDateInput(value?: string | null) {
  const parsed = parseDateInput(value)
  return parsed ? formatDateInput(parsed) : ''
}

function resolveAchievements(raw?: Record<string, number>) {
  const resolved: Record<string, AchievementDef> = {}

  for (const [id, def] of Object.entries(DEFAULT_ACHIEVEMENTS)) {
    resolved[id] = {
      ...def,
      points: toNumberOr(raw?.[id], def.points),
    }
  }

  return resolved
}

function resolveNumericMap(defaults: Record<number, number>, raw?: Partial<Record<number, number>>) {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [Number(key), toNumberOr(raw?.[Number(key)], value)]),
  ) as Record<number, number>
}

function resolveThresholds(raw?: number[]) {
  const defaults = DEFAULT_LEVEL_THRESHOLDS
  if (!Array.isArray(raw) || raw.length !== defaults.length) return [...defaults]

  const thresholdList = raw.map((value, index) => {
    if (index === 0) return 0
    return toNumberOr(value, defaults[index])
  })

  const normalized = [0]
  for (let index = 1; index < thresholdList.length; index++) {
    normalized[index] = Math.max(normalized[index - 1], thresholdList[index])
  }

  return normalized
}

function toNumberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
