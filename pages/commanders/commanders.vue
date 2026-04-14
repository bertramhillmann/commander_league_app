<template>
  <div class="page commanders-page">
    <div class="commanders-page__header">
      <div>
        <h1 class="commanders-page__title">Commanders</h1>
        <p class="commanders-page__subtitle">League-wide commander performance across all players.</p>
      </div>

      <div class="commanders-page__controls">
        <div class="commanders-page__sort">
          <button
            v-for="option in sortOptions"
            :key="option.key"
            type="button"
            class="commanders-page__sort-btn"
            :class="{ 'commanders-page__sort-btn--active': sortKey === option.key }"
            @click="sortKey = option.key"
          >
            {{ option.label }}
          </button>
        </div>

        <button
          type="button"
          class="commanders-page__mode-btn"
          :class="{ 'commanders-page__mode-btn--active': leaderMode === 'pairing' }"
          @click="leaderMode = leaderMode === 'overall' ? 'pairing' : 'overall'"
        >
          {{ leaderMode === 'overall' ? 'View: All Players' : 'View: Best Pairing' }}
        </button>
      </div>
    </div>

    <div class="commanders-list">
      <div
        v-for="row in sortedCommanders"
        :key="row.name"
        class="commander-row"
      >
        <div
          class="commander-row__art"
          @mouseenter="onCardPreviewEnter(row.name, $event)"
          @mousemove="onCardPreviewMove($event)"
          @mouseleave="onCardPreviewLeave"
        >
          <img
            v-if="artUrls.get(row.name)"
            :src="artUrls.get(row.name)"
            :alt="row.name"
            class="commander-row__art-img"
          />
          <div v-else class="commander-row__art-placeholder" />
        </div>

        <div class="commander-row__body">
          <div class="commander-row__header">
            <NuxtLink
              class="commander-row__name"
              :to="`/commanders/${encodeURIComponent(row.name)}`"
            >
              {{ row.name }}
            </NuxtLink>

            <span v-if="row.tier" class="commander-row__tier">
              <IconsTierIcon :tier="row.tier" :size="13" />
              <span class="commander-row__tier-label" :class="`tier-text--${row.tier}`">
                {{ TIER_META[row.tier].label }}
              </span>
            </span>
          </div>

          <div class="commander-row__stats">
            <div class="commander-row__stat" :class="{ 'commander-row__stat--sorted': sortKey === 'plays' }">
              <span class="commander-row__stat-val">{{ displayPlays(row) }}</span>
              <span class="commander-row__stat-lbl">{{ leaderMode === 'overall' ? 'Plays' : 'Pairing Plays' }}</span>
            </div>
            <div class="commander-row__stat" :class="{ 'commander-row__stat--sorted': sortKey === 'winRate' }">
              <span class="commander-row__stat-val">{{ displayWinRate(row) }}%</span>
              <span class="commander-row__stat-lbl">Win %</span>
            </div>
            <div class="commander-row__stat" :class="{ 'commander-row__stat--sorted': sortKey === 'avgPoints' }">
              <span class="commander-row__stat-val commander-row__stat-val--secondary">{{ fmt(displayAvgPoints(row)) }}</span>
              <span class="commander-row__stat-lbl">Avg Pts</span>
            </div>
            <div class="commander-row__stat">
              <span class="commander-row__stat-val">{{ displayWins(row) }}</span>
              <span class="commander-row__stat-lbl">Wins</span>
            </div>
            <div class="commander-row__stat">
              <span class="commander-row__stat-val commander-row__stat-val--muted">{{ displayPlayers(row) }}</span>
              <span class="commander-row__stat-lbl">{{ leaderMode === 'overall' ? 'Players' : 'Player' }}</span>
            </div>
            <div class="commander-row__stat">
              <span class="commander-row__stat-val commander-row__stat-val--danger">{{ fmt(displayLPoints(row)) }}</span>
              <span class="commander-row__stat-lbl">L-Points</span>
            </div>
          </div>

          <div v-if="selectedLeader(row)" class="commander-row__leader">
            <div class="commander-row__leader-label">
              {{ leaderMode === 'overall' ? `Strongest Player by ${leaderLabel}` : 'Best Pairing Shown' }}
            </div>
            <div class="commander-row__leader-card">
              <NuxtLink
                class="commander-row__leader-name"
                :to="`/players/${encodeURIComponent(selectedLeader(row)!.playerName)}`"
              >
                {{ selectedLeader(row)!.playerName }}
              </NuxtLink>
              <span v-if="selectedLeader(row)!.tier" class="commander-row__leader-tier">
                <IconsTierIcon :tier="selectedLeader(row)!.tier!" :size="12" />
                <span class="commander-row__leader-tier-label" :class="`tier-text--${selectedLeader(row)!.tier}`">
                  {{ TIER_META[selectedLeader(row)!.tier!].label }}
                </span>
              </span>
              <span class="commander-row__leader-meta commander-row__leader-meta--emphasis">
                {{ leaderMode === 'overall' ? 'Best pairing for this commander' : metricsLabel(row) }}
              </span>
            </div>
            <div v-if="otherPlayers(row).length" class="commander-row__leader-others">
              <span class="commander-row__leader-others-label">Also played by</span>
              <span class="commander-row__leader-others-list">
                <template v-for="(player, index) in otherPlayers(row)" :key="player.playerName">
                  <NuxtLink
                    class="commander-row__leader-other-name"
                    :to="`/players/${encodeURIComponent(player.playerName)}`"
                  >
                    {{ player.playerName }}
                  </NuxtLink>
                  <span v-if="index < otherPlayers(row).length - 1" class="commander-row__leader-others-separator">, </span>
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="cardPreview.visible && previewUrls.get(cardPreview.name)"
      class="floating-panel"
      :style="{ top: `${cardPreview.y}px`, left: `${cardPreview.x}px` }"
    >
      <img
        :src="previewUrls.get(cardPreview.name)"
        :alt="cardPreview.name"
        class="card-preview__img"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { TIER_META, blendScore, getTier, computeGlobalCommanderBaseline, computePlayerCommanderTier, type Tier } from '~/utils/tiers'

type SortKey = 'plays' | 'winRate' | 'avgPoints'
type LeaderMode = 'overall' | 'pairing'

interface LeaderRow {
  playerName: string
  plays: number
  wins: number
  winRate: number
  avgPoints: number
  totalLPoints: number
  tier: Tier | null
}

interface CommanderRow {
  name: string
  gamesPlayed: number
  wins: number
  winRate: number
  avgPoints: number
  totalLPoints: number
  uniquePlayers: number
  tier: Tier | null
  leaders: LeaderRow[]
}

const { commanders, gameRecords } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'plays', label: 'Plays' },
  { key: 'winRate', label: 'Win %' },
  { key: 'avgPoints', label: 'Avg Pts' },
]

const sortKey = ref<SortKey>('plays')
const leaderMode = ref<LeaderMode>('overall')

const globalCommanderBaseline = computed(() =>
  computeGlobalCommanderBaseline(commanders.value),
)

const commanderRows = computed((): CommanderRow[] => {
  return Object.values(commanders.value)
    .filter((commander) => commander.gamesPlayed > 0)
    .map((commander) => {
      const avgPoints = commander.gamesPlayed > 0
        ? round3(commander.totalBasePoints / commander.gamesPlayed)
        : 0
      const winRate = commander.gamesPlayed > 0
        ? Math.round((commander.wins / commander.gamesPlayed) * 100)
        : 0
      const tier = getTier(
        blendScore(avgPoints, commander.gamesPlayed > 0 ? commander.wins / commander.gamesPlayed : 0),
        globalCommanderBaseline.value,
        commander.gamesPlayed,
      )

      const leaders = Object.entries(gameRecords.value)
        .map(([playerName, recordsByGame]) => {
          const records = Object.values(recordsByGame).filter((record) => record.commander === commander.name)
          if (records.length === 0) return null

          const plays = records.length
          const totalBasePoints = records.reduce((sum, record) => sum + record.basePoints, 0)
          const totalLPoints = round3(records.reduce((sum, record) => sum + record.lPoints, 0))
          const avgPoints = round3(totalBasePoints / plays)
          const { detail, context } = computePlayerCommanderTier(records, globalCommanderBaseline.value)
          const wins = context.wins
          const winRate = Math.round((wins / plays) * 100)

          return {
            playerName,
            plays,
            wins,
            winRate,
            avgPoints,
            totalLPoints,
            tier: detail?.tier ?? null,
          } satisfies LeaderRow
        })
        .filter((entry): entry is LeaderRow => !!entry)

      return {
        name: commander.name,
        gamesPlayed: commander.gamesPlayed,
        wins: commander.wins,
        winRate,
        avgPoints,
        totalLPoints: commander.totalLPoints,
        uniquePlayers: commander.uniquePlayers.length,
        tier,
        leaders,
      }
    })
})

const sortedCommanders = computed(() => {
  const rows = [...commanderRows.value]
  switch (sortKey.value) {
    case 'winRate':
      return rows.sort((a, b) =>
        displayWinRate(b) - displayWinRate(a) ||
        displayAvgPoints(b) - displayAvgPoints(a) ||
        displayPlays(b) - displayPlays(a) ||
        a.name.localeCompare(b.name),
      )
    case 'avgPoints':
      return rows.sort((a, b) =>
        displayAvgPoints(b) - displayAvgPoints(a) ||
        displayWinRate(b) - displayWinRate(a) ||
        displayPlays(b) - displayPlays(a) ||
        a.name.localeCompare(b.name),
      )
    default:
      return rows.sort((a, b) =>
        displayPlays(b) - displayPlays(a) ||
        displayAvgPoints(b) - displayAvgPoints(a) ||
        displayWinRate(b) - displayWinRate(a) ||
        a.name.localeCompare(b.name),
      )
  }
})

const leaderLabel = computed(() => {
  switch (sortKey.value) {
    case 'winRate': return 'Win %'
    case 'avgPoints': return 'Avg Pts'
    default: return 'Plays'
  }
})

const artUrls = ref(new Map<string, string>())
const previewUrls = ref(new Map<string, string>())

watch(
  () => commanderRows.value.map((row) => row.name),
  async (names) => {
    if (names.length === 0) return
    await preloadCommanderImages(names, ['art_crop', 'normal'])

    const nextArtUrls = new Map<string, string>()
    const nextPreviewUrls = new Map<string, string>()
    for (const name of names) {
      nextArtUrls.set(name, getCachedCommanderImage(name, 'art_crop') ?? '')
      nextPreviewUrls.set(name, getCachedCommanderImage(name, 'normal') ?? '')
    }
    artUrls.value = nextArtUrls
    previewUrls.value = nextPreviewUrls
  },
  { immediate: true },
)

function sortLeadersByMetric(a: LeaderRow, b: LeaderRow) {
  switch (sortKey.value) {
    case 'winRate':
      return b.winRate - a.winRate || b.avgPoints - a.avgPoints || b.plays - a.plays || a.playerName.localeCompare(b.playerName)
    case 'avgPoints':
      return b.avgPoints - a.avgPoints || b.winRate - a.winRate || b.plays - a.plays || a.playerName.localeCompare(b.playerName)
    default:
      return b.plays - a.plays || b.avgPoints - a.avgPoints || b.winRate - a.winRate || a.playerName.localeCompare(b.playerName)
  }
}

function selectedLeader(row: CommanderRow) {
  const leaders = [...row.leaders]
  if (leaders.length === 0) return null
  leaders.sort(sortLeadersByMetric)
  return leaders[0] ?? null
}

function otherPlayers(row: CommanderRow) {
  const leader = selectedLeader(row)
  if (!leader) return row.leaders
  return row.leaders.filter((entry) => entry.playerName !== leader.playerName)
}

function displayPlays(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? (selectedLeader(row)?.plays ?? row.gamesPlayed)
    : row.gamesPlayed
}

function displayWinRate(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? (selectedLeader(row)?.winRate ?? row.winRate)
    : row.winRate
}

function displayAvgPoints(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? (selectedLeader(row)?.avgPoints ?? row.avgPoints)
    : row.avgPoints
}

function displayWins(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? (selectedLeader(row)?.wins ?? row.wins)
    : row.wins
}

function displayPlayers(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? 1
    : row.uniquePlayers
}

function displayLPoints(row: CommanderRow) {
  return leaderMode.value === 'pairing'
    ? (selectedLeader(row)?.totalLPoints ?? row.totalLPoints)
    : row.totalLPoints
}

function metricsLabel(row: CommanderRow) {
  const leader = selectedLeader(row)
  if (!leader) return 'Best pairing for this commander'
  return `${leader.playerName}: ${leader.plays} plays · ${fmt(leader.avgPoints)} avg pts · ${leader.winRate}% wins`
}

function fmt(n: number) {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

const PREVIEW_OFFSET_X = 18
const PREVIEW_OFFSET_Y = 18

const cardPreview = reactive({
  visible: false,
  name: '',
  x: 0,
  y: 0,
})

function calcPreviewPosition(e: MouseEvent, width: number, height: number) {
  let x = e.clientX + PREVIEW_OFFSET_X
  let y = e.clientY + PREVIEW_OFFSET_Y
  if (x + width > window.innerWidth) x = e.clientX - width - PREVIEW_OFFSET_X
  if (y + height > window.innerHeight) y = e.clientY - height - PREVIEW_OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onCardPreviewEnter(name: string, e: MouseEvent) {
  cardPreview.name = name
  cardPreview.visible = true
  const pos = calcPreviewPosition(e, 260, 360)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
}

function onCardPreviewMove(e: MouseEvent) {
  if (!cardPreview.visible) return
  const pos = calcPreviewPosition(e, 260, 360)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
}

function onCardPreviewLeave() {
  cardPreview.visible = false
}
</script>

<style lang="scss" scoped>
.commanders-page {
  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-4;
    margin-bottom: $spacing-6;
    flex-wrap: wrap;
  }

  &__title {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    margin-bottom: $spacing-1;
  }

  &__subtitle {
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &__controls {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  &__sort {
    display: flex;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__sort-btn,
  &__mode-btn {
    padding: $spacing-1 $spacing-3;
    font-size: $font-size-xs;
    font-family: inherit;
    color: $color-text-muted;
    background: $color-bg-card;
    border: 1px solid $border-color;
    cursor: pointer;
    transition: color $transition-fast, background $transition-fast, border-color $transition-fast;
  }

  &__sort-btn {
    border-radius: $border-radius-full;

    &--active {
      color: $color-primary-light;
      background: rgba($color-primary, 0.15);
      border-color: rgba($color-primary, 0.5);
    }
  }

  &__mode-btn {
    border-radius: 4px;

    &--active {
      color: #d8b06a;
      border-color: rgba(196, 148, 72, 0.45);
      background: linear-gradient(180deg, rgba(30, 22, 18, 0.98), rgba(14, 10, 8, 0.98));
    }
  }
}

.commanders-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.commander-row {
  display: flex;
  gap: $spacing-4;
  background: $color-bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: border-color $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.4);
  }

  &__art {
    width: 138px;
    flex-shrink: 0;
    padding: $spacing-3 0 $spacing-3 $spacing-3;
    cursor: zoom-in;
  }

  &__art-img,
  &__art-placeholder {
    width: 100%;
    height: 138px;
    border-radius: $border-radius-md;
    display: block;
    object-fit: cover;
    object-position: center top;
    background: $color-bg-elevated;
  }

  &__body {
    flex: 1;
    min-width: 0;
    padding: $spacing-3 $spacing-4 $spacing-3 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
  }

  &__header {
    display: flex;
    align-items: baseline;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__tier {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__tier-label,
  &__leader-tier-label {
    font-size: $font-size-xs;
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

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 66px;
    padding: $spacing-2 $spacing-3;
    background: $color-bg-elevated;
    border: 1px solid $border-color;
    border-radius: $border-radius-md;

    &--sorted {
      background: rgba($color-primary, 0.12);
      border-color: rgba($color-primary, 0.4);

      .commander-row__stat-lbl {
        color: $color-primary-light;
      }
    }
  }

  &__stat-val {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;

    &--secondary { color: $color-secondary; }
    &--danger { color: $color-danger; }
    &--muted { color: $color-text-muted; }
  }

  &__stat-lbl {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  &__leader {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__leader-label {
    font-size: 10px;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }

  &__leader-card {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex-wrap: wrap;
    padding: $spacing-2 $spacing-3;
    background: rgba($color-bg-elevated, 0.8);
    border: 1px solid rgba($border-color, 0.82);
    border-radius: $border-radius-md;
  }

  &__leader-name {
    color: $color-text;
    font-weight: $font-weight-semibold;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__leader-tier {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__leader-meta {
    font-size: $font-size-xs;
    color: $color-text-muted;

    &--emphasis {
      color: $color-primary-light;
    }
  }

  &__leader-others {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: baseline;
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__leader-others-label {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__leader-others-list {
    color: $color-text-muted;
  }

  &__leader-other-name {
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__leader-others-separator {
    color: $color-text-muted;
  }
}

@media (max-width: 860px) {
  .commander-row {
    flex-direction: column;
    gap: 0;

    &__art {
      width: 100%;
      padding: $spacing-3 $spacing-3 0;
    }

    &__art-img,
    &__art-placeholder {
      height: 160px;
    }

    &__body {
      padding: $spacing-3;
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
