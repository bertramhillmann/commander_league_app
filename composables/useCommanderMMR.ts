export type CommanderMMRTier =
  | "trash"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "legend"
  | "god"

export type CommanderMatchResult = "win" | "loss"

export interface CommanderPodResult {
  commanderId: string
  commanderName?: string
  currentMMR?: number
  placement: number
}

export interface CommanderMMRMatchup {
  opponentCommanderId: string
  opponentCommanderName?: string
  opponentMMR: number
  result: CommanderMatchResult
  rawDelta: number
  scaledDelta: number
  ratingMultiplier: number
  placementMultiplier: number
  clutchMultiplier: number
}

export interface CommanderMMRChange {
  commanderId: string
  commanderName?: string
  oldMMR: number
  newMMR: number
  delta: number
  placement: number
  matchups: CommanderMMRMatchup[]
}

export interface CommanderMMRTierRange {
  tier: CommanderMMRTier
  minMMR: number
  label: string
}

export interface CommanderMMRMultiplierBreakdown {
  ratingMultiplier: number
  placementMultiplier: number
  clutchMultiplier: number
  podSizeScaling: number
  combinedMultiplier: number
}

export const COMMANDER_MMR_CONFIG = {
  initialMMR: 1500,
  baseChange: 100,
  minPlayers: 2,
  precision: 2,
  rating: {
    winUpsideFactor: 1,
    winDownsideFactor: 1,
    lossDownsideFactor: 1,
    lossUpsideReliefFactor: 4,
    minMultiplier: 0.1,
    maxMultiplier: 3,
  },
  placement: {
    adjacentMultiplier: 1.35,
    distantMultiplier: 0.75,
  },
  clutch: {
    underdogFactor: 0.45,
    podiumBonus: 1.1,
    finalsBonus: 1.25,
    maxMultiplier: 1.4,
  },
  podScaling: {
    enabled: true,
  },
  tiers: [
    { tier: "god", minMMR: 3000, label: "God" },
    { tier: "legend", minMMR: 2600, label: "Legend" },
    { tier: "diamond", minMMR: 2300, label: "Diamond" },
    { tier: "platinum", minMMR: 2000, label: "Platinum" },
    { tier: "gold", minMMR: 1700, label: "Gold" },
    { tier: "silver", minMMR: 1400, label: "Silver" },
    { tier: "bronze", minMMR: 1000, label: "Bronze" },
    { tier: "trash", minMMR: Number.NEGATIVE_INFINITY, label: "Trash" },
  ] satisfies CommanderMMRTierRange[],
} as const

/**
 * Returns the starting MMR for a brand-new commander.
 */
export function getInitialCommanderMMR(): number {
  return COMMANDER_MMR_CONFIG.initialMMR
}

/**
 * Resolves the tier bucket for a given commander MMR.
 */
export function getCommanderTierFromMMR(mmr: number): CommanderMMRTier {
  return getCommanderTierRangeFromMMR(mmr).tier
}

/**
 * Resolves the full tier range metadata for a given commander MMR.
 */
export function getCommanderTierRangeFromMMR(mmr: number): CommanderMMRTierRange {
  const tierRange = COMMANDER_MMR_CONFIG.tiers.find((entry) => mmr >= entry.minMMR)

  if (!tierRange) {
    return COMMANDER_MMR_CONFIG.tiers[COMMANDER_MMR_CONFIG.tiers.length - 1]
  }

  return tierRange
}

/**
 * Calculates the pure rating-strength multiplier for a single pairwise virtual duel.
 */
export function getCommanderMMRMultiplier(
  commanderMMR: number,
  opponentMMR: number,
  result: CommanderMatchResult,
): number {
  const safeCommanderMMR = Math.max(commanderMMR, 1)
  const safeOpponentMMR = Math.max(opponentMMR, 1)
  const ratio = safeOpponentMMR / safeCommanderMMR

  let multiplier = 1

  if (result === "win") {
    if (ratio >= 1) {
      multiplier = 1 + ((ratio - 1) * COMMANDER_MMR_CONFIG.rating.winUpsideFactor)
    } else {
      multiplier = 1 / (1 + (((1 / ratio) - 1) * COMMANDER_MMR_CONFIG.rating.winDownsideFactor))
    }
  } else if (ratio <= 1) {
    multiplier = 1 + (((1 / ratio) - 1) * COMMANDER_MMR_CONFIG.rating.lossDownsideFactor)
  } else {
    multiplier = 1 / (1 + ((ratio - 1) * COMMANDER_MMR_CONFIG.rating.lossUpsideReliefFactor))
  }

  return roundNumber(
    clamp(
      multiplier,
      COMMANDER_MMR_CONFIG.rating.minMultiplier,
      COMMANDER_MMR_CONFIG.rating.maxMultiplier,
    ),
  )
}

/**
 * Calculates the full pairwise multiplier stack for a virtual duel inside a pod.
 */
export function getCommanderMMRMultiplierBreakdown(
  commander: CommanderPodResult,
  opponent: CommanderPodResult,
  podSize: number,
): CommanderMMRMultiplierBreakdown {
  const commanderMMR = commander.currentMMR ?? getInitialCommanderMMR()
  const opponentMMR = opponent.currentMMR ?? getInitialCommanderMMR()
  const result = getPairwiseResult(commander.placement, opponent.placement)

  if (!result) {
    return {
      ratingMultiplier: 0,
      placementMultiplier: 0,
      clutchMultiplier: 0,
      podSizeScaling: 0,
      combinedMultiplier: 0,
    }
  }

  const ratingMultiplier = getCommanderMMRMultiplier(commanderMMR, opponentMMR, result)
  const placementMultiplier = getPlacementClosenessMultiplier(
    commander.placement,
    opponent.placement,
    podSize,
  )
  const clutchMultiplier = getClutchMultiplier(commander, opponent, podSize, result)
  const podSizeScaling = getPodSizeScaling(podSize)

  return {
    ratingMultiplier,
    placementMultiplier,
    clutchMultiplier,
    podSizeScaling,
    combinedMultiplier: roundNumber(
      ratingMultiplier *
        placementMultiplier *
        clutchMultiplier *
        podSizeScaling,
    ),
  }
}

/**
 * Calculates MMR changes for every commander in a pod by summing pairwise virtual duels.
 */
export function calculateCommanderMMRChanges(
  podResults: CommanderPodResult[],
): CommanderMMRChange[] {
  validateCommanderPodResults(podResults)

  return podResults
    .map((commander) => {
      const oldMMR = commander.currentMMR ?? getInitialCommanderMMR()
      const matchups = podResults
        .filter((opponent) => opponent.commanderId !== commander.commanderId)
        .map((opponent) => {
          const result = getPairwiseResult(commander.placement, opponent.placement)
          if (!result) return null

          const multiplierBreakdown = getCommanderMMRMultiplierBreakdown(
            {
              ...commander,
              currentMMR: oldMMR,
            },
            opponent,
            podResults.length,
          )

          const direction = result === "win" ? 1 : -1
          const rawDelta =
            COMMANDER_MMR_CONFIG.baseChange *
            multiplierBreakdown.ratingMultiplier *
            multiplierBreakdown.placementMultiplier *
            multiplierBreakdown.clutchMultiplier *
            direction
          const scaledDelta = rawDelta * multiplierBreakdown.podSizeScaling

          return {
            opponentCommanderId: opponent.commanderId,
            opponentCommanderName: opponent.commanderName,
            opponentMMR: opponent.currentMMR ?? getInitialCommanderMMR(),
            result,
            rawDelta: roundNumber(rawDelta),
            scaledDelta: roundNumber(scaledDelta),
            ratingMultiplier: multiplierBreakdown.ratingMultiplier,
            placementMultiplier: multiplierBreakdown.placementMultiplier,
            clutchMultiplier: multiplierBreakdown.clutchMultiplier,
          } satisfies CommanderMMRMatchup
        })
        .filter((matchup): matchup is CommanderMMRMatchup => matchup !== null)
        .sort((left, right) => {
          if (left.result !== right.result) return left.result === "win" ? -1 : 1
          return right.scaledDelta - left.scaledDelta
        })

      const delta = roundNumber(
        matchups.reduce((total, matchup) => total + matchup.scaledDelta, 0),
      )

      return {
        commanderId: commander.commanderId,
        commanderName: commander.commanderName,
        oldMMR: roundNumber(oldMMR),
        newMMR: roundNumber(oldMMR + delta),
        delta,
        placement: commander.placement,
        matchups,
      } satisfies CommanderMMRChange
    })
    .sort((left, right) => {
      if (left.placement !== right.placement) return left.placement - right.placement
      return right.delta - left.delta
    })
}

/**
 * Returns "win", "loss", or null when placements are tied.
 */
export function getPairwiseResult(
  commanderPlacement: number,
  opponentPlacement: number,
): CommanderMatchResult | null {
  if (commanderPlacement === opponentPlacement) return null
  return commanderPlacement < opponentPlacement ? "win" : "loss"
}

/**
 * Measures how strongly a pairwise result should matter based on placement distance.
 */
export function getPlacementClosenessMultiplier(
  commanderPlacement: number,
  opponentPlacement: number,
  podSize: number,
): number {
  if (podSize <= 2) {
    return roundNumber(COMMANDER_MMR_CONFIG.placement.adjacentMultiplier)
  }

  const gap = Math.abs(commanderPlacement - opponentPlacement)
  const maxGap = Math.max(podSize - 1, 1)
  const normalizedGap = clamp((gap - 1) / Math.max(maxGap - 1, 1), 0, 1)
  const multiplier = lerp(
    COMMANDER_MMR_CONFIG.placement.adjacentMultiplier,
    COMMANDER_MMR_CONFIG.placement.distantMultiplier,
    normalizedGap,
  )

  return roundNumber(multiplier)
}

/**
 * Adds an extra win-only multiplier when an underdog finishes directly ahead of a stronger deck.
 */
export function getClutchMultiplier(
  commander: CommanderPodResult,
  opponent: CommanderPodResult,
  podSize: number,
  result: CommanderMatchResult,
): number {
  if (result !== "win") return 1

  const commanderMMR = commander.currentMMR ?? getInitialCommanderMMR()
  const opponentMMR = opponent.currentMMR ?? getInitialCommanderMMR()
  if (opponentMMR <= commanderMMR) return 1

  const ratingGapRatio = (opponentMMR - commanderMMR) / Math.max(commanderMMR, 1)
  const closenessScore = getPlacementClosenessScore(
    commander.placement,
    opponent.placement,
    podSize,
  )
  const podiumBonus = getPodiumBonus(commander.placement, opponent.placement)
  const bonus =
    ratingGapRatio *
    closenessScore *
    COMMANDER_MMR_CONFIG.clutch.underdogFactor *
    podiumBonus

  return roundNumber(
    clamp(1 + bonus, 1, COMMANDER_MMR_CONFIG.clutch.maxMultiplier),
  )
}

/**
 * Normalizes pairwise deltas so larger pods do not explode total MMR movement.
 */
export function getPodSizeScaling(podSize: number): number {
  if (!COMMANDER_MMR_CONFIG.podScaling.enabled) return 1
  return roundNumber(1 / Math.max(podSize - 1, 1))
}

/**
 * Validates pod inputs and throws a descriptive error when the shape is unsafe to score.
 */
export function validateCommanderPodResults(podResults: CommanderPodResult[]): void {
  if (podResults.length < COMMANDER_MMR_CONFIG.minPlayers) {
    throw new Error(`Commander MMR requires at least ${COMMANDER_MMR_CONFIG.minPlayers} players.`)
  }

  const commanderIds = new Set<string>()

  for (const entry of podResults) {
    if (!entry.commanderId.trim()) {
      throw new Error("Commander MMR requires every pod entry to have a commanderId.")
    }

    if (!Number.isFinite(entry.placement) || entry.placement < 1) {
      throw new Error(`Invalid placement for commander "${entry.commanderId}".`)
    }

    if (entry.currentMMR !== undefined && !Number.isFinite(entry.currentMMR)) {
      throw new Error(`Invalid currentMMR for commander "${entry.commanderId}".`)
    }

    if (commanderIds.has(entry.commanderId)) {
      throw new Error(`Duplicate commanderId "${entry.commanderId}" in pod results.`)
    }

    commanderIds.add(entry.commanderId)
  }
}

/**
 * Returns a small composable wrapper for convenient reuse inside Nuxt consumers.
 */
export function useCommanderMMR() {
  return {
    config: COMMANDER_MMR_CONFIG,
    getInitialCommanderMMR,
    getCommanderTierFromMMR,
    getCommanderTierRangeFromMMR,
    getCommanderMMRMultiplier,
    getCommanderMMRMultiplierBreakdown,
    getPlacementClosenessMultiplier,
    getClutchMultiplier,
    getPodSizeScaling,
    getPairwiseResult,
    calculateCommanderMMRChanges,
    validateCommanderPodResults,
  }
}

/**
 * Converts placement distance into a 0..1 closeness score for clutch calculations.
 */
function getPlacementClosenessScore(
  commanderPlacement: number,
  opponentPlacement: number,
  podSize: number,
): number {
  const gap = Math.abs(commanderPlacement - opponentPlacement)
  const maxGap = Math.max(podSize - 1, 1)
  return roundNumber(clamp(1 - ((gap - 1) / maxGap), 0, 1))
}

/**
 * Makes 1st-over-2nd the highest-value clutch case while still supporting smaller podium moments.
 */
function getPodiumBonus(
  commanderPlacement: number,
  opponentPlacement: number,
): number {
  if (commanderPlacement === 1 && opponentPlacement === 2) {
    return COMMANDER_MMR_CONFIG.clutch.finalsBonus
  }

  if (commanderPlacement <= 3 && opponentPlacement === commanderPlacement + 1) {
    return COMMANDER_MMR_CONFIG.clutch.podiumBonus
  }

  return 1
}

/**
 * Clamps a number into the provided numeric range.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Performs linear interpolation between two numeric endpoints.
 */
function lerp(start: number, end: number, amount: number): number {
  return start + ((end - start) * amount)
}

/**
 * Rounds public output values to the configured precision for readability.
 */
function roundNumber(value: number): number {
  const factor = 10 ** COMMANDER_MMR_CONFIG.precision
  return Math.round(value * factor) / factor
}
