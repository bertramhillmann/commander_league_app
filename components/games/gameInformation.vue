<template>
  <div v-if="record" class="game-info">
    <div class="game-info__heading">
      <span class="game-info__player">{{ playerName }}</span>
      <span class="game-info__game-id">{{ gameId }}</span>
    </div>
    <div class="game-info__commander-row">
      <div class="game-info__commander">{{ record.commander }}</div>
      <span v-if="commanderTier" class="game-info__tier">
        <IconsTierIcon :tier="commanderTier" :size="13" />
        <span class="game-info__tier-label" :class="`tier-text--${commanderTier}`">
          {{ TIER_META[commanderTier].label }}
        </span>
      </span>
    </div>

    <div class="game-info__section">
      <div class="game-info__row">
        <span class="game-info__label">Base points</span>
        <span class="game-info__value game-info__value--pts">{{ fmt(record.basePoints) }}</span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">L-Points</span>
        <span
          class="game-info__value"
          :class="record.lPoints > 0 ? 'game-info__value--lp' : 'game-info__value--muted'"
        >{{ fmt(record.lPoints) }}</span>
      </div>
    </div>

    <div class="game-info__section">
      <div class="game-info__section-title">Modifiers</div>
      <div v-if="record.modifiers.length === 0" class="game-info__muted">None</div>
      <div v-for="mod in record.modifiers" :key="mod.name" class="game-info__row">
        <span class="game-info__label" :class="{ 'game-info__label--info': mod.informational }">
          {{ mod.name }}{{ mod.informational ? ' (info)' : '' }}
        </span>
        <span class="game-info__modifier-val" :class="{ 'game-info__modifier-val--info': mod.informational }">
          +{{ fmt(mod.value) }}
        </span>
      </div>
      <div v-if="record.modifiers.length > 0" class="game-info__row game-info__row--total">
        <span class="game-info__label">Game Total</span>
        <span class="game-info__value game-info__value--pts">{{ fmt(record.finalPoints) }}</span>
      </div>
    </div>

    <div class="game-info__divider" />

    <div class="game-info__section">
      <div class="game-info__row">
        <span class="game-info__label">Score before game</span>
        <span class="game-info__value">{{ fmt(record.ratingBefore) }}</span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">Score after game</span>
        <span class="game-info__value">{{ fmt(record.ratingAfter) }}</span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">Rank at that time</span>
        <span class="game-info__rank-change">
          <span class="game-info__rank-before">#{{ record.rankBefore }}</span>
          <span class="game-info__rank-arrow" :class="rankChangeClass">{{ rankArrow }}</span>
          <span class="game-info__rank-after" :class="rankChangeClass">#{{ record.rankAfter }}</span>
          <span v-if="rankDelta !== 0" class="game-info__rank-delta" :class="rankChangeClass">
            ({{ rankDelta > 0 ? '+' : '' }}{{ rankDelta }})
          </span>
        </span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">Current rank</span>
        <span class="game-info__value">{{ currentRank > 0 ? `#${currentRank}` : '—' }}</span>
      </div>
    </div>

    <div class="game-info__divider" />

    <div class="game-info__section">
      <div class="game-info__section-title">Achievements</div>
      <div v-if="gameAchievements.length === 0" class="game-info__muted">None</div>
      <div v-for="ach in gameAchievements" :key="ach.id" class="game-info__achievement">
        <span class="game-info__achievement-icon">{{ ach.icon }}</span>
        <span class="game-info__achievement-name">{{ ach.name }}</span>
        <span class="game-info__achievement-pts">+{{ ach.points }}</span>
      </div>
    </div>

    <div class="game-info__divider" />

    <div class="game-info__section">
      <div class="game-info__row">
        <span class="game-info__label">Current rating</span>
        <span class="game-info__value game-info__value--pts">{{ fmt(currentRating) }}</span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">Avg per game</span>
        <span class="game-info__value">{{ fmt(avgRating) }}</span>
      </div>
      <div class="game-info__row">
        <span class="game-info__label">Avg w/ {{ record.commander }}</span>
        <span class="game-info__value">{{ fmt(commanderPlayerAvg) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ACHIEVEMENTS } from '~/utils/achievements'
import { TIER_META, blendScore, getTier, type Tier } from '~/utils/tiers'
import { getLeagueStandingMetrics } from '~/composables/useLeagueState'

const props = defineProps<{
  playerName: string
  gameId: string
}>()

const { players, commanders, gameRecords, standings } = useLeagueState()

const record = computed(() => gameRecords.value[props.playerName]?.[props.gameId])

const gameAchievements = computed(() =>
  (record.value?.achievements ?? [])
    .map((a) => ACHIEVEMENTS[a.id])
    .filter(Boolean),
)
const playerState = computed(() => players.value[props.playerName])
const playerStanding = computed(() =>
  playerState.value ? getLeagueStandingMetrics(playerState.value, players.value) : null,
)

const currentRating = computed(() => playerStanding.value?.totalScore ?? 0)
const currentRank = computed(() => {
  if (!playerState.value) return 0
  return standings.value.find((entry) => entry.name === props.playerName)?.rank ?? 0
})

const avgRating = computed(() => {
  return playerStanding.value?.avgPerGame ?? 0
})

const commanderPlayerAvg = computed(() => {
  if (!record.value) return 0
  const all = Object.values(gameRecords.value[props.playerName] ?? {}).filter(
    (r) => r.commander === record.value!.commander,
  )
  if (all.length === 0) return 0
  return round3(all.reduce((s, r) => s + r.finalPoints, 0) / all.length)
})

const globalCommanderBaseline = computed(() => {
  const scores = Object.values(commanders.value)
    .filter((commander) => commander.gamesPlayed > 0)
    .map((commander) => blendScore(
      commander.totalBasePoints / commander.gamesPlayed,
      commander.wins / commander.gamesPlayed,
    ))

  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
})

const commanderTier = computed((): Tier | null => {
  if (!record.value) return null

  const commanderRecords = Object.values(gameRecords.value[props.playerName] ?? {}).filter(
    (currentRecord) => currentRecord.commander === record.value!.commander,
  )
  if (commanderRecords.length === 0) return null

  const totalBasePoints = commanderRecords.reduce((sum, currentRecord) => sum + currentRecord.basePoints, 0)
  const wins = commanderRecords.filter((currentRecord) => currentRecord.basePoints === 1).length
  const rawScore = blendScore(totalBasePoints / commanderRecords.length, wins / commanderRecords.length)

  return getTier(rawScore, globalCommanderBaseline.value, commanderRecords.length)
})

// ── Rank change ───────────────────────────────────────────────────────────────

// positive = rose (lower number = better rank), negative = dropped
const rankDelta = computed(() => {
  if (!record.value || !record.value.rankBefore || !record.value.rankAfter) return 0
  return record.value.rankBefore - record.value.rankAfter
})

const rankArrow = computed(() => {
  if (rankDelta.value > 0) return '▲'
  if (rankDelta.value < 0) return '▼'
  return '='
})

const rankChangeClass = computed(() => {
  if (rankDelta.value > 0) return 'game-info__rank--up'
  if (rankDelta.value < 0) return 'game-info__rank--down'
  return 'game-info__rank--same'
})

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
</script>

<style lang="scss" scoped>
.game-info {
  background: $color-bg-elevated;
  border: 1px solid $color-primary;
  border-radius: $border-radius-md;
  padding: $spacing-3 $spacing-4;
  width: 260px;
  font-size: $font-size-xs;
  box-shadow: $shadow-lg, $shadow-glow-primary;

  &__heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
  }

  &__player {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    color: $color-text;
  }

  &__game-id {
    font-family: monospace;
    color: $color-text-muted;
    font-size: $font-size-xs;
  }

  &__commander {
    color: $color-primary-light;
    font-size: $font-size-xs;
  }

  &__commander-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
    margin-bottom: $spacing-3;
  }

  &__tier {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  &__tier-label {
    font-size: 10px;
    font-weight: $font-weight-medium;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &.tier-text--god      { color: $tier-god-color; }
    &.tier-text--legend   { color: $tier-legend-color; }
    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }

  &__section {
    margin-bottom: $spacing-2;
  }

  &__section-title {
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
    margin-bottom: $spacing-1;
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin: $spacing-2 0;
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 2px 0;

    &--total {
      border-top: 1px solid $border-color;
      margin-top: $spacing-1;
      padding-top: $spacing-1;
    }
  }

  &__label {
    color: $color-text-muted;

    &--info { color: rgba($color-text-muted, 0.6); font-style: italic; }
  }

  &__value {
    font-weight: $font-weight-semibold;
    color: $color-text;

    &--pts { color: $color-secondary; }
    &--lp  { color: $color-danger; }
    &--muted { color: $color-text-muted; }
  }

  &__modifier-val {
    color: $color-accent;

    &--info { color: rgba($color-accent, 0.5); font-style: italic; }
    font-weight: $font-weight-semibold;
  }

  &__muted {
    color: $color-text-muted;
    font-style: italic;
  }

  &__achievement {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: 2px 0;
  }

  &__achievement-icon {
    font-size: 12px;
    line-height: 1;
  }

  &__achievement-name {
    flex: 1;
    color: $color-text;
  }

  &__achievement-pts {
    color: $color-accent;
    font-weight: $font-weight-semibold;
  }

  &__rank-change {
    display: flex;
    align-items: center;
    gap: 4px;
    font-variant-numeric: tabular-nums;
  }

  &__rank-before { color: $color-text-muted; }

  &__rank-arrow,
  &__rank-after,
  &__rank-delta {
    font-weight: $font-weight-semibold;
  }

  &__rank--up   { color: $color-success; }
  &__rank--down { color: $color-danger; }
  &__rank--same { color: $color-text-muted; }
}
</style>
