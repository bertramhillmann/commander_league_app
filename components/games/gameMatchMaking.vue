<script setup lang="ts">
import { buildFairMatchmakingResult, buildMatchmakingPlayerOptions } from '~/utils/gameMatchMaking'

const { games, gameRecords, players, loading, error } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const playerOptions = computed(() =>
  buildMatchmakingPlayerOptions(games.value, gameRecords.value, players.value),
)

const selectedPlayers = ref<string[]>([])

watch(
  playerOptions,
  (options) => {
    const available = new Set(options.map((option) => option.name))
    const nextSelection = selectedPlayers.value.filter((name) => available.has(name)).slice(0, 5)

    if (nextSelection.length >= 3) {
      selectedPlayers.value = nextSelection
      return
    }

    selectedPlayers.value = options.slice(0, 4).map((option) => option.name)
  },
  { immediate: true },
)

const matchmaking = computed(() =>
  buildFairMatchmakingResult(selectedPlayers.value, games.value, gameRecords.value),
)

const canAddMorePlayers = computed(() => selectedPlayers.value.length < 5)

function togglePlayer(playerName: string) {
  const isSelected = selectedPlayers.value.includes(playerName)
  if (isSelected) {
    if (selectedPlayers.value.length <= 3) return
    selectedPlayers.value = selectedPlayers.value.filter((n) => n !== playerName)
    return
  }
  if (!canAddMorePlayers.value) return
  selectedPlayers.value = [...selectedPlayers.value, playerName]
}

function isSelected(playerName: string) {
  return selectedPlayers.value.includes(playerName)
}

function isDisabled(playerName: string) {
  return !isSelected(playerName) && !canAddMorePlayers.value
}

function fmt(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(3).replace(/\.?0+$/, '')
}

function pct(value: number) {
  return Math.round(value * 100)
}

function fmtAdj(value: number) {
  return `${value > 0 ? '+' : ''}${fmt(value)}`
}

const artUrls = ref(new Map<string, string>())

watch(
  () => matchmaking.value?.suggestions?.map((s) => s.commander) ?? [],
  async (commanders) => {
    const names = commanders.filter(Boolean)
    if (!names.length) return
    await preloadCommanderImages(names, ['art_crop'])
    const next = new Map<string, string>()
    for (const name of names) {
      const url = getCachedCommanderImage(name, 'art_crop')
      if (url) next.set(name, url)
    }
    artUrls.value = next
  },
  { immediate: true },
)
</script>

<template>
  <div class="mm">
    <!-- Header -->
    <div class="mm__head">
      <div class="mm__title-block">
        <span class="mm__label">Matchmaking</span>
        <h2 class="mm__title">Fair Suggestions</h2>
      </div>
      <span class="mm__counter">{{ selectedPlayers.length }}<span class="mm__counter-max">/5</span></span>
    </div>

    <div v-if="loading" class="mm__notice">Loading…</div>
    <div v-else-if="error" class="mm__notice mm__notice--err">Failed to load data.</div>
    <div v-else-if="playerOptions.length === 0" class="mm__notice">No player records yet.</div>

    <template v-else>
      <!-- Player picker -->
      <div class="mm__picker">
        <button
          v-for="opt in playerOptions"
          :key="opt.name"
          type="button"
          class="mm__chip"
          :class="{
            'mm__chip--on': isSelected(opt.name),
            'mm__chip--off': isDisabled(opt.name),
          }"
          :disabled="isDisabled(opt.name)"
          @click="togglePlayer(opt.name)"
        >
          <span class="mm__chip-check" aria-hidden="true">{{ isSelected(opt.name) ? '✓' : '' }}</span>
          {{ opt.name }}
        </button>
      </div>

      <!-- Summary bar -->
      <div v-if="matchmaking" class="mm__bar">
        <div class="mm__bar-stat">
          <span class="mm__bar-val">{{ fmt(matchmaking.averageStrength) }}</span>
          <span class="mm__bar-key">Pod avg</span>
        </div>
        <div class="mm__bar-divider" />
        <div class="mm__bar-stat">
          <span class="mm__bar-val">{{ fmt(matchmaking.fairnessSpreadBefore) }}</span>
          <span class="mm__bar-key">Spread before</span>
        </div>
        <div class="mm__bar-divider" />
        <div class="mm__bar-stat">
          <span
            class="mm__bar-val mm__bar-val--after"
            :class="matchmaking.fairnessSpreadAfter < matchmaking.fairnessSpreadBefore ? 'mm__bar-val--good' : 'mm__bar-val--bad'"
          >{{ fmt(matchmaking.fairnessSpreadAfter) }}</span>
          <span class="mm__bar-key">Spread after</span>
        </div>
      </div>

      <!-- Suggestion cards -->
      <div v-if="matchmaking" class="mm__cards">
        <article
          v-for="s in matchmaking.suggestions"
          :key="s.playerName"
          class="mm__card"
          :data-tooltip="s.explanation"
        >
          <!-- Art panel -->
          <div class="mm__art">
            <img
              v-if="artUrls.get(s.commander)"
              :src="artUrls.get(s.commander)"
              :alt="s.commander"
              class="mm__art-img"
            />
            <div v-else class="mm__art-placeholder" />
            <div class="mm__art-scrim" />
          </div>

          <!-- Content -->
          <div class="mm__content">
            <div class="mm__content-top">
              <div>
                <div class="mm__player">{{ s.playerName }}</div>
                <div class="mm__commander">{{ s.commander }}</div>
              </div>
              <div
                class="mm__adj"
                :class="s.adjustment <= 0 ? 'mm__adj--down' : 'mm__adj--up'"
              >
                {{ fmtAdj(s.adjustment) }}
              </div>
            </div>

            <div class="mm__stats">
              <div class="mm__stat">
                <span class="mm__stat-v">{{ pct(s.commanderWinRate) }}%</span>
                <span class="mm__stat-k">Win rate</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(s.commanderAvgPoints) }}</span>
                <span class="mm__stat-k">Avg pts</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(s.commanderPlacement) }}</span>
                <span class="mm__stat-k">Avg place</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ s.commanderPlays }}</span>
                <span class="mm__stat-k">Plays</span>
              </div>
            </div>

            <div class="mm__sample">{{ pct(s.confidence) }}% sample confidence</div>
          </div>
        </article>
      </div>

      <div v-else class="mm__notice">Select 3–5 players to generate a matchup.</div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.mm {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  // ── Header ─────────────────────────────────────────────────────────────────

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-3;
  }

  &__label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: $color-primary-light;
    font-weight: $font-weight-semibold;
    margin-bottom: $spacing-1;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $color-text;
    margin: 0;
  }

  &__counter {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    line-height: 1;
    padding-top: 2px;
  }

  &__counter-max {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-weight: $font-weight-normal;
  }

  // ── Player picker ──────────────────────────────────────────────────────────

  &__picker {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__chip {
    appearance: none;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px $spacing-3;
    border-radius: $border-radius-full;
    border: 1px solid rgba($border-color, 0.9);
    background: rgba($color-bg-elevated, 0.5);
    color: $color-text-muted;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    cursor: pointer;
    transition: border-color $transition-fast, color $transition-fast, background $transition-fast;

    &:hover:not(:disabled) {
      border-color: rgba($color-primary-light, 0.4);
      color: $color-text;
    }

    &--on {
      border-color: $color-primary-light;
      background: rgba($color-primary, 0.22);
      color: $color-text;
    }

    &--off {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  &__chip-check {
    width: 12px;
    font-size: 10px;
    color: $color-primary-light;
    line-height: 1;
  }

  // ── Summary bar ────────────────────────────────────────────────────────────

  &__bar {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    padding: $spacing-3 $spacing-4;
    background: rgba($color-bg-elevated, 0.45);
    border: 1px solid rgba($border-color, 0.7);
    border-radius: $border-radius-lg;
  }

  &__bar-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  &__bar-divider {
    width: 1px;
    height: 28px;
    background: rgba($border-color, 0.7);
    flex-shrink: 0;
  }

  &__bar-val {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text;

    &--good { color: $color-success; }
    &--bad  { color: $color-danger; }
  }

  &__bar-key {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: $color-text-muted;
  }

  // ── Cards ──────────────────────────────────────────────────────────────────

  &__cards {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
  }

  &__card {
    position: relative;
    display: flex;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($border-color, 0.8);
    background: rgba(12, 10, 18, 0.85);
    transition: border-color $transition-fast, transform $transition-fast;

    &:hover {
      border-color: rgba($color-primary-light, 0.35);
      transform: translateY(-1px);
    }

    // tooltip bubble on card hover
    &[data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 0;
      right: 0;
      padding: $spacing-2 $spacing-3;
      border-radius: $border-radius-md;
      background: rgba(20, 16, 32, 0.97);
      border: 1px solid rgba($color-primary-light, 0.22);
      box-shadow: $shadow-lg;
      color: $color-text-muted;
      font-size: $font-size-xs;
      line-height: 1.55;
      white-space: normal;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity $transition-fast, transform $transition-fast;
    }

    &[data-tooltip]:hover::after {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // ── Art panel ──────────────────────────────────────────────────────────────

  &__art {
    flex-shrink: 0;
    width: 100px;
    position: relative;
    overflow: hidden;
    border-radius: $border-radius-lg 0 0 $border-radius-lg;
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
    min-height: 130px;
    background: linear-gradient(160deg, rgba($color-primary-dark, 0.4), rgba(0,0,0,0.6));
  }

  &__art-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, transparent 55%, rgba(12, 10, 18, 0.92));
  }

  // ── Content ────────────────────────────────────────────────────────────────

  &__content {
    flex: 1;
    min-width: 0;
    padding: $spacing-3;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__content-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__player {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: $font-weight-semibold;
  }

  &__commander {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-accent;
    line-height: 1.25;
    margin-top: 2px;
  }

  &__adj {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    padding: 2px 7px;
    border-radius: $border-radius-full;
    white-space: nowrap;
    flex-shrink: 0;

    &--up   { color: $color-success; background: rgba($color-success, 0.12); }
    &--down { color: $color-danger;  background: rgba($color-danger,  0.12); }
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-1;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px $spacing-1;
    background: rgba(0, 0, 0, 0.25);
    border-radius: $border-radius-sm;
  }

  &__stat-v {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__stat-k {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $color-text-muted;
  }

  &__sample {
    font-size: 9px;
    color: rgba($color-text-muted, 0.6);
    text-align: right;
  }

  // ── Notices ────────────────────────────────────────────────────────────────

  &__notice {
    padding: $spacing-6 $spacing-4;
    text-align: center;
    color: $color-text-muted;
    font-size: $font-size-sm;

    &--err { color: $color-danger; }
  }
}
</style>
