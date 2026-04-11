<template>
  <div class="ach-list">
    <div class="ach-list__header">
      <span class="ach-list__title">Achievements</span>
      <span class="ach-list__total">{{ fmt(totalPoints) }} pts</span>
    </div>

    <div class="ach-list__divider" />

    <div v-if="rows.length === 0" class="ach-list__empty">No achievements yet</div>

    <div v-for="row in rows" :key="row.id" class="ach-list__row">
      <span class="ach-list__icon">{{ row.icon }}</span>
      <span class="ach-list__name">{{ row.name }}</span>
      <span v-if="row.count > 1" class="ach-list__count">×{{ row.count }}</span>
      <span class="ach-list__pts">+{{ fmt(row.totalPoints) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ACHIEVEMENTS } from '~/utils/achievements'

const props = defineProps<{ playerName: string }>()

const { players } = useLeagueState()

const rows = computed(() => {
  const earned = players.value[props.playerName]?.earnedAchievements ?? []
  const grouped: Record<string, { count: number; pointsEach: number }> = {}

  for (const e of earned) {
    const def = ACHIEVEMENTS[e.id]
    if (!def) continue
    if (!grouped[e.id]) grouped[e.id] = { count: 0, pointsEach: def.points }
    grouped[e.id].count++
  }

  return Object.entries(grouped)
    .map(([id, g]) => ({
      id,
      icon: ACHIEVEMENTS[id].icon,
      name: ACHIEVEMENTS[id].name,
      count: g.count,
      totalPoints: Math.round(g.count * g.pointsEach * 1000) / 1000,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
})

const totalPoints = computed(() =>
  rows.value.reduce((s, r) => s + r.totalPoints, 0),
)

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.ach-list {
  width: 220px;
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  padding: $spacing-3;
  box-shadow: $shadow-lg;
  font-size: $font-size-xs;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: $spacing-2;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__total {
    font-weight: $font-weight-bold;
    color: $color-accent;
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin-bottom: $spacing-2;
  }

  &__empty {
    color: $color-text-muted;
    font-style: italic;
    text-align: center;
    padding: $spacing-2 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: 3px 0;
  }

  &__icon {
    font-size: 13px;
    line-height: 1;
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    color: $color-text;
  }

  &__count {
    color: $color-text-muted;
    font-size: 10px;
  }

  &__pts {
    color: $color-accent;
    font-weight: $font-weight-semibold;
    white-space: nowrap;
  }
}
</style>
