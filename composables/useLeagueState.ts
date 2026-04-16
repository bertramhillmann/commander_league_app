import {
  computeGamePoints,
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MIN,
  PERF_MULT_MAX,
} from '~/utils/placements'
import { applyModifiers, type ModifierResult } from '~/utils/modifiers'
import { calculateXPGained, xpToLevel } from '~/utils/commanderExperience'
import { getTier, blendScore, type Tier } from '~/utils/tiers'
import { ACHIEVEMENTS, type EarnedAchievement } from '~/utils/achievements'
import { getMissedGameLoosterPoints } from '~/utils/loosterPoints'
import { formatPlayerName } from '~/utils/playerNames'
import { getArchEnemySummary } from '~/utils/archEnemy'
import { getFeaturedPlayerName } from '~/utils/featuredPlayer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedGamePlayer {
  name: string
  commander: string
  placement: number
  points: number
  lPoints: number
  eliminations: number | null
  commanderCasts: number | null
}

export interface ProcessedGame {
  gameId: string
  date: string | Date
  week: number
  players: ProcessedGamePlayer[]
}

export interface PlayerGameRecord {
  gameId: string
  playerName: string
  commander: string
  placement: number
  basePoints: number
  lPoints: number
  modifiers: ModifierResult[]
  finalPoints: number
  ratingBefore: number
  ratingAfter: number
  rankBefore: number
  rankAfter: number
  commanderXpBefore: number
  commanderXpAfter: number
  commanderLevelBefore: number
  commanderLevelAfter: number
  playerCount: number
  /** Achievements earned in this specific game */
  achievements: EarnedAchievement[]
}

export interface PlayerState {
  name: string
  totalPoints: number
  totalLPoints: number
  totalBasePoints: number
  baseWins: number
  gamesPlayed: number
  wins: number
  commanderXP: Record<string, number>
  commanderTiers: Record<string, Tier>
  earnedAchievements: EarnedAchievement[]
  achievementPoints: number
}

export interface CommanderState {
  name: string
  totalPoints: number
  totalBasePoints: number
  totalLPoints: number
  gamesPlayed: number
  wins: number
  uniquePlayers: string[]
}

export interface LeagueStanding {
  name: string
  totalScore: number
  rank: number
  totalPoints: number
  achievementPoints: number
  xpPoints: number
  perfMult: number
  gamesPlayed: number
  baseWins: number
  avgPerGame: number
  totalLPoints: number
}

export interface LeagueSnapshotEntry {
  rank: number
  totalScore: number
}

export interface LeagueStandingMetrics {
  totalScore: number
  totalPoints: number
  achievementPoints: number
  xpPoints: number
  perfMult: number
  gamesPlayed: number
  baseWins: number
  avgPerGame: number
  totalLPoints: number
}

export interface PlayerCommanderMetrics {
  plays: number
  first: number
  second: number
  last: number
  winRate: number
  avgBasePoints: number
  avgPlacement: number
  bestGame: number
  totalBasePoints: number
  totalFinalPoints: number
  totalLPoints: number
  totalLosses: number
  achievementPoints: number
  xpPoints: number
}

export interface PlayerCommanderPerformanceEdgeMetrics {
  withGames: number
  withoutGames: number
  withAvg: number
  withoutAvg: number
  rawEdge: number
  weightedEdge: number
  confidence: number
  pickRate: number
  importanceScore: number
  hasLowCommanderSample: boolean
  hasLowPoolSample: boolean
  isReliable: boolean
}

function createEmptyPlayerState(name: string): PlayerState {
  return {
    name,
    totalPoints: 0,
    totalLPoints: 0,
    totalBasePoints: 0,
    baseWins: 0,
    gamesPlayed: 0,
    wins: 0,
    commanderXP: {},
    commanderTiers: {},
    earnedAchievements: [],
    achievementPoints: 0,
  }
}

export function compareGameIdsAscending(a: string, b: string) {
  const aNum = extractGameIdNumber(a)
  const bNum = extractGameIdNumber(b)
  if (aNum !== bNum) return aNum - bNum
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function compareGamesChronological(
  a: Pick<ProcessedGame, 'date' | 'gameId'>,
  b: Pick<ProcessedGame, 'date' | 'gameId'>,
) {
  const dateDiff = gameDayValue(a.date) - gameDayValue(b.date)
  if (dateDiff !== 0) return dateDiff
  return compareGameIdsAscending(a.gameId, b.gameId)
}

export function compareGamesForDisplay(
  a: Pick<ProcessedGame, 'date' | 'gameId'>,
  b: Pick<ProcessedGame, 'date' | 'gameId'>,
) {
  const dateDiff = gameDayValue(b.date) - gameDayValue(a.date)
  if (dateDiff !== 0) return dateDiff
  return compareGameIdsAscending(b.gameId, a.gameId)
}

export function getXpPoints(player: PlayerState) {
  return Object.values(player.commanderXP).reduce((sum, xp) => sum + xpToLevel(xp), 0)
}

export function getLeagueAveragePerGame(playerMap: Record<string, PlayerState>) {
  const allPlayers = Object.values(playerMap)
  const totalGames = allPlayers.reduce((sum, player) => sum + player.gamesPlayed, 0)
  const totalPoints = allPlayers.reduce((sum, player) => sum + player.totalPoints, 0)
  return totalGames > 0 ? totalPoints / totalGames : 1
}

export function getLeagueStandingMetrics(
  player: PlayerState,
  playerMap: Record<string, PlayerState>,
): LeagueStandingMetrics {
  const xpPoints = getXpPoints(player)
  const avgPerGame = player.gamesPlayed > 0 ? round3(player.totalPoints / player.gamesPlayed) : 0
  const leagueAvgPerGame = getLeagueAveragePerGame(playerMap)
  const winRateFraction = player.gamesPlayed > 0
    ? player.baseWins / player.gamesPlayed
    : EXPECTED_WIN_RATE
  const avgFraction = leagueAvgPerGame > 0 ? avgPerGame / leagueAvgPerGame : 1
  const winRateTerm = round3(PERF_WIN_RATE_WEIGHT * (winRateFraction / EXPECTED_WIN_RATE))
  const avgTerm = round3(PERF_AVG_WEIGHT * avgFraction)
  const perfMultRaw = round3(PERF_BASE_WEIGHT + winRateTerm + avgTerm)
  const perfMult = player.gamesPlayed > 0
    ? Math.min(PERF_MULT_MAX, Math.max(PERF_MULT_MIN, perfMultRaw))
    : 1
  const baseScore = player.totalPoints + player.achievementPoints + xpPoints
  const totalScore = round3(baseScore * perfMult)

  return {
    totalScore,
    totalPoints: player.totalPoints,
    achievementPoints: player.achievementPoints,
    xpPoints,
    perfMult: round3(perfMult),
    gamesPlayed: player.gamesPlayed,
    baseWins: player.baseWins,
    avgPerGame,
    totalLPoints: player.totalLPoints,
  }
}

export function getPlayerCommanderRecords(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
) {
  return Object.values(gameRecords[playerName] ?? {}).filter((record) => record.commander === commanderName)
}

export function getPlayerCommanderAchievementPoints(
  player: PlayerState | null | undefined,
  records: PlayerGameRecord[],
  commanderName: string,
) {
  const gameScopedPoints = records.reduce((sum, record) => sum + record.achievements.reduce((achievementSum, achievement) => {
    const achievementDef = ACHIEVEMENTS[achievement.id]
    if (!achievementDef || achievementDef.scope !== 'commander') return achievementSum
    if (achievement.commander !== commanderName) return achievementSum
    return achievementSum + achievementDef.points
  }, 0), 0)

  const postScopedPoints = (player?.earnedAchievements ?? [])
    .filter((achievement) => {
      const achievementDef = ACHIEVEMENTS[achievement.id]
      return achievement.gameId === 'post'
        && achievement.commander === commanderName
        && achievementDef?.scope === 'commander'
    })
    .reduce((sum, achievement) => sum + (ACHIEVEMENTS[achievement.id]?.points ?? 0), 0)

  return round3(gameScopedPoints + postScopedPoints)
}

export function getPlayerCommanderMetrics(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
  players: Record<string, PlayerState>,
): PlayerCommanderMetrics | null {
  const records = getPlayerCommanderRecords(playerName, commanderName, gameRecords)
  if (records.length === 0) return null

  const plays = records.length
  const first = records.filter((record) => record.placement === 1).length
  const second = records.filter((record) => record.placement === 2).length
  const last = records.filter((record) => record.placement === record.playerCount).length
  const totalBasePoints = round3(records.reduce((sum, record) => sum + record.basePoints, 0))
  const totalFinalPoints = round3(records.reduce((sum, record) => sum + record.finalPoints, 0))
  const totalLPoints = round3(records.reduce((sum, record) => sum + record.lPoints, 0))
  const totalLosses = records.filter((record) => record.basePoints === 0).length
  const avgBasePoints = plays > 0 ? round3(totalBasePoints / plays) : 0
  const avgPlacement = plays > 0
    ? Math.round((records.reduce((sum, record) => sum + record.placement, 0) / plays) * 100) / 100
    : 0
  const bestGame = Math.max(...records.map((record) => record.basePoints), 0)
  const winRate = plays > 0 ? Math.round((first / plays) * 100) : 0
  const player = players[playerName]
  const achievementPoints = getPlayerCommanderAchievementPoints(player, records, commanderName)
  const xpPoints = xpToLevel(player?.commanderXP?.[commanderName] ?? 0)

  return {
    plays,
    first,
    second,
    last,
    winRate,
    avgBasePoints,
    avgPlacement,
    bestGame,
    totalBasePoints,
    totalFinalPoints,
    totalLPoints,
    totalLosses,
    achievementPoints,
    xpPoints,
  }
}

/**
 * Converts a placement into a normalized score so 3-, 4-, and 5-player games
 * can be compared on the same 0..1 scale.
 */
/**
 * Converts a finishing placement into a normalized 0..1 score so games with
 * different player counts can be compared on the same scale.
 */
function getNormalizedPlacementScore(placement: number, playerCount: number) {
  if (playerCount <= 1) return 0
  return (playerCount - placement) / (playerCount - 1)
}

/**
 * Computes the average normalized placement score for a set of records.
 */
function getAverageNormalizedPlacement(records: PlayerGameRecord[]) {
  if (records.length === 0) return 0

  const total = records.reduce(
    (sum, record) => sum + getNormalizedPlacementScore(record.placement, record.playerCount),
    0,
  )

  return total / records.length
}

/**
 * Shrinks a sample toward neutral as long as the sample is still small.
 */
function getSampleConfidence(sampleSize: number, k = 8) {
  if (sampleSize <= 0) return 0
  return sampleSize / (sampleSize + k)
}

/**
 * Combines weighted edge and pick rate into a simple importance score.
 */
function getCommanderImportanceScore(weightedEdge: number, pickRate: number) {
  return weightedEdge * (0.5 + 0.5 * pickRate)
}

/**
 * Rounds commander edge metrics only at the public return boundary.
 */
function roundCommanderEdgeMetrics(metrics: {
  withGames: number
  withoutGames: number
  withAvg: number
  withoutAvg: number
  rawEdge: number
  weightedEdge: number
  confidence: number
  pickRate: number
  importanceScore: number
  hasLowCommanderSample: boolean
  hasLowPoolSample: boolean
  isReliable: boolean
}): PlayerCommanderPerformanceEdgeMetrics {
  return {
    withGames: metrics.withGames,
    withoutGames: metrics.withoutGames,
    withAvg: round3(metrics.withAvg),
    withoutAvg: round3(metrics.withoutAvg),
    rawEdge: round3(metrics.rawEdge),
    weightedEdge: round3(metrics.weightedEdge),
    confidence: round3(metrics.confidence),
    pickRate: round3(metrics.pickRate),
    importanceScore: round3(metrics.importanceScore),
    hasLowCommanderSample: metrics.hasLowCommanderSample,
    hasLowPoolSample: metrics.hasLowPoolSample,
    isReliable: metrics.isReliable,
  }
}

/**
 * Calculates a player's commander edge versus the rest of their commander
 * pool using normalized placement and two-sided confidence shrinkage.
 */
export function getPlayerCommanderPerformanceEdgeMetrics(
  playerName: string,
  commanderName: string,
  gameRecords: Record<string, Record<string, PlayerGameRecord>>,
): PlayerCommanderPerformanceEdgeMetrics | null {
  const allRecords = Object.values(gameRecords[playerName] ?? {})
  if (allRecords.length === 0) return null

  const withRecords = allRecords.filter((record) => record.commander === commanderName)
  const withoutRecords = allRecords.filter((record) => record.commander !== commanderName)
  if (withRecords.length === 0) return null

  const withGames = withRecords.length
  const withoutGames = withoutRecords.length
  const totalGames = allRecords.length
  const withAvg = getAverageNormalizedPlacement(withRecords)
  const withoutAvg = getAverageNormalizedPlacement(withoutRecords)
  const rawEdge = withAvg - withoutAvg
  const commanderConfidence = getSampleConfidence(withGames)
  const poolConfidence = getSampleConfidence(withoutGames)
  const confidence = Math.sqrt(commanderConfidence * poolConfidence)
  const weightedEdge = rawEdge * confidence
  const pickRate = totalGames > 0 ? withGames / totalGames : 0
  const importanceScore = getCommanderImportanceScore(weightedEdge, pickRate)
  const hasLowCommanderSample = withGames < 5
  const hasLowPoolSample = withoutGames < 5
  const isReliable = !hasLowPoolSample

  return roundCommanderEdgeMetrics({
    withGames,
    withoutGames,
    withAvg,
    withoutAvg,
    rawEdge,
    weightedEdge,
    confidence,
    pickRate,
    importanceScore,
    hasLowCommanderSample,
    hasLowPoolSample,
    isReliable,
  })
}

// ─── Shared state ─────────────────────────────────────────────────────────────

const useGamesState = () => useState<ProcessedGame[]>('league:games', () => [])
const usePlayersState = () => useState<Record<string, PlayerState>>('league:players', () => ({}))
const useCommandersState = () => useState<Record<string, CommanderState>>('league:commanders', () => ({}))
const useGameRecordsState = () =>
  useState<Record<string, Record<string, PlayerGameRecord>>>('league:gameRecords', () => ({}))
const useLeagueSnapshotsState = () =>
  useState<Record<string, Record<string, LeagueSnapshotEntry>>>('league:leagueSnapshots', () => ({}))
const useLoadedState = () => useState<boolean>('league:loaded', () => false)

// ─── Composable ───────────────────────────────────────────────────────────────

export function useLeagueState() {
  const games = useGamesState()
  const players = usePlayersState()
  const commanders = useCommandersState()
  const gameRecords = useGameRecordsState()
  const leagueSnapshots = useLeagueSnapshotsState()
  const loaded = useLoadedState()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function init(force = false) {
    if (loaded.value && !force) return

    loading.value = true
    error.value = null

    try {
      const [raw, roster] = await Promise.all([
        $fetch<any[]>('/api/games'),
        $fetch<string[]>('/api/players'),
      ])

      const canonicalPlayerNames = new Map<string, string>()
      for (const playerName of roster) {
        canonicalPlayerNames.set(playerName.trim().toLowerCase(), formatPlayerName(playerName.trim()))
      }

      const normalizePlayerName = (name: string) => {
        const trimmed = name.trim()
        const key = trimmed.toLowerCase()
        const canonical = canonicalPlayerNames.get(key)
        if (canonical) return canonical
        const fallbackName = formatPlayerName(trimmed)
        canonicalPlayerNames.set(key, fallbackName)
        return fallbackName
      }

      const normalizedRaw = raw.map((game) => ({
        ...game,
        players: (game.players ?? []).map((player: any) => ({
          ...player,
          name: normalizePlayerName(player.name),
        })),
      }))

      const sorted = [...normalizedRaw].sort(compareGamesChronological)

      const processedGames: ProcessedGame[] = []
      const playerMap: Record<string, PlayerState> = {}
      const commanderMap: Record<string, CommanderState> = {}
      const recordsMap: Record<string, Record<string, PlayerGameRecord>> = {}
      const snapshotMap: Record<string, Record<string, LeagueSnapshotEntry>> = {}
      const allPlayerNames = new Set<string>(roster.map((n) => formatPlayerName(n.trim())))

      for (const game of sorted) {
        for (const player of game.players ?? []) allPlayerNames.add(player.name)
      }

      for (const playerName of allPlayerNames) {
        playerMap[playerName] = createEmptyPlayerState(playerName)
      }

      // ── Achievement tracking state ──────────────────────────────────────────

      // One-time player achievements already earned: playerName -> Set<achievementId>
      const playerOneTime: Record<string, Set<string>> = {}
      // One-time commander achievements: `playerName:commander:achievementId` -> true
      const cmdOneTime = new Set<string>()
      // Per-player per-week data
      interface WeekData {
        games: number
        commanders: Set<string>
        wins: number
        weeklyWinDone: boolean
        beatLeaderDone: boolean
        varietyDone: boolean
        grinderDone: boolean
      }
      const playerWeeks: Record<string, Record<string, WeekData>> = {}
      // Repeatable achievements already earned by this player in a given week
      const playerWeeklyRepeatables: Record<string, Record<string, Set<string>>> = {}
      // Absolute week (year*53+isoWeek) of each player's last game
      const playerLastAbsWeek: Record<string, number> = {}

      // Global game index (increments once per game, not per player)
      let globalGameIdx = 0
      // Per-player: global game index of their last played game (for returning_wanderer)
      const playerLastGlobalGameIdx: Record<string, number> = {}
      // Per-player: their own sequential game count (for old_memory)
      const playerOwnGameIdx: Record<string, number> = {}
      // Per-player per-commander: player's own game index of last appearance (for old_memory)
      const playerCommanderLastOwnIdx: Record<string, Record<string, number>> = {}
      // Per-player: { commander, count } of consecutive games with same commander (hyper_fixation)
      const playerConsecutiveCmd: Record<string, { commander: string; count: number }> = {}
      // Per-player: consecutive non-win count (losing_streak)
      const playerNonWinStreak: Record<string, number> = {}
      // Per-player: { commander, count } of consecutive wins with same commander (win_streak)
      const playerWinStreakData: Record<string, { commander: string; count: number }> = {}
      // Per-player per-commander: consecutive last-place finishes (cold_trail)
      const playerCommanderLastPlaceStreak: Record<string, Record<string, number>> = {}
      // Per-player per-commander: track 5 misses after a win without reaching top 2 (wither)
      const playerCommanderWitherData: Record<string, Record<string, { failures: number; active: boolean }>> = {}

      // ── Game loop ───────────────────────────────────────────────────────────

      for (const game of sorted) {
        const playerCount = game.players.length
        const gameDate = new Date(game.date)
        const gameWeek = isoWeek(gameDate)
        const gameAbsWeek = absWeek(gameDate)
        const weekKey = `${gameDate.getUTCFullYear()}_${gameWeek}`

        // Current leader before this game (highest totalPoints so far)
        const leaderEntry = Object.values(playerMap).reduce<PlayerState | null>(
          (best, p) => (!best || p.totalPoints > best.totalPoints ? p : best),
          null,
        )
        const leaderName = leaderEntry?.name ?? ''
        const featuredPlayerName = getFeaturedPlayerName(
          recordsMap,
          new Map(processedGames.map((processedGame, index) => [processedGame.gameId, index])),
        )

        // Snapshot ratings before this game
        const ratingsBefore: Record<string, number> = {}
        for (const p of game.players) {
          ratingsBefore[p.name] = playerMap[p.name]?.totalPoints ?? 0
        }

        const computed = computeGamePoints(game.players) as ProcessedGamePlayer[]

        // All other players finished 2nd (killing the table check)
        const allOthers2nd = computed.every((p) => p.placement === 1 || p.placement === 2)

        // Snapshot league ranks before this game using the shared dashboard metric.
        const rankBeforeList = buildLeagueStandings(playerMap)
        const rankBeforeMap: Record<string, number> = {}
        const scoreBeforeMap: Record<string, number> = {}
        for (const p of game.players) {
          const entry = rankBeforeList.find((pl) => pl.name === p.name)
          rankBeforeMap[p.name] = entry?.rank ?? (rankBeforeList.length + 1)
          scoreBeforeMap[p.name] = entry?.totalScore ?? 0
        }

        for (const p of computed) {
          const isWinner = p.placement === 1

          const commanderXpBefore = playerMap[p.name]?.commanderXP?.[p.commander] ?? 0
          const commanderXpGained = calculateXPGained(playerCount, isWinner)
          const commanderLevelBefore = xpToLevel(commanderXpBefore)
          const commanderLevelAfter = xpToLevel(commanderXpBefore + commanderXpGained)

          const modifiers = applyModifiers({
            playerName: p.name,
            basePoints: p.points,
            ratingsBefore,
            commanderXpBefore,
            commanderXpGained,
          })

          const modifierSum = modifiers.reduce((s, m) => s + (m.informational ? 0 : m.value), 0)
          const finalPoints = round3(p.points + modifierSum)

          if (!playerMap[p.name]) playerMap[p.name] = createEmptyPlayerState(p.name)

          if (!commanderMap[p.commander]) {
            commanderMap[p.commander] = {
              name: p.commander,
              totalPoints: 0,
              totalBasePoints: 0,
              totalLPoints: 0,
              gamesPlayed: 0,
              wins: 0,
              uniquePlayers: [],
            }
          }

          if (!recordsMap[p.name]) recordsMap[p.name] = {}
          recordsMap[p.name][game.gameId] = {
            gameId: game.gameId,
            playerName: p.name,
            commander: p.commander,
            placement: p.placement,
            basePoints: p.points,
            lPoints: p.lPoints,
            modifiers,
            finalPoints,
            ratingBefore: scoreBeforeMap[p.name] ?? 0,
            ratingAfter: 0,
            rankBefore: rankBeforeMap[p.name] ?? 0,
            rankAfter: 0,
            commanderXpBefore,
            commanderXpAfter: commanderXpBefore + commanderXpGained,
            commanderLevelBefore,
            commanderLevelAfter,
            playerCount,
            achievements: [],
          }

          // ── Achievement checks ────────────────────────────────────────────

          if (!playerOneTime[p.name])   playerOneTime[p.name] = new Set()
          if (!playerWeeks[p.name])     playerWeeks[p.name] = {}
          if (!playerWeeklyRepeatables[p.name]) playerWeeklyRepeatables[p.name] = {}
          if (!playerOwnGameIdx[p.name])  playerOwnGameIdx[p.name] = 0
          if (!playerCommanderLastOwnIdx[p.name]) playerCommanderLastOwnIdx[p.name] = {}
          if (!playerCommanderLastPlaceStreak[p.name]) playerCommanderLastPlaceStreak[p.name] = {}
          if (!playerCommanderWitherData[p.name]) playerCommanderWitherData[p.name] = {}
          if (!playerWeeklyRepeatables[p.name][weekKey]) {
            playerWeeklyRepeatables[p.name][weekKey] = new Set()
          }
          if (!playerWeeks[p.name][weekKey]) {
            playerWeeks[p.name][weekKey] = {
              games: 0,
              commanders: new Set(),
              wins: 0,
              weeklyWinDone: false,
              beatLeaderDone: false,
              varietyDone: false,
              grinderDone: false,
            }
          }

          const wd = playerWeeks[p.name][weekKey]
          const weeklyRepeatables = playerWeeklyRepeatables[p.name][weekKey]
          const gameAchievements: EarnedAchievement[] = []
          const isLastPlace = p.placement === playerCount
          const lastPlaceStreak = playerCommanderLastPlaceStreak[p.name][p.commander] ?? 0
          const witherData = playerCommanderWitherData[p.name][p.commander] ?? { failures: 0, active: false }

          const earn = (id: string, commander?: string) => {
            const def = ACHIEVEMENTS[id]
            if (def.repeatable && weeklyRepeatables.has(id)) return

            const entry: EarnedAchievement = { id, gameId: game.gameId, commander }
            gameAchievements.push(entry)
            playerMap[p.name].earnedAchievements.push(entry)
            playerMap[p.name].achievementPoints = round3(
              playerMap[p.name].achievementPoints + def.points,
            )

            if (def.repeatable) weeklyRepeatables.add(id)
          }

          // Cold Trail: 5 last-place finishes in a row with this commander
          if (isLastPlace) {
            const nextStreak = lastPlaceStreak + 1
            if (nextStreak >= 5) {
              earn('cold_trail', p.commander)
              playerCommanderLastPlaceStreak[p.name][p.commander] = 0
            } else {
              playerCommanderLastPlaceStreak[p.name][p.commander] = nextStreak
            }
          } else {
            playerCommanderLastPlaceStreak[p.name][p.commander] = 0
          }

          // Wither: after a win, miss top 2 for the next 5 games with this commander
          if (isWinner) {
            playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: true }
          } else if (witherData.active) {
            if (p.placement <= 2) {
              playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: false }
            } else {
              const failures = witherData.failures + 1
              if (failures >= 5) {
                earn('wither', p.commander)
                playerCommanderWitherData[p.name][p.commander] = { failures: 0, active: false }
              } else {
                playerCommanderWitherData[p.name][p.commander] = { failures, active: true }
              }
            }
          } else {
            playerCommanderWitherData[p.name][p.commander] = witherData
          }

          // Sleeper: 2+ week gap since last game
          const lastAbsWeek = playerLastAbsWeek[p.name]
          if (lastAbsWeek !== undefined && gameAbsWeek - lastAbsWeek >= 2) {
            earn('sleeper')
          }

          // Returning wanderer: 10+ global games played since this player last played
          const lastGlobal = playerLastGlobalGameIdx[p.name]
          if (lastGlobal !== undefined && globalGameIdx - lastGlobal >= 10) {
            earn('returning_wanderer')
          }

          // Old memory: played this commander 15+ of own games ago
          const ownIdx = playerOwnGameIdx[p.name]
          const cmdLastOwn = playerCommanderLastOwnIdx[p.name][p.commander]
          if (cmdLastOwn !== undefined && ownIdx - cmdLastOwn >= 10) {
            earn('forgotten_friend', p.commander)
          }
          if (cmdLastOwn !== undefined && ownIdx - cmdLastOwn >= 15) {
            earn('old_memory')
          }

          // Diversify: playing 5th unique commander (commander not yet in XP map = new)
          const isNewCommander = !(p.commander in (playerMap[p.name]?.commanderXP ?? {}))
          const uniqueCmdCount = Object.keys(playerMap[p.name]?.commanderXP ?? {}).length
          if (isNewCommander && uniqueCmdCount === 4 && !playerOneTime[p.name].has('diversify')) {
            playerOneTime[p.name].add('diversify')
            earn('diversify')
          }

          // Hyper fixation: 15 consecutive games with same commander
          if (!playerConsecutiveCmd[p.name]) playerConsecutiveCmd[p.name] = { commander: p.commander, count: 0 }
          const cc = playerConsecutiveCmd[p.name]
          if (cc.commander === p.commander) {
            cc.count++
            if (cc.count === 15 && !playerOneTime[p.name].has('hyper_fixation')) {
              playerOneTime[p.name].add('hyper_fixation')
              earn('hyper_fixation')
            }
          } else {
            cc.commander = p.commander
            cc.count = 1
          }

          // Losing streak: 15 games without first place
          if (!playerNonWinStreak[p.name]) playerNonWinStreak[p.name] = 0
          if (!isWinner) {
            playerNonWinStreak[p.name]++
            if (playerNonWinStreak[p.name] === 15 && !playerOneTime[p.name].has('losing_streak')) {
              playerOneTime[p.name].add('losing_streak')
              earn('losing_streak')
            }
          } else {
            playerNonWinStreak[p.name] = 0
          }

          // Update week stats
          wd.games++
          wd.commanders.add(p.commander)

          // Grinder: 10th game in a week
          if (wd.games === 10 && !wd.grinderDone) {
            wd.grinderDone = true
            earn('grinder')
          }

          // Variety: 3rd different commander this week
          if (wd.commanders.size === 3 && !wd.varietyDone) {
            wd.varietyDone = true
            earn('weekly_variety')
          }

          if (isWinner) {
            wd.wins++

            // Weekly win (once per week)
            if (!wd.weeklyWinDone) {
              wd.weeklyWinDone = true
              earn('weekly_win')
            }

            // First blood: first ever win with this commander
            const fbKey = `${p.name}:${p.commander}:first_blood`
            if (!cmdOneTime.has(fbKey)) {
              cmdOneTime.add(fbKey)
              earn('first_blood', p.commander)
            }

            // Killing the table: winner + all others are placement 2
            if (allOthers2nd && !playerOneTime[p.name].has('killing_the_table')) {
              playerOneTime[p.name].add('killing_the_table')
              earn('killing_the_table')
            }

            // Born a star: first win in a 5-player game
            if (playerCount === 5 && !playerOneTime[p.name].has('born_a_star')) {
              playerOneTime[p.name].add('born_a_star')
              earn('born_a_star')
            }

            // Beat leader: win against league leader (once per week)
            const leaderInGame = game.players.some((gp: any) => gp.name === leaderName)
            if (leaderInGame && leaderName !== p.name && !wd.beatLeaderDone) {
              wd.beatLeaderDone = true
              earn('beat_leader')
            }

            const archEnemy = getArchEnemySummary(p.name, processedGames, recordsMap)
            const archEnemyPlayer = archEnemy.enemyName
              ? computed.find((participant) => participant.name === archEnemy.enemyName)
              : null
            const beatCurrentArchEnemy = Boolean(archEnemyPlayer && archEnemyPlayer.placement > 1)
            if (beatCurrentArchEnemy) {
              earn('beat_arch_enemy')
            }

            const featuredPlayer = featuredPlayerName
              ? computed.find((participant) => participant.name === featuredPlayerName)
              : null
            const beatCurrentFeaturedPlayer = Boolean(
              featuredPlayer && featuredPlayer.name !== p.name && featuredPlayer.placement > 1,
            )
            if (beatCurrentFeaturedPlayer) {
              earn('beat_featured_player')
            }

            // Straggler / Hyper Straggler: win against player with many more games
            const maxOpponentGames = game.players
              .filter((gp: any) => gp.name !== p.name)
              .reduce((max: number, gp: any) => Math.max(max, playerMap[gp.name]?.gamesPlayed ?? 0), 0)
            const myGames = playerMap[p.name]?.gamesPlayed ?? 0
            const diff = maxOpponentGames - myGames
            if (diff >= 20) earn('hyper_straggler')
            else if (diff >= 10) earn('straggler')

            // Win streak: 3 consecutive wins with same commander
            if (!playerWinStreakData[p.name]) playerWinStreakData[p.name] = { commander: p.commander, count: 0 }
            const ws = playerWinStreakData[p.name]
            if (ws.commander === p.commander) {
              ws.count++
              if (ws.count >= 3) {
                earn('win_streak')
                ws.count = 0 // reset after awarding
              }
            } else {
              ws.commander = p.commander
              ws.count = 1
            }
          } else {
            // Reset win streak on non-win
            if (playerWinStreakData[p.name]) {
              playerWinStreakData[p.name].count = 0
            }
          }

          recordsMap[p.name][game.gameId].achievements = gameAchievements

          // Update player totals
          const ps = playerMap[p.name]
          ps.totalPoints = round3(ps.totalPoints + finalPoints)
          ps.totalLPoints = round3(ps.totalLPoints + p.lPoints)
          ps.totalBasePoints = round3(ps.totalBasePoints + p.points)
          if (p.placement === 1) ps.baseWins++
          ps.gamesPlayed++
          if (isWinner) ps.wins++
          ps.commanderXP[p.commander] = commanderXpBefore + commanderXpGained

          const cs = commanderMap[p.commander]
          cs.totalPoints = round3(cs.totalPoints + finalPoints)
          cs.totalBasePoints = round3(cs.totalBasePoints + p.points)
          cs.totalLPoints = round3(cs.totalLPoints + p.lPoints)
          cs.gamesPlayed++
          if (isWinner) cs.wins++
          if (!cs.uniquePlayers.includes(p.name)) cs.uniquePlayers.push(p.name)

          // Update own game index and commander last-seen index
          playerCommanderLastOwnIdx[p.name][p.commander] = ownIdx
          playerOwnGameIdx[p.name] = ownIdx + 1
          playerLastGlobalGameIdx[p.name] = globalGameIdx
          playerLastAbsWeek[p.name] = gameAbsWeek

          // Level achievements (commander-scoped, once per commander per player)
          const levelMilestones: [number, string][] = [[7, 'reach_level_7'], [10, 'reach_level_10'], [20, 'reach_level_20']]
          for (const [lvl, achId] of levelMilestones) {
            if (commanderLevelAfter >= lvl && commanderLevelBefore < lvl) {
              const key = `${p.name}:${p.commander}:${achId}`
              if (!cmdOneTime.has(key)) {
                cmdOneTime.add(key)
                earn(achId, p.commander)
              }
            }
          }
        }

        const missedGameLPoints = getMissedGameLoosterPoints(playerCount)
        if (missedGameLPoints > 0) {
          const participants = new Set(computed.map((player) => player.name))
          for (const playerName of allPlayerNames) {
            if (participants.has(playerName)) continue
            if (!playerMap[playerName]) playerMap[playerName] = createEmptyPlayerState(playerName)
            playerMap[playerName].totalLPoints = round3(playerMap[playerName].totalLPoints + missedGameLPoints)
          }
        }

        // King maker: a player who lost causes someone else to reach league #1
        // Check: for each non-winner, did their loss allow a winner's new total to surpass the pre-game leader?
        const newLeaderEntry = Object.values(playerMap).reduce<PlayerState | null>(
          (best, pl) => (!best || pl.totalPoints > best.totalPoints ? pl : best),
          null,
        )
        if (newLeaderEntry && newLeaderEntry.name !== leaderName) {
          // Someone new is now leading — credit all losers in this game
          for (const p of computed) {
            if (p.placement !== 1) {
              const achEntry: EarnedAchievement = { id: 'king_maker', gameId: game.gameId }
              recordsMap[p.name][game.gameId].achievements.push(achEntry)
              playerMap[p.name].earnedAchievements.push(achEntry)
              playerMap[p.name].achievementPoints = round3(
                playerMap[p.name].achievementPoints + ACHIEVEMENTS.king_maker.points,
              )
            }
          }
        }

        // Compute league ranks after this game with the centralized dashboard metric.
        const rankAfterList = buildLeagueStandings(playerMap)
        snapshotMap[game.gameId] = Object.fromEntries(
          rankAfterList.map((entry) => [
            entry.name,
            { rank: entry.rank, totalScore: entry.totalScore },
          ]),
        )
        for (const p of computed) {
          recordsMap[p.name][game.gameId].ratingAfter =
            snapshotMap[game.gameId][p.name]?.totalScore ?? 0
          recordsMap[p.name][game.gameId].rankAfter =
            snapshotMap[game.gameId][p.name]?.rank ?? 0
        }

        globalGameIdx++

        processedGames.push({
          gameId: game.gameId,
          date: game.date,
          week: gameWeek,
          players: computed,
        })
      }

      // ── Post-processing: tiers + tier/rock-bottom achievements ─────────────

      // Global baseline: mean blended score across all commanders
      const globalScores = Object.values(commanderMap)
        .filter((cs) => cs.gamesPlayed > 0)
        .map((cs) => blendScore(cs.totalBasePoints / cs.gamesPlayed, cs.wins / cs.gamesPlayed))
      const globalAvgScore =
        globalScores.length > 0
          ? globalScores.reduce((s, r) => s + r, 0) / globalScores.length
          : 0

      const gameOrder = new Map(processedGames.map((game, index) => [game.gameId, index]))

      const tierAchievements: Partial<Record<Tier, string>> = {
        god: 'god_tier',
        legend: 'legend_tier',
        diamond: 'diamond_tier',
        platinum: 'platinum_tier',
        gold: 'gold_tier',
        bronze: 'bronze_tier',
        trash: 'trash_tier',
      }

      for (const [playerName, records] of Object.entries(recordsMap)) {
        const byCommander: Record<string, {
          totalPoints: number
          games: number
          wins: number
          lasts: number
          firstGameWon: boolean
          records: PlayerGameRecord[]
        }> = {}

        const orderedRecords = Object.values(records)
          .sort((a, b) => (gameOrder.get(a.gameId) ?? 0) - (gameOrder.get(b.gameId) ?? 0))

        for (const record of orderedRecords) {
          if (!byCommander[record.commander])
            byCommander[record.commander] = {
              totalPoints: 0,
              games: 0,
              wins: 0,
              lasts: 0,
              firstGameWon: record.placement === 1,
              records: [],
            }
          byCommander[record.commander].totalPoints += record.basePoints
          byCommander[record.commander].games++
          if (record.placement === 1) byCommander[record.commander].wins++
          if (record.placement === record.playerCount) byCommander[record.commander].lasts++
          byCommander[record.commander].records.push(record)
        }

        const ps = playerMap[playerName]

        for (const [cmdName, data] of Object.entries(byCommander)) {
          const rawScore = data.games > 0
            ? blendScore(data.totalPoints / data.games, data.wins / data.games)
            : 0
          const tier = getTier(rawScore, globalAvgScore, data.games)
          playerMap[playerName].commanderTiers[cmdName] = tier

          const cumulativeRecords: PlayerGameRecord[] = []
          for (const record of data.records) {
            cumulativeRecords.push(record)
            const cumulativeGames = cumulativeRecords.length
            const cumulativeBasePoints = cumulativeRecords.reduce((sum, entry) => sum + entry.basePoints, 0)
            const cumulativeWins = cumulativeRecords.filter((entry) => entry.placement === 1).length
            const cumulativeScore = blendScore(
              cumulativeBasePoints / cumulativeGames,
              cumulativeWins / cumulativeGames,
            )
            const currentTier = getTier(cumulativeScore, globalAvgScore, cumulativeGames)
            const achId = tierAchievements[currentTier]
            if (!achId) continue

            const key = `${playerName}:${cmdName}:${achId}`
            if (cmdOneTime.has(key)) continue

            cmdOneTime.add(key)
            const entry: EarnedAchievement = { id: achId, gameId: record.gameId, commander: cmdName }
            recordsMap[playerName][record.gameId].achievements.push(entry)
            ps.earnedAchievements.push(entry)
            ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS[achId].points)
          }

          // Hit rock bottom: 0% win rate after 5+ games
          if (data.games >= 5 && data.totalPoints === 0) {
            const key = `${playerName}:${cmdName}:hit_rock_bottom`
            if (!cmdOneTime.has(key)) {
              cmdOneTime.add(key)
              const entry: EarnedAchievement = { id: 'hit_rock_bottom', gameId: 'post', commander: cmdName }
              ps.earnedAchievements.push(entry)
              ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS.hit_rock_bottom.points)
            }
          }

          if (data.lasts >= 10) {
            const key = `${playerName}:${cmdName}:cursed_commander`
            if (!cmdOneTime.has(key)) {
              cmdOneTime.add(key)
              const entry: EarnedAchievement = { id: 'cursed_commander', gameId: 'post', commander: cmdName }
              ps.earnedAchievements.push(entry)
              ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS.cursed_commander.points)
            }
          }

          if (data.firstGameWon && data.games >= 5 && data.wins === 1) {
            const key = `${playerName}:${cmdName}:false_promise`
            if (!cmdOneTime.has(key)) {
              cmdOneTime.add(key)
              const entry: EarnedAchievement = { id: 'false_promise', gameId: 'post', commander: cmdName }
              ps.earnedAchievements.push(entry)
              ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS.false_promise.points)
            }
          }

          if (data.games >= 50) {
            const key = `${playerName}:${cmdName}:lapdog`
            if (!cmdOneTime.has(key)) {
              cmdOneTime.add(key)
              const entry: EarnedAchievement = { id: 'lapdog', gameId: 'post', commander: cmdName }
              ps.earnedAchievements.push(entry)
              ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS.lapdog.points)
            }
          }
        }
      }

      if (processedGames.length > 0) {
        const finalStandings = buildLeagueStandings(playerMap)
        const latestGameId = processedGames[processedGames.length - 1]?.gameId

        if (latestGameId) {
          snapshotMap[latestGameId] = Object.fromEntries(
            finalStandings.map((entry) => [
              entry.name,
              { rank: entry.rank, totalScore: entry.totalScore },
            ]),
          )

          for (const participant of processedGames[processedGames.length - 1]?.players ?? []) {
            const finalEntry = snapshotMap[latestGameId][participant.name]
            if (!finalEntry) continue

            if (recordsMap[participant.name]?.[latestGameId]) {
              recordsMap[participant.name][latestGameId].ratingAfter = finalEntry.totalScore
              recordsMap[participant.name][latestGameId].rankAfter = finalEntry.rank
            }
          }
        }
      }

      games.value = [...processedGames].sort(compareGamesForDisplay)
      players.value = playerMap
      commanders.value = commanderMap
      gameRecords.value = recordsMap
      leagueSnapshots.value = snapshotMap
      loaded.value = true
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load league data'
    } finally {
      loading.value = false
    }
  }

  const standings = computed(() => buildLeagueStandings(players.value))

  async function refresh() {
    await init(true)
  }

  return { games, players, commanders, gameRecords, leagueSnapshots, standings, loaded, loading, error, init, refresh }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function absWeek(date: Date): number {
  return date.getUTCFullYear() * 53 + isoWeek(date)
}

function buildLeagueStandings(playerMap: Record<string, PlayerState>): LeagueStanding[] {
  const allPlayers = Object.values(playerMap)

  return allPlayers
    .map((player) => {
      const metrics = getLeagueStandingMetrics(player, playerMap)

      return {
        name: player.name,
        totalScore: metrics.totalScore,
        rank: 0,
        totalPoints: metrics.totalPoints,
        achievementPoints: metrics.achievementPoints,
        xpPoints: metrics.xpPoints,
        perfMult: metrics.perfMult,
        gamesPlayed: metrics.gamesPlayed,
        baseWins: metrics.baseWins,
        avgPerGame: metrics.avgPerGame,
        totalLPoints: metrics.totalLPoints,
      }
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
      return a.name.localeCompare(b.name)
    })
    .map((player, index) => ({ ...player, rank: index + 1 }))
}

function extractGameIdNumber(gameId: string) {
  const match = gameId.match(/\d+/)
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY
}

function gameDayValue(date: string | Date) {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
