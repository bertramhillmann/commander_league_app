import { xpToLevel } from './commanderExperience'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModifierResult {
  name: string
  value: number
  description: string
  /** If true, shown in the UI but NOT added to finalPoints. */
  informational?: boolean
}

/**
 * All context a modifier needs to decide whether it fires and what value to return.
 * Captured once per player-game in useLeagueState before any totals are updated.
 */
export interface ModifierContext {
  playerName: string
  basePoints: number
  /** Pre-game total-points map for every participant in this game. */
  ratingsBefore: Record<string, number>
  /** XP this player had with this commander before the game. */
  commanderXpBefore: number
  /** XP earned in this game (from calculateXPGained). */
  commanderXpGained: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNDERDOG_BONUS_PER_PLAYER = 0.1
const LEVEL_UP_BONUS = 1

// ─── Individual modifiers ────────────────────────────────────────────────────

/**
 * Underdog Bonus — +0.1 per opponent with a higher pre-game rating.
 * Never fires when basePoints === 0.
 */
function underdogModifier(ctx: ModifierContext): ModifierResult | null {
  if (ctx.basePoints === 0) return null

  const playerRating = ctx.ratingsBefore[ctx.playerName] ?? 0
  const strongerCount = Object.entries(ctx.ratingsBefore).filter(
    ([name, rating]) => name !== ctx.playerName && rating > playerRating,
  ).length

  if (strongerCount === 0) return null

  return {
    name: 'Underdog Bonus',
    value: round3(strongerCount * UNDERDOG_BONUS_PER_PLAYER),
    description: `+${UNDERDOG_BONUS_PER_PLAYER} × ${strongerCount} stronger opponent${strongerCount !== 1 ? 's' : ''}`,
  }
}

/**
 * Level-Up Bonus — +1 per commander level gained in this game.
 * Never fires when basePoints === 0.
 */
function levelUpModifier(ctx: ModifierContext): ModifierResult | null {
  if (ctx.basePoints === 0) return null

  const levelBefore = xpToLevel(ctx.commanderXpBefore)
  const levelAfter = xpToLevel(ctx.commanderXpBefore + ctx.commanderXpGained)
  const levelsGained = levelAfter - levelBefore

  if (levelsGained <= 0) return null

  return {
    name: 'Level Up',
    value: levelsGained * LEVEL_UP_BONUS,
    description: `+${LEVEL_UP_BONUS} × ${levelsGained} level${levelsGained !== 1 ? 's' : ''} (lvl ${levelBefore} → ${levelAfter})`,
    informational: true,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all active modifiers and returns the results.
 * Modifiers are never applied when basePoints === 0 (the rule is enforced per-modifier).
 */
export function applyModifiers(ctx: ModifierContext): ModifierResult[] {
  const results: ModifierResult[] = []

  const underdog = underdogModifier(ctx)
  if (underdog) results.push(underdog)

  const levelUp = levelUpModifier(ctx)
  if (levelUp) results.push(levelUp)

  return results
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
