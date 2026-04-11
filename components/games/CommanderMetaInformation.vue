<template>
  <div class="cmd-meta">
    <!-- Art crop -->
    <div class="cmd-meta__art">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="commanderName"
        class="cmd-meta__art-img"
      />
      <div v-else class="cmd-meta__art-placeholder" />
    </div>

    <!-- Name + tier -->
    <div class="cmd-meta__header">
      <span class="cmd-meta__name">{{ commanderName }}</span>
      <span v-if="tier" class="cmd-meta__tier">
        <IconsTierIcon :tier="tier" :size="13" />
        <span class="cmd-meta__tier-label" :class="`tier-text--${tier}`">
          {{ TIER_META[tier].label }}
        </span>
      </span>
    </div>

    <div class="cmd-meta__divider" />

    <!-- Level + progress bar -->
    <div class="cmd-meta__level-row">
      <span class="cmd-meta__level-label">Lvl {{ level }}</span>
      <div class="cmd-meta__bar-wrap">
        <div
          class="cmd-meta__bar-fill"
          :style="{ width: `${progressPct}%` }"
        />
      </div>
      <span class="cmd-meta__level-next">
        {{ isMaxLevel ? 'MAX' : `Lvl ${level + 1}` }}
      </span>
    </div>
    <div class="cmd-meta__xp-label">
      {{ commanderXP }} / {{ isMaxLevel ? maxXP : nextLevelXP }} XP
    </div>

    <div class="cmd-meta__divider" />

    <!-- Stats -->
    <div class="cmd-meta__stats">
      <div class="cmd-meta__stat">
        <span class="cmd-meta__stat-icon">🎮</span>
        <span class="cmd-meta__stat-val">{{ totalGames }}</span>
        <span class="cmd-meta__stat-lbl">games</span>
      </div>
      <div class="cmd-meta__stat">
        <span class="cmd-meta__stat-icon">🥇</span>
        <span class="cmd-meta__stat-val">{{ firstPlaces }}</span>
        <span class="cmd-meta__stat-lbl">1st</span>
      </div>
      <div class="cmd-meta__stat">
        <span class="cmd-meta__stat-icon">🥈</span>
        <span class="cmd-meta__stat-val">{{ secondPlaces }}</span>
        <span class="cmd-meta__stat-lbl">2nd</span>
      </div>
      <div class="cmd-meta__stat">
        <span class="cmd-meta__stat-icon">💀</span>
        <span class="cmd-meta__stat-val">{{ lastPlaces }}</span>
        <span class="cmd-meta__stat-lbl">last</span>
      </div>
    </div>

    <div class="cmd-meta__winrate-row">
      <span class="cmd-meta__winrate-val">{{ avgPoints }}</span>
      <span class="cmd-meta__winrate-lbl">avg pts</span>
      <span class="cmd-meta__winrate-sep">·</span>
      <span class="cmd-meta__winrate-val">{{ winRatePct }}%</span>
      <span class="cmd-meta__winrate-lbl">wins</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchCardByName, getCardImageUrl } from '~/services/scryfallService'
import { TIER_META } from '~/utils/tiers'
import { xpToLevel, LEVEL_THRESHOLDS, MAX_LEVEL } from '~/utils/commanderExperience'

const props = defineProps<{
  playerName: string
  commanderName: string
}>()

const { players, gameRecords } = useLeagueState()

// ── Card image ─────────────────────────────────────────────────────────────────

const imageUrl = ref<string | null>(null)

onMounted(async () => {
  const card = await fetchCardByName(props.commanderName)
  if (card) imageUrl.value = getCardImageUrl(card, 'art_crop')
})

// ── Tier ───────────────────────────────────────────────────────────────────────

const tier = computed(() =>
  players.value[props.playerName]?.commanderTiers?.[props.commanderName] ?? null,
)

// ── Level & XP progress ────────────────────────────────────────────────────────

const commanderXP = computed(
  () => players.value[props.playerName]?.commanderXP?.[props.commanderName] ?? 0,
)

const level = computed(() => xpToLevel(commanderXP.value))
const isMaxLevel = computed(() => level.value >= MAX_LEVEL)
const maxXP = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]

const levelStartXP = computed(() => LEVEL_THRESHOLDS[level.value - 1] ?? 0)
const nextLevelXP = computed(() => LEVEL_THRESHOLDS[level.value] ?? maxXP)

const progressPct = computed(() => {
  if (isMaxLevel.value) return 100
  const range = nextLevelXP.value - levelStartXP.value
  if (range === 0) return 100
  return Math.min(100, Math.round(((commanderXP.value - levelStartXP.value) / range) * 100))
})

// ── Game stats ─────────────────────────────────────────────────────────────────

const commanderRecords = computed(() =>
  Object.values(gameRecords.value[props.playerName] ?? {}).filter(
    (r) => r.commander === props.commanderName,
  ),
)

const totalGames = computed(() => commanderRecords.value.length)
const firstPlaces = computed(() => commanderRecords.value.filter((r) => r.placement === 1).length)
const secondPlaces = computed(() => commanderRecords.value.filter((r) => r.placement === 2).length)
const lastPlaces = computed(() =>
  commanderRecords.value.filter((r) => r.placement === r.playerCount).length,
)
const avgPoints = computed(() => {
  if (totalGames.value === 0) return 0
  const total = commanderRecords.value.reduce((s, r) => s + r.basePoints, 0)
  return Math.round((total / totalGames.value) * 1000) / 1000
})

const winRatePct = computed(() =>
  totalGames.value > 0 ? Math.round((firstPlaces.value / totalGames.value) * 100) : 0,
)
</script>

<style lang="scss" scoped>
.cmd-meta {
  width: 240px;
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  box-shadow: $shadow-lg;

  &__art {
    width: 100%;
    height: 170px;
    overflow: hidden;
  }

  &__art-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  &__art-placeholder {
    width: 100%;
    height: 100%;
    background: $color-bg-card;
  }

  &__header {
    padding: $spacing-2 $spacing-3 $spacing-1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__tier {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  &__tier-label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin: $spacing-1 0;
  }

  &__level-row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: $spacing-1 $spacing-3;
  }

  &__level-label,
  &__level-next {
    font-size: $font-size-xs;
    color: $color-text-muted;
    white-space: nowrap;
    min-width: 32px;
  }

  &__level-next {
    text-align: right;
  }

  &__bar-wrap {
    flex: 1;
    height: 6px;
    background: $color-bg-card;
    border-radius: $border-radius-full;
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-primary, $color-primary-light);
    border-radius: $border-radius-full;
    transition: width $transition-slow;
  }

  &__xp-label {
    font-size: 10px;
    color: $color-text-muted;
    padding: 0 $spacing-3 $spacing-2;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: $spacing-2 $spacing-3 $spacing-1;
    gap: $spacing-1;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  &__winrate-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 0 $spacing-3 $spacing-2;
  }

  &__winrate-val {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-secondary;
  }

  &__winrate-lbl {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__winrate-sep {
    color: $color-text-muted;
    margin: 0 2px;
  }

  &__stat-icon {
    font-size: 13px;
    line-height: 1;
  }

  &__stat-val {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__stat-lbl {
    font-size: 9px;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}
</style>
