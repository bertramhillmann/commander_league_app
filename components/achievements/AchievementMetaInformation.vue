<template>
  <div class="ach-card" :class="`ach-card--rarity-${rarityClass}`">
    <div class="ach-card__inner">
      <div class="ach-card__glow" />

      <div class="ach-card__top">
        <span class="ach-card__scope">{{ def.scope }}</span>
        <span class="ach-card__rarity">{{ rarityLabel }}</span>
      </div>

      <div class="ach-card__main">
        <span class="ach-card__icon">{{ def.icon }}</span>
        <div class="ach-card__text">
          <h3 class="ach-card__name">{{ def.name }}</h3>
          <p class="ach-card__description">{{ def.description }}</p>
        </div>
      </div>

      <div class="ach-card__footer">
        <span class="ach-card__points">{{ formatPoints(def.points) }} pts</span>
        <span class="ach-card__type">{{ def.repeatable ? 'Repeatable' : 'One-Time' }}</span>
      </div>

      <div class="ach-card__divider" />

      <div class="ach-card__earned">
        <span class="ach-card__earned-label">Earned by</span>
        <span v-if="earnedByPlayers.length === 0" class="ach-card__earned-none">nobody yet</span>
        <div v-else class="ach-card__earned-chips">
          <span v-for="name in earnedByPlayers" :key="name" class="ach-card__earned-chip">{{ name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ACHIEVEMENTS, type AchievementRarity } from '~/utils/achievements'

const props = defineProps<{ achievementId: string }>()

const def = computed(() => ACHIEVEMENTS[props.achievementId])

const { players } = useLeagueState()

const earnedByPlayers = computed(() =>
  Object.values(players.value)
    .filter((p) => p.earnedAchievements.some((a) => a.id === props.achievementId))
    .map((p) => p.name),
)

const rarityLabel = computed(() => getRarityLabel(def.value?.rarity ?? 'common'))

const rarityClass = computed(() => def.value?.rarity ?? 'common')

function getRarityLabel(rarity: AchievementRarity) {
  return {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    mythic: 'Mythic',
  }[rarity]
}

function formatPoints(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.ach-card {
  &__inner {
    --rarity-stripe: rgba(200, 195, 185, 0.25);
    --rarity-glow: rgba(200, 195, 185, 0.06);

    position: relative;
    width: 230px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    padding: $spacing-3;
    padding-top: calc(#{$spacing-3} + 3px);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(13, 16, 23, 0.97), rgba(10, 12, 18, 0.97));
    box-shadow: 0 20px 52px rgba(0, 0, 0, 0.55);

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--rarity-stripe);
      z-index: 3;
      pointer-events: none;
    }
  }

  &__glow,
  &__top,
  &__main,
  &__footer,
  &__divider,
  &__earned {
    position: relative;
    z-index: 1;
  }

  &__glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 30%, var(--rarity-glow), transparent 55%);
    pointer-events: none;
    z-index: 0;
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__scope {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba($color-text-muted, 0.88);
  }

  &__rarity {
    font-family: $font-family-display;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba($color-text, 0.9);
  }

  &__main {
    display: flex;
    align-items: flex-start;
    gap: $spacing-2;
  }

  &__icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 22px;
    line-height: 1;
  }

  &__text {
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 14px;
    line-height: 1.25;
    text-transform: none;
    font-family: $font-family-base;
    color: $color-text;
  }

  &__description {
    margin: $spacing-1 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.75);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__points {
    color: $color-accent;
    font-size: 12px;
    font-weight: $font-weight-bold;
  }

  &__type {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba($color-text-muted, 0.88);
  }

  &__divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 2px 0;
  }

  &__earned {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  &__earned-label {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba($color-text-muted, 0.65);
  }

  &__earned-none {
    font-size: $font-size-xs;
    color: rgba($color-text-muted, 0.55);
    font-style: italic;
  }

  &__earned-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__earned-chip {
    padding: 2px 7px;
    border-radius: $border-radius-full;
    background: rgba($color-primary, 0.12);
    border: 1px solid rgba($color-primary-light, 0.16);
    color: $color-text;
    font-size: 10px;
    line-height: 1.2;
  }

  // ── Rarity tiers ──────────────────────────────────────────────────────────

  &--rarity-common &__inner {
    --rarity-stripe: #9e9070;
    --rarity-glow: rgba(158, 144, 112, 0.1);
    border-color: rgba(158, 144, 112, 0.2);
    background: linear-gradient(180deg, rgba(18, 16, 12, 0.97), rgba(12, 11, 10, 0.97));
  }
  &--rarity-common &__rarity { color: #b0a27e; }

  &--rarity-uncommon &__inner {
    --rarity-stripe: #52c8a8;
    --rarity-glow: rgba(82, 200, 168, 0.14);
    border-color: rgba(82, 200, 168, 0.28);
    background: linear-gradient(160deg, rgba(0, 30, 26, 0.2) 0%, transparent 55%),
      linear-gradient(180deg, rgba(10, 15, 15, 0.97), rgba(9, 12, 12, 0.97));
  }
  &--rarity-uncommon &__rarity { color: #52c8a8; }
  &--rarity-uncommon &__icon { background: rgba(82, 200, 168, 0.1); border: 1px solid rgba(82, 200, 168, 0.15); }

  &--rarity-rare &__inner {
    --rarity-stripe: #9b6ee8;
    --rarity-glow: rgba(155, 110, 232, 0.18);
    border-color: rgba(155, 110, 232, 0.34);
    background: linear-gradient(155deg, rgba(30, 10, 55, 0.24) 0%, transparent 55%),
      linear-gradient(180deg, rgba(12, 9, 20, 0.97), rgba(10, 8, 17, 0.97));
    box-shadow: 0 20px 52px rgba(0, 0, 0, 0.55), 0 0 28px rgba(155, 110, 232, 0.2);
  }
  &--rarity-rare &__rarity { color: #9b6ee8; }
  &--rarity-rare &__name { font-family: $font-family-display; font-size: 13px; }
  &--rarity-rare &__icon { background: rgba(155, 110, 232, 0.1); border: 1px solid rgba(155, 110, 232, 0.18); }

  &--rarity-mythic &__inner {
    --rarity-stripe: #ff9030;
    --rarity-glow: rgba(255, 138, 40, 0.2);
    border-color: rgba(255, 148, 50, 0.44);
    background: linear-gradient(150deg, rgba(55, 18, 0, 0.24) 0%, rgba(30, 10, 0, 0.1) 50%, transparent 75%),
      linear-gradient(180deg, rgba(15, 10, 7, 0.97), rgba(10, 8, 6, 0.97));
    box-shadow: 0 20px 52px rgba(0, 0, 0, 0.55), 0 0 32px rgba(255, 130, 40, 0.24);

    &::before {
      background: linear-gradient(90deg, #d04010, #ffb830, #ffe870, #ffb830, #d04010);
    }
  }
  &--rarity-mythic &__rarity { color: #ffaa40; text-shadow: 0 0 10px rgba(255, 160, 50, 0.5); }
  &--rarity-mythic &__name { font-family: $font-family-display; font-size: 13px; color: #fff0d8; }
  &--rarity-mythic &__icon { background: rgba(220, 110, 20, 0.14); border: 1px solid rgba(255, 148, 50, 0.24); }
  &--rarity-mythic &__points { color: #ffb840; }
}
</style>
