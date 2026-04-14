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
      <span class="cmd-meta__name">{{ playerName }} × {{ commanderName }}</span>
      <span class="cmd-meta__title">{{ commanderTitle.name }}</span>
      <span v-if="tierDetail" class="cmd-meta__tier">
        <UITierBadge :detail="tierDetail" :context="tierContext" />
      </span>
    </div>

    <div class="cmd-meta__divider" />

    <div class="cmd-meta__title-copy">
      <div class="cmd-meta__title-description">{{ commanderTitle.description }}</div>
      <div class="cmd-meta__title-reason">{{ commanderTitle.reason }}</div>
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
      {{ currentLevelXP }} / {{ levelSpanXP }} XP
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
import { computed, ref, watch } from 'vue'
import { compareGamesChronological } from '~/composables/useLeagueState'
import { computeGlobalCommanderBaseline, computePlayerCommanderTier, type TierDetail, type TierContext } from '~/utils/tiers'
import { getCommanderLevelProgress } from '~/utils/commanderExperience'
import { getCommanderPerformanceTitle } from '~/utils/titles'

const props = defineProps<{
  playerName: string
  commanderName: string
}>()

const { players, commanders, gameRecords, games, standings } = useLeagueState()
const { getCommanderImage } = useImageCache()

// ── Card image ─────────────────────────────────────────────────────────────────

const imageUrl = ref<string | null>(null)

watch(
  () => props.commanderName,
  async (name) => {
    imageUrl.value = await getCommanderImage(name, 'art_crop')
  },
  { immediate: true },
)

// ── Records (shared by tier + stats) ──────────────────────────────────────────

const commanderRecords = computed(() =>
  Object.values(gameRecords.value[props.playerName] ?? {}).filter(
    (r) => r.commander === props.commanderName,
  ),
)

// ── Tier ───────────────────────────────────────────────────────────────────────

const globalCommanderBaseline = computed(() =>
  computeGlobalCommanderBaseline(commanders.value),
)

const tierComputed = computed(() =>
  computePlayerCommanderTier(commanderRecords.value, globalCommanderBaseline.value),
)

const tierDetail = computed((): TierDetail | null => tierComputed.value.detail)
const tierContext = computed((): TierContext | undefined =>
  tierComputed.value.detail ? tierComputed.value.context : undefined,
)

const commanderTitle = computed(() =>
  getCommanderPerformanceTitle({
    playerName: props.playerName,
    commanderName: props.commanderName,
    commanderRecords: commanderRecords.value,
    playerRecords: Object.values(gameRecords.value[props.playerName] ?? {}),
    allRecords: Object.values(gameRecords.value).flatMap((entry) => Object.values(entry)),
    games: [...games.value].sort(compareGamesChronological),
    standings: standings.value,
  }),
)

// ── Level & XP progress ────────────────────────────────────────────────────────

const commanderXP = computed(
  () => players.value[props.playerName]?.commanderXP?.[props.commanderName] ?? 0,
)

const levelProgress = computed(() => getCommanderLevelProgress(commanderXP.value))
const level = computed(() => levelProgress.value.level)
const isMaxLevel = computed(() => levelProgress.value.isMaxLevel)
const currentLevelXP = computed(() => levelProgress.value.currentLevelXP)
const levelSpanXP = computed(() => levelProgress.value.levelSpanXP)
const progressPct = computed(() => levelProgress.value.progressPct)

// ── Game stats ─────────────────────────────────────────────────────────────────

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

  &__title {
    align-self: flex-start;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #d8b06a;
    border: 1px solid rgba(196, 148, 72, 0.36);
    border-radius: 3px;
    padding: 4px 11px;
    background:
      linear-gradient(180deg, rgba(29, 22, 18, 0.98), rgba(14, 10, 8, 0.98));
    box-shadow: inset 0 0 0 1px rgba(255, 224, 154, 0.04);
  }

  &__tier {
    display: flex;
    align-items: center;
    gap: 5px;
  }


  &__divider {
    height: 1px;
    background: $border-color;
    margin: $spacing-1 0;
  }

  &__title-copy {
    padding: 0 $spacing-3 $spacing-2;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title-description,
  &__title-reason {
    font-size: 10px;
    line-height: 1.45;
  }

  &__title-description {
    color: $color-text;
  }

  &__title-reason {
    color: $color-text-muted;
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
    background: linear-gradient(90deg, $color-xp-start, $color-xp-end);
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
