<template>
  <div class="ach-meta">
    <div class="ach-meta__header">
      <span class="ach-meta__icon">{{ def.icon }}</span>
      <div class="ach-meta__title-block">
        <span class="ach-meta__name">{{ def.name }}</span>
        <span class="ach-meta__pts">{{ def.points }} pt{{ def.points !== 1 ? 's' : '' }}</span>
      </div>
    </div>

    <div class="ach-meta__divider" />

    <p class="ach-meta__desc">{{ def.description }}</p>

    <div class="ach-meta__earned">
      <span class="ach-meta__earned-lbl">Earned by</span>
      <span v-if="earnedByPlayers.length === 0" class="ach-meta__earned-none">nobody yet</span>
      <span v-else class="ach-meta__earned-names">
        <span v-for="(name, i) in earnedByPlayers" :key="name">{{ name }}<span v-if="i < earnedByPlayers.length - 1">, </span></span>
      </span>
    </div>

    <div class="ach-meta__tags">
      <span class="ach-meta__tag ach-meta__tag--scope">{{ def.scope }}</span>
      <span v-if="def.repeatable" class="ach-meta__tag ach-meta__tag--repeatable">repeatable</span>
      <span v-else class="ach-meta__tag ach-meta__tag--once">once</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ACHIEVEMENTS } from '~/utils/achievements'

const props = defineProps<{ achievementId: string }>()

const def = computed(() => ACHIEVEMENTS[props.achievementId])

const { players } = useLeagueState()

const earnedByPlayers = computed(() =>
  Object.values(players.value)
    .filter((p) => p.earnedAchievements.some((a) => a.id === props.achievementId))
    .map((p) => p.name),
)
</script>

<style lang="scss" scoped>
.ach-meta {
  width: 220px;
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  padding: $spacing-3;
  box-shadow: $shadow-lg;
  font-size: $font-size-xs;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    margin-bottom: $spacing-2;
  }

  &__icon {
    font-size: 24px;
    line-height: 1;
    flex-shrink: 0;
  }

  &__title-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    color: $color-text;
  }

  &__pts {
    color: $color-accent;
    font-weight: $font-weight-semibold;
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin-bottom: $spacing-2;
  }

  &__desc {
    color: $color-text-muted;
    line-height: 1.5;
    margin: 0 0 $spacing-2;
  }

  &__earned {
    margin-bottom: $spacing-2;
    font-size: $font-size-xs;
  }

  &__earned-lbl {
    color: $color-text-muted;
    display: block;
    margin-bottom: 2px;
  }

  &__earned-names {
    color: $color-text;
    font-weight: $font-weight-medium;
  }

  &__earned-none {
    color: $color-text-muted;
    font-style: italic;
  }

  &__tags {
    display: flex;
    gap: $spacing-1;
    flex-wrap: wrap;
  }

  &__tag {
    padding: 1px 6px;
    border-radius: $border-radius-sm;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: $font-weight-medium;

    &--scope      { background: rgba($color-primary, 0.15); color: $color-primary-light; }
    &--repeatable { background: rgba($color-secondary, 0.15); color: $color-secondary; }
    &--once       { background: rgba($color-text-muted, 0.1); color: $color-text-muted; }
  }
}
</style>
