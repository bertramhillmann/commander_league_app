<script setup lang="ts">
import { computeGamePoints } from '~/utils/placements'
import type { GameDocument } from '~/utils/gameTypes'
import { compareGamesForDisplay, type ProcessedGame, type ProcessedGamePlayer } from '~/composables/useLeagueState'
import { formatPlayerName } from '~/utils/playerNames'

const { ensureSession, isAdmin } = useAuth()
await ensureSession()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const highlightGameId = computed(() => (route.query.highlight as string) || null)

const { games, loading, loaded, error, init, refresh: refreshLeagueState, progress } = useLeagueState()
const hasMounted = ref(false)

const selectedPlayer = ref<string | null>(null)
const randomExportCount = ref(35)
const exportBusy = ref(false)
const testActionBusy = ref(false)
const actionError = ref('')
const actionSuccess = ref('')

const {
  data: adminGames,
  pending: adminGamesLoading,
  error: adminGamesError,
  refresh: refreshAdminGames,
} = useFetch<GameDocument[]>('/api/games', {
  query: { includeHidden: '1' },
  default: () => [],
  immediate: isAdmin.value,
  lazy: true,
})

const {
  data: allPlayers,
} = useFetch<string[]>('/api/players', {
  default: () => [],
  immediate: isAdmin.value,
  lazy: true,
})

const {
  data: allCommanders,
} = useFetch<string[]>('/api/commanders', {
  default: () => [],
  immediate: isAdmin.value,
  lazy: true,
})

const displayGames = computed(() => {
  if (!isAdmin.value) {
    return [...games.value].sort(compareGamesForDisplay)
  }

  return [...(adminGames.value ?? [])]
    .map(toProcessedGame)
    .sort(compareGamesForDisplay)
})

const playerNames = computed(() =>
  Array.from(
    new Set(
      displayGames.value.flatMap((game) => game.players.map((player) => formatPlayerName(player.name))),
    ),
  ).sort((a, b) => a.localeCompare(b)),
)

const filteredGames = computed(() => {
  if (!selectedPlayer.value) return displayGames.value
  return displayGames.value.filter((game) =>
    game.players.some((player) => formatPlayerName(player.name) === selectedPlayer.value),
  )
})

const pageError = computed(() =>
  error.value || (isAdmin.value ? adminGamesError.value?.message ?? null : null),
)

const pageLoading = computed(() =>
  !pageError.value && (!hasMounted.value || loading.value || !loaded.value || (isAdmin.value && adminGamesLoading.value)),
)

const progressPercent = computed(() => {
  if (progress.value.total <= 0) return 8
  return Math.max(8, Math.min(100, Math.round((progress.value.current / progress.value.total) * 100)))
})

const progressLabel = computed(() => {
  if (progress.value.total <= 0) return 'Preparing league data...'
  return `${progress.value.current}/${progress.value.total} games computed`
})

const adminRawGames = computed(() => adminGames.value ?? [])
const isTestEnvironment = computed(() => String(runtimeConfig.public.environment ?? '').toLowerCase() === 'test')

onMounted(() => {
  hasMounted.value = true
  if (!loaded.value) {
    void init()
  }
})

watch(pageLoading, (isLoading) => {
  if (!isLoading && highlightGameId.value) {
    nextTick(() => {
      const el = document.getElementById(`game-${highlightGameId.value}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
}, { immediate: true })

async function onGameUpdated() {
  await Promise.all([
    refreshLeagueState(),
    isAdmin.value ? refreshAdminGames() : Promise.resolve(),
  ])
}

function exportGamesJson(mode: 'all' | 'random') {
  if (!isAdmin.value) return

  const sourceGames = adminRawGames.value
  if (sourceGames.length === 0) {
    actionError.value = 'No games available to export.'
    actionSuccess.value = ''
    return
  }

  const amount = clampRandomExportCount(randomExportCount.value, sourceGames.length)
  const selectedGames = mode === 'random'
    ? sampleGames(sourceGames, amount)
    : sourceGames

  const payload = JSON.stringify(selectedGames, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  const suffix = mode === 'random' ? `random-${selectedGames.length}` : `all-${selectedGames.length}`

  exportBusy.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    anchor.href = url
    anchor.download = `games-${suffix}-${stamp}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    actionSuccess.value = mode === 'random'
      ? `Exported ${selectedGames.length} random games.`
      : `Exported all ${selectedGames.length} games.`
  } finally {
    URL.revokeObjectURL(url)
    exportBusy.value = false
  }
}

async function clearAllGames() {
  if (!isAdmin.value || !isTestEnvironment.value) return

  testActionBusy.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const response = await $fetch<{ deletedCount: number }>('/api/games/test-clear', { method: 'POST' })
    await onGameUpdated()
    actionSuccess.value = `Cleared ${response.deletedCount} games.`
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage ?? 'Failed to clear games.'
  } finally {
    testActionBusy.value = false
  }
}

async function addRandomGame() {
  if (!isAdmin.value || !isTestEnvironment.value) return

  testActionBusy.value = true
  actionError.value = ''
  actionSuccess.value = ''

  try {
    const response = await $fetch<{ gameId: string }>('/api/games/test-random', { method: 'POST' })
    await onGameUpdated()
    actionSuccess.value = `Added random game ${response.gameId}.`
  } catch (error: any) {
    actionError.value = error?.data?.statusMessage ?? 'Failed to add a random game.'
  } finally {
    testActionBusy.value = false
  }
}

function toProcessedGame(game: GameDocument): ProcessedGame {
  const normalizedPlayers = game.players.map((player) => ({
    ...player,
    name: formatPlayerName(player.name),
  }))
  const computedPlayers = computeGamePoints(normalizedPlayers) as ProcessedGamePlayer[]
  return {
    gameId: game.gameId,
    date: game.date,
    week: isoWeek(new Date(game.date)),
    hidden: Boolean(game.hidden),
    players: computedPlayers,
  }
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

function clampRandomExportCount(value: number, max: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(max, Math.round(value)))
}

function sampleGames<T>(items: T[], count: number) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy.slice(0, count)
}
</script>

<template>
  <div class="page">
    <header class="game-list__header">
      <NuxtLink to="/" class="back-link">&larr; Home</NuxtLink>
      <h1>Games</h1>
    </header>

    <div v-if="pageLoading" class="page-loader" aria-live="polite" aria-busy="true">
      <div class="page-loader__dots"><span /><span /><span /></div>
      <p class="page-loader__label">{{ progressLabel }}</p>
      <div class="page-loader__track">
        <div class="page-loader__fill" :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>
    <div v-else-if="pageError" class="state-msg state-msg--error">Failed to load games.</div>

    <template v-else>
      <div class="game-list__layout">
        <div class="game-list__grid">
          <div class="game-list__filter-bar">
            <span class="game-list__count">{{ filteredGames.length }} games</span>
            <div class="game-list__filter-actions">
              <select
                v-model="selectedPlayer"
                class="game-list__player-filter"
              >
                <option :value="null">All players</option>
                <option v-for="name in playerNames" :key="name" :value="name">{{ name }}</option>
              </select>
            </div>
          </div>

          <div v-if="isAdmin" class="game-list__admin-tools">
            <div class="game-list__tool-group">
              <button type="button" class="btn btn--muted btn--sm" :disabled="exportBusy || adminRawGames.length === 0" @click="exportGamesJson('all')">
                Export All JSON
              </button>
              <label class="game-list__random-export">
                <span>Random export</span>
                <input v-model.number="randomExportCount" type="number" min="1" :max="adminRawGames.length || 1" class="game-list__random-input" />
              </label>
              <button type="button" class="btn btn--ghost btn--sm" :disabled="exportBusy || adminRawGames.length === 0" @click="exportGamesJson('random')">
                Export Random JSON
              </button>
            </div>

            <div v-if="isTestEnvironment" class="game-list__tool-group game-list__tool-group--danger">
              <button type="button" class="btn btn--secondary btn--sm" :disabled="testActionBusy" @click="addRandomGame">
                Add Random Game
              </button>
              <button type="button" class="btn btn--ghost btn--sm game-list__danger-button" :disabled="testActionBusy" @click="clearAllGames">
                Clear All Games
              </button>
            </div>
          </div>

          <p v-if="actionSuccess" class="game-list__action-msg game-list__action-msg--success">{{ actionSuccess }}</p>
          <p v-if="actionError" class="game-list__action-msg game-list__action-msg--error">{{ actionError }}</p>

          <div v-if="isAdmin && isTestEnvironment" class="game-list__test-note">
            Test mode is active via `environment=test`, so destructive game-list tools are enabled.
          </div>

          <div
            v-for="game in filteredGames"
            :key="game.gameId"
            :id="`game-${game.gameId}`"
          >
            <GamesGame
              :game="game"
              :highlight-player="selectedPlayer"
              :highlight="highlightGameId === game.gameId"
              :admin-raw-game="isAdmin ? (adminGames ?? []).find((entry) => entry.gameId === game.gameId) ?? null : null"
              :all-player-options="isAdmin ? (allPlayers ?? []) : []"
              :all-commander-options="isAdmin ? (allCommanders ?? []) : []"
              @updated="onGameUpdated"
            />
          </div>
        </div>

        <aside class="game-list__sidebar">
          <GamesGameMatchMaking />
        </aside>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.game-list {
  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-4;
    margin-bottom: $spacing-8;
  }

  &__filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-2;
  }

  &__filter-actions {
    display: flex;
    align-items: center;
    gap: $spacing-3;
  }

  &__player-filter {
    font-size: $font-size-sm;
    background: $color-bg-elevated;
    color: $color-text;
    border: 1px solid rgba($color-primary-light, 0.3);
    border-radius: $border-radius-sm;
    padding: $spacing-1 $spacing-3;
    cursor: pointer;

    &:focus {
      outline: none;
      border-color: $color-primary-light;
    }
  }

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__admin-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-3;
    padding: $spacing-3 $spacing-4;
    border: 1px solid rgba($color-primary-light, 0.18);
    border-radius: $border-radius-lg;
    background:
      linear-gradient(180deg, rgba($color-primary, 0.06), rgba(255, 255, 255, 0.01)),
      rgba(7, 10, 16, 0.72);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
  }

  &__tool-group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-3;

    &--danger {
      justify-content: flex-end;
      padding-left: $spacing-4;
      border-left: 1px solid rgba($color-danger, 0.18);
    }
  }

  &__random-export {
    display: inline-flex;
    align-items: center;
    gap: $spacing-2;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &__random-input {
    appearance: none;
    width: 5rem;
    padding: 4px 8px;
    border-radius: $border-radius-sm;
    border: 1px solid rgba($border-color, 0.75);
    background: rgba($color-bg-elevated, 0.6);
    color: $color-text;
    font: inherit;
    font-size: $font-size-sm;
    transition: border-color $transition-fast;

    &:focus {
      outline: none;
      border-color: rgba($color-accent, 0.55);
    }
  }

  &__danger-button {
    border-color: rgba($color-danger, 0.4) !important;
    color: $color-danger !important;
  }

  &__action-msg {
    padding: $spacing-2 $spacing-3;
    border-radius: $border-radius-md;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;

    &--success {
      background: rgba($color-success, 0.12);
      color: $color-success;
      border: 1px solid rgba($color-success, 0.3);
    }

    &--error {
      background: rgba($color-danger, 0.12);
      color: $color-danger;
      border: 1px solid rgba($color-danger, 0.3);
    }
  }

  &__test-note {
    margin-bottom: $spacing-3;
    padding: $spacing-2 $spacing-3;
    border-radius: $border-radius-sm;
    border: 1px solid rgba($color-accent, 0.2);
    background: rgba($color-accent, 0.08);
    color: rgba($color-accent, 0.92);
    font-size: $font-size-sm;
  }

  &__layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    align-items: flex-start;
    gap: $spacing-6;
  }

  &__grid {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
    min-width: 0;
  }

  &__sidebar {
    position: sticky;
    top: $spacing-6;
    max-height: calc(100vh - #{$spacing-6} * 2);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba($color-primary-light, 0.2) transparent;
  }
}

// ── Buttons ───────────────────────────────────────────────────────────────────

.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 18px;
  border-radius: $border-radius-md;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast;

  &--primary {
    background: $color-primary;
    border: 1px solid rgba($color-primary-light, 0.5);
    color: $color-text;

    &:hover:not(:disabled) { background: $color-primary-light; }
  }

  &--secondary {
    background: rgba($color-bg-elevated, 0.7);
    border: 1px solid rgba($border-color, 0.8);
    color: $color-text-muted;

    &:hover:not(:disabled) {
      color: $color-text;
      border-color: rgba($color-accent, 0.4);
    }
  }

  &--muted {
    background: transparent;
    border: 1px solid rgba($border-color, 0.6);
    color: $color-text-muted;

    &:hover:not(:disabled) { color: $color-text; border-color: rgba($border-color, 1); }
  }

  &--ghost {
    background: transparent;
    border: 1px solid rgba($color-danger, 0.4);
    color: $color-danger;

    &:hover:not(:disabled) { background: rgba($color-danger, 0.1); }
  }

  &--sm {
    padding: 4px 10px;
    font-size: $font-size-xs;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

@media (max-width: 1100px) {
  .game-list {
    &__filter-bar,
    &__admin-tools {
      align-items: flex-start;
      flex-direction: column;
    }

    &__tool-group {
      width: 100%;
    }

    &__layout {
      grid-template-columns: 1fr;
    }

    &__sidebar {
      position: static;
      max-height: none;
      overflow-y: visible;
    }
  }
}

.back-link {
  font-size: $font-size-sm;
  color: $color-text-muted;
  white-space: nowrap;

  &:hover {
    color: $color-text;
  }
}

.state-msg {
  color: $color-text-muted;
  padding: $spacing-8;
  text-align: center;

  &--error {
    color: $color-danger;
  }
}
</style>
