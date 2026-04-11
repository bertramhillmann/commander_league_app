// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'trash'

export interface TierMeta {
  label: string
  symbol: string
  cssClass: string
}

// ─── Weights & smoothing ──────────────────────────────────────────────────────

/** Phantom games added per player to smooth out small sample sizes */
export const TIER_SMOOTH_GAMES = 10

/** Weight of avg base points vs win rate in the blended tier score */
export const TIER_PTS_WEIGHT = 0.6
export const TIER_WIN_WEIGHT = 0.4

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS = {
  diamond:  1.6,
  platinum: 1.3,
  gold:     1.1,
  silverMin: 0.9,
} as const

export const TIER_META: Record<Tier, TierMeta> = {
  diamond:  { label: 'Diamond',  symbol: '◆', cssClass: 'tier--diamond' },
  platinum: { label: 'Platinum', symbol: '▲', cssClass: 'tier--platinum' },
  gold:     { label: 'Gold',     symbol: '●', cssClass: 'tier--gold' },
  silver:   { label: 'Silver',   symbol: '●', cssClass: 'tier--silver' },
  bronze:   { label: 'Bronze',   symbol: '●', cssClass: 'tier--bronze' },
  trash:    { label: 'Trash',    symbol: '✕', cssClass: 'tier--trash' },
}

// ─── Score helpers ────────────────────────────────────────────────────────────

/**
 * Blends avg base points and win rate into a single tier score.
 * Both inputs are expected in natural units (pts 0–1, win rate 0–1).
 */
export function blendScore(avgBasePoints: number, winRate: number): number {
  return TIER_PTS_WEIGHT * avgBasePoints + TIER_WIN_WEIGHT * winRate
}

/**
 * Smoothed tier score for a player×commander pair using a Bayesian prior
 * of TIER_SMOOTH_GAMES phantom games at the player's own overall averages.
 *
 * @param cmdBasePoints  total base points with this commander
 * @param cmdWins        total outright wins (basePoints === 1) with this commander
 * @param cmdGames       games played with this commander
 * @param playerAvgPts   player's overall avg base points across all commanders
 * @param playerWinRate  player's overall win rate (0–1) across all commanders
 */
export function smoothedTierScore(
  cmdBasePoints: number,
  cmdWins: number,
  cmdGames: number,
  playerAvgPts: number,
  playerWinRate: number,
): number {
  const n = cmdGames + TIER_SMOOTH_GAMES
  const smoothAvgPts = (cmdBasePoints + playerAvgPts * TIER_SMOOTH_GAMES) / n
  const smoothWinRate = (cmdWins + playerWinRate * TIER_SMOOTH_GAMES) / n
  return blendScore(smoothAvgPts, smoothWinRate)
}

// ─── Logic ────────────────────────────────────────────────────────────────────

/**
 * @param playerScore  smoothed blended score for this player × commander
 * @param globalScore  mean blended score across all commanders (global baseline)
 */
export function getTier(playerScore: number, globalScore: number): Tier {
  if (globalScore === 0) return 'silver'

  const ratio = playerScore / globalScore

  if (ratio < 0.3) return 'trash'
  if (ratio >= TIER_THRESHOLDS.diamond)   return 'diamond'
  if (ratio >= TIER_THRESHOLDS.platinum)  return 'platinum'
  if (ratio >= TIER_THRESHOLDS.gold)      return 'gold'
  if (ratio >= TIER_THRESHOLDS.silverMin) return 'silver'
  return 'bronze'
}
