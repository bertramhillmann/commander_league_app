<template>
  <div class="arch-enemy-card">
    <template v-if="summary.enemyName">
      <div class="arch-enemy-card__body">
        <img
          v-if="enemyImageUrl"
          :src="enemyImageUrl"
          :alt="enemyLabel"
          class="arch-enemy-card__portrait"
        />
        <div v-else class="arch-enemy-card__portrait arch-enemy-card__portrait--empty" />

        <div class="arch-enemy-card__text">
          <div class="arch-enemy-card__headline">
            <span class="arch-enemy-card__label">⚔ Arch Enemy:</span>
            <NuxtLink
              class="arch-enemy-card__name"
              :to="`/players/${encodeURIComponent(summary.enemyName)}`"
            >
              {{ enemyLabel }}
            </NuxtLink>
          </div>

          <div class="arch-enemy-card__wounds">
            <IconsMmrIcon :size="11" />{{ formatMmr(summary.mmrLost) }} MMR lost
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <span class="arch-enemy-card__none">No arch enemy yet</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatPlayerName } from '~/utils/playerNames'
import type { ArchEnemySummary } from '~/utils/archEnemy'

const props = defineProps<{
  summary: ArchEnemySummary
}>()

const playerImages = import.meta.glob('../../assets/img/*.png', { eager: true, import: 'default' }) as Record<string, string>

const enemyLabel = computed(() =>
  props.summary.enemyName ? formatPlayerName(props.summary.enemyName) : '',
)

const enemyImageUrl = computed(() => {
  if (!props.summary.enemyName) return null
  const key = `../../assets/img/${props.summary.enemyName.toLowerCase()}.png`
  return playerImages[key] ?? null
})

function formatMmr(value: number | null | undefined) {
  if (!Number.isFinite(value)) return '0'
  return (Math.round((value ?? 0) * 100) / 100).toFixed(2).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.arch-enemy-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  background: rgba(0, 0, 0, 0.35);
  padding: $spacing-3 $spacing-4;
  border-radius: $border-radius-lg;
  gap: $spacing-1;
  margin: 0 0 0 auto;

  &__body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $spacing-2;
  }

  &__portrait {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: $border-radius-sm;
    object-fit: cover;
    object-position: center top;
    border: 1px solid rgba($color-danger, 0.3);

    &--empty {
      background: rgba($color-danger, 0.06);
    }
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__headline {
    display: flex;
    align-items: baseline;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    color: $color-danger;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-shadow: 0 0 10px rgba($color-danger, 0.5);
    white-space: nowrap;
  }

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $color-danger;
    line-height: 1;
    text-decoration: none;
    transition: color $transition-fast;

    &:hover {
      color: rgba($color-danger, 0.8);
      text-decoration: underline dotted;
    }
  }

  &__wounds {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: $font-size-xs;
    color: rgba($color-danger, 0.55);
    font-style: italic;
    letter-spacing: 0.02em;
  }

  &__none {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-style: italic;
  }
}
</style>
