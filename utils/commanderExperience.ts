// ─── Constants ────────────────────────────────────────────────────────────────

/** XP earned per game by every participant, equal to the player count. */
export const XP_PER_GAME: Record<number, number> = {
  3: 3,
  4: 4,
  5: 5,
}

/** Bonus XP for the winner on top of the base per-game XP. */
export const WIN_BONUS_XP: Record<number, number> = {
  3: 2,
  4: 3,
  5: 3,
}

export const MAX_LEVEL = 20

/**
 * Cumulative XP thresholds to reach each level (1-indexed).
 * LEVEL_THRESHOLDS[i] = total XP needed to be at level i+1.
 *
 * Designed so that ~60 games at the average XP rate (~4.5 XP/game) brings a
 * player-commander pair from level 1 to level 20 (≈ 270 XP total).
 *
 * XP per level-up increments:
 *   Lv 1→2:  5   Lv 2→3:  7   Lv 3→4:  9   Lv 4→5:  10   Lv 5→6:  11
 *   Lv 6→7: 12   Lv 7→8: 12   Lv 8→9: 13   Lv 9→10: 13   Lv10→11: 14
 *   Lv11→12:14   Lv12→13:15   Lv13→14:15   Lv14→15: 16   Lv15→16: 16
 *   Lv16→17:17   Lv17→18:17   Lv18→19:18   Lv19→20: 18
 *   Total: 252 XP  (≈ 56 games at 4.5 avg XP)
 */
const XP_INCREMENTS = [
   6,  9,  10, 12, 13,  // levels 1–5
  15, 17, 19, 20, 21,  // levels 6–10
  24, 25, 25, 26, 27,  // levels 11–15
  28, 29, 30, 35,      // levels 16–19 (19 increments for 20 levels)
]

export const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0] // level 1 at 0 XP
  let cumulative = 0
  for (const inc of XP_INCREMENTS) {
    cumulative += inc
    thresholds.push(cumulative)
  }
  return thresholds // 20 entries, index = level-1
})()

// ─── Functions ────────────────────────────────────────────────────────────────

/**
 * XP earned by a player in a single game.
 * Base = player count. Winner gets an additional WIN_BONUS_XP.
 */
export function calculateXPGained(playerCount: number, isWinner: boolean): number {
  const base = XP_PER_GAME[playerCount] ?? playerCount
  const bonus = isWinner ? (WIN_BONUS_XP[playerCount] ?? 0) : 0
  return base + bonus
}

/**
 * Returns the current level (1–20) for a given total XP amount.
 */
export function xpToLevel(xp: number): number {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1
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
  return LEVEL_THRESHOLDS[currentLevel] - xp
}
