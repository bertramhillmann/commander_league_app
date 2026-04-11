<template>
  <div class="page page--dashboard">
    <h1 class="dashboard__title">Standings</h1>

    <table class="standings">
      <thead>
        <tr>
          <th class="standings__th standings__th--rank">#</th>
          <th class="standings__th standings__th--name">Player</th>
          <th class="standings__th standings__th--num" title="(Points + Achievement Points + Commander XP Points) × Performance Multiplier&#10;Multiplier rewards win rate and avg points per game relative to the league">Total</th>
          <th class="standings__th standings__th--num standings__th--mult" title="Performance multiplier applied to base score&#10;1.0 = league average · &gt;1.0 = above average · &lt;1.0 = below average">×Mult</th>
          <th class="standings__th standings__th--num">Points</th>
          <th class="standings__th standings__th--num">Achv. Pts</th>
          <th class="standings__th standings__th--num">XP Pts</th>
          <th class="standings__th standings__th--num">Games</th>
          <th class="standings__th standings__th--num">Win %</th>
          <th class="standings__th standings__th--num">Avg / Game</th>
          <th class="standings__th standings__th--commander">Top Commander</th>
          <th class="standings__th standings__th--num">L-Points</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table"
          :key="row.name"
          class="standings__row"
          :class="{ 'standings__row--top3': row.rank <= 3 }"
        >
          <td class="standings__td standings__td--rank">
            <span class="standings__rank" :class="`standings__rank--${row.rank}`">
              {{ rankLabel(row.rank) }}
            </span>
          </td>
          <td class="standings__td standings__td--name">
            <NuxtLink class="standings__player-link" :to="`/players/${encodeURIComponent(row.name)}`">{{ row.name }}</NuxtLink>
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
            @mouseenter="onAchvEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onAchvLeave"
          >{{ fmt(row.achievementPoints) }}</td>
          <td
            class="standings__td standings__td--num standings__td--xp standings__td--hoverable-xp"
            @mouseenter="onXpEnter(row.name, $event)"
            @mousemove="onMouseMove($event)"
            @mouseleave="onXpLeave"
          >{{ fmt(row.xpPoints) }}</td>
          <td class="standings__td standings__td--num">{{ row.gamesPlayed }}</td>
          <td class="standings__td standings__td--num">{{ row.winRate }}%</td>
          <td class="standings__td standings__td--num">{{ fmt(row.avgPerGame) }}</td>
          <td class="standings__td standings__td--commander">
            <NuxtLink
              v-if="row.topCommander"
              class="standings__commander-name"
              :to="`/commanders/${encodeURIComponent(row.topCommander!)}`"
              @mouseenter="onCommanderEnter(row.name, row.topCommander!, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onCommanderLeave"
            >
              <IconsTierIcon
                v-if="row.topCommanderTier"
                :tier="row.topCommanderTier"
                :size="12"
              />
              {{ row.topCommander }}
            </NuxtLink>
            <span v-else class="standings__muted">—</span>
          </td>
          <td class="standings__td standings__td--num standings__td--lp">{{ fmt(row.totalLPoints) }}</td>
        </tr>
      </tbody>
    </table>

    <Teleport to="body">
      <div
        v-if="hover.visible"
        class="floating-panel"
        :style="{ top: `${hover.y}px`, left: `${hover.x}px` }"
      >
        <GamesCommanderMetaInformation
          :player-name="hover.playerName"
          :commander-name="hover.commanderName"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="achvHover.visible"
        class="floating-panel"
        :style="{ top: `${achvHover.y}px`, left: `${achvHover.x}px` }"
      >
        <AchievementsAchievementList :player-name="achvHover.playerName" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="xpHover.visible"
        class="floating-panel"
        :style="{ top: `${xpHover.y}px`, left: `${xpHover.x}px` }"
      >
        <CommandersCommanderXPList :player-name="xpHover.playerName" />
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
import { computed, reactive } from 'vue'
import {
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
} from '~/utils/placements'

const { players, gameRecords, standings } = useLeagueState()

// ── Commander XP points: 1 pt per level per commander ────────────────────────

// ── Most played commander ─────────────────────────────────────────────────────

function topCommander(playerName: string): string | null {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (records.length === 0) return null
  const counts: Record<string, number> = {}
  for (const r of records) counts[r.commander] = (counts[r.commander] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ── Table rows ────────────────────────────────────────────────────────────────

const table = computed(() => {
  const allPlayers = standings.value

  // League average points per game (used to normalise avgPerGame in the multiplier)
  const totalGames  = allPlayers.reduce((s, p) => s + p.gamesPlayed, 0)
  const totalPoints = allPlayers.reduce((s, p) => s + p.totalPoints, 0)
  const leagueAvgPerGame = totalGames > 0 ? totalPoints / totalGames : 1

  return allPlayers.map((p) => {
    const avg = p.avgPerGame
    const winRate = p.gamesPlayed > 0
      ? Math.round((p.baseWins / p.gamesPlayed) * 100)
      : 0

    // Performance multiplier: average player (25 % wins, league-avg pts) → 1.0
    const winRateFraction = p.gamesPlayed > 0 ? p.baseWins / p.gamesPlayed : EXPECTED_WIN_RATE
    const avgFraction     = leagueAvgPerGame > 0 ? avg / leagueAvgPerGame : 1
    const winRateTerm     = r3(PERF_WIN_RATE_WEIGHT * (winRateFraction / EXPECTED_WIN_RATE))
    const avgTerm         = r3(PERF_AVG_WEIGHT * avgFraction)
    const multRaw         = r3(PERF_BASE_WEIGHT + winRateTerm + avgTerm)

    const tc = topCommander(p.name)
    return {
      rank: p.rank,
      name: p.name,
      totalScore: p.totalScore,
      totalPoints: p.totalPoints,
      achievementPoints: p.achievementPoints,
      xpPoints: p.xpPoints,
      gamesPlayed: p.gamesPlayed,
      winRate,
      avgPerGame: avg,
      leagueAvgPerGame: r3(leagueAvgPerGame),
      perfMult: p.perfMult,
      perfMultRaw: multRaw,
      winRateFraction: r3(winRateFraction),
      winRateTerm,
      avgFraction: r3(avgFraction),
      avgTerm,
      topCommander: tc,
      topCommanderTier: tc ? (players.value[p.name]?.commanderTiers?.[tc] ?? null) : null,
      totalLPoints: p.totalLPoints,
    }
  })
})

function r3(n: number): number { return Math.round(n * 1000) / 1000 }

function rankLabel(rank: number) {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `${rank}.`
}

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
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
  if (xpHover.visible) {
    const pos = calcXpPosition(e)
    xpHover.x = pos.x
    xpHover.y = pos.y
  }
  if (multHover.visible) {
    const pos = calcMultPosition(e)
    multHover.x = pos.x
    multHover.y = pos.y
  }
}

function onCommanderLeave() {
  hover.visible = false
}

// ── Achievement tooltip ───────────────────────────────────────────────────────

const achvHover = reactive({ visible: false, playerName: '', x: 0, y: 0 })

function calcAchvPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 220 > window.innerWidth) x = e.clientX - 220 - OFFSET_X
  if (y + 300 > window.innerHeight) y = e.clientY - 300 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onAchvEnter(playerName: string, e: MouseEvent) {
  achvHover.playerName = playerName
  achvHover.visible = true
  const pos = calcAchvPosition(e)
  achvHover.x = pos.x
  achvHover.y = pos.y
}

function onAchvLeave() {
  achvHover.visible = false
}

// ── XP tooltip ────────────────────────────────────────────────────────────────

const xpHover = reactive({ visible: false, playerName: '', x: 0, y: 0 })

function calcXpPosition(e: MouseEvent) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + 260 > window.innerWidth) x = e.clientX - 260 - OFFSET_X
  if (y + 420 > window.innerHeight) y = e.clientY - 420 - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onXpEnter(playerName: string, e: MouseEvent) {
  xpHover.playerName = playerName
  xpHover.visible = true
  const pos = calcXpPosition(e)
  xpHover.x = pos.x
  xpHover.y = pos.y
}

function onXpLeave() {
  xpHover.visible = false
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

function onMultEnter(row: (typeof table.value)[number], e: MouseEvent) {
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

function onMultLeave() {
  multHover.visible = false
}
</script>

<style lang="scss" scoped>
.dashboard__title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: $color-text;
  margin-bottom: $spacing-6;
}

.standings {
  width: 100%;
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
    &--commander { width: 180px; }
    &--mult { color: $color-text-muted; font-size: $font-size-xs; }
  }

  &__row {
    border-bottom: 1px solid rgba($border-color, 0.5);
    transition: background $transition-fast;

    &:hover {
      background: $color-bg-elevated;
    }

    &--top3 {
      background: rgba($color-primary, 0.04);
    }
  }

  &__td {
    padding: $spacing-2 $spacing-3;
    color: $color-text;
    vertical-align: middle;

    &--num { text-align: right; font-variant-numeric: tabular-nums; }
    &--rank { text-align: center; }
    &--total { font-weight: $font-weight-bold; color: $color-secondary; }
    &--achv  { color: $color-accent; }
    &--hoverable { cursor: default; text-decoration: underline dotted $color-accent; }
    &--hoverable-xp { cursor: default; text-decoration: underline dotted $color-primary-light; }
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
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__muted {
    color: $color-text-muted;
  }

  &__player-link {
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
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

  &__label--clamped {
    color: $color-accent;
  }
}
</style>
