<template>
  <div class="ach-list">
    <div class="ach-list__header">
      <span class="ach-list__title">Achievements</span>
      <span class="ach-list__total">{{ fmt(totalPoints) }} pts</span>
    </div>

    <div class="ach-list__divider" />

    <div v-if="rows.length === 0" class="ach-list__empty">No achievements yet</div>

    <div v-for="row in visibleRows" :key="row.id" class="ach-list__row">
      <span class="ach-list__icon">{{ row.icon }}</span>
      <span class="ach-list__name">{{ row.name }}</span>
      <span v-if="row.count > 1" class="ach-list__count">×{{ row.count }}</span>
      <span class="ach-list__pts">+{{ fmt(row.totalPoints) }}</span>
    </div>

    <div v-if="hiddenCount > 0" class="ach-list__more">
      … {{ hiddenCount }} more — click to see full list
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAchievementDefinition } from '~/utils/achievements'

const props = defineProps<{ playerName: string; commanderName?: string }>()

const { players } = useLeagueState()

const MAX_VISIBLE = 6

const rows = computed(() => {
  const earned = players.value[props.playerName]?.earnedAchievements ?? []
  const grouped: Record<string, { count: number; pointsEach: number }> = {}

  for (const e of earned) {
    const def = getAchievementDefinition(e.id)
    if (!def) continue
    if (props.commanderName) {
      if (def.scope !== 'commander') continue
      if (e.commander !== props.commanderName) continue
    }
    if (!grouped[e.id]) grouped[e.id] = { count: 0, pointsEach: def.points }
    grouped[e.id].count++
  }

  return Object.entries(grouped)
    .map(([id, g]) => ({
      id,
      icon: getAchievementDefinition(id)?.icon ?? '',
      name: getAchievementDefinition(id)?.name ?? id,
      count: g.count,
      totalPoints: Math.round(g.count * g.pointsEach * 1000) / 1000,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints)
})

const visibleRows = computed(() => rows.value.slice(0, MAX_VISIBLE))
const hiddenCount = computed(() => Math.max(0, rows.value.length - MAX_VISIBLE))

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
  width: 240px;
  background: linear-gradient(155deg, rgba(18, 12, 30, 0.97), rgba(7, 5, 13, 0.98));
  border: 1px solid rgba($color-accent, 0.3);
  border-radius: $border-radius-lg;
  padding: $spacing-3;
  box-shadow:
    0 20px 56px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba($color-accent, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  font-size: $font-size-xs;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: $spacing-2;
  }

  &__title {
    font-size: 10px;
    font-weight: $font-weight-bold;
    color: $color-accent;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  &__total {
    font-weight: $font-weight-bold;
    color: $color-accent;
    font-size: $font-size-sm;
  }

  &__divider {
    height: 1px;
    background: rgba($color-accent, 0.2);
    margin-bottom: $spacing-2;
  }

  &__empty {
    color: rgba($color-text-muted, 0.7);
    font-style: italic;
    text-align: center;
    padding: $spacing-2 0;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: 4px 0;

    & + & {
      border-top: 1px solid rgba($border-color, 0.3);
    }
  }

  &__icon {
    font-size: 13px;
    line-height: 1;
    flex-shrink: 0;
  }

  &__name {
    flex: 1;
    color: rgba($color-text, 0.9);
    line-height: 1.3;
  }

  &__count {
    color: rgba($color-text-muted, 0.75);
    font-size: 10px;
    white-space: nowrap;
  }

  &__pts {
    color: $color-accent;
    font-weight: $font-weight-semibold;
    white-space: nowrap;
  }

  &__more {
    margin-top: $spacing-2;
    padding-top: $spacing-2;
    border-top: 1px solid rgba($color-accent, 0.15);
    color: rgba($color-text-muted, 0.65);
    font-size: 10px;
    font-style: italic;
    text-align: center;
    letter-spacing: 0.02em;
  }
}
</style>
