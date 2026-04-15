<script setup lang="ts">
import { compareGamesForDisplay } from '~/composables/useLeagueState'

const { games, players, loading, error } = useLeagueState()

const selectedPlayer = ref<string | null>(null)

const playerNames = computed(() =>
  Object.keys(players.value).sort((a, b) => a.localeCompare(b)),
)

const sortedGames = computed(() =>
  [...games.value].sort(compareGamesForDisplay),
)

const filteredGames = computed(() => {
  if (!selectedPlayer.value) return sortedGames.value
  return sortedGames.value.filter(game =>
    game.players.some(p => p.name === selectedPlayer.value),
  )
})
</script>

<template>
  <div class="page">
    <header class="game-list__header">
      <NuxtLink to="/" class="back-link">← Home</NuxtLink>
      <h1>Games</h1>
    </header>

    <div v-if="loading" class="state-msg">Loading…</div>
    <div v-else-if="error" class="state-msg state-msg--error">Failed to load games.</div>

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
          <GamesGame v-for="game in filteredGames" :key="game.gameId" :game="game" :highlight-player="selectedPlayer" />
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
