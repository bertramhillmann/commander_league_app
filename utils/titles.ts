import type { LeagueStanding, PlayerGameRecord, ProcessedGame, ProcessedGamePlayer } from '~/composables/useLeagueState'
import { buildLeagueSeasonRanges, getResolvedLeagueSettings, hasActiveSeasonalRanking } from '~/utils/leagueSettings'

export type CommanderTitleId =
  | 'chaotic_force'
  | 'stonewall'
  | 'tempo_savant'
  | 'calculated_pressure'
  | 'scrappy_contender'
  | 'rising_star'
  | 'fallen_champion'
  | 'the_unshaken'
  | 'tyrant_of_the_tables'
  | 'tyrant_of_glass'
  | 'feast_or_famine'
  | 'master_of_none'
  | 'prodigy'
  | 'paradigm_of_stubbornness'
  | 'wayward_apprentice'
  | 'bottom_dweller'
  | 'forgotten_hero'
  | 'wild_card'
  | 'giant_slayer'
  | 'crusher_of_the_meek'
  | 'challenger'
  | 'underdog'
  | 'overthrower'
  | 'kingslayer'
  | 'legends_bane'
  | 'comeback_kid'
  | 'hero_to_zero'
  | 'hero_of_the_first_era'
  | 'herald_of_the_second_coming'
  | 'knight_of_three_crossroads'
  | 'champion_of_the_end'

export interface CommanderTitleDef {
  id: CommanderTitleId
  name: string
  description: string
}

export interface CommanderTitleResult extends CommanderTitleDef {
  reason: string
}

export interface CommanderTitleSummary {
  currentTitle: CommanderTitleResult
  displayTitle: CommanderTitleResult
  earnedTitles: CommanderTitleResult[]
}

export const TITLES: Record<CommanderTitleId, CommanderTitleDef> = {
  chaotic_force: {
    id: 'chaotic_force',
    name: 'Chaotic Force',
    description: 'Placements are spread unusually evenly across the full range of possible finishes.',
  },
  stonewall: {
    id: 'stonewall',
    name: 'Stonewall',
    description: 'A stubbornly stable pairing that lives in the middle of the pack with little drama.',
  },
  tempo_savant: {
    id: 'tempo_savant',
    name: 'Steady Hand',
    description: 'Wins through patience and precision, securing strong finishes without ever overreaching.',
  },
  calculated_pressure: {
    id: 'calculated_pressure',
    name: 'Grand Strategist',
    description: 'Applies steady pressure with strong points and finishes, overall controlled and consistent gameplay.',
  },
  scrappy_contender: {
    id: 'scrappy_contender',
    name: 'Knight of Close to Winning',
    description: 'Often pushes into strong finishes and good points, even when it does rarely convert into wins.',
  },
  rising_star: {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Recent games show a clear upward trend toward better placements.',
  },
  fallen_champion: {
    id: 'fallen_champion',
    name: 'Falling Champion',
    description: 'Recent games show a clear downward trend toward worse placements.',
  },
  the_unshaken: {
    id: 'the_unshaken',
    name: 'The Unshaken',
    description: 'Delivers strong placements with remarkable consistency.',
  },
  tyrant_of_the_tables: {
    id: 'tyrant_of_the_tables',
    name: 'Tyrant of the Tables',
    description: 'Wins more often than any other finish and owns the best win rate in the league.',
  },
  tyrant_of_glass: {
    id: 'tyrant_of_glass',
    name: 'Overlord of Glass',
    description: 'A volatile pairing that spikes into first place almost as often as it crashes to last.',
  },
  feast_or_famine: {
    id: 'feast_or_famine',
    name: 'Volatile Madman',
    description: 'Lives on extreme swings, with explosive highs and punishing lows, but without fully ruling the tables.',
  },
  master_of_none: {
    id: 'master_of_none',
    name: 'Master Of None',
    description: 'Underperforms both the league baseline and the player’s own overall level.',
  },
  prodigy: {
    id: 'prodigy',
    name: 'Prodigy',
    description: 'A small sample size, but the early returns are already excellent.',
  },
  paradigm_of_stubbornness: {
    id: 'paradigm_of_stubbornness',
    name: 'Paradigm of Stubbornness',
    description: 'The pairing keeps coming back despite a large sample of weak results.',
  },
  wayward_apprentice: {
    id: 'wayward_apprentice',
    name: 'Wayward Apprentice',
    description: 'A low-sample commander pairing that has not yet learned how to turn games into wins.',
  },
  bottom_dweller: {
    id: 'bottom_dweller',
    name: 'Bottom Dweller',
    description: 'Consistently stayed beneath this player\'s own usual standard and never climbed above it.',
  },
  forgotten_hero: {
    id: 'forgotten_hero',
    name: 'Forgotten Hero',
    description: 'Once a trusted staple, now left untouched for a long stretch of the player’s recent games.',
  },
  wild_card: {
    id: 'wild_card',
    name: 'Wild Card',
    description: 'No single extreme defines this pairing better than its all-around unpredictability.',
  },
  giant_slayer: {
    id: 'giant_slayer',
    name: 'Giant Slayer',
    description: 'Most wins came against stronger opposition near the top of the league.',
  },
  crusher_of_the_meek: {
    id: 'crusher_of_the_meek',
    name: 'Crusher Of the Meek',
    description: 'Most wins came against weaker opposition near the bottom of the league.',
  },
  challenger: { id: 'challenger', name: 'Challenger', description: 'Won a game against a commander MMR advantage of at least 200.' },
  underdog: { id: 'underdog', name: 'Underdog', description: 'Won a game against a commander MMR advantage of at least 300.' },
  overthrower: { id: 'overthrower', name: 'Overthrower', description: 'Won a game against a commander MMR advantage of at least 400.' },
  kingslayer: { id: 'kingslayer', name: 'Kingslayer', description: 'Won a game against the league leader while last in the standings.' },
  legends_bane: { id: 'legends_bane', name: "Legend's Bane", description: 'Repeatedly finished strongly against pods with at least 150 more average commander MMR.' },
  comeback_kid: { id: 'comeback_kid', name: 'Comeback Kid', description: 'Recovered more than 600 commander MMR from this pairing’s low point.' },
  hero_to_zero: { id: 'hero_to_zero', name: 'Hero to Zero', description: 'Fell more than 600 commander MMR from this pairing’s peak.' },
  hero_of_the_first_era: { id: 'hero_of_the_first_era', name: 'Hero of the First Era', description: 'Best eligible commander pairing by average placement in the first league season.' },
  herald_of_the_second_coming: { id: 'herald_of_the_second_coming', name: 'Herald Of the Second Coming', description: 'Best eligible commander pairing by average placement in the second league season.' },
  knight_of_three_crossroads: { id: 'knight_of_three_crossroads', name: 'Knight of Three Crossroads', description: 'Best eligible commander pairing by average placement in the third league season.' },
  champion_of_the_end: { id: 'champion_of_the_end', name: 'Champion of the End', description: 'Best eligible commander pairing by average placement in the final league season.' },
}

export const TITLE_ORDER: CommanderTitleId[] = [
  'chaotic_force',
  'stonewall',
  'tempo_savant',
  'calculated_pressure',
  'scrappy_contender',
  'forgotten_hero',
  'crusher_of_the_meek',
  'giant_slayer',
  'feast_or_famine',
  'rising_star',
  'fallen_champion',
  'tyrant_of_glass',
  'the_unshaken',
  'master_of_none',
  'wayward_apprentice',
  'bottom_dweller',
  'prodigy',
  'paradigm_of_stubbornness',
  'tyrant_of_the_tables',
  'challenger',
  'underdog',
  'overthrower',
  'kingslayer',
  'legends_bane',
  'comeback_kid',
  'hero_to_zero',
  'hero_of_the_first_era',
  'herald_of_the_second_coming',
  'knight_of_three_crossroads',
  'champion_of_the_end',
]

type OpponentSummary = {
  avgPercentile: number
  topShare: number
  bottomShare: number
  winGames: number
}

type MmrTitleStats = {
  largestWinMmrGap: number
  strongUnderdogFinishes: number
  kingslayerWins: number
  recoveryFromLow: number
  fallFromPeak: number
}

export type CommanderTitleContext = {
  playerName: string
  commanderName: string
  commanderRecords: PlayerGameRecord[]
  playerRecords: PlayerGameRecord[]
  allRecords: PlayerGameRecord[]
  games: Pick<ProcessedGame, 'gameId' | 'players' | 'date'>[]
  standings: Pick<LeagueStanding, 'name' | 'rank'>[]
}

const SEASON_CHAMPION_TITLE_IDS = new Set<CommanderTitleId>([
  'hero_of_the_first_era',
  'herald_of_the_second_coming',
  'knight_of_three_crossroads',
  'champion_of_the_end',
])

function getEligibleCommanderTitles(
  context: CommanderTitleContext,
  includeSeasonChampionTitles = true,
): CommanderTitleResult[] {
  const {
    playerName,
    commanderName,
    commanderRecords,
    playerRecords,
    allRecords,
    games,
    standings,
  } = context

  if (commanderRecords.length === 0) {
    return [withReason('wild_card', 'No games recorded with this pairing yet.')]
  }

  const gameOrder = new Map(games.map((game, index) => [game.gameId, index]))
  const orderedCommanderRecords = [...commanderRecords].sort(
    (a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0),
  )
  const orderedPlayerRecords = [...playerRecords].sort(
    (a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0),
  )
  const gamesById = new Map(games.map((game) => [game.gameId, game]))
  const standingsByName = new Map(standings.map((entry) => [entry.name, entry.rank]))

  const plays = orderedCommanderRecords.length
  const placements = orderedCommanderRecords.map((record) => record.placement)
  const wins = orderedCommanderRecords.filter((record) => record.placement === 1).length
  const firstRate = wins / plays
  const lastCount = orderedCommanderRecords.filter((record) => record.placement === record.playerCount).length
  const lastRate = lastCount / plays
  const avgBasePoints = average(orderedCommanderRecords.map((record) => record.basePoints))
  const maxPrefixAvgBasePoints = maxPrefixAverage(orderedCommanderRecords.map((record) => record.basePoints))
  const avgPlacement = average(placements)
  const placementStdDev = stddev(placements)
  const trendSlope = regressionSlope(placements)
  const earlyAvgPlacement = average(placements.slice(0, Math.ceil(plays / 2)))
  const lateAvgPlacement = average(placements.slice(Math.floor(plays / 2)))

  const playerAvgBasePoints = average(orderedPlayerRecords.map((record) => record.basePoints))
  const playerWinRate = orderedPlayerRecords.length
    ? orderedPlayerRecords.filter((record) => record.placement === 1).length / orderedPlayerRecords.length
    : 0
  const leagueAvgBasePoints = average(allRecords.map((record) => record.basePoints))
  const leagueWinRate = allRecords.length
    ? allRecords.filter((record) => record.placement === 1).length / allRecords.length
    : 0

  const placementCounts = new Map<number, number>()
  for (const placement of placements) {
    placementCounts.set(placement, (placementCounts.get(placement) ?? 0) + 1)
  }
  const distinctPlacements = placementCounts.size
  const expectedPerPlacement = plays / Math.max(1, distinctPlacements)
  const placementSpread = [...placementCounts.values()].map((count) => Math.abs(count - expectedPerPlacement))
  const evennessScore = expectedPerPlacement === 0
    ? 0
    : 1 - (average(placementSpread) / expectedPerPlacement)

  const pairWinRates = buildPairWinRates(allRecords)
  const thisPairKey = `${playerName}::${commanderName}`
  const otherPairWinRates = [...pairWinRates.entries()]
    .filter(([key]) => key !== thisPairKey)
    .map(([, value]) => value)
  const bestOtherWinRate = otherPairWinRates.length ? Math.max(...otherPairWinRates) : 0

  const placementRateMap = new Map<number, number>()
  for (const [placement, count] of placementCounts.entries()) {
    placementRateMap.set(placement, count / plays)
  }
  const bestNonWinPlacementRate = Math.max(
    0,
    ...[...placementRateMap.entries()]
      .filter(([placement]) => placement !== 1)
      .map(([, rate]) => rate),
  )

  const forgottenGames = countGamesSinceLastUse(orderedPlayerRecords, commanderName)
  const forgottenThreshold = Math.max(6, Math.ceil(orderedPlayerRecords.length * 0.3))
  const winOpponents = summarizeWinOpponents(
    orderedCommanderRecords.filter((record) => record.placement === 1),
    gamesById,
    standingsByName,
    standings.length,
  )
  const mmrTitleStats = summarizeMmrTitles(
    playerName,
    orderedCommanderRecords,
    allRecords,
    standingsByName,
    standings.length,
  )
  const seasonChampionIndexes = includeSeasonChampionTitles
    ? getSeasonChampionIndexes(playerName, commanderName, allRecords, games)
    : []

  const earnedTitles: CommanderTitleResult[] = []
  for (const id of TITLE_ORDER) {
    if (!includeSeasonChampionTitles && SEASON_CHAMPION_TITLE_IDS.has(id)) continue
    const reason = evaluateTitle(id, {
      playerName,
      commanderName,
      plays,
      wins,
      firstRate,
      lastRate,
      avgBasePoints,
      avgPlacement,
      placementStdDev,
      trendSlope,
      earlyAvgPlacement,
      lateAvgPlacement,
      maxPrefixAvgBasePoints,
      playerAvgBasePoints,
      playerWinRate,
      leagueAvgBasePoints,
      leagueWinRate,
      evennessScore,
      distinctPlacements,
      bestOtherWinRate,
      bestNonWinPlacementRate,
      forgottenGames,
      forgottenThreshold,
      winOpponents,
      mmrTitleStats,
      seasonChampionIndexes,
    })

    if (reason) earnedTitles.push(withReason(id, reason))
  }

  return earnedTitles.length > 0
    ? earnedTitles
    : [withReason('wild_card', 'No more specific pattern outweighed the others for this pairing.')]
}

export function getCommanderPerformanceTitle(context: CommanderTitleContext): CommanderTitleResult {
  return getEligibleCommanderTitles(context).at(-1)
    ?? withReason('wild_card', 'No games recorded with this pairing yet.')
}

export function getCommanderTitleHistory(context: CommanderTitleContext): CommanderTitleResult[] {
  const currentTitle = getCommanderPerformanceTitle(context)
  if (context.commanderRecords.length === 0) return [currentTitle]

  const gameOrder = new Map(context.games.map((game, index) => [game.gameId, index]))
  const orderedGames = [...context.games]
  const orderedCommanderRecords = [...context.commanderRecords].sort(
    (a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0),
  )
  const orderedPlayerRecords = [...context.playerRecords].sort(
    (a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0),
  )
  const orderedAllRecords = [...context.allRecords].sort(
    (a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0),
  )

  const earnedById = new Map<CommanderTitleId, CommanderTitleResult>()

  for (let index = 0; index < orderedCommanderRecords.length; index++) {
    const latestCommanderRecord = orderedCommanderRecords[index]
    const lastGameIndex = gameOrder.get(latestCommanderRecord.gameId) ?? index
    const snapshotContext = {
      ...context,
      commanderRecords: orderedCommanderRecords.slice(0, index + 1),
      playerRecords: orderedPlayerRecords.filter((record) => (gameOrder.get(record.gameId) ?? 0) <= lastGameIndex),
      allRecords: orderedAllRecords.filter((record) => (gameOrder.get(record.gameId) ?? 0) <= lastGameIndex),
      games: orderedGames.slice(0, lastGameIndex + 1),
    }

    for (const title of getEligibleCommanderTitles(snapshotContext, false)) {
      earnedById.set(title.id, title)
    }
  }

  for (const title of getEligibleCommanderTitles(context)) {
    earnedById.set(title.id, title)
  }

  return [...earnedById.values()]
}

export function getCommanderTitleSummary(
  context: CommanderTitleContext,
  selectedTitleId?: CommanderTitleId | null,
): CommanderTitleSummary {
  const currentTitle = getCommanderPerformanceTitle(context)
  const earnedTitles = getCommanderTitleHistory(context)
  const displayTitle = selectedTitleId
    ? earnedTitles.find((title) => title.id === selectedTitleId) ?? currentTitle
    : currentTitle

  return {
    currentTitle,
    displayTitle,
    earnedTitles,
  }
}

function evaluateTitle(
  id: CommanderTitleId,
  metrics: {
    playerName: string
    commanderName: string
    plays: number
    wins: number
    firstRate: number
    lastRate: number
    avgBasePoints: number
    avgPlacement: number
    placementStdDev: number
    trendSlope: number
    earlyAvgPlacement: number
    lateAvgPlacement: number
    maxPrefixAvgBasePoints: number
    playerAvgBasePoints: number
    playerWinRate: number
    leagueAvgBasePoints: number
    leagueWinRate: number
    evennessScore: number
    distinctPlacements: number
    bestOtherWinRate: number
    bestNonWinPlacementRate: number
    forgottenGames: number
    forgottenThreshold: number
    winOpponents: OpponentSummary
    mmrTitleStats: MmrTitleStats
    seasonChampionIndexes: number[]
  },
) {
  const {
    plays,
    wins,
    firstRate,
    lastRate,
    avgBasePoints,
    avgPlacement,
    placementStdDev,
    trendSlope,
    earlyAvgPlacement,
    lateAvgPlacement,
    maxPrefixAvgBasePoints,
    playerAvgBasePoints,
    playerWinRate,
    leagueAvgBasePoints,
    leagueWinRate,
    evennessScore,
    distinctPlacements,
    bestOtherWinRate,
    bestNonWinPlacementRate,
    forgottenGames,
    forgottenThreshold,
    winOpponents,
    mmrTitleStats,
    seasonChampionIndexes,
  } = metrics

  switch (id) {
    case 'chaotic_force':
      if (plays >= 5 && distinctPlacements >= 3 && evennessScore >= 0.52 && placementStdDev >= 0.82) {
        return `Placements are unusually even across ${distinctPlacements} finish bands over ${plays} games.`
      }
      return null
    case 'stonewall':
      if (
        plays >= 7 &&
        placementStdDev <= 0.7 &&
        avgPlacement >= 2 &&
        avgPlacement <= 3.25 &&
        distinctPlacements <= 3
      ) {
        return `Across ${plays} games it keeps landing in a narrow middle band with only ${fmt(placementStdDev)} placement spread.`
      }
      return null
    case 'tempo_savant':
      if (
        plays >= 6 &&
        avgBasePoints >= Math.max(leagueAvgBasePoints, playerAvgBasePoints) * 1.08 &&
        firstRate >= leagueWinRate * 0.85 &&
        lastRate <= 0.12 &&
        placementStdDev <= 0.8
      ) {
        return `It quietly outperforms baseline scoring while almost never collapsing, pairing ${fmt(avgBasePoints)} avg points with only ${Math.round(lastRate * 100)}% last places.`
      }
      return null
    case 'calculated_pressure':
      if (
        plays >= 6 &&
        avgBasePoints >= Math.max(leagueAvgBasePoints, playerAvgBasePoints) * 1.02 &&
        bestNonWinPlacementRate >= 0.28 &&
        lastRate <= 0.2 &&
        placementStdDev <= 1.02
      ) {
        return `It keeps producing strong finishes and good points without the extreme swings of a glass-cannon pairing.`
      }
      return null
    case 'scrappy_contender':
      if (
        plays >= 6 &&
        avgBasePoints >= Math.max(leagueAvgBasePoints, playerAvgBasePoints) * 1.05 &&
        firstRate < Math.max(leagueWinRate, playerWinRate) * 1.05 &&
        bestNonWinPlacementRate >= 0.3
      ) {
        return `It scores well and threatens often, but a lot of that pressure turns into near-misses instead of wins.`
      }
      return null
    case 'rising_star':
      if (plays >= 6 && trendSlope <= -0.12 && lateAvgPlacement <= earlyAvgPlacement - 0.5) {
        return `Recent finishes improved from ${fmt(earlyAvgPlacement)} average early to ${fmt(lateAvgPlacement)} lately.`
      }
      return null
    case 'fallen_champion':
      if (plays >= 6 && trendSlope >= 0.12 && lateAvgPlacement >= earlyAvgPlacement + 0.5) {
        return `Recent finishes slipped from ${fmt(earlyAvgPlacement)} average early to ${fmt(lateAvgPlacement)} lately.`
      }
      return null
    case 'forgotten_hero':
      if (plays >= 6 && forgottenGames >= forgottenThreshold) {
        return `It has ${plays} total games, but has been absent for ${forgottenGames} of ${forgottenThreshold}+ recent player games.`
      }
      return null
    case 'crusher_of_the_meek':
      if (
        winOpponents.winGames >= 2 &&
        winOpponents.avgPercentile >= 0.68 &&
        winOpponents.bottomShare >= 0.5
      ) {
        return `Winning pods leaned toward lower-ranked opponents, with ${Math.round(winOpponents.bottomShare * 100)}% of wins against bottom-tier tables.`
      }
      return null
    case 'giant_slayer':
      if (
        winOpponents.winGames >= 2 &&
        winOpponents.avgPercentile <= 0.38 &&
        winOpponents.topShare >= 0.4
      ) {
        return `Wins mostly came through stronger pods, with ${Math.round(winOpponents.topShare * 100)}% of winning tables featuring top-tier opposition.`
      }
      return null
    case 'challenger':
      if (mmrTitleStats.largestWinMmrGap >= 200) {
        return `Won a game while facing ${Math.round(mmrTitleStats.largestWinMmrGap)} more average commander MMR across the rest of the pod.`
      }
      return null
    case 'underdog':
      if (mmrTitleStats.largestWinMmrGap >= 300) {
        return `Won a game while facing ${Math.round(mmrTitleStats.largestWinMmrGap)} more average commander MMR across the rest of the pod.`
      }
      return null
    case 'overthrower':
      if (mmrTitleStats.largestWinMmrGap >= 400) {
        return `Toppled a pod with ${Math.round(mmrTitleStats.largestWinMmrGap)} more average commander MMR.`
      }
      return null
    case 'kingslayer':
      if (mmrTitleStats.kingslayerWins > 0) {
        return `Won ${mmrTitleStats.kingslayerWins} game${mmrTitleStats.kingslayerWins === 1 ? '' : 's'} against the current league leader while sitting last in the standings.`
      }
      return null
    case 'legends_bane':
      if (mmrTitleStats.strongUnderdogFinishes >= 4) {
        return `Finished in the top half ${mmrTitleStats.strongUnderdogFinishes} times against pods averaging at least 150 more commander MMR.`
      }
      return null
    case 'comeback_kid':
      if (mmrTitleStats.recoveryFromLow >= 600) {
        return `Climbed ${Math.round(mmrTitleStats.recoveryFromLow)} commander MMR from its lowest recorded point.`
      }
      return null
    case 'hero_to_zero':
      if (mmrTitleStats.fallFromPeak >= 600) {
        return `Dropped ${Math.round(mmrTitleStats.fallFromPeak)} commander MMR from its highest recorded point.`
      }
      return null
    case 'hero_of_the_first_era':
      return seasonChampionIndexes.includes(0) ? 'Finished as the best eligible commander pairing of Season 1 by average placement.' : null
    case 'herald_of_the_second_coming':
      return seasonChampionIndexes.includes(1) ? 'Finished as the best eligible commander pairing of Season 2 by average placement.' : null
    case 'knight_of_three_crossroads':
      return seasonChampionIndexes.includes(2) ? 'Finished as the best eligible commander pairing of Season 3 by average placement.' : null
    case 'champion_of_the_end':
      return seasonChampionIndexes.includes(3) ? 'Finished as the best eligible commander pairing of Season 4 by average placement.' : null
    case 'feast_or_famine':
      if (
        plays >= 7 &&
        firstRate >= 0.2 &&
        lastRate >= 0.2 &&
        placementStdDev >= 1 &&
        firstRate < bestOtherWinRate &&
        trendSlope < 0.12 &&
        lateAvgPlacement < earlyAvgPlacement + 0.5
      ) {
        return `It bounces between explosive highs and brutal crashes, but not consistently enough to own the league's best win rate.`
      }
      return null
    case 'tyrant_of_glass':
      if (plays >= 8 && firstRate >= 0.3 && lastRate >= 0.22 && placementStdDev >= 1.15) {
        return `It swings hard between greatness and collapse with ${Math.round(firstRate * 100)}% wins and ${Math.round(lastRate * 100)}% last places.`
      }
      return null
    case 'the_unshaken':
      if (
        plays >= 8 &&
        avgPlacement <= 2.15 &&
        placementStdDev <= 0.68 &&
        distinctPlacements <= 3 &&
        evennessScore <= 0.58 &&
        trendSlope < 0.08
      ) {
        return `Average finish sits at ${fmt(avgPlacement)} with a very tight placement spread of ${fmt(placementStdDev)}.`
      }
      return null
    case 'master_of_none':
      if (
        plays >= 6 &&
        avgBasePoints <= leagueAvgBasePoints * 0.78 &&
        avgBasePoints <= playerAvgBasePoints * 0.78 &&
        firstRate <= Math.min(leagueWinRate * 0.75, playerWinRate * 0.75 || 1)
      ) {
        return `Average points trail both the league (${fmt(leagueAvgBasePoints)}) and the player baseline (${fmt(playerAvgBasePoints)}).`
      }
      return null
    case 'wayward_apprentice':
      if (
        plays >= 3 &&
        plays <= 8 &&
        firstRate <= Math.min(0.1, leagueWinRate * 0.65)
      ) {
        return `Only ${plays} games so far, and it has managed just ${Math.round(firstRate * 100)}% wins.`
      }
      return null
    case 'bottom_dweller':
      if (
        plays >= 5 &&
        avgBasePoints < playerAvgBasePoints * 0.92 &&
        maxPrefixAvgBasePoints <= playerAvgBasePoints
      ) {
        return `Across all stretches of play, it never rose above ${metrics.playerName}'s usual scoring pace.`
      }
      return null
    case 'prodigy':
      if (
        plays <= 5 &&
        (
          avgBasePoints >= Math.max(leagueAvgBasePoints, playerAvgBasePoints) * 1.25 ||
          firstRate >= Math.max(leagueWinRate, playerWinRate) * 1.35
        )
      ) {
        return `Only ${plays} games so far, but it is already outperforming the usual baseline by a wide margin.`
      }
      return null
    case 'paradigm_of_stubbornness':
      if (
        plays >= 12 &&
        avgBasePoints <= leagueAvgBasePoints * 0.85 &&
        firstRate <= leagueWinRate * 0.85 &&
        trendSlope >= -0.03
      ) {
        return `It keeps seeing play across ${plays} games despite staying below league pace.`
      }
      return null
    case 'tyrant_of_the_tables':
      if (
        plays >= 8 &&
        firstRate >= bestNonWinPlacementRate + 0.1 &&
        firstRate > bestOtherWinRate
      ) {
        return `Wins make up ${Math.round(firstRate * 100)}% of games, beating every other pairing’s win rate in the league.`
      }
      return null
    default:
      return null
  }
}

function getSeasonChampionIndexes(
  playerName: string,
  commanderName: string,
  allRecords: PlayerGameRecord[],
  games: Pick<ProcessedGame, 'gameId' | 'date'>[],
): number[] {
  const seasonalRanking = getResolvedLeagueSettings().standings.seasonalRanking
  if (!hasActiveSeasonalRanking(seasonalRanking)) return []

  const timestampByGameId = new Map(games.map((game) => [game.gameId, new Date(game.date).getTime()]))
  const minimumGames = 3
  const now = Date.now()

  const championIndexes: number[] = []
  for (const [index, season] of buildLeagueSeasonRanges(seasonalRanking).entries()) {
    if (season.endMs >= now) continue

    const pairRecords = new Map<string, PlayerGameRecord[]>()
    for (const record of allRecords) {
      const timestamp = timestampByGameId.get(record.gameId)
      if (!Number.isFinite(timestamp) || timestamp! < season.startMs || timestamp! > season.endMs) continue
      const key = `${record.playerName}::${record.commander}`
      const bucket = pairRecords.get(key)
      if (bucket) bucket.push(record)
      else pairRecords.set(key, [record])
    }

    const champion = [...pairRecords.entries()]
      .filter(([, records]) => records.length >= minimumGames)
      .map(([key, records]) => ({
        key,
        averagePlacement: average(records.map((record) => record.placement)),
        averagePoints: average(records.map((record) => record.finalPoints)),
        plays: records.length,
      }))
      .sort((left, right) =>
        left.averagePlacement - right.averagePlacement
        || right.averagePoints - left.averagePoints
        || right.plays - left.plays
        || left.key.localeCompare(right.key),
      )[0]

    if (champion?.key === `${playerName}::${commanderName}`) championIndexes.push(index)
  }

  return championIndexes
}

function summarizeMmrTitles(
  playerName: string,
  commanderRecords: PlayerGameRecord[],
  allRecords: PlayerGameRecord[],
  standingsByName: Map<string, number>,
  standingCount: number,
): MmrTitleStats {
  const recordsByGameId = new Map<string, PlayerGameRecord[]>()
  for (const record of allRecords) {
    const bucket = recordsByGameId.get(record.gameId)
    if (bucket) bucket.push(record)
    else recordsByGameId.set(record.gameId, [record])
  }

  let largestWinMmrGap = 0
  let strongUnderdogFinishes = 0
  let kingslayerWins = 0

  for (const record of commanderRecords) {
    const ownMmr = record.commanderMMRBefore ?? record.commanderMMRAfter ?? 0
    const opponents = (recordsByGameId.get(record.gameId) ?? [])
      .filter((opponent) => opponent.playerName !== playerName)
    const opponentMmrs = opponents
      .map((opponent) => opponent.commanderMMRBefore ?? opponent.commanderMMRAfter ?? 0)
      .filter((mmr) => Number.isFinite(mmr) && mmr > 0)
    const opponentAverage = opponentMmrs.length > 0 ? average(opponentMmrs) : 0
    const mmrGap = opponentAverage - ownMmr

    if (record.placement === 1) largestWinMmrGap = Math.max(largestWinMmrGap, mmrGap)
    if (mmrGap >= 150 && record.placement <= Math.ceil(record.playerCount / 2)) {
      strongUnderdogFinishes++
    }

    const playerRank = standingsByName.get(playerName)
    const facesLeader = opponents.some((opponent) => standingsByName.get(opponent.playerName) === 1)
    if (record.placement === 1 && playerRank === standingCount && facesLeader) kingslayerWins++
  }

  let lowPoint = Number.POSITIVE_INFINITY
  let peakPoint = Number.NEGATIVE_INFINITY
  let recoveryFromLow = 0
  let fallFromPeak = 0
  for (const record of commanderRecords) {
    const mmr = record.commanderMMRAfter ?? record.commanderMMRBefore ?? 0
    if (!Number.isFinite(mmr) || mmr <= 0) continue
    recoveryFromLow = Math.max(recoveryFromLow, mmr - lowPoint)
    fallFromPeak = Math.max(fallFromPeak, peakPoint - mmr)
    lowPoint = Math.min(lowPoint, mmr)
    peakPoint = Math.max(peakPoint, mmr)
  }

  return {
    largestWinMmrGap: Math.max(0, largestWinMmrGap),
    strongUnderdogFinishes,
    kingslayerWins,
    recoveryFromLow: Math.max(0, recoveryFromLow),
    fallFromPeak: Math.max(0, fallFromPeak),
  }
}

function summarizeWinOpponents(
  winRecords: PlayerGameRecord[],
  gamesById: Map<string, Pick<ProcessedGame, 'gameId' | 'players'>>,
  standingsByName: Map<string, number>,
  playerCount: number,
): OpponentSummary {
  if (winRecords.length === 0 || playerCount === 0) {
    return { avgPercentile: 0.5, topShare: 0, bottomShare: 0, winGames: 0 }
  }

  const avgPercentiles: number[] = []
  let topOpponents = 0
  let bottomOpponents = 0
  let totalOpponents = 0

  for (const record of winRecords) {
    const game = gamesById.get(record.gameId)
    if (!game) continue

    const opponents = game.players.filter((player) => player.name !== record.playerName)
    if (opponents.length === 0) continue

    const percentiles = opponents.map((player) => getRankPercentile(player, standingsByName, playerCount))
    avgPercentiles.push(average(percentiles))

    for (const percentile of percentiles) {
      if (percentile <= 0.33) topOpponents++
      if (percentile >= 0.67) bottomOpponents++
      totalOpponents++
    }
  }

  if (avgPercentiles.length === 0 || totalOpponents === 0) {
    return { avgPercentile: 0.5, topShare: 0, bottomShare: 0, winGames: 0 }
  }

  return {
    avgPercentile: average(avgPercentiles),
    topShare: topOpponents / totalOpponents,
    bottomShare: bottomOpponents / totalOpponents,
    winGames: avgPercentiles.length,
  }
}

function getRankPercentile(
  player: Pick<ProcessedGamePlayer, 'name'>,
  standingsByName: Map<string, number>,
  playerCount: number,
) {
  const rank = standingsByName.get(player.name) ?? playerCount
  if (playerCount <= 1) return 0.5
  return (rank - 1) / (playerCount - 1)
}

function buildPairWinRates(records: PlayerGameRecord[]) {
  const byPair = new Map<string, { plays: number; wins: number }>()
  for (const record of records) {
    const key = `${record.playerName}::${record.commander}`
    const current = byPair.get(key) ?? { plays: 0, wins: 0 }
    current.plays += 1
    if (record.placement === 1) current.wins += 1
    byPair.set(key, current)
  }

  return new Map(
    [...byPair.entries()].map(([key, value]) => [key, value.plays > 0 ? value.wins / value.plays : 0]),
  )
}

function countGamesSinceLastUse(records: PlayerGameRecord[], commanderName: string) {
  let lastIndex = -1
  records.forEach((record, index) => {
    if (record.commander === commanderName) lastIndex = index
  })
  if (lastIndex < 0) return 0
  return (records.length - 1) - lastIndex
}

function regressionSlope(values: number[]) {
  if (values.length < 2) return 0
  const meanX = (values.length - 1) / 2
  const meanY = average(values)
  let numerator = 0
  let denominator = 0
  values.forEach((value, index) => {
    const dx = index - meanX
    numerator += dx * (value - meanY)
    denominator += dx * dx
  })
  return denominator === 0 ? 0 : numerator / denominator
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stddev(values: number[]) {
  if (values.length === 0) return 0
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function maxPrefixAverage(values: number[]) {
  let total = 0
  let best = Number.NEGATIVE_INFINITY
  values.forEach((value, index) => {
    total += value
    best = Math.max(best, total / (index + 1))
  })
  return best === Number.NEGATIVE_INFINITY ? 0 : best
}

function withReason(id: CommanderTitleId, reason: string): CommanderTitleResult {
  return { ...TITLES[id], reason }
}

function fmt(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
