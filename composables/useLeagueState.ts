import { computed, effectScope, markRaw, toRaw, type ComputedRef } from 'vue'
import type { NuxtApp } from '#app'
import { getResolvedLeagueSettings } from '~/utils/leagueSettings'
import { formatPlayerName } from '~/utils/playerNames'
import {
  buildFreeGameAwardsByGame,
  buildLeagueStandings,
  compareGamesChronological,
  type CommanderState,
  type CommanderTitleSelectionMap,
  type FreeGameAwardEntry,
  type LeagueComputationResult,
  type LeagueSnapshotEntry,
  type LeagueStanding,
  type PlayerGameRecord,
  type PlayerState,
  type ProcessedGame,
  type RawLeagueGame,
  type SavedCommanderTitle,
} from '~/utils/league/engine'
import { runLeagueComputation } from '~/utils/league/runner'

// The league engine lives in ~/utils/league/engine so it can run inside a Web Worker.
// Everything it exports stays importable from here.
export {
  buildFreeGameAwardsByGame,
  buildLeagueStandings,
  calculatePlayerSeasonAverages,
  calculateProjectedPoints,
  calculateStandingsAdjustment,
  compareGameIdsAscending,
  compareGamesChronological,
  compareGamesForDisplay,
  getCommanderId,
  getFreeGameAwardsForGame,
  getLeagueAveragePerGame,
  getLeagueStandingMetrics,
  getPlayerCommanderAchievementPoints,
  getPlayerCommanderMetrics,
  getPlayerCommanderPerformanceEdgeMetrics,
  getPlayerCommanderRecords,
  getXpPoints,
} from '~/utils/league/engine'
export type {
  CommanderState,
  CommanderTitleSelectionMap,
  FreeGameAwardEntry,
  LeagueSnapshotEntry,
  LeagueStanding,
  LeagueStandingMetrics,
  LPointModifierResult,
  PlayerCommanderMetrics,
  PlayerCommanderPerformanceEdgeMetrics,
  PlayerGameRecord,
  PlayerState,
  ProcessedGame,
  ProcessedGamePlayer,
  ProjectedPointsResult,
  StandingAdjustmentContext,
  StandingAdjustmentResult,
} from '~/utils/league/engine'

// ─── Shared state ─────────────────────────────────────────────────────────────

const useGamesState = () => useState<ProcessedGame[]>('league:games', () => [])
const usePlayersState = () => useState<Record<string, PlayerState>>('league:players', () => ({}))
const useCommandersState = () => useState<Record<string, CommanderState>>('league:commanders', () => ({}))
const useGameRecordsState = () =>
  useState<Record<string, Record<string, PlayerGameRecord>>>('league:gameRecords', () => ({}))
const useLeagueSnapshotsState = () =>
  useState<Record<string, Record<string, LeagueSnapshotEntry>>>('league:leagueSnapshots', () => ({}))
const useCommanderTitleSelectionsState = () =>
  useState<CommanderTitleSelectionMap>('league:commanderTitleSelections', () => ({}))
const useProgressState = () =>
  useState<{ current: number; total: number }>('league:progress', () => ({ current: 0, total: 0 }))
const useLoadedState = () => useState<boolean>('league:loaded', () => false)
const useLoadingState = () => useState<boolean>('league:loading', () => false)
const useErrorState = () => useState<string | null>('league:error', () => null)

let pendingLeagueInit: Promise<void> | null = null

// One computation per app instance instead of one per component that calls
// useLeagueState() (tooltips used to rebuild the full standings on every hover).
const sharedComputeds = new WeakMap<NuxtApp, {
  standings: ComputedRef<LeagueStanding[]>
  freeGameAwardsByGame: ComputedRef<Map<string, FreeGameAwardEntry[]>>
}>()

// ─── Composable ───────────────────────────────────────────────────────────────

export function useLeagueState() {
  const nuxtApp = useNuxtApp()
  const games = useGamesState()
  const players = usePlayersState()
  const commanders = useCommandersState()
  const gameRecords = useGameRecordsState()
  const leagueSnapshots = useLeagueSnapshotsState()
  const commanderTitleSelections = useCommanderTitleSelectionsState()
  const progress = useProgressState()
  const loaded = useLoadedState()
  const loading = useLoadingState()
  const error = useErrorState()
  const { rawSettings, init: initLeagueSettings } = useLeagueSettings()
  // Cached worker results are keyed by build so new scoring code never reuses them.
  const resultCacheVersion = import.meta.dev ? null : useRuntimeConfig().app.buildId ?? null

  function applyResult(result: LeagueComputationResult) {
    // The league state is only ever replaced as a whole, never mutated in place.
    // markRaw keeps Vue from wrapping thousands of nested records in reactive
    // proxies, so every computed that walks them runs at plain-object speed.
    games.value = markRaw(result.games)
    players.value = markRaw(result.players)
    commanders.value = markRaw(result.commanders)
    gameRecords.value = markRaw(result.gameRecords)
    leagueSnapshots.value = markRaw(result.leagueSnapshots)
    commanderTitleSelections.value = result.commanderTitleSelections
  }

  async function init(force = false) {
    // The league is computed in the browser (in a Web Worker) and never during SSR:
    // replaying every game per request is slow, and serializing the result into
    // each HTML payload made pages heavy to download and hydrate. Only the small
    // settings document is loaded on the server, so both renders use the same settings.
    if (import.meta.server) {
      await initLeagueSettings(force)
      return
    }
    if (loaded.value && !force) return
    // The server rendered without league data, so during hydration the state must stay
    // as rendered: the computation starts once hydration is done, and pages that
    // await init() in setup are not blocked (the data then arrives reactively).
    const hydrating = nuxtApp.isHydrating
    if (!pendingLeagueInit) {
      pendingLeagueInit = hydrating
        ? new Promise<void>((resolve) => nuxtApp.hooks.hookOnce('app:suspense:resolve', () => resolve()))
          .then(() => computeLeague(force))
        : computeLeague(force)
    }
    if (hydrating) return
    await pendingLeagueInit
  }

  function computeLeague(force: boolean) {
    return (async () => {
      loading.value = true
      error.value = null
      progress.value = { current: 0, total: 0 }

      try {
        await initLeagueSettings(force)

        const [rawGames, roster, savedCommanderTitles] = await Promise.all([
          $fetch<RawLeagueGame[]>('/api/games'),
          $fetch<string[]>('/api/players'),
          $fetch<SavedCommanderTitle[]>('/api/commander-titles').catch(() => []),
        ])

        const result = await runLeagueComputation(
          {
            rawGames,
            roster,
            savedCommanderTitles,
            // Plain clone: reactive proxies cannot be posted to a worker.
            rawSettings: rawSettings.value ? JSON.parse(JSON.stringify(toRaw(rawSettings.value))) : null,
          },
          {
            onProgress: (current, total) => {
              progress.value = { current, total }
            },
            cacheVersion: resultCacheVersion,
          },
        )

        applyResult(result)
        loaded.value = true
      } catch (e: any) {
        error.value = e.message ?? 'Failed to load league data'
      } finally {
        progress.value = { current: 0, total: 0 }
        loading.value = false
        pendingLeagueInit = null
      }
    })()
  }

  let shared = sharedComputeds.get(nuxtApp)
  if (!shared) {
    shared = effectScope(true).run(() => ({
      standings: computed(() => buildLeagueStandings(
        players.value,
        rawSettings.value,
        { games: [...games.value].sort(compareGamesChronological), gameRecords: gameRecords.value },
      )),
      // Only evaluated when a view reads it, i.e. when the classic ranking uses free games.
      freeGameAwardsByGame: computed(() => {
        const resolved = getResolvedLeagueSettings(rawSettings.value)
        if (resolved.playerRankingSystem === 'player_rating_based' || resolved.standings.adjustmentMode !== 'freeGames') {
          return new Map<string, FreeGameAwardEntry[]>()
        }
        const playerNames = Object.keys(players.value)
          .map((playerName) => formatPlayerName(playerName))
          .sort((a, b) => a.localeCompare(b))
        return buildFreeGameAwardsByGame(games.value, gameRecords.value, playerNames, rawSettings.value)
      }),
    }))!
    sharedComputeds.set(nuxtApp, shared)
  }
  const { standings, freeGameAwardsByGame } = shared

  async function refresh() {
    await init(true)
  }

  async function checkNewGames() {
    const lastGameId = games.value
      .map((game) => game.gameId)
      .filter((gameId) => /^G\d+$/.test(gameId))
      .sort((left, right) => Number(right.slice(1)) - Number(left.slice(1)))[0]

    // Do the cheap incremental database check first. Rebuilding remains the
    // safe path when additions are found: standings include sequential MMR,
    // achievements, and cross-player context that must stay consistent.
    const newGames = await $fetch<any[]>('/api/games?afterId=' + encodeURIComponent(lastGameId ?? 'G0000'))
    if (newGames.length === 0) return 0

    await init(true)
    return newGames.length
  }

  return {
    games,
    players,
    commanders,
    gameRecords,
    leagueSnapshots,
    commanderTitleSelections,
    standings,
    freeGameAwardsByGame,
    progress,
    loaded,
    loading,
    error,
    init,
    refresh,
    checkNewGames,
  }
}
