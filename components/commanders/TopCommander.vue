<template>
  <section v-if="topEntry" class="top-commander">
    <article class="top-commander__hero">
      <div class="top-commander__art">
        <img
          v-if="artUrls[topEntry.commander]"
          :src="artUrls[topEntry.commander]"
          :alt="topEntry.commander"
          class="top-commander__art-img"
        />
        <div v-else class="top-commander__art-placeholder" />
        <div class="top-commander__art-overlay" />
      </div>

      <div class="top-commander__body">
        <div class="top-commander__eyebrow">Top Commander Pairing</div>
        <h2 class="top-commander__title">
          <NuxtLink class="top-commander__player" :to="`/players/${encodeURIComponent(topEntry.player)}`">
            {{ topEntry.player }}
          </NuxtLink>
          <span class="top-commander__title-sep">×</span>
          <NuxtLink class="top-commander__commander" :to="`/commanders/${encodeURIComponent(topEntry.commander)}`">
            {{ topEntry.commander }}
          </NuxtLink>
        </h2>
        <button
          type="button"
          class="top-commander__title-badge"
          @mouseenter="onTitleEnter(topEntry.title, $event)"
          @mousemove="onTitleMove($event)"
          @mouseleave="onTitleLeave"
        >
          {{ topEntry.title.name }}
        </button>

        <p class="top-commander__summary">
          Best-performing commander pairing in the league based on win rate, average points,
          and avoiding 0-point games.
        </p>

        <div class="top-commander__metrics">
          <div class="top-commander__metric">
            <span class="top-commander__metric-label">Record</span>
            <span class="top-commander__metric-value">
              {{ topEntry.plays }} games · {{ topEntry.wins }} wins
            </span>
          </div>
          <div class="top-commander__metric">
            <span class="top-commander__metric-label">Win Rate</span>
            <span class="top-commander__metric-value">
              {{ pct(topEntry.winRate) }}%
              <span class="top-commander__metric-delta top-commander__metric-delta--up">
                +{{ pct(topEntry.winRateDiff) }}% vs avg
              </span>
            </span>
          </div>
          <div class="top-commander__metric">
            <span class="top-commander__metric-label">Avg Points</span>
            <span class="top-commander__metric-value">
              {{ fmt(topEntry.avgPoints) }}
              <span
                class="top-commander__metric-delta"
                :class="topEntry.avgPointsDiff >= 0 ? 'top-commander__metric-delta--up' : 'top-commander__metric-delta--down'"
              >
                {{ topEntry.avgPointsDiff >= 0 ? '+' : '' }}{{ pct(topEntry.avgPointsDiff) }}% vs avg
              </span>
            </span>
          </div>
          <div class="top-commander__metric">
            <span class="top-commander__metric-label">0-Point Games</span>
            <span class="top-commander__metric-value">
              {{ pct(topEntry.zeroPointRate) }}%
              <span
                class="top-commander__metric-delta"
                :class="topEntry.zeroPointAvoidanceDiff >= 0 ? 'top-commander__metric-delta--up' : 'top-commander__metric-delta--down'"
              >
                {{ formatZeroPointDelta(topEntry.zeroPointAvoidanceDiff) }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </article>

    <div v-if="runnerUps.length > 0" class="top-commander__podium">
      <article
        v-for="(entry, index) in runnerUps"
        :key="`${entry.player}-${entry.commander}`"
        class="top-commander__runner"
      >
        <div
          class="top-commander__runner-art"
          @mouseenter="onPreviewEnter(entry.commander, $event)"
          @mousemove="onPreviewMove($event)"
          @mouseleave="onPreviewLeave"
        >
          <img
            v-if="artUrls[entry.commander]"
            :src="artUrls[entry.commander]"
            :alt="entry.commander"
            class="top-commander__runner-art-img"
          />
          <div v-else class="top-commander__runner-art-placeholder" />
        </div>
        <div class="top-commander__runner-rank">#{{ index + 2 }}</div>
        <div class="top-commander__runner-header">
          <NuxtLink class="top-commander__runner-player" :to="`/players/${encodeURIComponent(entry.player)}`">
            {{ entry.player }}
          </NuxtLink>
          <span class="top-commander__runner-sep">×</span>
          <NuxtLink class="top-commander__runner-commander" :to="`/commanders/${encodeURIComponent(entry.commander)}`">
            {{ entry.commander }}
          </NuxtLink>
        </div>
        <button
          type="button"
          class="top-commander__runner-title"
          @mouseenter="onTitleEnter(entry.title, $event)"
          @mousemove="onTitleMove($event)"
          @mouseleave="onTitleLeave"
        >
          {{ entry.title.name }}
        </button>

        <div class="top-commander__runner-stats">
          <span>{{ entry.plays }} games</span>
          <span>{{ pct(entry.winRate) }}% win</span>
          <span>{{ fmt(entry.avgPoints) }} avg pts</span>
          <span>{{ formatZeroPointDelta(entry.zeroPointAvoidanceDiff) }}</span>
        </div>
      </article>
    </div>
  </section>

  <Teleport to="body">
    <div
      v-if="preview.visible && previewUrls[preview.name]"
      class="floating-panel"
      :style="{ top: `${preview.y}px`, left: `${preview.x}px` }"
    >
      <img
        :src="previewUrls[preview.name]"
        :alt="preview.name"
        class="card-preview__img"
      />
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="titlePreview.visible && titlePreview.title"
      class="floating-panel"
      :style="{ top: `${titlePreview.y}px`, left: `${titlePreview.x}px` }"
    >
      <TitlesTitleMetaInformation :title="titlePreview.title" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { compareGamesChronological } from '~/composables/useLeagueState'
import { getCommanderPerformanceTitle, type CommanderTitleResult } from '~/utils/titles'

type PairStats = {
  player: string
  commander: string
  plays: number
  wins: number
  winRate: number
  avgPoints: number
  zeroPointRate: number
  score: number
  winRateDiff: number
  avgPointsDiff: number
  zeroPointAvoidanceDiff: number
  title: CommanderTitleResult
}

const { gameRecords, games, standings } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const artUrls = reactive<Record<string, string>>({})
const previewUrls = reactive<Record<string, string>>({})
const preview = reactive({
  visible: false,
  name: '',
  x: 0,
  y: 0,
})
const titlePreview = reactive<{
  visible: boolean
  title: CommanderTitleResult | null
  x: number
  y: number
}>({
  visible: false,
  title: null,
  x: 0,
  y: 0,
})

const PREVIEW_OFFSET_X = 18
const PREVIEW_OFFSET_Y = 18
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const allLeagueRecords = computed(() => Object.values(gameRecords.value).flatMap((records) => Object.values(records)))

const rankedEntries = computed<PairStats[]>(() => {
  const pairStats: PairStats[] = []
  const allRecords = allLeagueRecords.value
  if (allRecords.length === 0) return []

  const leagueWinRate = allRecords.filter((record) => record.placement === 1).length / allRecords.length
  const leagueAvgPoints = allRecords.reduce((sum, record) => sum + record.basePoints, 0) / allRecords.length
  const leagueZeroPointRate = allRecords.filter((record) => record.basePoints === 0).length / allRecords.length

  for (const [player, records] of Object.entries(gameRecords.value)) {
    const byCommander = new Map<string, typeof allRecords>()
    for (const record of Object.values(records)) {
      const current = byCommander.get(record.commander) ?? []
      current.push(record)
      byCommander.set(record.commander, current)
    }

    for (const [commander, commanderRecords] of byCommander.entries()) {
      const plays = commanderRecords.length
      const wins = commanderRecords.filter((record) => record.placement === 1).length
      const zeroPointGames = commanderRecords.filter((record) => record.basePoints === 0).length
      const winRate = wins / plays
      const avgPoints = commanderRecords.reduce((sum, record) => sum + record.basePoints, 0) / plays
      const zeroPointRate = zeroPointGames / plays

      const winRateRatio = leagueWinRate > 0 ? winRate / leagueWinRate : 1
      const avgPointsRatio = leagueAvgPoints > 0 ? avgPoints / leagueAvgPoints : 1
      const zeroPointAvoidance = 1 - zeroPointRate
      const leagueZeroPointAvoidance = 1 - leagueZeroPointRate
      const zeroPointRatio = leagueZeroPointAvoidance > 0 ? zeroPointAvoidance / leagueZeroPointAvoidance : 1
      const confidence = Math.min(1, plays / 5)
      const score = confidence * (
        (winRateRatio * 0.5) +
        (avgPointsRatio * 0.35) +
        (zeroPointRatio * 0.15)
      )

      pairStats.push({
        player,
        commander,
        plays,
        wins,
        winRate,
        avgPoints,
        zeroPointRate,
        score,
        winRateDiff: relativeDiff(winRate, leagueWinRate),
        avgPointsDiff: relativeDiff(avgPoints, leagueAvgPoints),
        zeroPointAvoidanceDiff: relativeDiff(zeroPointAvoidance, leagueZeroPointAvoidance),
        title: getCommanderPerformanceTitle({
          playerName: player,
          commanderName: commander,
          commanderRecords,
          playerRecords: Object.values(records),
          allRecords,
          games: chronologicalGames.value,
          standings: standings.value,
        }),
      })
    }
  }

  return pairStats.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.plays !== a.plays) return b.plays - a.plays
    return a.commander.localeCompare(b.commander)
  })
})

const topEntry = computed(() => rankedEntries.value[0] ?? null)
const runnerUps = computed(() => rankedEntries.value.slice(1, 3))

watch(
  rankedEntries,
  async (entries) => {
    const targets = entries.slice(0, 3).map((entry) => entry.commander)
    await preloadCommanderImages(targets, ['art_crop', 'normal'])

    for (const name of targets) {
      artUrls[name] = getCachedCommanderImage(name, 'art_crop') ?? ''
      previewUrls[name] = getCachedCommanderImage(name, 'normal') ?? ''
    }
  },
  { immediate: true },
)

function relativeDiff(value: number, baseline: number) {
  if (baseline <= 0) return 0
  return ((value - baseline) / baseline) * 100
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function pct(n: number) {
  return Math.round(n * 10) / 10
}

function formatZeroPointDelta(diff: number) {
  const rounded = pct(Math.abs(diff))
  if (diff >= 0) return `+${rounded}% fewer 0-point games`
  return `${rounded}% more 0-point games`
}

function calcPreviewPosition(e: MouseEvent, width: number, height: number) {
  let x = e.clientX + PREVIEW_OFFSET_X
  let y = e.clientY + PREVIEW_OFFSET_Y
  if (x + width > window.innerWidth) x = e.clientX - width - PREVIEW_OFFSET_X
  if (y + height > window.innerHeight) y = e.clientY - height - PREVIEW_OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onPreviewEnter(name: string, e: MouseEvent) {
  preview.name = name
  preview.visible = true
  const pos = calcPreviewPosition(e, 260, 364)
  preview.x = pos.x
  preview.y = pos.y
}

function onPreviewMove(e: MouseEvent) {
  if (!preview.visible) return
  const pos = calcPreviewPosition(e, 260, 364)
  preview.x = pos.x
  preview.y = pos.y
}

function onPreviewLeave() {
  preview.visible = false
}

function onTitleEnter(title: CommanderTitleResult, e: MouseEvent) {
  titlePreview.title = title
  titlePreview.visible = true
  const pos = calcPreviewPosition(e, 250, 180)
  titlePreview.x = pos.x
  titlePreview.y = pos.y
}

function onTitleMove(e: MouseEvent) {
  if (!titlePreview.visible) return
  const pos = calcPreviewPosition(e, 250, 180)
  titlePreview.x = pos.x
  titlePreview.y = pos.y
}

function onTitleLeave() {
  titlePreview.visible = false
}
</script>

<style lang="scss" scoped>
.top-commander {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  margin-top: $spacing-8;

  &__hero {
    display: grid;
    grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
    gap: $spacing-4;
    border: 1px solid rgba($color-primary-light, 0.18);
    border-radius: $border-radius-xl;
    overflow: hidden;
    background:linear-gradient(45deg, black, rgba(100,24,140,0.1));
    box-shadow:
      inset 0 0 0 1px rgba(255, 240, 214, 0.03),
      $shadow-lg;
  }

  &__art {
    position: relative;
    min-height: 240px;
    background: rgba($color-bg-elevated, 0.9);
  }

  &__art-img,
  &__art-placeholder {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
  }

  &__art-placeholder {
    background:
      radial-gradient(circle at top, rgba($color-primary-light, 0.18), transparent 40%),
      linear-gradient(180deg, rgba(57, 37, 23, 0.95), rgba(27, 18, 12, 0.98));
  }

  &__art-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(11, 8, 6, 0.02), rgba(11, 8, 6, 0.58)),
      linear-gradient(90deg, rgba(11, 8, 6, 0), rgba(11, 8, 6, 0.2));
  }

  &__body {
    padding: $spacing-6;
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    justify-content: center;
  }

  &__eyebrow {
    color: $color-primary-light;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
  }

  &__title {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    text-transform: none;
    gap: $spacing-2;
    font-size: $font-size-2xl;
    font-family: $font-family-display;
    color: $color-text;
  }

  &__player,
  &__commander,
  &__runner-player,
  &__runner-commander {
    color: $color-text;

    &:hover {
      color: $color-primary-light;
    }
  }

  &__title-sep,
  &__runner-sep {
    color: rgba($color-primary-light, 0.7);
  }

  &__summary {
    max-width: 60ch;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &__title-badge,
  &__runner-title {
    appearance: none;
    border: 1px solid rgba(196, 148, 72, 0.36);
    background:
      linear-gradient(180deg, rgba(28, 21, 17, 0.98), rgba(13, 10, 8, 0.98));
    padding: 4px 11px;
    font: inherit;
    color: #d8b06a;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: help;
    text-align: left;
    border-radius: 3px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 226, 160, 0.04),
      0 8px 18px rgba(0, 0, 0, 0.2);
  }

  &__title-badge {
    align-self: flex-start;
    justify-self: start;
    width: fit-content;
    max-width: 100%;
    font-size: 10px;
  }

  &__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-3;
  }

  &__metric {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    background: rgba(10,0,30,0.25);
    border: 1px solid rgba($border-color, 0.72);
  }

  &__metric-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: $color-text-muted;
  }

  &__metric-value {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
    align-items: baseline;
    font-size: $font-size-base;
    color: $color-text;
    font-weight: $font-weight-semibold;
  }

  &__metric-delta {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &--up { color: $color-success; }
    &--down { color: $color-danger; }
  }

  &__podium {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-4;
  }

  &__runner {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: start;
    column-gap: $spacing-3;
    row-gap: $spacing-2;
    padding: $spacing-4;
    border: 1px solid rgba($color-primary-light, 0.14);
    border-radius: $border-radius-lg;
    background:
      linear-gradient(180deg, rgba(10, 0, 14, 0.5), rgba(19, 14, 19, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(255, 240, 214, 0.025),
      $shadow-md;
  }

  &__runner-art {
    width: 100%;
    aspect-ratio: 1;
    border-radius: $border-radius-md;
    overflow: hidden;
    background: rgba($color-bg-elevated, 0.9);
    border: 1px solid rgba($color-primary-light, 0.12);
    cursor: zoom-in;
    grid-row: 1 / span 3;
  }

  &__runner-art-img,
  &__runner-art-placeholder {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
  }

  &__runner-art-placeholder {
    background:
      radial-gradient(circle at top, rgba($color-primary-light, 0.16), transparent 40%),
      linear-gradient(180deg, rgba(57, 37, 23, 0.95), rgba(27, 18, 12, 0.98));
  }

  &__runner-rank {
    grid-column: 2;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: $color-primary-light;
    font-weight: $font-weight-semibold;
  }

  &__runner-header {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-1;
    align-items: baseline;
    font-size: $font-size-lg;
  }

  &__runner-stats {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2 $spacing-3;
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__runner-title {
    grid-column: 2;
    justify-self: start;
    width: fit-content;
    max-width: 100%;
    font-size: 10px;
  }
}

@media (max-width: 900px) {
  .top-commander {
    &__hero {
      grid-template-columns: 1fr;
    }

    &__art {
      min-height: 180px;
    }

    &__metrics,
    &__podium {
      grid-template-columns: 1fr;
    }

    &__runner {
      grid-template-columns: 76px minmax(0, 1fr);
    }
  }
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}

.card-preview__img {
  width: 260px;
  border-radius: 14px;
  display: block;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}
</style>
