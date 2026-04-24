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

export interface LeagueSettingsDocument {
  points?: Partial<Record<number, PlacementRating[]>>
  achievements?: Record<string, number>
  level?: {
    xpPerGame?: Partial<Record<number, number>>
    winBonusXp?: Partial<Record<number, number>>
    thresholds?: number[]
  }
}

export interface ResolvedLeagueSettings {
  points: Record<number, PlacementRating[]>
  achievements: Record<string, AchievementDef>
  level: {
    xpPerGame: Record<number, number>
    winBonusXp: Record<number, number>
    thresholds: number[]
    maxLevel: number
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
    level: {
      xpPerGame: resolveNumericMap(DEFAULT_XP_PER_GAME, source?.level?.xpPerGame),
      winBonusXp: resolveNumericMap(DEFAULT_WIN_BONUS_XP, source?.level?.winBonusXp),
      thresholds,
      maxLevel: DEFAULT_MAX_LEVEL,
    },
  }
}

export function getResolvedAchievementDefinitions(settings?: LeagueSettingsDocument | null) {
  return getResolvedLeagueSettings(settings).achievements
}

export function getResolvedAchievementDefinition(id: string, settings?: LeagueSettingsDocument | null) {
  return getResolvedAchievementDefinitions(settings)[id]
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
