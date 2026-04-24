// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = 'god' | 'legend' | 'diamond' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'trash'
export type TierDivision = 1 | 2 | 3

export interface TierMeta {
  label: string
  symbol: string
  cssClass: string
}

/** Full tier information including sub-division (1 = top, 3 = bottom). */
export interface TierDetail {
  tier: Tier
  division: TierDivision
  ratio: number
  tierMin: number
  tierMax: number    // Infinity for diamond
  divMin: number
  divMax: number     // Infinity for diamond 1
}

/** Raw metrics needed to simulate how future games affect the tier. */
export interface TierContext {
  totalBasePoints: number
  wins: number
  plays: number
  globalAvgScore: number
}

export interface TierProgress {
  /** How many consecutive 1st-place games would push to a higher division/tier. null = already at max or won't happen within 5 games. */
  riseGames: number | null
  /** How many consecutive 0-point games would push to a lower division/tier. null = already at min or won't happen within 5 games. */
  dropGames: number | null
  /** Label of the target higher division, e.g. "Platinum 1" */
  riseTarget: string | null
  /** Label of the target lower division, e.g. "Silver 3" */
  dropTarget: string | null
  /** True when the rise crosses a full tier boundary (not just a division boundary) */
  riseIsTierChange: boolean
  /** True when the drop crosses a full tier boundary */
  dropIsTierChange: boolean
}

// ─── Weights & smoothing ──────────────────────────────────────────────────────

/** Phantom games added per player to smooth out small sample sizes */
export const TIER_SMOOTH_GAMES = 10

/** Weight of avg base points vs win rate in the blended tier score */
export const TIER_PTS_WEIGHT = 0.4
export const TIER_WIN_WEIGHT = 0.6

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS = {
  god:      2.2,
  legend:   1.9,
  diamond:  1.6,
  platinum: 1.3,
  gold:     1.1,
  silverMin: 0.9,
} as const

// ─── Plays-based tier cap ─────────────────────────────────────────────────────

/**
 * Commanders must earn their way up through tiers.
 * Maps minimum games played → the ratio band they may occupy.
 * 1 game: exactly silver (floor + ceiling). 2: max gold. 3–4: max platinum. 5+: uncapped.
 */
const TIER_PLAYS_CAPS: Array<{ minPlays: number; minRatio: number; maxRatio: number }> = [
  { minPlays: 5, minRatio: 0,                          maxRatio: Infinity },
  { minPlays: 3, minRatio: 0,                          maxRatio: TIER_THRESHOLDS.diamond - Number.EPSILON },   // platinum max
  { minPlays: 2, minRatio: 0,                          maxRatio: TIER_THRESHOLDS.platinum - Number.EPSILON },  // gold max
  { minPlays: 1, minRatio: TIER_THRESHOLDS.silverMin,  maxRatio: TIER_THRESHOLDS.gold - Number.EPSILON },      // forced silver
]

function appliedPlaysCap(ratio: number, plays: number): number {
  for (const cap of TIER_PLAYS_CAPS) {
    if (plays >= cap.minPlays) return Math.min(Math.max(ratio, cap.minRatio), cap.maxRatio)
  }
  return ratio
}

function cappedTierRatio(ratio: number, plays: number): number {
  return appliedPlaysCap(ratio, plays)
}

/** Virtual upper bound for god (division boundaries need a finite upper limit). */
const GOD_VIRTUAL_MAX = 2.8

/** Tier boundary table, ordered highest → lowest. */
const TIER_BOUNDS: Array<{ tier: Tier; min: number; max: number }> = [
  { tier: 'god',      min: TIER_THRESHOLDS.god,      max: Infinity },
  { tier: 'legend',   min: TIER_THRESHOLDS.legend,   max: TIER_THRESHOLDS.god },
  { tier: 'diamond',  min: TIER_THRESHOLDS.diamond,  max: TIER_THRESHOLDS.legend },
  { tier: 'platinum', min: TIER_THRESHOLDS.platinum, max: TIER_THRESHOLDS.diamond },
  { tier: 'gold',     min: TIER_THRESHOLDS.gold,     max: TIER_THRESHOLDS.platinum },
  { tier: 'silver',   min: TIER_THRESHOLDS.silverMin, max: TIER_THRESHOLDS.gold },
  { tier: 'bronze',   min: 0.3,                       max: TIER_THRESHOLDS.silverMin },
  { tier: 'trash',    min: 0,                         max: 0.3 },
]

export const TIER_META: Record<Tier, TierMeta> = {
  god:      { label: 'God',      symbol: '✦', cssClass: 'tier--god' },
  legend:   { label: 'Legend',   symbol: '★', cssClass: 'tier--legend' },
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

// ─── Division helpers ─────────────────────────────────────────────────────────

function divisionBounds(
  min: number,
  max: number,
  division: TierDivision,
): { divMin: number; divMax: number } {
  const effectiveMax = max === Infinity ? GOD_VIRTUAL_MAX : max
  const step = (effectiveMax - min) / 3
  // division 1 = bottom third, 3 = top third
  const idx = division - 1  // 0 = bottom (div1), 1 = mid (div2), 2 = top (div3)
  const divMin = min + idx * step
  const divMax = idx === 2 ? max : min + (idx + 1) * step
  return { divMin, divMax }
}

function tierDetailFromRatio(ratio: number): TierDetail {
  for (const { tier, min, max } of TIER_BOUNDS) {
    if (ratio >= min) {
      const effectiveMax = max === Infinity ? GOD_VIRTUAL_MAX : max
      const step = (effectiveMax - min) / 3

      let division: TierDivision
      if (ratio >= min + 2 * step) division = 3      // top third = highest division
      else if (ratio >= min + step) division = 2
      else division = 1                               // bottom third = lowest division

      const { divMin, divMax } = divisionBounds(min, max, division)
      return { tier, division, ratio, tierMin: min, tierMax: max, divMin, divMax }
    }
  }

  // Ratio below 0 — deepest trash
  const { divMin, divMax } = divisionBounds(0, 0.3, 1)
  return { tier: 'trash', division: 1, ratio, tierMin: 0, tierMax: 0.3, divMin, divMax }
}

// ─── Logic ────────────────────────────────────────────────────────────────────

/**
 * @param playerScore  smoothed blended score for this player × commander
 * @param globalScore  mean blended score across all commanders (global baseline)
 * @param plays        games played with this commander (applies plays cap)
 */
export function getTier(playerScore: number, globalScore: number, plays = Number.POSITIVE_INFINITY): Tier {
  if (globalScore === 0) return 'silver'
  return getTierFromRatio(playerScore / globalScore, plays)
}

/**
 * Returns the full TierDetail (tier + division 1–3) for a player×commander pair.
 * Returns null when globalScore is 0 or plays is 0.
 */
export function getTierDetail(playerScore: number, globalScore: number, plays = Number.POSITIVE_INFINITY): TierDetail | null {
  if (globalScore === 0) return null
  return getTierDetailFromRatio(playerScore / globalScore, plays)
}

export function getTierFromRatio(ratio: number, plays = Number.POSITIVE_INFINITY): Tier {
  return tierDetailFromRatio(cappedTierRatio(ratio, plays)).tier
}

export function getTierDetailFromRatio(ratio: number, plays = Number.POSITIVE_INFINITY): TierDetail {
  return tierDetailFromRatio(cappedTierRatio(ratio, plays))
}

/** Human-readable label for a TierDetail, e.g. "GOLD 2". */
export function tierDetailLabel(detail: TierDetail): string {
  return `${TIER_META[detail.tier].label.toUpperCase()} ${detail.division}`
}

// ─── Centralised computation helpers ─────────────────────────────────────────
//
// All pages must use these two functions so that every tier display is derived
// from exactly the same formula.  Do NOT inline baseline or score calculations
// in individual components — it leads to drift like the Diamond 2 vs 3 bug.

/**
 * The global commander baseline — the average blended score across every
 * commander that has been played at least once.  All player×commander ratios
 * are normalised against this value.
 *
 * Pass `commanders` directly from `useLeagueState()`.
 */
export function computeGlobalCommanderBaseline(
  commanders: Record<string, { gamesPlayed: number; totalBasePoints: number; wins: number }>,
): number {
  const scores = Object.values(commanders)
    .filter((c) => c.gamesPlayed > 0)
    .map((c) => blendScore(c.totalBasePoints / c.gamesPlayed, c.wins / c.gamesPlayed))
  if (scores.length === 0) return 0
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

/**
 * Convenience helper for consumers that only have per-player game records.
 * This produces the same league-wide commander baseline as `computeGlobalCommanderBaseline()`
 * after aggregating all player×commander records into commander totals.
 */
export function computeGlobalCommanderBaselineFromRecords(
  gameRecords: Record<string, Record<string, { commander: string; basePoints: number; placement: number }>>,
): number {
  const commanders: Record<string, { gamesPlayed: number; totalBasePoints: number; wins: number }> = {}

  for (const recordsByGame of Object.values(gameRecords)) {
    for (const record of Object.values(recordsByGame)) {
      if (!commanders[record.commander]) {
        commanders[record.commander] = { gamesPlayed: 0, totalBasePoints: 0, wins: 0 }
      }

      const commander = commanders[record.commander]
      commander.gamesPlayed++
      commander.totalBasePoints += record.basePoints
      if (record.placement === 1) commander.wins++
    }
  }

  return computeGlobalCommanderBaseline(commanders)
}

/**
 * TierDetail + TierContext for a single player × commander pairing.
 *
 * **Win criterion**: `placement === 1`.  Using `basePoints === 1` is wrong for
 * tie games (shared 1st gives basePoints < 1 even though placement is 1) and
 * inconsistent with how `CommanderState.wins` is counted.
 *
 * @param records  Every game record for this player with this commander.
 * @param globalBaseline  Result of `computeGlobalCommanderBaseline()`.
 */
export function computePlayerCommanderTier(
  records: ReadonlyArray<{ basePoints: number; placement: number }>,
  globalBaseline: number,
): { detail: TierDetail | null; context: TierContext } {
  const plays = records.length
  const emptyCtx: TierContext = { totalBasePoints: 0, wins: 0, plays: 0, globalAvgScore: globalBaseline }
  if (plays === 0) return { detail: null, context: emptyCtx }

  const totalBasePoints = records.reduce((sum, r) => sum + r.basePoints, 0)
  const wins = records.filter((r) => r.placement === 1).length
  const rawScore = blendScore(totalBasePoints / plays, wins / plays)
  const detail = globalBaseline > 0 ? getTierDetailFromRatio(rawScore / globalBaseline, plays) : null
  const context: TierContext = { totalBasePoints, wins, plays, globalAvgScore: globalBaseline }
  return { detail, context }
}

// ─── Progress / tooltip ───────────────────────────────────────────────────────

function simulateRatio(ctx: TierContext, n: number, bpPerGame: number, winPerGame: number): number {
  if (ctx.globalAvgScore === 0) return 0
  const score = blendScore(
    (ctx.totalBasePoints + n * bpPerGame) / (ctx.plays + n),
    (ctx.wins + n * winPerGame) / (ctx.plays + n),
  )
  return cappedTierRatio(score / ctx.globalAvgScore, ctx.plays + n)
}

/**
 * Computes how many consecutive best-case (1st place) or worst-case (0-point)
 * games it would take to shift the player into a different division or tier.
 * Looks up to 5 games ahead.
 */
export function getTierProgress(detail: TierDetail, ctx: TierContext): TierProgress {
  const isTopOfAll = detail.tier === 'god' && detail.division === 3
  const isBottomOfAll = detail.tier === 'trash' && detail.division === 1

  let riseGames: number | null = null
  let riseTarget: string | null = null
  let riseIsTierChange = false

  if (!isTopOfAll) {
    for (let n = 1; n <= 5; n++) {
      const newRatio = simulateRatio(ctx, n, 1, 1)   // 1st place: full bp + win
      const newDetail = tierDetailFromRatio(newRatio)
      if (newDetail.tier !== detail.tier || newDetail.division !== detail.division) {
        riseGames = n
        riseTarget = `${TIER_META[newDetail.tier].label} ${newDetail.division}`
        riseIsTierChange = newDetail.tier !== detail.tier
        break
      }
    }
  }

  let dropGames: number | null = null
  let dropTarget: string | null = null
  let dropIsTierChange = false

  if (!isBottomOfAll) {
    for (let n = 1; n <= 5; n++) {
      const newRatio = simulateRatio(ctx, n, 0, 0)   // last place: 0 bp, no win
      const newDetail = tierDetailFromRatio(newRatio)
      if (newDetail.tier !== detail.tier || newDetail.division !== detail.division) {
        dropGames = n
        dropTarget = `${TIER_META[newDetail.tier].label} ${newDetail.division}`
        dropIsTierChange = newDetail.tier !== detail.tier
        break
      }
    }
  }

  return { riseGames, dropGames, riseTarget, dropTarget, riseIsTierChange, dropIsTierChange }
}
