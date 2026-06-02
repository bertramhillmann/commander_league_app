import { type PlayerGameRecord, type PlayerState, type ProcessedGame, compareGamesChronological } from '~/composables/useLeagueState'
import { calculateCommanderMMRChanges, getCommanderTierFromMMR, type CommanderMMRTier } from '~/composables/useCommanderMMR'

const MIN_PLAYERS = 3
const MAX_PLAYERS = 5
const FAIRNESS_PULL = 0.85

export interface MatchmakingPlayerOption {
  name: string
  gamesPlayed: number
  overallMMR: number
  commanderCount: number
}

export interface MatchmakingCommanderChoice {
  commander: string
  currentMMR: number
  mmrTier: CommanderMMRTier
  tierLabel: string
  plays: number
  winRate: number
  avgPoints: number
  avgPlacement: number
  confidence: number
}

export interface MatchmakingPlacementOutcome {
  placement: number
  delta: number
  newMMR: number
  tier: CommanderMMRTier
  tierLabel: string
}

export interface MatchmakingCommanderSuggestion {
  playerName: string
  overallMMR: number
  targetMMR: number
  selectedMMR: number
  adjustment: number
  recommendedCommander: string
  selectedCommander: string
  commanderPlays: number
  commanderWinRate: number
  commanderAvgPoints: number
  commanderPlacement: number
  confidence: number
  tier: CommanderMMRTier
  tierLabel: string
  explanation: string
  availableCommanders: MatchmakingCommanderChoice[]
  placementOutcomes: MatchmakingPlacementOutcome[]
  isOverride: boolean
}

export interface MatchmakingResult {
  selectedPlayers: string[]
  fairnessSpreadBefore: number
  fairnessSpreadAfter: number
  averageMMR: number
  suggestions: MatchmakingCommanderSuggestion[]
}

interface CommanderProfile {
  commander: string
  plays: number
  wins: number
  avgBasePoints: number
  avgPlacement: number
  currentMMR: number
  mmrTier: CommanderMMRTier
  confidence: number
}

export function buildMatchmakingPlayerOptions(
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
): MatchmakingPlayerOption[] {
  const orderedGames = [...games].sort(compareGamesChronological)

  return Object.values(players)
    .map((player) => {
      const orderedRecords = getOrderedPlayerRecords(player.name, orderedGames, gameRecords)
      const profiles = buildCommanderProfiles(orderedRecords)

      return {
        name: player.name,
        gamesPlayed: orderedRecords.length,
        overallMMR: getOverallMMR(profiles),
        commanderCount: profiles.length,
      }
    })
    .filter((player) => player.gamesPlayed > 0 && player.commanderCount > 0)
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.overallMMR - a.overallMMR || a.name.localeCompare(b.name))
}

export function buildFairMatchmakingResult(
  selectedPlayers: string[],
  selectedCommanders: Record<string, string>,
  games: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): MatchmakingResult | null {
  if (selectedPlayers.length < MIN_PLAYERS || selectedPlayers.length > MAX_PLAYERS) return null

  const orderedGames = [...games].sort(compareGamesChronological)
  const playerPools = selectedPlayers
    .map((playerName) => {
      const orderedRecords = getOrderedPlayerRecords(playerName, orderedGames, gameRecords)
      const commanders = buildCommanderProfiles(orderedRecords)

      if (orderedRecords.length === 0 || commanders.length === 0) return null

      return {
        playerName,
        overallMMR: getOverallMMR(commanders),
        commanders,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))

  if (playerPools.length < MIN_PLAYERS) return null

  const averageMMR = round2(
    playerPools.reduce((sum, player) => sum + player.overallMMR, 0) / playerPools.length,
  )

  const recommendedByPlayer = new Map<string, CommanderProfile>()
  for (const player of playerPools) {
    recommendedByPlayer.set(player.playerName, pickRecommendedCommander(player, averageMMR))
  }

  const selectedProfiles = playerPools.map((player) => {
    const recommended = recommendedByPlayer.get(player.playerName) ?? player.commanders[0]
    const overrideName = selectedCommanders[player.playerName]
    const selected = player.commanders.find((commander) => commander.commander === overrideName) ?? recommended

    return {
      ...player,
      recommended,
      selected,
    }
  })

  const suggestions = selectedProfiles.map((player) => {
    const placementOutcomes = buildPlacementOutcomes(player.playerName, selectedProfiles)

    return {
      playerName: player.playerName,
      overallMMR: round2(player.overallMMR),
      targetMMR: round2(getTargetMMR(player, averageMMR)),
      selectedMMR: round2(player.selected.currentMMR),
      adjustment: round2(player.selected.currentMMR - player.overallMMR),
      recommendedCommander: player.recommended.commander,
      selectedCommander: player.selected.commander,
      commanderPlays: player.selected.plays,
      commanderWinRate: round3(player.selected.wins / player.selected.plays),
      commanderAvgPoints: round3(player.selected.avgBasePoints),
      commanderPlacement: round3(player.selected.avgPlacement),
      confidence: round3(player.selected.confidence),
      tier: player.selected.mmrTier,
      tierLabel: tierLabel(player.selected.mmrTier),
      explanation: describeAdjustment(player.overallMMR, averageMMR, player.selected, player.recommended),
      availableCommanders: player.commanders.map((commander) => ({
        commander: commander.commander,
        currentMMR: round2(commander.currentMMR),
        mmrTier: commander.mmrTier,
        tierLabel: tierLabel(commander.mmrTier),
        plays: commander.plays,
        winRate: round3(commander.wins / commander.plays),
        avgPoints: round3(commander.avgBasePoints),
        avgPlacement: round3(commander.avgPlacement),
        confidence: round3(commander.confidence),
      })),
      placementOutcomes,
      isOverride: player.selected.commander !== player.recommended.commander,
    } satisfies MatchmakingCommanderSuggestion
  })

  return {
    selectedPlayers: playerPools.map((player) => player.playerName),
    fairnessSpreadBefore: round2(getSpread(playerPools.map((player) => player.overallMMR))),
    fairnessSpreadAfter: round2(getSpread(selectedProfiles.map((player) => player.selected.currentMMR))),
    averageMMR: round2(averageMMR),
    suggestions,
  }
}

function buildCommanderProfiles(records: PlayerGameRecord[]): CommanderProfile[] {
  const grouped = new Map<string, PlayerGameRecord[]>()

  for (const record of records) {
    const bucket = grouped.get(record.commander)
    if (bucket) bucket.push(record)
    else grouped.set(record.commander, [record])
  }

  return [...grouped.entries()]
    .map(([commander, commanderRecords]) => {
      const plays = commanderRecords.length
      const wins = commanderRecords.filter((record) => record.placement === 1).length
      const avgBasePoints = commanderRecords.reduce((sum, record) => sum + record.basePoints, 0) / plays
      const avgPlacement = commanderRecords.reduce((sum, record) => sum + record.placement, 0) / plays
      const currentMMR = commanderRecords[commanderRecords.length - 1]?.commanderMMRAfter ?? 1500
      const mmrTier = getCommanderTierFromMMR(currentMMR)

      return {
        commander,
        plays,
        wins,
        avgBasePoints: round3(avgBasePoints),
        avgPlacement: round3(avgPlacement),
        currentMMR: round2(currentMMR),
        mmrTier,
        confidence: round3(Math.min(1, plays / 6)),
      }
    })
    .sort((a, b) => b.currentMMR - a.currentMMR || b.plays - a.plays || a.commander.localeCompare(b.commander))
}

function buildPlacementOutcomes(
  targetPlayerName: string,
  selectedProfiles: Array<{
    playerName: string
    selected: CommanderProfile
  }>,
): MatchmakingPlacementOutcome[] {
  const podSize = selectedProfiles.length
  if (podSize < MIN_PLAYERS) return []

  const target = selectedProfiles.find((entry) => entry.playerName === targetPlayerName)
  if (!target) return []

  const opponents = selectedProfiles
    .filter((entry) => entry.playerName !== targetPlayerName)
    .sort((left, right) =>
      right.selected.currentMMR - left.selected.currentMMR ||
      left.playerName.localeCompare(right.playerName),
    )

  const outcomes: MatchmakingPlacementOutcome[] = []

  for (let placement = 1; placement <= podSize; placement++) {
    const podResults = []
    let opponentIndex = 0

    for (let slot = 1; slot <= podSize; slot++) {
      if (slot === placement) {
        podResults.push({
          commanderId: `${target.playerName}::${target.selected.commander}`,
          commanderName: target.selected.commander,
          currentMMR: target.selected.currentMMR,
          placement: slot,
        })
        continue
      }

      const opponent = opponents[opponentIndex++]
      if (!opponent) continue

      podResults.push({
        commanderId: `${opponent.playerName}::${opponent.selected.commander}`,
        commanderName: opponent.selected.commander,
        currentMMR: opponent.selected.currentMMR,
        placement: slot,
      })
    }

    const changes = calculateCommanderMMRChanges(podResults)
    const targetChange = changes.find((entry) => entry.commanderId === `${target.playerName}::${target.selected.commander}`)
    if (!targetChange) continue

    const tier = getCommanderTierFromMMR(targetChange.newMMR)
    outcomes.push({
      placement,
      delta: round2(targetChange.delta),
      newMMR: round2(targetChange.newMMR),
      tier,
      tierLabel: tierLabel(tier),
    })
  }

  return outcomes
}

function getOrderedPlayerRecords(
  playerName: string,
  orderedGames: ProcessedGame[],
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  const records = gameRecords[playerName] ?? {}

  return orderedGames
    .map((game) => records[game.gameId])
    .filter((record): record is PlayerGameRecord => Boolean(record))
}

function getOverallMMR(commanders: CommanderProfile[]) {
  if (commanders.length === 0) return 0

  const totalPlays = commanders.reduce((sum, commander) => sum + commander.plays, 0)
  if (totalPlays <= 0) {
    return round2(commanders.reduce((sum, commander) => sum + commander.currentMMR, 0) / commanders.length)
  }

  return round2(
    commanders.reduce((sum, commander) => sum + (commander.currentMMR * commander.plays), 0) / totalPlays,
  )
}

function pickRecommendedCommander(
  player: {
    overallMMR: number
    commanders: CommanderProfile[]
  },
  averageMMR: number,
) {
  const targetMMR = getTargetMMR(player, averageMMR)

  return [...player.commanders]
    .sort((a, b) => {
      const distanceDiff = Math.abs(a.currentMMR - targetMMR) - Math.abs(b.currentMMR - targetMMR)
      if (distanceDiff !== 0) return distanceDiff
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      if (b.plays !== a.plays) return b.plays - a.plays
      return a.commander.localeCompare(b.commander)
    })[0]
}

function getTargetMMR(
  player: {
    overallMMR: number
    commanders: CommanderProfile[]
  },
  averageMMR: number,
) {
  return clamp(
    averageMMR - ((player.overallMMR - averageMMR) * FAIRNESS_PULL),
    Math.min(...player.commanders.map((commander) => commander.currentMMR)),
    Math.max(...player.commanders.map((commander) => commander.currentMMR)),
  )
}

function getSpread(values: number[]) {
  if (values.length === 0) return 0
  const min = Math.min(...values)
  const max = Math.max(...values)
  return max - min
}

function describeAdjustment(
  playerMMR: number,
  averageMMR: number,
  selectedCommander: CommanderProfile,
  recommendedCommander: CommanderProfile,
) {
  if (selectedCommander.commander === recommendedCommander.commander) {
    if (playerMMR > averageMMR + 25) {
      return `${selectedCommander.commander} trims this player's pod entry closer to the table MMR average without forcing a deep comfort cut.`
    }

    if (playerMMR < averageMMR - 25) {
      return `${selectedCommander.commander} gives this player one of their stronger MMR lanes so they do not enter the pod far below the average.`
    }

    return `${selectedCommander.commander} lands close to the pod's center line, which keeps the table tight on current commander MMR.`
  }

  return `${selectedCommander.commander} is a manual override. The placement preview below shows how that exact commander would gain or lose MMR in this pod.`
}

function tierLabel(tier: CommanderMMRTier) {
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}
