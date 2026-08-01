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

    <div v-if="showDetailedHoverContent" class="game-info__section">
      <div class="game-info__row">
        <span class="game-info__label">Base points</span>
        <span class="game-info__value game-info__value--pts">{{ fmt(record.basePoints) }}</span>
      </div>
    </div>

    <div v-if="showDetailedHoverContent" class="game-info__section">
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

    <div v-if="showDetailedHoverContent" class="game-info__divider" />

    <div class="game-info__section">
      <div class="game-info__row game-info__row--rating">
        <span class="game-info__label">{{ rankingValueLabel }} before game</span>
        <span class="game-info__rating-value game-info__rating-value--before">{{ displayRating(record.ratingBefore) }}</span>
      </div>
      <div class="game-info__row game-info__row--rating">
        <span class="game-info__label">{{ rankingValueLabel }} after game</span>
        <span class="game-info__rating-value" :class="ratingDeltaClass">
          {{ displayRating(record.ratingAfter) }}
          <small v-if="ratingDelta !== 0">({{ fmtSigned(ratingDelta) }})</small>
        </span>
      </div>
      <div class="game-info__row game-info__row--stacked">
        <span class="game-info__label">Commander MMR change</span>
        <span class="game-info__value game-info__value--mmr" :class="commanderMmrDeltaClass">
          <IconsMmrIcon :size="11" />{{ fmtSigned(record.commanderMMRDelta) }} ({{ fmt(record.commanderMMRBefore) }} → {{ fmt(record.commanderMMRAfter) }})
        </span>
      </div>
      <div class="game-info__divider" />
      <div class="game-info__row">
        <span class="game-info__label">L-Points</span>
        <span
          class="game-info__value"
          :class="record.lPoints > 0 ? 'game-info__value--lp' : 'game-info__value--muted'"
        >{{ fmt(record.lPoints) }}</span>
      </div>
      <div v-if="lPointModifierSummary" class="game-info__row game-info__row--stacked">
        <span class="game-info__label">L-Points modifier</span>
        <span class="game-info__value" :class="lPointModifierClass">{{ lPointModifierSummary }}</span>
        <span class="game-info__subvalue">{{ lPointModifierDetail }}</span>
      </div>
      <div v-if="showDetailedHoverContent" class="game-info__row">
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
      <div v-if="showDetailedHoverContent" class="game-info__row">
        <span class="game-info__label">Current rank</span>
        <span class="game-info__value">{{ currentRank > 0 ? `#${currentRank}` : '—' }}</span>
      </div>
    </div>

    <div v-if="showDetailedHoverContent" class="game-info__divider" />

    <div v-if="showDetailedHoverContent" class="game-info__section">
      <div class="game-info__section-title">Achievements</div>
      <div v-if="gameAchievements.length === 0" class="game-info__muted">None</div>
      <div v-for="ach in gameAchievements" :key="ach.id" class="game-info__achievement">
        <span class="game-info__achievement-icon">{{ ach.icon }}</span>
        <span class="game-info__achievement-name">{{ ach.name }}</span>
        <span class="game-info__achievement-pts">+{{ ach.points }}</span>
      </div>
    </div>

    <div v-if="showDetailedHoverContent" class="game-info__divider" />

    <div v-if="showDetailedHoverContent" class="game-info__section">
      <div class="game-info__row">
        <span class="game-info__label">Current rating</span>
        <span class="game-info__value game-info__value--pts">{{ settings.playerRankingSystem === 'player_rating_based' ? Math.round(currentRating) : fmt(currentRating) }}</span>
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
import { getAchievementDefinition } from '~/utils/achievements'
import { TIER_META, type Tier } from '~/utils/tiers'
import { getCommanderTierFromMMR } from '~/composables/useCommanderMMR'

const props = defineProps<{
  playerName: string
  gameId: string
}>()

const { players, gameRecords, standings } = useLeagueState()
const { settings } = useLeagueSettings()
const showDetailedHoverContent = false

const record = computed(() => gameRecords.value[props.playerName]?.[props.gameId])

const gameAchievements = computed(() =>
  (record.value?.achievements ?? [])
    .map((a) => getAchievementDefinition(a.id))
    .filter(Boolean),
)
const playerState = computed(() => players.value[props.playerName])
const playerStanding = computed(() => standings.value.find((entry) => entry.name === props.playerName) ?? null)
const rankingValueLabel = computed(() => settings.value.playerRankingSystem === 'player_rating_based' ? 'Rating' : 'Score')

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

const commanderTier = computed((): Tier | null => {
  if (!record.value) return null
  return getCommanderTierFromMMR(record.value.commanderMMRAfter) as Tier
})

const lPointModifierSummary = computed(() => {
  const modifier = record.value?.lPointModifier
  if (!modifier?.enabled) return ''

  const percentLabel = modifier.percent > 0 ? `+${fmt(modifier.percent)}` : fmt(modifier.percent)
  return `${percentLabel}% (${fmt(modifier.baseLPoints)} -> ${fmt(modifier.adjustedLPoints)})`
})

const lPointModifierDetail = computed(() => {
  const modifier = record.value?.lPointModifier
  if (!modifier?.enabled) return ''

  const reasonLabel = modifier.reason === 'stronger_pod'
    ? 'Tougher pod bonus'
    : modifier.reason === 'weaker_pod'
      ? 'Softer pod reduction'
      : 'Neutral pod'

  return `${reasonLabel}: player ${fmt(modifier.playerRatingBefore)} vs ${fmt(modifier.podAveragePlayerRating)} avg, commander ${fmt(modifier.commanderMmrBefore)} vs ${fmt(modifier.podAverageCommanderMmr)} avg`
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

const commanderMmrDeltaClass = computed(() => {
  if (!record.value) return 'game-info__value--muted'
  if (record.value.commanderMMRDelta > 0) return 'game-info__mmr--up'
  if (record.value.commanderMMRDelta < 0) return 'game-info__mmr--down'
  return 'game-info__value--muted'
})

const ratingDelta = computed(() => (record.value?.ratingAfter ?? 0) - (record.value?.ratingBefore ?? 0))
const ratingDeltaClass = computed(() => {
  if (ratingDelta.value > 0) return 'game-info__rating-value--up'
  if (ratingDelta.value < 0) return 'game-info__rating-value--down'
  return 'game-info__rating-value--same'
})

const lPointModifierClass = computed(() => {
  const percent = record.value?.lPointModifier?.percent ?? 0
  if (percent > 0) return 'game-info__value--lp-mod-up'
  if (percent < 0) return 'game-info__value--lp-mod-down'
  return 'game-info__value--muted'
})

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n)
}

function displayRating(n: number): string {
  return settings.value.playerRankingSystem === 'player_rating_based' ? String(Math.round(n)) : fmt(n)
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
</script>

<style lang="scss" scoped>
.game-info {
  background: linear-gradient(155deg, rgba(18, 12, 30, 0.97), rgba(7, 5, 13, 0.98));
  border: 1px solid rgba($color-primary-light, 0.3);
  border-radius: $border-radius-lg;
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

    &--stacked {
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
    }

    &--rating {
      align-items: center;
      padding: $spacing-1 0;
    }
  }

  &__rating-value {
    padding: 3px 7px;
    border-radius: $border-radius-sm;
    background: rgba($color-bg, 0.5);
    color: $color-text;
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    font-variant-numeric: tabular-nums;

    small {
      margin-left: 3px;
      font-size: 10px;
      font-weight: $font-weight-semibold;
    }

    &--before { color: $color-text-muted; }
    &--up { color: $color-success; background: rgba($color-success, 0.14); }
    &--down { color: $color-danger; background: rgba($color-danger, 0.14); }
    &--same { color: $color-text-muted; }
  }

  &__value--mmr {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
    &--lp-mod-up { color: rgba($color-success, 0.9); }
    &--lp-mod-down { color: rgba($color-danger, 0.9); }
    &--muted { color: $color-text-muted; }
  }

  &__subvalue {
    color: rgba($color-text-muted, 0.82);
    font-size: 10px;
    line-height: 1.35;
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

  &__mmr--up   { color: rgba($color-success, 0.65); }
  &__mmr--down { color: rgba($color-danger, 0.65); }
}
</style>
