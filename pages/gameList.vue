<script setup lang="ts">
import { compareGamesForDisplay } from '~/composables/useLeagueState'

const { games, loading, error } = useLeagueState()

const sortedGames = computed(() =>
  [...games.value].sort(compareGamesForDisplay),
)
</script>

<template>
  <div class="page">
    <header class="game-list__header">
      <NuxtLink to="/" class="back-link">← Home</NuxtLink>
      <h1>Games</h1>
      <span class="game-list__count">{{ sortedGames.length }} games</span>
    </header>

    <div v-if="loading" class="state-msg">Loading…</div>
    <div v-else-if="error" class="state-msg state-msg--error">Failed to load games.</div>

    <div v-else class="game-list__grid">
      <GamesGame v-for="game in sortedGames" :key="game.gameId" :game="game" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.game-list {
  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-4;
    margin-bottom: $spacing-8;

    h1 {
      flex: 1;
    }
  }

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__grid {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
    max-width: 800px;
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
