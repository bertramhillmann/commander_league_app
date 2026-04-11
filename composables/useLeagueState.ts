import { computeGamePoints } from '~/utils/placements'
import { applyModifiers, type ModifierResult } from '~/utils/modifiers'
import { calculateXPGained, xpToLevel } from '~/utils/commanderExperience'
import { getTier, smoothedTierScore, blendScore, type Tier } from '~/utils/tiers'
import { ACHIEVEMENTS, type EarnedAchievement } from '~/utils/achievements'

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

// ─── Shared state ─────────────────────────────────────────────────────────────

const useGamesState = () => useState<ProcessedGame[]>('league:games', () => [])
const usePlayersState = () => useState<Record<string, PlayerState>>('league:players', () => ({}))
const useCommandersState = () => useState<Record<string, CommanderState>>('league:commanders', () => ({}))
const useGameRecordsState = () =>
  useState<Record<string, Record<string, PlayerGameRecord>>>('league:gameRecords', () => ({}))
const useLoadedState = () => useState<boolean>('league:loaded', () => false)

// ─── Composable ───────────────────────────────────────────────────────────────

export function useLeagueState() {
  const games = useGamesState()
  const players = usePlayersState()
  const commanders = useCommandersState()
  const gameRecords = useGameRecordsState()
  const loaded = useLoadedState()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function init() {
    if (loaded.value) return

    loading.value = true
    error.value = null

    try {
      const raw = await $fetch<any[]>('/api/games')

      const sorted = [...raw].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )

      const processedGames: ProcessedGame[] = []
      const playerMap: Record<string, PlayerState> = {}
      const commanderMap: Record<string, CommanderState> = {}
      const recordsMap: Record<string, Record<string, PlayerGameRecord>> = {}

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

        // Snapshot ratings before this game
        const ratingsBefore: Record<string, number> = {}
        for (const p of game.players) {
          ratingsBefore[p.name] = playerMap[p.name]?.totalPoints ?? 0
        }

        const computed = computeGamePoints(game.players) as ProcessedGamePlayer[]

        // All other players finished 2nd (killing the table check)
        const allOthers2nd = computed.every((p) => p.placement === 1 || p.placement === 2)

        // Snapshot league ranks before this game
        // Sort matches dashboard: totalPoints + achievementPoints + Σ xpToLevel(commanderXP)
        const fullScore = (p: PlayerState) =>
          p.totalPoints + p.achievementPoints +
          Object.values(p.commanderXP).reduce((s, xp) => s + xpToLevel(xp), 0)
        const rankBeforeList = Object.values(playerMap).sort((a, b) => fullScore(b) - fullScore(a))
        const rankBeforeMap: Record<string, number> = {}
        for (const p of game.players) {
          const idx = rankBeforeList.findIndex((pl) => pl.name === p.name)
          rankBeforeMap[p.name] = idx === -1 ? rankBeforeList.length + 1 : idx + 1
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

          if (!playerMap[p.name]) {
            playerMap[p.name] = {
              name: p.name,
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
            ratingBefore: ratingsBefore[p.name],
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
          if (!playerOwnGameIdx[p.name])  playerOwnGameIdx[p.name] = 0
          if (!playerCommanderLastOwnIdx[p.name]) playerCommanderLastOwnIdx[p.name] = {}
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
          const gameAchievements: EarnedAchievement[] = []

          const earn = (id: string, commander?: string) => {
            const def = ACHIEVEMENTS[id]
            const entry: EarnedAchievement = { id, gameId: game.gameId, commander }
            gameAchievements.push(entry)
            playerMap[p.name].earnedAchievements.push(entry)
            playerMap[p.name].achievementPoints = round3(
              playerMap[p.name].achievementPoints + def.points,
            )
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

          recordsMap[p.name][game.gameId].ratingAfter = ps.totalPoints

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

        // Compute league ranks after this game (same scoring as dashboard)
        const rankAfterList = Object.values(playerMap).sort((a, b) => fullScore(b) - fullScore(a))
        for (const p of computed) {
          recordsMap[p.name][game.gameId].rankAfter =
            rankAfterList.findIndex((pl) => pl.name === p.name) + 1
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

      for (const [playerName, records] of Object.entries(recordsMap)) {
        const byCommander: Record<string, { totalPoints: number; games: number; wins: number }> = {}

        for (const record of Object.values(records)) {
          if (!byCommander[record.commander])
            byCommander[record.commander] = { totalPoints: 0, games: 0, wins: 0 }
          byCommander[record.commander].totalPoints += record.basePoints
          byCommander[record.commander].games++
          if (record.basePoints === 1) byCommander[record.commander].wins++
        }

        const ps = playerMap[playerName]
        const playerAvgPts = ps.gamesPlayed > 0 ? ps.totalBasePoints / ps.gamesPlayed : 0
        const playerWinRate = ps.gamesPlayed > 0 ? ps.baseWins / ps.gamesPlayed : 0

        for (const [cmdName, data] of Object.entries(byCommander)) {
          const score = smoothedTierScore(
            data.totalPoints,
            data.wins,
            data.games,
            playerAvgPts,
            playerWinRate,
          )
          const tier = getTier(score, globalAvgScore)
          playerMap[playerName].commanderTiers[cmdName] = tier

          // Tier achievements
          const tierAchievements: Record<string, string> = {
            diamond: 'diamond_tier',
            platinum: 'platinum_tier',
            gold: 'gold_tier',
          }
          if (tier in tierAchievements) {
            const achId = tierAchievements[tier]
            const key = `${playerName}:${cmdName}:${achId}`
            if (!cmdOneTime.has(key)) {
              cmdOneTime.add(key)
              const entry: EarnedAchievement = { id: achId, gameId: 'post', commander: cmdName }
              ps.earnedAchievements.push(entry)
              ps.achievementPoints = round3(ps.achievementPoints + ACHIEVEMENTS[achId].points)
            }
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
        }
      }

      games.value = [...processedGames].reverse()
      players.value = playerMap
      commanders.value = commanderMap
      gameRecords.value = recordsMap
      loaded.value = true
    } catch (e: any) {
      error.value = e.message ?? 'Failed to load league data'
    } finally {
      loading.value = false
    }
  }

  const standings = computed(() =>
    Object.values(players.value)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((p, i) => ({ ...p, rank: i + 1 })),
  )

  return { games, players, commanders, gameRecords, standings, loaded, loading, error, init }
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
