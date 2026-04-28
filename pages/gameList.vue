<script setup lang="ts">
import { computeGamePoints } from '~/utils/placements'
import type { GameDocument } from '~/utils/gameTypes'
import { compareGamesForDisplay, type ProcessedGame, type ProcessedGamePlayer } from '~/composables/useLeagueState'
import { formatPlayerName } from '~/utils/playerNames'

const { ensureSession, isAdmin } = useAuth()
await ensureSession()

const { games, loading, error, init, refresh: refreshLeagueState } = useLeagueState()
await init()

const selectedPlayer = ref<string | null>(null)

const {
  data: adminGames,
  pending: adminGamesLoading,
  error: adminGamesError,
  refresh: refreshAdminGames,
} = await useFetch<GameDocument[]>('/api/games', {
  query: { includeHidden: '1' },
  default: () => [],
  immediate: isAdmin.value,
})

const {
  data: allPlayers,
} = await useFetch<string[]>('/api/players', {
  default: () => [],
  immediate: isAdmin.value,
})

const {
  data: allCommanders,
} = await useFetch<string[]>('/api/commanders', {
  default: () => [],
  immediate: isAdmin.value,
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

const pageLoading = computed(() =>
  loading.value || (isAdmin.value && adminGamesLoading.value),
)

const pageError = computed(() =>
  error.value || (isAdmin.value ? adminGamesError.value?.message ?? null : null),
)

async function onGameUpdated() {
  await Promise.all([
    refreshLeagueState(),
    isAdmin.value ? refreshAdminGames() : Promise.resolve(),
  ])
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
</script>

<template>
  <div class="page">
    <header class="game-list__header">
      <NuxtLink to="/" class="back-link">← Home</NuxtLink>
      <h1>Games</h1>
    </header>

    <div v-if="pageLoading" class="state-msg">Loading…</div>
    <div v-else-if="pageError" class="state-msg state-msg--error">Failed to load games.</div>

    <template v-else>
      <div class="game-list__layout">
        <div class="game-list__grid">
          <div class="game-list__filter-bar">
            <span class="game-list__count">{{ filteredGames.length }} games</span>
            <select
              v-model="selectedPlayer"
              class="game-list__player-filter"
            >
              <option :value="null">All players</option>
              <option v-for="name in playerNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </div>
          <GamesGame
            v-for="game in filteredGames"
            :key="game.gameId"
            :game="game"
            :highlight-player="selectedPlayer"
            :admin-raw-game="isAdmin ? (adminGames ?? []).find((entry) => entry.gameId === game.gameId) ?? null : null"
            :all-player-options="isAdmin ? (allPlayers ?? []) : []"
            :all-commander-options="isAdmin ? (allCommanders ?? []) : []"
            @updated="onGameUpdated"
          />
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

@media (max-width: 1100px) {
  .game-list {
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
