<template>
  <div class="page page--players">
    <header class="players-page__header">
      <h1 class="players-page__title">Players</h1>
      <span class="players-page__count">{{ standings.length }} players</span>
    </header>

    <div class="players-page__list">
      <NuxtLink
        v-for="player in standings"
        :key="player.name"
        class="players-page__row"
        :to="`/players/${encodeURIComponent(player.name)}`"
      >
        <span class="players-page__rank">{{ player.rank }}.</span>
        <span class="players-page__name">{{ player.name }}</span>
        <span class="players-page__score">{{ fmt(player.totalScore) }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const { standings } = useLeagueState()

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.players-page {
  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-6;
    flex-wrap: wrap;
  }

  &__title {
    font-size: $font-size-2xl;
    color: $color-text;
  }

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    max-width: 720px;
  }

  &__row {
    display: grid;
    grid-template-columns: 52px 1fr auto;
    align-items: center;
    gap: $spacing-3;
    padding: $spacing-3 $spacing-4;
    background: $color-bg-card;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    color: $color-text;
    text-decoration: none;
    transition: border-color $transition-fast, background $transition-fast;

    &:hover {
      border-color: rgba($color-primary, 0.45);
      background: rgba($color-bg-elevated, 0.8);
    }
  }

  &__rank {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text-muted;
  }

  &__name {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
  }

  &__score {
    font-size: $font-size-sm;
    color: $color-secondary;
    font-variant-numeric: tabular-nums;
  }
}
</style>
