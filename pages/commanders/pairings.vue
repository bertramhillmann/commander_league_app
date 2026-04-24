<template>
  <div class="page page--pairings">
    <h1 class="pairings__title">Player × Commander Pairings</h1>

    <div class="standings-wrap">
      <table class="standings">
        <thead>
          <tr>
            <th class="standings__th standings__th--rank">#</th>
            <th class="standings__th standings__th--name">Player × Commander</th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('totalScore')">
                <span>Total</span>
                <span class="standings__sort-indicator">{{ sortIndicator('totalScore') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num standings__th--mult">×Mult</th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('totalPoints')">
                <span>Points</span>
                <span class="standings__sort-indicator">{{ sortIndicator('totalPoints') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('achievementPoints')">
                <span>Achv. Pts</span>
                <span class="standings__sort-indicator">{{ sortIndicator('achievementPoints') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('xpPoints')">
                <span>XP Pts</span>
                <span class="standings__sort-indicator">{{ sortIndicator('xpPoints') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('gamesPlayed')">
                <span>Games</span>
                <span class="standings__sort-indicator">{{ sortIndicator('gamesPlayed') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('totalLosses')">
                <span>Losses</span>
                <span class="standings__sort-indicator">{{ sortIndicator('totalLosses') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('winRate')">
                <span>Win %</span>
                <span class="standings__sort-indicator">{{ sortIndicator('winRate') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('avgPerGame')">
                <span>Avg / Game</span>
                <span class="standings__sort-indicator">{{ sortIndicator('avgPerGame') }}</span>
              </button>
            </th>
            <th class="standings__th standings__th--num">
              <button type="button" class="standings__sort-button standings__sort-button--num" @click="toggleSort('totalLPoints')">
                <span>L-Points</span>
                <span class="standings__sort-indicator">{{ sortIndicator('totalLPoints') }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in paginatedTable"
            :key="row.key"
            class="standings__row"
            :class="{
              'standings__row--top1': row.rank === 1,
              'standings__row--top2': row.rank === 2,
              'standings__row--top3': row.rank === 3
            }"
          >
            <td class="standings__td standings__td--rank">
              <span class="standings__rank" :class="`standings__rank--${row.rank}`">
                {{ rankLabel(row.rank) }}
              </span>
            </td>
            <td class="standings__td standings__td--name">
              <div class="standings__pairing-name">
                <IconsTierIcon v-if="row.commanderTier" :tier="row.commanderTier" :size="12" />
                <NuxtLink class="standings__player-link" :to="`/players/${encodeURIComponent(row.playerName)}`">{{ row.playerName }}</NuxtLink>
                <span class="standings__pairing-separator">×</span>
                <NuxtLink
                  class="standings__commander-name"
                  :to="`/commanders/${encodeURIComponent(row.commanderName)}`"
                  @mouseenter="onCommanderEnter(row.playerName, row.commanderName, $event)"
                  @mousemove="onMouseMove($event)"
                  @mouseleave="onCommanderLeave"
                >
                  {{ row.commanderName }}
                </NuxtLink>
              </div>
            </td>
            <td class="standings__td standings__td--num standings__td--total">{{ fmt(row.totalScore) }}</td>
            <td
              class="standings__td standings__td--num standings__td--mult standings__td--hoverable-mult"
              @mouseenter="onMultEnter(row, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onMultLeave"
            >{{ fmt(row.perfMult) }}</td>
            <td class="standings__td standings__td--num">{{ fmt(row.totalPoints) }}</td>
            <td
              class="standings__td standings__td--num standings__td--achv standings__td--hoverable"
              @mouseenter="onAchvEnter(row.playerName, $event, row.commanderName)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onAchvLeave"
            >{{ fmt(row.achievementPoints) }}</td>
            <td class="standings__td standings__td--num standings__td--xp">{{ fmt(row.xpPoints) }}</td>
            <td class="standings__td standings__td--num">{{ row.gamesPlayed }}</td>
            <td class="standings__td standings__td--num">{{ row.totalLosses }}</td>
            <td class="standings__td standings__td--num">{{ row.winRate }}%</td>
            <td class="standings__td standings__td--num">{{ fmt(row.avgPerGame) }}</td>
            <td class="standings__td standings__td--num standings__td--lp">{{ fmt(row.totalLPoints) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pairings__pagination">
      <div class="pairings__pagination-bar">
        <button
          type="button"
          class="pairings__page-btn pairings__page-btn--nav"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >← Prev</button>

        <template v-for="(p, i) in pageNumbers" :key="i">
          <span v-if="typeof p !== 'number'" class="pairings__page-ellipsis">{{ p }}</span>
          <button
            v-else
            type="button"
            class="pairings__page-btn"
            :class="{ 'pairings__page-btn--active': p === currentPage }"
            @click="currentPage = p"
          >{{ p }}</button>
        </template>

        <button
          type="button"
          class="pairings__page-btn pairings__page-btn--nav"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >Next →</button>
      </div>
      <div class="pairings__page-count">
        {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, pairingTable.length) }} / {{ pairingTable.length }}
      </div>
    </div>

    <Teleport to="body">
      <div v-if="hover.visible" class="floating-panel" :style="{ top: `${hover.y}px`, left: `${hover.x}px` }">
        <GamesCommanderMetaInformation :player-name="hover.playerName" :commander-name="hover.commanderName" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="achvHover.visible" class="floating-panel" :style="{ top: `${achvHover.y}px`, left: `${achvHover.x}px` }">
        <AchievementsAchievementList :player-name="achvHover.playerName" :commander-name="achvHover.commanderName || undefined" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="multHover.visible"
        class="floating-panel mult-tooltip"
        :style="{ top: `${multHover.y}px`, left: `${multHover.x}px` }"
      >
        <div class="mult-tooltip__title">Performance ×Mult</div>
        <table class="mult-tooltip__table">
          <tr>
            <td class="mult-tooltip__label">Base</td>
            <td class="mult-tooltip__op"></td>
            <td class="mult-tooltip__detail"></td>
            <td class="mult-tooltip__value">{{ fmt(0.70) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Win rate</td>
            <td class="mult-tooltip__op">+</td>
            <td class="mult-tooltip__detail">0.15 × ({{ multHover.winRate }}% / 25%)</td>
            <td class="mult-tooltip__value">{{ fmt(multHover.winRateTerm) }}</td>
          </tr>
          <tr>
            <td class="mult-tooltip__label">Avg / game</td>
            <td class="mult-tooltip__op">+</td>
            <td class="mult-tooltip__detail">0.15 × ({{ fmt(multHover.avgPerGame) }} / {{ fmt(multHover.leagueAvgPerGame) }})</td>
            <td class="mult-tooltip__value">{{ fmt(multHover.avgTerm) }}</td>
          </tr>
          <tr class="mult-tooltip__row--sep">
            <td class="mult-tooltip__label">Raw</td>
            <td class="mult-tooltip__op">=</td>
            <td class="mult-tooltip__detail"></td>
            <td class="mult-tooltip__value">{{ fmt(multHover.perfMultRaw) }}</td>
          </tr>
          <tr v-if="multHover.perfMultRaw !== multHover.perfMult">
            <td class="mult-tooltip__label mult-tooltip__label--clamped">Clamped</td>
            <td class="mult-tooltip__op">→</td>
            <td class="mult-tooltip__detail mult-tooltip__label--clamped">range [0.5 – 1.5]</td>
            <td class="mult-tooltip__value mult-tooltip__label--clamped">{{ fmt(multHover.perfMult) }}</td>
          </tr>
        </table>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { getPlayerCommanderMetrics } from '~/composables/useLeagueState'
import {
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MAX,
  PERF_MULT_MIN,
} from '~/utils/placements'
import { computeGlobalCommanderBaseline, computePlayerCommanderTier, type Tier } from '~/utils/tiers'

const { commanders, gameRecords, players } = useLeagueState()

type SortKey =
  | 'totalScore'
  | 'totalPoints'
  | 'achievementPoints'
  | 'xpPoints'
  | 'gamesPlayed'
  | 'totalLosses'
  | 'winRate'
  | 'avgPerGame'
  | 'totalLPoints'

const sortKey = ref<SortKey>('totalScore')
const sortDirection = ref<'desc' | 'asc'>('desc')
const currentPage = ref(1)
const PAGE_SIZE = 15

const globalCommanderBaseline = computed(() => computeGlobalCommanderBaseline(commanders.value))

function playerCommanderTier(playerName: string, commanderName: string): Tier | null {
  const records = Object.values(gameRecords.value[playerName] ?? {}).filter(
    (record) => record.commander === commanderName,
  )
  const { detail } = computePlayerCommanderTier(records, globalCommanderBaseline.value)
  return detail?.tier ?? null
}

function buildPerformanceMetrics(totalPoints: number, gamesPlayed: number, baseWins: number, leagueAvgPerGame: number) {
  const avgPerGame = gamesPlayed > 0 ? r3(totalPoints / gamesPlayed) : 0
  const winRate = gamesPlayed > 0 ? Math.round((baseWins / gamesPlayed) * 100) : 0
  const winRateFraction = gamesPlayed > 0 ? baseWins / gamesPlayed : EXPECTED_WIN_RATE
  const avgFraction = leagueAvgPerGame > 0 ? avgPerGame / leagueAvgPerGame : 1
  const winRateTerm = r3(PERF_WIN_RATE_WEIGHT * (winRateFraction / EXPECTED_WIN_RATE))
  const avgTerm = r3(PERF_AVG_WEIGHT * avgFraction)
  const perfMultRaw = r3(PERF_BASE_WEIGHT + winRateTerm + avgTerm)
  const perfMult = gamesPlayed > 0
    ? r3(Math.min(PERF_MULT_MAX, Math.max(PERF_MULT_MIN, perfMultRaw)))
    : 1

  return {
    avgPerGame,
    winRate,
    winRateFraction: r3(winRateFraction),
    avgFraction: r3(avgFraction),
    winRateTerm,
    avgTerm,
    perfMultRaw,
    perfMult,
    leagueAvgPerGame: r3(leagueAvgPerGame),
  }
}

const pairingTable = computed(() => {
  const rows = Object.entries(gameRecords.value).flatMap(([playerName, recordsMap]) => {
    const byCommander = new Set(Object.values(recordsMap).map((record) => record.commander))

    return Array.from(byCommander).flatMap((commanderName) => {
      const metrics = getPlayerCommanderMetrics(playerName, commanderName, gameRecords.value, players.value)
      if (!metrics) return []

      return {
        key: `${playerName}::${commanderName}`,
        playerName,
        commanderName,
        commanderTier: playerCommanderTier(playerName, commanderName),
        totalPoints: metrics.totalFinalPoints,
        achievementPoints: metrics.achievementPoints,
        xpPoints: metrics.xpPoints,
        gamesPlayed: metrics.plays,
        totalLosses: metrics.totalLosses,
        baseWins: metrics.first,
        totalLPoints: metrics.totalLPoints,
      }
    })
  })

  const totalGames = rows.reduce((sum, row) => sum + row.gamesPlayed, 0)
  const totalPoints = rows.reduce((sum, row) => sum + row.totalPoints, 0)
  const leagueAvgPerGame = totalGames > 0 ? totalPoints / totalGames : 1

  const enrichedRows = rows.map((row) => {
    const performance = buildPerformanceMetrics(
      row.totalPoints,
      row.gamesPlayed,
      row.baseWins,
      leagueAvgPerGame,
    )
    const totalScore = r3((row.totalPoints + row.achievementPoints + row.xpPoints) * performance.perfMult)

    return {
      ...row,
      totalScore,
      winRate: performance.winRate,
      avgPerGame: performance.avgPerGame,
      leagueAvgPerGame: performance.leagueAvgPerGame,
      perfMult: performance.perfMult,
      perfMultRaw: performance.perfMultRaw,
      winRateFraction: performance.winRateFraction,
      winRateTerm: performance.winRateTerm,
      avgFraction: performance.avgFraction,
      avgTerm: performance.avgTerm,
    }
  })

  return enrichedRows
    .sort((a, b) => {
      const direction = sortDirection.value === 'desc' ? -1 : 1
      const delta = a[sortKey.value] - b[sortKey.value]

      if (delta !== 0) return delta * direction

      return a.key.localeCompare(b.key) * direction
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))
})

const totalPages = computed(() => Math.max(1, Math.ceil(pairingTable.value.length / PAGE_SIZE)))

const paginatedTable = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return pairingTable.value.slice(start, start + PAGE_SIZE)
})

const pageNumbers = computed((): (number | '…')[] => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '…')[] = [1]
  if (current > 3) pages.push('…')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('…')
  pages.push(total)
  return pages
})

function r3(n: number): number { return Math.round(n * 1000) / 1000 }

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function rankLabel(rank: number) {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDirection.value = 'desc'
  }
  currentPage.value = 1
}

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'desc' ? '↓' : '↑'
}

// ── Commander tooltip ─────────────────────────────────────────────────────────

const OFFSET_X = 16
const OFFSET_Y = 16

const hover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })

function calcPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - OFFSET_X
  if (y + 380 > window.innerHeight) y = e.clientY - 380 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onCommanderEnter(playerName: string, commanderName: string, e: MouseEvent) {
  hover.playerName = playerName
  hover.commanderName = commanderName
  hover.visible = true
  const pos = calcPosition(e)
  hover.x = pos.x
  hover.y = pos.y
}

function onCommanderLeave() { hover.visible = false }

// ── Achievement tooltip ───────────────────────────────────────────────────────

const achvHover = reactive({ visible: false, playerName: '', commanderName: '', x: 0, y: 0 })

function calcAchvPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 220 > window.innerWidth) x = e.clientX - 220 - OFFSET_X
  if (y + 300 > window.innerHeight) y = e.clientY - 300 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onAchvEnter(playerName: string, e: MouseEvent, commanderName = '') {
  achvHover.playerName = playerName
  achvHover.commanderName = commanderName
  achvHover.visible = true
  const pos = calcAchvPosition(e)
  achvHover.x = pos.x
  achvHover.y = pos.y
}

function onAchvLeave() {
  achvHover.visible = false
  achvHover.commanderName = ''
}

// ── Mult tooltip ──────────────────────────────────────────────────────────────

type MultHoverData = {
  visible: boolean
  x: number
  y: number
  winRate: number
  winRateFraction: number
  winRateTerm: number
  avgPerGame: number
  leagueAvgPerGame: number
  avgFraction: number
  avgTerm: number
  perfMultRaw: number
  perfMult: number
}

type MultRow = {
  winRate: number
  winRateFraction: number
  winRateTerm: number
  avgPerGame: number
  leagueAvgPerGame: number
  avgFraction: number
  avgTerm: number
  perfMultRaw: number
  perfMult: number
}

const multHover = reactive<MultHoverData>({
  visible: false,
  x: 0, y: 0,
  winRate: 0,
  winRateFraction: 0,
  winRateTerm: 0,
  avgPerGame: 0,
  leagueAvgPerGame: 0,
  avgFraction: 0,
  avgTerm: 0,
  perfMultRaw: 0,
  perfMult: 1,
})

function calcMultPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 240 > window.innerWidth) x = e.clientX - 240 - OFFSET_X
  if (y + 200 > window.innerHeight) y = e.clientY - 200 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onMultEnter(row: MultRow, e: MouseEvent) {
  multHover.visible = true
  multHover.winRate = row.winRate
  multHover.winRateFraction = row.winRateFraction
  multHover.winRateTerm = row.winRateTerm
  multHover.avgPerGame = row.avgPerGame
  multHover.leagueAvgPerGame = row.leagueAvgPerGame
  multHover.avgFraction = row.avgFraction
  multHover.avgTerm = row.avgTerm
  multHover.perfMultRaw = row.perfMultRaw
  multHover.perfMult = row.perfMult
  const pos = calcMultPosition(e)
  multHover.x = pos.x
  multHover.y = pos.y
}

function onMultLeave() { multHover.visible = false }

function onMouseMove(e: MouseEvent) {
  if (hover.visible) {
    const pos = calcPosition(e)
    hover.x = pos.x
    hover.y = pos.y
  }
  if (achvHover.visible) {
    const pos = calcAchvPosition(e)
    achvHover.x = pos.x
    achvHover.y = pos.y
  }
  if (multHover.visible) {
    const pos = calcMultPosition(e)
    multHover.x = pos.x
    multHover.y = pos.y
  }
}
</script>

<style lang="scss" scoped>
.pairings__title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: $color-text;
  margin-bottom: $spacing-6;
}

.standings-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.standings {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border-collapse: collapse;
  font-size: $font-size-sm;

  &__th {
    text-align: left;
    padding: $spacing-2 $spacing-3;
    color: $color-text-muted;
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-weight: $font-weight-medium;
    border-bottom: 1px solid $border-color;
    white-space: nowrap;

    &--num  { text-align: right; }
    &--rank { width: 2.5rem; text-align: center; }
    &--mult { color: $color-text-muted; font-size: $font-size-xs; }
  }

  &__sort-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: pointer;

    &:hover { color: $color-text; }

    &--num {
      width: 100%;
      justify-content: flex-end;
    }
  }

  &__sort-indicator {
    min-width: 10px;
    color: $color-primary-light;
    text-align: center;
  }

  &__row {
    border-bottom: 1px solid rgba($border-color, 0.5);
    transition: background $transition-fast;

    &:hover {
      background: rgba(16, 16, 16, 0.35);
      backdrop-filter: blur(3px);
    }

    &--top3 { background: rgba($color-primary, 0.05); }
    &--top2 { background: rgba($color-primary, 0.1); }
    &--top1 { background: rgba($color-primary, 0.15); }
  }

  &__td {
    padding: $spacing-2 $spacing-3;
    color: $color-text;
    vertical-align: middle;

    &--num  { text-align: right; font-variant-numeric: tabular-nums; }
    &--rank { text-align: center; }
    &--total { font-weight: $font-weight-bold; color: $color-secondary; }
    &--achv  { color: $color-accent; }
    &--hoverable { cursor: default; text-decoration: underline dotted $color-accent; }
    &--xp    { color: $color-primary-light; }
    &--lp    { color: $color-danger; }
    &--mult  { color: $color-text-muted; font-size: $font-size-xs; }
    &--hoverable-mult { cursor: default; text-decoration: underline dotted $color-text-muted; }
  }

  &__rank {
    font-size: $font-size-base;
    &--1, &--2, &--3 { font-size: $font-size-base; }
  }

  &__commander-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: default;
    white-space: nowrap;

    &:hover {
      cursor: pointer;
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__pairing-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__pairing-separator { color: $color-text-muted; }

  &__player-link {
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }
}

.pairings__pagination {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-3;
  margin-top: $spacing-8;
  padding: $spacing-4 $spacing-6;
  backdrop-filter: blur(6px);
}

.pairings__pagination-bar {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  flex-wrap: wrap;
  justify-content: center;
}

.pairings__page-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 $spacing-2;
  border-radius: $border-radius-md;
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($color-bg-card, 0.52);
  color: $color-text-muted;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: color $transition-fast, border-color $transition-fast, background $transition-fast, box-shadow $transition-fast;

  &:hover:not(:disabled) {
    color: $color-accent;
    border-color: rgba($color-accent, 0.4);
    background: rgba($color-bg-elevated, 0.78);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  &--active {
    color: $color-accent;
    border-color: rgba($color-accent, 0.6);
    background: rgba($color-accent, 0.12);
    box-shadow: 0 0 10px rgba($color-accent, 0.2);
  }

  &--nav {
    padding: 0 $spacing-3;
    font-size: $font-size-xs;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
}

.pairings__page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 36px;
  color: $color-text-muted;
  font-size: $font-size-sm;
  user-select: none;
}

.pairings__page-count {
  font-size: $font-size-sm;
  font-variant-numeric: tabular-nums;
  color: $color-text-muted;
  letter-spacing: 0.03em;
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}

.mult-tooltip {
  background: $color-bg-elevated;
  border: 1px solid $border-color;
  border-radius: $border-radius-md;
  padding: $spacing-3;
  min-width: 220px;

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: $spacing-2;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: $font-size-xs;
  }

  &__label {
    color: $color-text-muted;
    padding: 2px 0;
    white-space: nowrap;
  }

  &__op {
    color: $color-text-muted;
    text-align: center;
    padding: 0 $spacing-1;
  }

  &__detail {
    color: $color-text-muted;
    padding: 0 $spacing-2;
    font-variant-numeric: tabular-nums;
  }

  &__value {
    text-align: right;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    font-weight: $font-weight-medium;
    padding-left: $spacing-2;
  }

  &__row--sep td {
    border-top: 1px solid $border-color;
    padding-top: $spacing-1;
    color: $color-text;
    font-weight: $font-weight-bold;
  }

  &__label--clamped { color: $color-accent; }
}
</style>
