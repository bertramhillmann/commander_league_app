<template>
  <div class="xp-list">
    <div class="xp-list__header">
      <span class="xp-list__title">Commander XP</span>
      <span class="xp-list__total">{{ totalXpPoints }} pts</span>
    </div>

    <div class="xp-list__divider" />

    <div v-for="row in rows" :key="row.commander" class="xp-list__row">
      <div class="xp-list__art">
        <img v-if="artUrls.get(row.commander)" :src="artUrls.get(row.commander)" :alt="row.commander" class="xp-list__art-img" />
        <div v-else class="xp-list__art-placeholder" />
      </div>
      <div class="xp-list__info">
        <span class="xp-list__name">{{ row.commander }} <span class="xp-list__games">({{ row.games }})</span></span>
        <div class="xp-list__bar-wrap">
          <div class="xp-list__bar-fill" :style="{ width: `${row.progressPct}%` }" />
        </div>
      </div>
      <div class="xp-list__meta">
        <span class="xp-list__level">Lvl {{ row.level }}</span>
        <span class="xp-list__pts">+{{ row.level }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCommanderLevelProgress } from '~/utils/commanderExperience'

const props = defineProps<{ playerName: string }>()

const { players, gameRecords } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const gamesPerCommander = computed(() => {
  const counts: Record<string, number> = {}
  for (const record of Object.values(gameRecords.value[props.playerName] ?? {})) {
    counts[record.commander] = (counts[record.commander] ?? 0) + 1
  }
  return counts
})

const rows = computed(() => {
  const xpMap = players.value[props.playerName]?.commanderXP ?? {}
  return Object.entries(xpMap)
    .map(([commander, xp]) => {
      const { level, progressPct } = getCommanderLevelProgress(xp)
      return { commander, xp, level, progressPct, games: gamesPerCommander.value[commander] ?? 0 }
    })
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
})

const totalXpPoints = computed(() => rows.value.reduce((s, r) => s + r.level, 0))

// ── Art images ────────────────────────────────────────────────────────────────

const artUrls = ref(new Map<string, string>())

watch(
  rows,
  async (currentRows) => {
    const commanders = currentRows.map((row) => row.commander)
    await preloadCommanderImages(commanders, ['art_crop'])

    const nextArtUrls = new Map<string, string>()
    for (const commander of commanders) {
      nextArtUrls.set(commander, getCachedCommanderImage(commander, 'art_crop') ?? '')
    }

    artUrls.value = nextArtUrls
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.xp-list {
  width: 260px;
  max-height: 420px;
  overflow-y: auto;
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
    color: $color-primary-light;
  }

  &__divider {
    height: 1px;
    background: $border-color;
    margin-bottom: $spacing-2;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: 4px 0;

    & + & {
      border-top: 1px solid rgba($border-color, 0.4);
    }
  }

  &__art {
    flex-shrink: 0;
    width: 36px;
    height: 26px;
    border-radius: $border-radius-sm;
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

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  &__name {
    color: $color-text;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__games {
    color: $color-text-muted;
    font-size: 10px;
  }

  &__bar-wrap {
    height: 3px;
    background: $color-bg-card;
    border-radius: $border-radius-full;
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-xp-start, $color-xp-end);
    border-radius: $border-radius-full;
  }

  &__meta {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  &__level {
    color: $color-text-muted;
    white-space: nowrap;
  }

  &__pts {
    color: $color-primary-light;
    font-weight: $font-weight-semibold;
  }
}
</style>
