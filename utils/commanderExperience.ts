import { getResolvedLeagueSettings } from '~/utils/leagueSettings'
import {
  DEFAULT_LEVEL_THRESHOLDS,
  DEFAULT_MAX_LEVEL,
  DEFAULT_WIN_BONUS_XP,
  DEFAULT_XP_PER_GAME,
} from '~/utils/scoringDefaults'

/** XP earned per game by every participant, equal to the player count. */
export const XP_PER_GAME: Record<number, number> = DEFAULT_XP_PER_GAME

/** Bonus XP for the winner on top of the base per-game XP. */
export const WIN_BONUS_XP: Record<number, number> = DEFAULT_WIN_BONUS_XP

export const MAX_LEVEL = DEFAULT_MAX_LEVEL

/**
 * Cumulative XP thresholds to reach each level (1-indexed).
 * LEVEL_THRESHOLDS[i] = total XP needed to be at level i+1.
 */
export const LEVEL_THRESHOLDS: number[] = DEFAULT_LEVEL_THRESHOLDS

/**
 * XP earned by a player in a single game.
 * Base = player count. Winner gets an additional WIN_BONUS_XP.
 */
export function calculateXPGained(playerCount: number, isWinner: boolean): number {
  const { level } = getResolvedLeagueSettings()
  const base = level.xpPerGame[playerCount] ?? playerCount
  const bonus = isWinner ? (level.winBonusXp[playerCount] ?? 0) : 0
  return base + bonus
}

/**
 * Returns the current level (1-20) for a given total XP amount.
 */
export function xpToLevel(xp: number): number {
  const thresholds = getResolvedLeagueSettings().level.thresholds
  let level = 1
  for (let index = 1; index < thresholds.length; index++) {
    if (xp >= thresholds[index]) level = index + 1
    else break
  }
  return Math.min(level, MAX_LEVEL)
}

/**
 * XP remaining until the next level-up. Returns 0 at max level.
 */
export function xpForNextLevel(xp: number): number {
  const currentLevel = xpToLevel(xp)
  if (currentLevel >= MAX_LEVEL) return 0
  const thresholds = getResolvedLeagueSettings().level.thresholds
  return (thresholds[currentLevel] ?? 0) - xp
}

export function getCommanderLevelProgress(xp: number) {
  const thresholds = getResolvedLeagueSettings().level.thresholds
  const level = xpToLevel(xp)
  const isMaxLevel = level >= MAX_LEVEL
  const maxXP = thresholds[thresholds.length - 1] ?? 0
  const levelStartXP = thresholds[level - 1] ?? 0
  const nextLevelXP = isMaxLevel ? maxXP : (thresholds[level] ?? maxXP)
  const range = Math.max(0, nextLevelXP - levelStartXP)
  const currentLevelXP = isMaxLevel ? range : Math.max(0, xp - levelStartXP)
  const levelSpanXP = range
  const progressPct = isMaxLevel || range === 0
    ? 100
    : Math.max(0, Math.min(100, ((xp - levelStartXP) / range) * 100))
  const xpToNext = isMaxLevel ? 0 : Math.max(0, nextLevelXP - xp)

  return {
    level,
    isMaxLevel,
    maxXP,
    levelStartXP,
    nextLevelXP,
    currentLevelXP,
    levelSpanXP,
    progressPct,
    xpToNext,
  }
}
