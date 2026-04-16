<template>
  <div class="page page--dashboard">
    <h1 class="dashboard__title">Standings</h1>

    <div class="standings-wrap">
    <table class="standings">
      <thead>
        <tr>
          <th class="standings__th standings__th--rank">#</th>
          <th class="standings__th standings__th--name">Player</th>
          <th class="standings__th standings__th--num" title="(Points + Achievement Points + Commander XP Points) × Performance Multiplier&#10;Multiplier rewards win rate and avg points per game relative to the league">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalScore')"
            >
              <span>Total</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalScore') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num standings__th--mult" title="Performance multiplier applied to base score&#10;1.0 = league average · &gt;1.0 = above average · &lt;1.0 = below average">×Mult</th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalPoints')"
            >
              <span>Points</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('achievementPoints')"
            >
              <span>Achv. Pts</span>
              <span class="standings__sort-indicator">{{ sortIndicator('achievementPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('xpPoints')"
            >
              <span>XP Pts</span>
              <span class="standings__sort-indicator">{{ sortIndicator('xpPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('gamesPlayed')"
            >
              <span>Games</span>
              <span class="standings__sort-indicator">{{ sortIndicator('gamesPlayed') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('winRate')"
            >
              <span>Win %</span>
              <span class="standings__sort-indicator">{{ sortIndicator('winRate') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('avgPerGame')"
            >
              <span>Avg / Game</span>
              <span class="standings__sort-indicator">{{ sortIndicator('avgPerGame') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--commander">Top Commander</th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="toggleSort('totalLPoints')"
            >
              <span>L-Points</span>
              <span class="standings__sort-indicator">{{ sortIndicator('totalLPoints') }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in table"
          :key="row.name"
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
    </div>

    <section
      v-if="featuredPlayer || loggedInArchEnemy"
      class="dashboard__spotlight"
      :class="{ 'dashboard__spotlight--no-art': !featuredPlayer }"
    >
      <div v-if="featuredPlayer" class="dashboard__spotlight-art">
        <img
          v-if="featuredPlayer.imageUrl"
          :src="featuredPlayer.imageUrl"
          :alt="featuredPlayer.name"
          class="dashboard__spotlight-art-img"
        />
        <div v-else class="dashboard__spotlight-art-placeholder">
          {{ featuredPlayer.initials }}
        </div>
        <div class="dashboard__spotlight-art-overlay" />
      </div>

      <div class="dashboard__spotlight-body">
        <div v-if="featuredPlayer" class="dashboard__spotlight-player">
          <div class="dashboard__spotlight-eyebrow">Featured Player</div>
          <NuxtLink
            class="dashboard__spotlight-name"
            :to="`/players/${encodeURIComponent(featuredPlayer.name)}`"
          >{{ featuredPlayer.name }}</NuxtLink>
          <div class="dashboard__spotlight-player-title">{{ featuredPlayer.title }}</div>
          <p class="dashboard__spotlight-summary">{{ featuredPlayer.summary }}</p>
          <ul class="dashboard__spotlight-reasons">
            <li
              v-for="reason in featuredPlayer.reasons"
              :key="reason"
              class="dashboard__spotlight-reason"
            >{{ reason }}</li>
          </ul>
        </div>

        <div v-if="honorableMentions.length" class="dashboard__spotlight-honorable">
          <div class="dashboard__spotlight-honorable-label">Honorable Mentions</div>
          <div class="dashboard__spotlight-honorable-list">
            <NuxtLink
              v-for="(player, index) in honorableMentions"
              :key="player.name"
              class="dashboard__spotlight-mention"
              :to="`/players/${encodeURIComponent(player.name)}`"
            >
              <div class="dashboard__spotlight-mention-rank">#{{ index + 2 }}</div>
              <div class="dashboard__spotlight-mention-header">
                <div class="dashboard__spotlight-mention-name">{{ player.name }}</div>
                <div class="dashboard__spotlight-mention-title">{{ player.title }}</div>
              </div>
              <div class="dashboard__spotlight-mention-stats">
                <span>{{ player.rankLabel }}</span>
                <span>{{ player.gamesPlayed }} games</span>
                <span>{{ player.winRate }}% win</span>
                <span>{{ fmt(player.avgPerGame) }} avg pts</span>
              </div>
              <p class="dashboard__spotlight-mention-summary">{{ player.summary }}</p>
            </NuxtLink>
          </div>
        </div>

        <div v-if="loggedInArchEnemy" class="dashboard__spotlight-aside">
          <div class="dashboard__spotlight-aside-label">Your Arch Enemy</div>
          <PlayersArchEnemyCard :summary="loggedInArchEnemy" />
        </div>
      </div>
    </section>

    <CommandersTopCommander />

    <h2 class="dashboard__subtitle">Player × Commander Pairings</h2>

    <div class="standings-wrap">
    <table class="standings">
      <thead>
        <tr>
          <th class="standings__th standings__th--rank">#</th>
          <th class="standings__th standings__th--name">Player × Commander</th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('totalScore')"
            >
              <span>Total</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('totalScore') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num standings__th--mult">×Mult</th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('totalPoints')"
            >
              <span>Points</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('totalPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('achievementPoints')"
            >
              <span>Achv. Pts</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('achievementPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('xpPoints')"
            >
              <span>XP Pts</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('xpPoints') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('gamesPlayed')"
            >
              <span>Games</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('gamesPlayed') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('totalLosses')"
            >
              <span>Losses</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('totalLosses') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('winRate')"
            >
              <span>Win %</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('winRate') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('avgPerGame')"
            >
              <span>Avg / Game</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('avgPerGame') }}</span>
            </button>
          </th>
          <th class="standings__th standings__th--num">
            <button
              type="button"
              class="standings__sort-button standings__sort-button--num"
              @click="togglePairingSort('totalLPoints')"
            >
              <span>L-Points</span>
              <span class="standings__sort-indicator">{{ pairingSortIndicator('totalLPoints') }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in pairingTable"
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
              <IconsTierIcon
                v-if="row.commanderTier"
                :tier="row.commanderTier"
                :size="12"
              />
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
        <AchievementsAchievementList
          :player-name="achvHover.playerName"
          :commander-name="achvHover.commanderName || undefined"
        />
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
import { computed, reactive, ref } from 'vue'
import { compareGamesChronological, getPlayerCommanderMetrics } from '~/composables/useLeagueState'
import { getArchEnemySummary } from '~/utils/archEnemy'
import { getFeaturedPlayers, type FeaturedPlayerCandidate } from '~/utils/featuredPlayer'
import { formatPlayerName } from '~/utils/playerNames'
import {
  EXPECTED_WIN_RATE,
  PERF_BASE_WEIGHT,
  PERF_WIN_RATE_WEIGHT,
  PERF_AVG_WEIGHT,
  PERF_MULT_MAX,
  PERF_MULT_MIN,
} from '~/utils/placements'
import { computeGlobalCommanderBaseline, computePlayerCommanderTier, type Tier } from '~/utils/tiers'

const { commanders, gameRecords, games, players, standings } = useLeagueState()
const { user, ensureSession } = useAuth()

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
const pairingSortKey = ref<SortKey>('totalScore')
const pairingSortDirection = ref<'desc' | 'asc'>('desc')
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const playerPortraitModules = import.meta.glob('../assets/img/*.png', { eager: true, import: 'default' })
const playerPortraits = Object.fromEntries(
  Object.entries(playerPortraitModules).map(([path, url]) => {
    const fileName = path.split('/').pop() ?? ''
    const key = fileName.replace(/\.png$/i, '').toLowerCase()
    return [key, url as string]
  }),
)
const gameOrderMap = computed(() =>
  new Map(chronologicalGames.value.map((game, index) => [game.gameId, index])),
)
const loggedInArchEnemy = computed(() => {
  if (!user.value) return null
  const playerName = formatPlayerName(user.value)
  if (!players.value[playerName]) return null
  return getArchEnemySummary(playerName, chronologicalGames.value, gameRecords.value)
})

onMounted(async () => {
  await ensureSession()
})

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

// ── Commander XP points: 1 pt per level per commander ────────────────────────

// ── Most played commander ─────────────────────────────────────────────────────

function topCommander(playerName: string): string | null {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (records.length === 0) return null
  const counts: Record<string, number> = {}
  for (const r of records) counts[r.commander] = (counts[r.commander] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

const globalCommanderBaseline = computed(() =>
  computeGlobalCommanderBaseline(commanders.value),
)

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

// ── Table rows ────────────────────────────────────────────────────────────────

const table = computed(() => {
  const allPlayers = standings.value

  // League average points per game (used to normalise avgPerGame in the multiplier)
  const totalGames  = allPlayers.reduce((s, p) => s + p.gamesPlayed, 0)
  const totalPoints = allPlayers.reduce((s, p) => s + p.totalPoints, 0)
  const leagueAvgPerGame = totalGames > 0 ? totalPoints / totalGames : 1

  const rows = allPlayers.map((p) => {
    const performance = buildPerformanceMetrics(
      p.totalPoints,
      p.gamesPlayed,
      p.baseWins,
      leagueAvgPerGame,
    )

    const tc = topCommander(p.name)
    return {
      rank: p.rank,
      name: p.name,
      totalScore: p.totalScore,
      totalPoints: p.totalPoints,
      achievementPoints: p.achievementPoints,
      xpPoints: p.xpPoints,
      gamesPlayed: p.gamesPlayed,
      winRate: performance.winRate,
      avgPerGame: performance.avgPerGame,
      leagueAvgPerGame: performance.leagueAvgPerGame,
      perfMult: performance.perfMult,
      perfMultRaw: performance.perfMultRaw,
      winRateFraction: performance.winRateFraction,
      winRateTerm: performance.winRateTerm,
      avgFraction: performance.avgFraction,
      avgTerm: performance.avgTerm,
      topCommander: tc,
      topCommanderTier: tc ? playerCommanderTier(p.name, tc) : null,
      totalLPoints: p.totalLPoints,
    }
  })

  return rows.sort((a, b) => {
    const direction = sortDirection.value === 'desc' ? -1 : 1
    const delta = a[sortKey.value] - b[sortKey.value]

    if (delta !== 0) return delta * direction

    return (a.rank - b.rank) * direction
  })
})

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
      const direction = pairingSortDirection.value === 'desc' ? -1 : 1
      const delta = a[pairingSortKey.value] - b[pairingSortKey.value]

      if (delta !== 0) return delta * direction

      return a.key.localeCompare(b.key) * direction
    })
    .map((row, index) => ({ ...row, rank: index + 1 }))
})

const featuredPlayers = computed<FeaturedPlayerCandidate[]>(() => {
  // Prefer players who have a portrait image
  const withImages = getFeaturedPlayers(gameRecords.value, gameOrderMap.value, {
    resolveImageUrl: getPlayerPortrait,
    requireImage: true,
  }, 3)
  if (withImages.length > 0) return withImages

  // Fall back to signal-based without image requirement
  const withoutImages = getFeaturedPlayers(gameRecords.value, gameOrderMap.value, {
    resolveImageUrl: getPlayerPortrait,
    requireImage: false,
  }, 3)
  if (withoutImages.length > 0) return withoutImages

  // Final fallback: current league leader with a generic highlight
  const leader = standings.value[0]
  if (!leader) return []
  return [{
    name: leader.name,
    imageUrl: getPlayerPortrait(leader.name),
    initials: leader.name.slice(0, 2).toUpperCase(),
    title: 'League Leader',
    summary: `${leader.name} sits at the top of the standings, currently leading the league.`,
    reasons: [
      `Ranked #1 with ${leader.gamesPlayed} game${leader.gamesPlayed === 1 ? '' : 's'} played.`,
    ],
    score: 0,
  }]
})

const featuredPlayer = computed<FeaturedPlayerCandidate | null>(() => featuredPlayers.value[0] ?? null)
const honorableMentions = computed(() =>
  featuredPlayers.value
    .slice(1, 3)
    .map((player) => {
      const standing = standings.value.find((entry) => entry.name === player.name)

      return {
        ...player,
        rank: standing ? standings.value.findIndex((entry) => entry.name === player.name) + 1 : null,
        rankLabel: standing ? `League #${standings.value.findIndex((entry) => entry.name === player.name) + 1}` : 'League spotlight',
        gamesPlayed: standing?.gamesPlayed ?? 0,
        winRate: standing?.gamesPlayed ? Math.round((standing.baseWins / standing.gamesPlayed) * 100) : 0,
        avgPerGame: standing?.gamesPlayed ? standing.totalPoints / standing.gamesPlayed : 0,
      }
    }),
)

function r3(n: number): number { return Math.round(n * 1000) / 1000 }

function getPlayerPortrait(playerName: string) {
  return playerPortraits[playerName.toLowerCase()] ?? ''
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }

  sortKey.value = key
  sortDirection.value = 'desc'
}

function sortIndicator(key: SortKey) {
  if (sortKey.value !== key) return '↕'
  return sortDirection.value === 'desc' ? '↓' : '↑'
}

function togglePairingSort(key: SortKey) {
  if (pairingSortKey.value === key) {
    pairingSortDirection.value = pairingSortDirection.value === 'desc' ? 'asc' : 'desc'
    return
  }

  pairingSortKey.value = key
  pairingSortDirection.value = 'desc'
}

function pairingSortIndicator(key: SortKey) {
  if (pairingSortKey.value !== key) return '↕'
  return pairingSortDirection.value === 'desc' ? '↓' : '↑'
}

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

.dashboard__subtitle {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $color-text;
  margin: $spacing-8 0 $spacing-4;
}

.dashboard__spotlight {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  margin: $spacing-8 0;
  border: 1px solid rgba($color-primary-light, 0.18);
  border-radius: $border-radius-xl;
  overflow: hidden;
  backdrop-filter: blur(3px);
  background: linear-gradient(45deg, black, rgba(100, 24, 140, 0.1));
  box-shadow:
    inset 0 0 0 1px rgba(255, 240, 214, 0.03),
    $shadow-lg;

  &--no-art {
    grid-template-columns: 1fr;
  }

  &-art {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: $spacing-3;
  }

  &-art-img {
    width: 100%;
    display: block;
    object-fit: cover;
    object-position: center top;
    border-radius: $border-radius-lg;
  }

  &-art-placeholder {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: grid;
    place-items: center;
    font-size: 1.8rem;
    font-weight: $font-weight-bold;
    letter-spacing: 0.08em;
    color: rgba($color-text, 0.9);
    border-radius: $border-radius-lg;
    background:
      radial-gradient(circle at top, rgba($color-primary-light, 0.18), transparent 55%),
      linear-gradient(180deg, rgba(22, 28, 38, 0.92), rgba(8, 11, 17, 0.96));
  }

  &-art-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(11, 8, 6, 0.02), rgba(11, 8, 6, 0.45)),
      linear-gradient(90deg, rgba(11, 8, 6, 0), rgba(11, 8, 6, 0.25));
  }

  &-body {
    padding: $spacing-4;
    display: flex;
    flex-direction: row;
    gap: $spacing-4;
    align-items: flex-start;
  }

  &-player {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-eyebrow {
    color: $color-primary-light;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
  }

  &-name {
    font-size: $font-size-xl;
    font-family: $font-family-display;
    font-weight: $font-weight-bold;
    line-height: 1;
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
    }
  }

  &-player-title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-secondary, 0.88);
  }

  &-summary {
    margin: 0;
    max-width: 60ch;
    color: $color-text-muted;
    font-size: $font-size-sm;
  }

  &-reasons {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: $spacing-3;
  }

  &-reason {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    background: rgba(10, 0, 30, 0.25);
    border: 1px solid rgba($border-color, 0.72);
    font-size: $font-size-sm;
    color: $color-text;
    font-weight: $font-weight-semibold;
    line-height: 1.4;
  }

  &-honorable {
    flex: 0 1 320px;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-honorable-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
    color: rgba($color-secondary, 0.8);
  }

  &-honorable-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &-mention {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: $spacing-3;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($color-primary-light, 0.16);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(7, 10, 16, 0.72);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.02),
      0 8px 24px rgba(0, 0, 0, 0.18);
    color: inherit;
    text-decoration: none;
    transition: border-color $transition-fast, transform $transition-fast, background $transition-fast, box-shadow $transition-fast;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba($color-primary-light, 0.34);
      background:
        linear-gradient(180deg, rgba($color-primary, 0.08), rgba(255, 255, 255, 0.03)),
        rgba(7, 10, 16, 0.78);
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.03),
        0 12px 28px rgba(0, 0, 0, 0.24);
    }
  }

  &-mention-rank {
    align-self: flex-start;
    font-size: 10px;
    font-weight: $font-weight-bold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba($color-primary-light, 0.88);
    background: rgba($color-primary, 0.14);
    border: 1px solid rgba($color-primary, 0.24);
    border-radius: $border-radius-full;
    padding: 3px 8px;
    line-height: 1;
  }

  &-mention-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &-mention-name {
    color: $color-text;
    font-weight: $font-weight-semibold;
    line-height: 1.1;
  }

  &-mention-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-primary-light, 0.78);
  }

  &-mention-summary {
    margin: 0;
    color: rgba($color-text-muted, 0.95);
    font-size: $font-size-xs;
    line-height: 1.45;
  }

  &-mention-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    span {
      font-size: 10px;
      color: rgba($color-text, 0.86);
      background: rgba($color-primary, 0.08);
      border: 1px solid rgba($color-primary-light, 0.14);
      border-radius: $border-radius-full;
      padding: 2px 8px;
      white-space: nowrap;
    }
  }

  &-aside {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: $spacing-1;
  }

  &-aside-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-weight: $font-weight-semibold;
    color: rgba($color-danger, 0.65);
  }

  :deep(.arch-enemy-card) {
    background: rgba(0, 0, 0, 0.25);
    align-items: flex-end;
  }
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
    &--commander { width: 180px; }
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

    &:hover {
      color: $color-text;
    }

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
      // background: $color-bg-elevated;
      background:rgba(16,16,16,0.35);
      backdrop-filter: blur(3px);
    }

    &--top3 {
      background: rgba($color-primary, 0.05);
    }

    &--top2 {
      background: rgba($color-primary, 0.1);
    }

    &--top1 {
      background: rgba($color-primary, 0.15);
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
      cursor:pointer;
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__muted {
    color: $color-text-muted;
  }

  &__pairing-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__pairing-separator {
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

@media (max-width: $breakpoint-md) {
  .dashboard__spotlight {
    grid-template-columns: 1fr;

    &-art {
      max-height: 120px;
      padding: $spacing-2 $spacing-3;
    }

    &-art-img {
      max-height: 100px;
      width: auto;
      max-width: 100%;
      margin: 0 auto;
    }

    &-body {
      flex-direction: column;
    }

    &-honorable {
      min-width: 0;
    }

    &-aside {
      align-items: flex-start;
    }
  }
}

@media (max-width: $breakpoint-sm) {
  .dashboard__title {
    font-size: $font-size-xl;
  }

  .dashboard__subtitle {
    font-size: $font-size-base;
  }

  .dashboard__spotlight {
    &-art {
      max-height: 90px;
    }

    &-art-img {
      max-height: 74px;
    }

    &-body {
      padding: $spacing-3;
    }

    &-reasons {
      grid-template-columns: 1fr;
    }

    &-name {
      font-size: $font-size-lg;
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
