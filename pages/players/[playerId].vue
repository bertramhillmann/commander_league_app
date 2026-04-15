<template>
  <div class="page page--player">
    <NuxtLink class="player__back" to="/">← Standings</NuxtLink>

    <template v-if="player">
      <h1 class="player__title">{{ displayPlayerName }}</h1>

      <div class="player__placement-overview">
        <div class="player__placement-cards">
          <div class="player__placement-card player__placement-card--current">
            <span class="player__placement-rank">#{{ currentLeagueRank }}</span>
            <span class="player__placement-label">League Standing</span>
            <span class="player__placement-meta">out of {{ standings.length }} players</span>
          </div>

          <div
            class="player__placement-card player__placement-card--prognosis"
            @mouseenter="onPrognosisEnter($event)"
            @mousemove="onPrognosisMove($event)"
            @mouseleave="onPrognosisLeave"
          >
            <template v-if="placementPrognosis.hasEnoughData && placementPrognosis.segments">
              <span class="player__placement-rank">#{{ placementPrognosis.projectedRank }}</span>
              <span class="player__placement-label">Prognosis</span>
              <div class="player__placement-breakdown">
                <span class="player__placement-breakdown-chip">Weighted <strong>{{ fmt(placementPrognosis.weightedRating ?? 0) }}</strong></span>
                <span class="player__placement-breakdown-chip">L10 <strong>{{ fmt(placementPrognosis.segments.last10.rating) }}</strong></span>
                <span class="player__placement-breakdown-chip">L20 <strong>{{ fmt(placementPrognosis.segments.last20.rating) }}</strong></span>
                <span class="player__placement-breakdown-chip">All <strong>{{ fmt(placementPrognosis.segments.overall.rating) }}</strong></span>
              </div>
            </template>
            <template v-else>
              <span class="player__placement-label">Prognosis</span>
              <span class="player__placement-message">not enough data</span>
            </template>
          </div>

          <div
            v-if="placementPrognosis.hasEnoughData && placementPrognosis.commanderSuggestions?.length > 0"
            class="player__placement-picks"
          >
            <div class="player__placement-picks-label">Suggested Picks</div>
            <div class="player__placement-picks-list">
              <button
                v-for="suggestion in placementPrognosis.commanderSuggestions"
                :key="suggestion.commander"
                type="button"
                class="player__placement-pick"
                @mouseenter="onPlacementPickEnter(suggestion, $event)"
                @mousemove="onPlacementPickMove($event)"
                @mouseleave="onPlacementPickLeave"
              >
                <img
                  v-if="artUrls.get(suggestion.commander)"
                  :src="artUrls.get(suggestion.commander)"
                  :alt="suggestion.commander"
                  class="player__placement-pick-art"
                />
                <div v-else class="player__placement-pick-art player__placement-pick-art--empty" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="playerSuggestion" class="player__focus-tip">
          <span class="player__focus-tip-label">Focus Tip</span>
          <div class="player__focus-tip-title">{{ playerSuggestion.title }}</div>
          <p class="player__focus-tip-summary">{{ playerSuggestion.summary }}</p>
          <ul class="player__focus-tip-reasons">
            <li
              v-for="reason in playerSuggestion.reasons"
              :key="reason"
              class="player__focus-tip-reason"
            >
              {{ reason }}
            </li>
          </ul>
        </div>
      </div>

      <div class="player__stats">
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--total" :title="'Points + Achievement Points + XP Points'">
            {{ fmt(totalScore) }}
          </span>
          <span class="player__stat-lbl">Total Score</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val">{{ fmt(player.totalPoints) }}</span>
          <span class="player__stat-lbl">Points</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--achv">{{ fmt(player.achievementPoints) }}</span>
          <span class="player__stat-lbl">Achv. Pts</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--xp">{{ fmt(xpPts) }}</span>
          <span class="player__stat-lbl">XP Pts</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val">{{ player.gamesPlayed }}</span>
          <span class="player__stat-lbl">Games</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val">{{ winRate }}%</span>
          <span class="player__stat-lbl">Win %</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val">{{ fmt(avgPerGame) }}</span>
          <span class="player__stat-lbl">Avg / Game</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--lp">{{ fmt(player.totalLPoints) }}</span>
          <span class="player__stat-lbl">L-Points</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--muted">{{ uniqueCommandersCount }}</span>
          <span class="player__stat-lbl">Commanders</span>
        </div>
        <div class="player__stat">
          <span class="player__stat-val player__stat-val--muted">{{ fmt(avgPlacementOverall) }}</span>
          <span class="player__stat-lbl">Avg Place</span>
        </div>
      </div>

      <div v-if="leagueTimeline.length > 0" class="player__league-panel">
        <div class="player__league-chart">
          <ChartsLeagueRankTimeline :points="leagueTimeline" />
        </div>

        <div v-if="playerAchievements.length > 0" class="player__league-achievements">
          <div class="player__league-achievements-title">Player Achievements</div>
          <div class="player__league-achievements-list">
            <button
              v-for="achievement in playerAchievements"
              :key="achievement.id"
              type="button"
              class="mini-ach"
              :class="`mini-ach--rarity-${getAchievementRarityClass(achievement.id)}`"
              @mouseenter="onAchievementEnter(achievement.id, $event)"
              @mousemove="onAchievementMove($event)"
              @mouseleave="onAchievementLeave"
            >
              <span class="mini-ach__icon">{{ achievement.icon }}</span>
              <span class="mini-ach__name">{{ achievement.name }}</span>
              <div class="mini-ach__footer">
                <span class="mini-ach__pts">+{{ fmtAchPts(achievement.points) }} pts</span>
                <span v-if="achievement.count > 1" class="mini-ach__count">×{{ achievement.count }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Commanders ──────────────────────────────────────── -->
      <div class="player__section">
        <div class="player__section-header">
          <h2 class="player__section-title">Commanders</h2>
          <div class="player__sort">
            <button
              v-for="s in sortOptions"
              :key="s.key"
              class="player__sort-btn"
              :class="{ 'player__sort-btn--active': sortKey === s.key }"
              @click="sortKey = s.key"
            >{{ s.label }}</button>
          </div>
        </div>

        <div class="cmd-list">
          <div
            v-for="cmd in sortedCommanders"
            :key="cmd.name"
            class="cmd-row"
          >
            <!-- Full card image + level under it -->
            <div class="cmd-row__card-wrap">
              <div
                class="cmd-row__card"
                :title="getCommanderIndicatorTitle(cmd)"
                @mouseenter="onCardPreviewEnter(cmd.name, $event)"
                @mousemove="onCardPreviewMove($event)"
                @mouseleave="onCardPreviewLeave"
              >
                <div
                  v-if="getCommanderIndicator(cmd)"
                  class="cmd-row__indicator"
                  :class="`cmd-row__indicator--${getCommanderIndicator(cmd)?.direction}`"
                >
                  <span
                    v-for="n in getCommanderIndicator(cmd)?.strength ?? 0"
                    :key="`${cmd.name}-${n}`"
                    class="cmd-row__indicator-icon"
                  >
                    {{ getCommanderIndicator(cmd)?.direction === 'up' ? '▲' : '▼' }}
                  </span>
                </div>
                <img
                  v-if="artUrls.get(cmd.name)"
                  :src="artUrls.get(cmd.name)"
                  :alt="cmd.name"
                  class="cmd-row__card-img"
                />
                <div v-else class="cmd-row__card-placeholder" />
              </div>
              <div
                class="cmd-row__card-xp"
                :class="{
                  'cmd-row__card-xp--near-levelup': !cmd.isMaxLevel && cmd.levelPct >= 80,
                  'cmd-row__card-xp--max-level': cmd.isMaxLevel,
                }"
              >
                <div class="cmd-row__level-row">
                  <span class="cmd-row__level-label">Lv {{ cmd.level }}</span>
                  <div class="cmd-row__bar-wrap">
                    <div class="cmd-row__bar-fill" :style="{ width: `${cmd.levelPct}%` }" />
                  </div>
                  <span class="cmd-row__level-next">{{ cmd.isMaxLevel ? 'MAX' : `Lv ${cmd.level + 1}` }}</span>
                </div>
                <div class="cmd-row__xp-detail">
                  <span class="cmd-row__xp-current">{{ cmd.currentLevelXP }} / {{ cmd.levelSpanXP }} XP</span>
                  <span v-if="!cmd.isMaxLevel" class="cmd-row__xp-remaining">· {{ cmd.xpToNext }} to next</span>
                  <span class="cmd-row__xp-pts" title="Score points contributed by XP levels">+{{ cmd.xpScorePts }} pts</span>
                </div>
              </div>
            </div>

            <!-- Body -->
            <div class="cmd-row__body">

              <!-- Name + tier -->
              <div class="cmd-row__header">
                <NuxtLink class="cmd-row__name" :to="`/commanders/${encodeURIComponent(cmd.name)}`">{{ cmd.name }}</NuxtLink>
                <button
                  type="button"
                  class="cmd-row__title-badge"
                  @mouseenter="onTitleEnter(cmd.title, $event)"
                  @mousemove="onTitleMove($event)"
                  @mouseleave="onTitleLeave"
                >
                  {{ cmd.title.name }}
                </button>
                <span v-if="cmd.tierDetail" class="cmd-row__tier">
                  <UITierBadge :detail="cmd.tierDetail" :context="cmd.tierContext" />
                </span>
                <span
                  v-if="cmd.plays < 20 && cmd.projectedTierDetail"
                  class="cmd-row__tier cmd-row__tier--projected"
                >
                  <span class="cmd-row__tier-prefix">Projected</span>
                  <UITierBadge :detail="cmd.projectedTierDetail" />
                </span>
              </div>

              <div class="cmd-row__stats-band">
                <!-- Core stats row -->
                <div class="cmd-row__stats">
                  <div class="cmd-row__stat" :class="{ 'cmd-row__stat--sorted': sortKey === 'plays' }">
                    <span class="cmd-row__stat-val">{{ cmd.plays }}</span>
                    <span class="cmd-row__stat-lbl">Plays</span>
                  </div>
                  <div class="cmd-row__stat" :class="{ 'cmd-row__stat--sorted': sortKey === 'winRate' }">
                    <span class="cmd-row__stat-val">{{ cmd.winRate }}%</span>
                    <span class="cmd-row__stat-lbl">Win %</span>
                  </div>
                  <div class="cmd-row__stat" :class="{ 'cmd-row__stat--sorted': sortKey === 'avgPoints' }">
                    <span class="cmd-row__stat-val cmd-row__stat-val--secondary">{{ fmt(cmd.avgPoints) }}</span>
                    <span class="cmd-row__stat-lbl">Avg Pts</span>
                  </div>
                  <div
                    class="cmd-row__stat"
                    :class="{
                      'cmd-row__stat--positive': cmd.edgeScore > 0,
                      'cmd-row__stat--negative': cmd.edgeScore < 0,
                    }"
                    @mouseenter="onEdgeEnter(cmd, $event)"
                    @mousemove="onEdgeMove($event)"
                    @mouseleave="onEdgeLeave"
                  >
                    <span
                      class="cmd-row__stat-val"
                      :class="{
                        'cmd-row__stat-val--positive': cmd.edgeScore > 0,
                        'cmd-row__stat-val--negative': cmd.edgeScore < 0,
                      }"
                    >
                      {{ formatSignedPercent(cmd.edgeScore) }}
                    </span>
                    <span class="cmd-row__stat-lbl">Edge</span>
                  </div>
                  <div class="cmd-row__stat cmd-row__stat--place cmd-row__stat--gold">
                    <span class="cmd-row__stat-val">{{ cmd.first }}</span>
                    <span class="cmd-row__stat-lbl">🥇 1st</span>
                  </div>
                  <div class="cmd-row__stat cmd-row__stat--place">
                    <span class="cmd-row__stat-val">{{ cmd.second }}</span>
                    <span class="cmd-row__stat-lbl">🥈 2nd</span>
                  </div>
                  <div class="cmd-row__stat cmd-row__stat--place cmd-row__stat--danger">
                    <span class="cmd-row__stat-val">{{ cmd.last }}</span>
                    <span class="cmd-row__stat-lbl">💀 Last</span>
                  </div>
                </div>

                <ChartsPlacementTimeline
                  v-if="cmd.timeline.length > 0"
                  :points="cmd.timeline"
                  class="cmd-row__timeline"
                  compact
                />
              </div>

              <!-- Commander-scoped achievements -->
              <div v-if="cmd.achievements.length > 0" class="cmd-row__achievements">
                <button
                  v-for="ach in cmd.achievements"
                  :key="ach.id"
                  type="button"
                  class="mini-ach"
                  :class="`mini-ach--rarity-${getAchievementRarityClass(ach.id)}`"
                  @mouseenter="onAchievementEnter(ach.id, $event)"
                  @mousemove="onAchievementMove($event)"
                  @mouseleave="onAchievementLeave"
                >
                  <span class="mini-ach__icon">{{ ach.icon }}</span>
                  <span class="mini-ach__name">{{ ach.name }}</span>
                  <div class="mini-ach__footer">
                    <span class="mini-ach__pts">+{{ fmtAchPts(ach.points) }} pts</span>
                  </div>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="player__not-found">
      Player "{{ displayPlayerName }}" not found.
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

  <Teleport to="body">
    <div
      v-if="achievementPreview.visible"
      class="floating-panel"
      :style="{ top: `${achievementPreview.y}px`, left: `${achievementPreview.x}px` }"
    >
      <AchievementsAchievementMetaInformation :achievement-id="achievementPreview.id" />
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

  <Teleport to="body">
    <div
      v-if="prognosisPreview.visible"
      class="floating-panel"
      :style="{ top: `${prognosisPreview.y}px`, left: `${prognosisPreview.x}px` }"
    >
      <div class="prognosis-tooltip">
        <div class="prognosis-tooltip__title">How prognosis works</div>
        <p class="prognosis-tooltip__line">{{ placementPrognosis.explanation.summary }}</p>
        <p class="prognosis-tooltip__line">{{ placementPrognosis.explanation.trend }}</p>
        <p class="prognosis-tooltip__line">{{ placementPrognosis.explanation.formula }}</p>
        <p class="prognosis-tooltip__line prognosis-tooltip__line--muted">{{ placementPrognosis.explanation.recencyNote }}</p>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="placementPickPreview.visible && placementPickPreview.suggestion"
      class="floating-panel"
      :style="{ top: `${placementPickPreview.y}px`, left: `${placementPickPreview.x}px` }"
    >
      <div class="prognosis-pick-tooltip">
        <div class="prognosis-pick-tooltip__name">{{ placementPickPreview.suggestion.commander }}</div>
        <div class="prognosis-pick-tooltip__focus">{{ placementPickPreview.suggestion.title }}</div>
        <p class="prognosis-pick-tooltip__summary">{{ placementPickPreview.suggestion.summary }}</p>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="edgePreview.visible && edgePreview.commander"
      class="floating-panel"
      :style="{ top: `${edgePreview.y}px`, left: `${edgePreview.x}px` }"
    >
      <div class="dependency-tooltip">
        <div class="dependency-tooltip__title">Commander Edge</div>
        <p class="dependency-tooltip__line">
          {{ getEdgeTooltipText(edgePreview.commander) }}
        </p>
        <p class="dependency-tooltip__line dependency-tooltip__line--muted">
          Positive = better than this player's usual pool. Negative = worse.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { compareGamesChronological, getLeagueStandingMetrics, getPlayerCommanderPerformanceEdgeMetrics, getPlayerCommanderMetrics } from '~/composables/useLeagueState'
import { xpToLevel, getCommanderLevelProgress } from '~/utils/commanderExperience'
import { buildCommanderPlacementTimeline, type PlacementTimelinePoint } from '~/utils/commanderTimeline'
import { buildPlayerLeagueTimeline } from '~/utils/playerLeagueTimeline'
import { buildPlacementPrognosis } from '~/utils/placementPrognosis'
import { formatPlayerName } from '~/utils/playerNames'
import { buildPlayerSuggestion, type PlayerCommanderPickSuggestion } from '~/utils/playerSuggestions'
import { computeGlobalCommanderBaseline, computePlayerCommanderTier, smoothedTierScore, getTierDetail, type TierDetail, type TierContext } from '~/utils/tiers'
import { ACHIEVEMENTS } from '~/utils/achievements'
import { getCommanderPerformanceTitle, type CommanderTitleResult } from '~/utils/titles'

const route = useRoute()
const playerId = computed(() => route.params.playerId as string)
const displayPlayerName = computed(() => formatPlayerName(playerId.value))

const { games, commanders, players, gameRecords, leagueSnapshots, standings } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const player = computed(() => players.value[playerId.value] ?? null)
const playerStanding = computed(() =>
  player.value ? getLeagueStandingMetrics(player.value, players.value) : null,
)
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const leagueTimeline = computed(() =>
  buildPlayerLeagueTimeline(chronologicalGames.value, gameRecords.value, leagueSnapshots.value, playerId.value),
)
const currentLeagueRank = computed(() =>
  standings.value.find((entry) => entry.name === playerId.value)?.rank ?? standings.value.length,
)
const placementPrognosis = computed(() =>
  buildPlacementPrognosis(playerId.value, chronologicalGames.value, gameRecords.value, players.value, commanders.value),
)
const playerSuggestion = computed(() =>
  buildPlayerSuggestion(playerId.value, chronologicalGames.value, gameRecords.value, players.value),
)
const playerAchievements = computed(() => {
  const counts = new Map<string, number>()
  for (const achievement of player.value?.earnedAchievements ?? []) {
    const def = ACHIEVEMENTS[achievement.id]
    if (!def || def.scope !== 'player') continue
    counts.set(def.id, (counts.get(def.id) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([id, count]) => {
      const def = ACHIEVEMENTS[id]
      return {
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        points: def.points,
        count,
      }
    })
    .sort((a, b) => (b.points * b.count) - (a.points * a.count) || a.name.localeCompare(b.name))
})

// ── Player-level stats ────────────────────────────────────────────────────────

function xpPoints(playerName: string): number {
  const xpMap = players.value[playerName]?.commanderXP ?? {}
  return Object.values(xpMap).reduce((s, xp) => s + xpToLevel(xp), 0)
}

const xpPts = computed(() => xpPoints(playerId.value))

const totalScore = computed(() => {
  return playerStanding.value?.totalScore ?? 0
})

const winRate = computed(() => {
  if (!player.value || player.value.gamesPlayed === 0) return 0
  return Math.round((player.value.baseWins / player.value.gamesPlayed) * 100)
})

const avgPerGame = computed(() => {
  if (!player.value || player.value.gamesPlayed === 0) return 0
  return Math.round((player.value.totalPoints / player.value.gamesPlayed) * 1000) / 1000
})

const allRecords = computed(() => Object.values(gameRecords.value[playerId.value] ?? {}))

const uniqueCommandersCount = computed(() => new Set(allRecords.value.map((r) => r.commander)).size)

const avgPlacementOverall = computed(() => {
  const recs = allRecords.value
  if (recs.length === 0) return 0
  const sum = recs.reduce((s, r) => s + r.placement, 0)
  return Math.round((sum / recs.length) * 100) / 100
})

// ── Per-commander aggregation ─────────────────────────────────────────────────

interface CommanderRow {
  name: string
  plays: number
  first: number
  second: number
  last: number
  winRate: number
  avgPoints: number
  avgPlacement: number
  tierDetail: TierDetail | null
  tierContext: TierContext
  projectedTierDetail: TierDetail | null
  level: number
  levelPct: number
  xp: number
  currentLevelXP: number
  levelSpanXP: number
  xpToNext: number
  isMaxLevel: boolean
  xpScorePts: number
  edgeScore: number
  edgeWithGames: number
  edgeWithoutGames: number
  edgeWithAvg: number
  edgeWithoutAvg: number
  edgeConfidence: number
  edgeRaw: number
  edgePickRate: number
  edgeImportanceScore: number
  edgeLowCommanderSample: boolean
  edgeLowPoolSample: boolean
  edgeReliable: boolean
  timeline: PlacementTimelinePoint[]
  title: CommanderTitleResult
  achievements: Array<{ id: string; name: string; description: string; icon: string; points: number }>
}

type CommanderIndicatorDirection = 'up' | 'down'
type CommanderIndicator = {
  direction: CommanderIndicatorDirection
  strength: 1 | 2
  metricLabel: string
  deltaRatio: number
}

const commanderRows = computed((): CommanderRow[] => {
  const globalAvgScore = computeGlobalCommanderBaseline(commanders.value)

  const byCommander: Record<string, typeof allRecords.value> = {}
  for (const r of allRecords.value) {
    if (!byCommander[r.commander]) byCommander[r.commander] = []
    byCommander[r.commander].push(r)
  }

  // Build a set of earned achievement ids per commander for this player
  const earnedByCommander: Record<string, Set<string>> = {}
  for (const a of player.value?.earnedAchievements ?? []) {
    if (a.commander) {
      if (!earnedByCommander[a.commander]) earnedByCommander[a.commander] = new Set()
      earnedByCommander[a.commander].add(a.id)
    }
  }

  return Object.entries(byCommander).map(([name, records]) => {
    const metrics = getPlayerCommanderMetrics(playerId.value, name, gameRecords.value, players.value)
    if (!metrics) return null
    const edgeMetrics = getPlayerCommanderPerformanceEdgeMetrics(playerId.value, name, gameRecords.value)

    const { detail: tierDetail, context: tierContext } = computePlayerCommanderTier(records, globalAvgScore)

    const playerAvgPts = player.value && player.value.gamesPlayed > 0
      ? player.value.totalBasePoints / player.value.gamesPlayed
      : 0
    const playerWinRate = player.value && player.value.gamesPlayed > 0
      ? player.value.baseWins / player.value.gamesPlayed
      : 0
    const projectedScore = metrics.plays > 0
      ? smoothedTierScore(metrics.totalBasePoints, metrics.first, metrics.plays, playerAvgPts, playerWinRate)
      : 0
    const projectedTierDetail = metrics.plays > 0 ? getTierDetail(projectedScore, globalAvgScore, metrics.plays) : null
    const xp = player.value?.commanderXP?.[name] ?? 0
    const {
      level,
      isMaxLevel,
      currentLevelXP,
      levelSpanXP,
      progressPct,
      xpToNext,
    } = getCommanderLevelProgress(xp)

    // XP score contribution: 1 point per level
    const xpScorePts = level
    const timeline = buildCommanderPlacementTimeline(
      chronologicalGames.value,
      gameRecords.value,
      playerId.value,
      name,
    )
    const title = getCommanderPerformanceTitle({
      playerName: playerId.value,
      commanderName: name,
      commanderRecords: records,
      playerRecords: allRecords.value,
      allRecords: Object.values(gameRecords.value).flatMap((entry) => Object.values(entry)),
      games: chronologicalGames.value,
      standings: standings.value,
    })

    // Commander-scoped achievements (deduplicated by id)
    const cmdAchIds = earnedByCommander[name] ?? new Set()
    const achievements = [...cmdAchIds]
      .map((id) => ACHIEVEMENTS[id])
      .filter(Boolean)
      .map((def) => ({ id: def.id, name: def.name, description: def.description, icon: def.icon, points: def.points }))

    return {
      name,
      plays: metrics.plays,
      first: metrics.first,
      second: metrics.second,
      last: metrics.last,
      winRate: metrics.winRate,
      avgPoints: metrics.avgBasePoints,
      avgPlacement: metrics.avgPlacement,
      tierDetail,
      tierContext,
      projectedTierDetail,
      level,
      levelPct: progressPct,
      xp,
      currentLevelXP,
      levelSpanXP,
      xpToNext,
      isMaxLevel,
      xpScorePts,
      edgeScore: edgeMetrics?.weightedEdge ?? 0,
      edgeWithGames: edgeMetrics?.withGames ?? 0,
      edgeWithoutGames: edgeMetrics?.withoutGames ?? 0,
      edgeWithAvg: edgeMetrics?.withAvg ?? 0,
      edgeWithoutAvg: edgeMetrics?.withoutAvg ?? 0,
      edgeConfidence: edgeMetrics?.confidence ?? 0,
      edgeRaw: edgeMetrics?.rawEdge ?? 0,
      edgePickRate: edgeMetrics?.pickRate ?? 0,
      edgeImportanceScore: edgeMetrics?.importanceScore ?? 0,
      edgeLowCommanderSample: edgeMetrics?.hasLowCommanderSample ?? true,
      edgeLowPoolSample: edgeMetrics?.hasLowPoolSample ?? true,
      edgeReliable: edgeMetrics?.isReliable ?? false,
      timeline,
      title,
      achievements,
    }
  }).filter((row): row is CommanderRow => !!row)
})

// ── Card art images ───────────────────────────────────────────────────────────

const artUrls = ref(new Map<string, string>())
const previewUrls = ref(new Map<string, string>())

watch(
  [commanderRows, placementPrognosis],
  async ([rows, prognosis]) => {
    const names = [
      ...rows.map((row) => row.name),
      ...prognosis.commanderSuggestions.map((suggestion) => suggestion.commander),
    ]
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

const PREVIEW_OFFSET_X = 18
const PREVIEW_OFFSET_Y = 18

const cardPreview = reactive({
  visible: false,
  name: '',
  x: 0,
  y: 0,
})
const achievementPreview = reactive({
  visible: false,
  id: '',
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
const prognosisPreview = reactive({
  visible: false,
  x: 0,
  y: 0,
})
const placementPickPreview = reactive<{
  visible: boolean
  suggestion: PlayerCommanderPickSuggestion | null
  x: number
  y: number
}>({
  visible: false,
  suggestion: null,
  x: 0,
  y: 0,
})
const edgePreview = reactive<{
  visible: boolean
  commander: CommanderRow | null
  x: number
  y: number
}>({
  visible: false,
  commander: null,
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
  const pos = calcPreviewPosition(e, 260, 364)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
}

function onCardPreviewMove(e: MouseEvent) {
  if (!cardPreview.visible) return
  const pos = calcPreviewPosition(e, 260, 364)
  cardPreview.x = pos.x
  cardPreview.y = pos.y
}

function onCardPreviewLeave() {
  cardPreview.visible = false
}

function onAchievementEnter(id: string, e: MouseEvent) {
  achievementPreview.id = id
  achievementPreview.visible = true
  const pos = calcPreviewPosition(e, 240, 220)
  achievementPreview.x = pos.x
  achievementPreview.y = pos.y
}

function onAchievementMove(e: MouseEvent) {
  if (!achievementPreview.visible) return
  const pos = calcPreviewPosition(e, 240, 220)
  achievementPreview.x = pos.x
  achievementPreview.y = pos.y
}

function onAchievementLeave() {
  achievementPreview.visible = false
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

function onPrognosisEnter(e: MouseEvent) {
  prognosisPreview.visible = true
  const pos = calcPreviewPosition(e, 320, 190)
  prognosisPreview.x = pos.x
  prognosisPreview.y = pos.y
}

function onPrognosisMove(e: MouseEvent) {
  if (!prognosisPreview.visible) return
  if (placementPickPreview.visible) return
  const pos = calcPreviewPosition(e, 320, 190)
  prognosisPreview.x = pos.x
  prognosisPreview.y = pos.y
}

function onPrognosisLeave() {
  prognosisPreview.visible = false
}

function onPlacementPickEnter(suggestion: PlayerCommanderPickSuggestion, e: MouseEvent) {
  prognosisPreview.visible = false
  placementPickPreview.visible = true
  placementPickPreview.suggestion = suggestion
  const pos = calcPreviewPosition(e, 280, 150)
  placementPickPreview.x = pos.x
  placementPickPreview.y = pos.y
}

function onPlacementPickMove(e: MouseEvent) {
  if (!placementPickPreview.visible) return
  const pos = calcPreviewPosition(e, 280, 150)
  placementPickPreview.x = pos.x
  placementPickPreview.y = pos.y
}

function onPlacementPickLeave() {
  placementPickPreview.visible = false
  placementPickPreview.suggestion = null
}

function onEdgeEnter(commander: CommanderRow, e: MouseEvent) {
  edgePreview.visible = true
  edgePreview.commander = commander
  const pos = calcPreviewPosition(e, 340, 230)
  edgePreview.x = pos.x
  edgePreview.y = pos.y
}

function onEdgeMove(e: MouseEvent) {
  if (!edgePreview.visible) return
  const pos = calcPreviewPosition(e, 340, 230)
  edgePreview.x = pos.x
  edgePreview.y = pos.y
}

function onEdgeLeave() {
  edgePreview.visible = false
  edgePreview.commander = null
}

// ── Sort ──────────────────────────────────────────────────────────────────────

const sortOptions = [
  { key: 'plays',     label: 'Plays' },
  { key: 'avgPoints', label: 'Avg Pts' },
  { key: 'winRate',   label: 'Win %' },
  { key: 'alpha',     label: 'A–Z' },
]

const sortKey = ref<string>('avgPoints')

const activeIndicatorMetric = computed<'avgPoints' | 'winRate'>(() =>
  sortKey.value === 'winRate' ? 'winRate' : 'avgPoints',
)

const sortedCommanders = computed(() => {
  const rows = [...commanderRows.value]
  switch (sortKey.value) {
    case 'avgPoints': return rows.sort((a, b) => b.avgPoints - a.avgPoints)
    case 'winRate':   return rows.sort((a, b) => b.winRate - a.winRate)
    case 'alpha':     return rows.sort((a, b) => a.name.localeCompare(b.name))
    default:          return rows.sort((a, b) => b.plays - a.plays)
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}

function getRelativeDelta(value: number, baseline: number) {
  if (baseline <= 0) return value > 0 ? 1 : 0
  return (value - baseline) / baseline
}

function getCommanderIndicator(cmd: CommanderRow): CommanderIndicator | null {
  const metric = activeIndicatorMetric.value
  const baseline = metric === 'winRate' ? winRate.value : avgPerGame.value
  const value = metric === 'winRate' ? cmd.winRate : cmd.avgPoints
  const deltaRatio = getRelativeDelta(value, baseline)

  if (Math.abs(deltaRatio) < 0.1) return null

  return {
    direction: deltaRatio > 0 ? 'up' : 'down',
    strength: Math.abs(deltaRatio) >= 0.3 ? 2 : 1,
    metricLabel: metric === 'winRate' ? 'player win rate' : 'player avg points',
    deltaRatio,
  }
}

function getCommanderIndicatorTitle(cmd: CommanderRow) {
  const indicator = getCommanderIndicator(cmd)
  if (!indicator) return ''
  const pct = Math.round(Math.abs(indicator.deltaRatio) * 100)
  const relation = indicator.direction === 'up' ? 'above' : 'below'
  return `${pct}% ${relation} ${indicator.metricLabel}`
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 1000) / 10
  const prefix = rounded > 0 ? '+' : ''
  const absRounded = Math.abs(rounded)
  const display = absRounded % 1 === 0 ? String(absRounded) : absRounded.toFixed(1).replace(/\.0$/, '')
  return `${prefix}${rounded < 0 ? '-' : ''}${display}%`
}

function getAchievementRarityClass(id: string): string {
  const def = ACHIEVEMENTS[id]
  if (!def) return 'common'
  if (def.points >= 3) return 'mythic'
  if (def.points >= 2 || !def.repeatable) return 'rare'
  if (def.points >= 1) return 'uncommon'
  return 'common'
}

function fmtAchPts(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function getEdgeTooltipText(cmd: CommanderRow) {
  if (!cmd.edgeReliable) {
    return `Not reliable yet: only ${cmd.edgeWithoutGames} games outside ${cmd.name}.`
  }

  if (cmd.edgeLowCommanderSample) {
    return `${formatSignedPercent(cmd.edgeScore)} weighted edge. Low sample: ${cmd.edgeWithGames} games with ${cmd.name}.`
  }

  return `${formatSignedPercent(cmd.edgeScore)} weighted edge vs this player's other commanders.`
}
</script>

<style lang="scss" scoped>
.player {
  &__back {
    display: inline-block;
    font-size: $font-size-sm;
    color: $color-text-muted;
    margin-bottom: $spacing-6;
    transition: color $transition-fast;

    &:hover { color: $color-primary-light; }
  }

  &__title {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    margin-bottom: $spacing-6;
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
    margin-bottom: $spacing-8;
  }

  &__stat {
    background: $color-bg-card;
    border: 1px solid $border-color;
    border-radius: $border-radius-md;
    padding: $spacing-3 $spacing-4;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-1;
    min-width: 90px;
  }

  &__stat-val {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;

    &--total   { color: $color-secondary; }
    &--achv    { color: $color-accent; }
    &--xp      { color: $color-primary-light; }
    &--lp      { color: $color-danger; }
    &--muted   { color: $color-text-muted; }
  }

  &__stat-lbl {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  &__section {
    margin-top: 3.5rem;
  }

  &__placement-overview {
    display: flex;
    flex-direction: column;
    margin-bottom: $spacing-6;
    border-radius: $border-radius-lg;
    border: 1px solid $border-color;
    background: $color-bg-card;
    overflow: hidden;
  }

  &__placement-cards {
    display: flex;
    align-items: flex-end;
    gap: $spacing-8;
    padding: $spacing-4 $spacing-6;
  }

  &__placement-card {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-width: 0;
  }

  &__placement-card--current {
    .player__placement-label {
      color: rgba($color-accent, 0.6);
    }
    .player__placement-rank {
      font-size: clamp(2.8rem, 4.5vw, 4.5rem);
      color: $color-accent;
      text-shadow: 0 0 24px rgba($color-accent, 0.25);
    }
    .player__placement-meta {
      color: $color-text-muted;
    }
  }

  &__placement-card--prognosis {
    cursor: help;

    .player__placement-label {
      color: rgba($color-primary-light, 0.5);
    }
    .player__placement-rank {
      font-size: clamp(1.4rem, 2vw, 2rem);
      color: $color-primary-light;
    }
  }

  &__placement-label {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 2px;
  }

  &__placement-rank {
    font-weight: $font-weight-bold;
    color: $color-text;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  &__placement-meta {
    font-size: $font-size-sm;
    color: $color-text-muted;
    line-height: 1.4;
    margin-top: 4px;
  }

  &__placement-breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-1;
    margin-top: 4px;
    font-size: $font-size-xs;
    font-variant-numeric: tabular-nums;
  }

  &__placement-breakdown-chip {
    padding: 2px 7px;
    border-radius: $border-radius-full;
    background: rgba($color-primary, 0.1);
    border: 1px solid rgba($color-primary-light, 0.14);
    color: rgba($color-primary-light, 0.5);
    white-space: nowrap;

    strong {
      color: rgba($color-primary-light, 0.85);
      font-weight: $font-weight-semibold;
    }
  }

  &__placement-message {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-style: italic;
    line-height: 1.4;
    margin-top: 4px;
  }

  &__placement-picks {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: $spacing-2;
  }

  &__placement-picks-label {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    color: rgba($color-primary-light, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  &__placement-picks-list {
    display: flex;
    gap: $spacing-2;
  }

  &__placement-pick {
    appearance: none;
    padding: 0;
    border: 1px solid rgba($color-primary-light, 0.14);
    border-radius: $border-radius-sm;
    background: rgba($color-primary, 0.08);
    cursor: help;
    overflow: hidden;
    transition: transform $transition-fast, border-color $transition-fast, box-shadow $transition-fast;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba($color-primary-light, 0.35);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
    }
  }

  &__placement-pick-art {
    display: block;
    width: 88px;
    height: 88px;
    object-fit: cover;
    object-position: center top;
    background: rgba($color-bg-elevated, 0.95);

    &--empty {
      border: 1px solid rgba($border-color, 0.8);
    }
  }

  &__focus-tip {
    border-top: 1px solid $border-color;
    padding: $spacing-4 $spacing-6;
    background: rgba(0, 0, 0, 0.25);
    display: grid;
    grid-template-columns: 56px 1fr;
    grid-template-rows: auto auto auto;
    column-gap: $spacing-4;
    row-gap: $spacing-1;
  }

  &__focus-tip-label {
    grid-column: 1;
    grid-row: 1 / 4;
    align-self: start;
    padding-top: 3px;
    font-size: 9px;
    font-weight: $font-weight-semibold;
    color: rgba($color-primary-light, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.09em;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    text-align: center;
    white-space: nowrap;
  }

  &__focus-tip-title {
    grid-column: 2;
    grid-row: 1;
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: white;
  }

  &__focus-tip-summary {
    grid-column: 2;
    grid-row: 2;
    margin: 0;
    font-size: $font-size-sm;
    line-height: 1.5;
    color: $color-secondary;
  }

  &__focus-tip-reasons {
    grid-column: 2;
    grid-row: 3;
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-1 $spacing-3;
    margin: $spacing-1 0 0;
    padding: 0;
    list-style: none;
  }

  &__focus-tip-reason {
    font-size: $font-size-xs;
    color: rgba($color-text-muted, 0.75);

    &::before {
      content: '·';
      margin-right: 4px;
      color: rgba($color-primary-light, 0.4);
    }
  }

  &__league-panel {
    display: flex;
    align-items: stretch;
    gap: $spacing-3;
    margin-bottom: $spacing-8;
    min-width: 0;
  }

  &__league-chart {
    flex: 0 0 600px;
    height:300px;
    min-width: 0;
  }

  &__league-achievements {
    width: 220px;
    flex: 1 0 220px;
    height:300px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    border-radius: $border-radius-md;
    padding: $spacing-3;
  }

  &__league-achievements-title {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__league-achievements-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: $spacing-2;
    align-content: start;
  }

  &__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $spacing-4;
    gap: $spacing-4;
    flex-wrap: wrap;
  }

  &__section-title {
    font-size: $font-size-xl;
    color: $color-text;
  }

  &__sort {
    display: flex;
    gap: $spacing-2;
  }

  &__sort-btn {
    padding: $spacing-1 $spacing-3;
    font-size: $font-size-xs;
    font-family: inherit;
    color: $color-text-muted;
    background: $color-bg-card;
    border: 1px solid $border-color;
    border-radius: $border-radius-full;
    cursor: pointer;
    transition: color $transition-fast, background $transition-fast, border-color $transition-fast;

    &:hover {
      color: $color-text;
      border-color: rgba($color-primary, 0.6);
    }

    &--active {
      color: $color-primary-light;
      background: rgba($color-primary, 0.15);
      border-color: rgba($color-primary, 0.5);
    }
  }

  &__not-found {
    margin-top: $spacing-8;
    color: $color-text-muted;
    font-size: $font-size-lg;
  }
}

// ── Commander row list ────────────────────────────────────────────────────────

.cmd-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.cmd-row {
  display: flex;
  gap: $spacing-4;
  background: $color-bg-card;
  backdrop-filter:blur(3px);
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: border-color $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.4);
  }

  // ── Full card image + XP under it ────────────────────────────────────────

  &__card-wrap {
    flex-shrink: 0;
    width: 234px;
    display: flex;
    flex-direction: column;
    padding: $spacing-3 0 $spacing-3 $spacing-3;
    gap: 0;
    filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.72));
  }

  &__card {
    position: relative;
    border-radius: $border-radius-md $border-radius-md 0 0;
    overflow: hidden;
    flex-shrink: 0;
    flex-grow: 1;
    cursor: zoom-in;
  }

  &__card-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  &__card-placeholder {
    width: 100%;
    height: 192px;
    background: $color-bg-elevated;
    border-radius: $border-radius-md $border-radius-md 0 0;
  }

  &__indicator {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    border-radius: $border-radius-full;
    backdrop-filter: blur(6px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);

    &--up {
      background: rgba(44, 156, 106, 0.82);
      color: #f3fff8;
    }

    &--down {
      background: rgba(176, 72, 72, 0.82);
      color: #fff3f3;
    }
  }

  &__indicator-icon {
    font-size: 10px;
    line-height: 1;
  }

  &__card-xp {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: rgba(0, 0, 0, 0.25);
    border-radius:0 0 $border-radius-md $border-radius-md;
    border: none;

    &--near-levelup {
      .cmd-row__level-label {
        color: #f5c842;
        text-shadow: 0 0 10px rgba(245, 200, 66, 0.65);
      }

      .cmd-row__level-next {
        color: #f5c842;
        animation: xp-pulse-text 1.6s ease-in-out infinite;
      }

      .cmd-row__bar-fill {
        box-shadow:
          0 0 12px rgba(255, 100, 0, 0.9),
          0 0 28px rgba(230, 60, 0, 0.55);
        animation: xp-pulse-bar 1.6s ease-in-out infinite;
      }
    }

    &--max-level {
      .cmd-row__level-label {
        color: #ffd966;
        text-shadow: 0 0 12px rgba(255, 217, 102, 0.75);
      }

      .cmd-row__level-next {
        color: #ffd966;
        font-weight: $font-weight-semibold;
        letter-spacing: 0.06em;
      }

      .cmd-row__bar-fill {
        box-shadow:
          0 0 14px rgba(255, 120, 0, 0.95),
          0 0 32px rgba(240, 70, 0, 0.6);
      }
    }
  }

  // ── Body ─────────────────────────────────────────────────────────────────

  &__body {
    flex: 1;
    min-width: 0;
    padding: $spacing-3 $spacing-4 $spacing-3 0;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  // ── Header ────────────────────────────────────────────────────────────────

  &__header {
    display: flex;
    align-items: baseline;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__name {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__title-badge {
    appearance: none;
    border: 1px solid rgba(196, 148, 72, 0.38);
    background:
      linear-gradient(180deg, rgba(30, 22, 18, 0.98), rgba(14, 10, 8, 0.98));
    padding: 4px 11px;
    font: inherit;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #d8b06a;
    cursor: help;
    display: inline-flex;
    align-items: center;
    width: fit-content;
    max-width: 100%;
    text-align: left;
    flex: 0 0 auto;
    border-radius: 3px;
    box-shadow:
      inset 0 0 0 1px rgba(255, 225, 155, 0.04),
      0 6px 16px rgba(0, 0, 0, 0.22);
  }

  &__tier {
    display: flex;
    align-items: center;
    gap: 4px;

    &--projected {
      padding-left: $spacing-1;
      border-left: 1px solid rgba($border-color, 0.8);
    }
  }

  &__tier-prefix {
    font-size: 10px;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__tier-label {
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

  // ── Stats row ─────────────────────────────────────────────────────────────

  &__stats {
    display: flex;
    gap: $spacing-1;
    flex-wrap: wrap;
    flex: 0 1 auto;
    align-content: flex-start;
  }

  &__stats-band {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 56px;
    padding: $spacing-2 $spacing-3;
    background: $color-bg-elevated;
    border: 1px solid $border-color;
    border-radius: $border-radius-md;
    transition: background $transition-fast, border-color $transition-fast;

    &--sorted {
      background: rgba($color-primary, 0.12);
      border-color: rgba($color-primary, 0.4);

      .cmd-row__stat-lbl { color: $color-primary-light; }
    }

    &--place { min-width: 44px; }
    &--gold  .cmd-row__stat-val { color: $color-accent; }
    &--danger .cmd-row__stat-val { color: $color-danger; }
    &--positive {
      border-color: rgba(44, 156, 106, 0.35);
      background: rgba(44, 156, 106, 0.1);
    }
    &--negative {
      border-color: rgba(176, 72, 72, 0.35);
      background: rgba(176, 72, 72, 0.1);
    }
  }

  &__stat-val {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;

    &--secondary { color: $color-secondary; }
    &--accent    { color: $color-primary-light; }
    &--positive  { color: #72d6a2; }
    &--negative  { color: #f18a8a; }
  }

  &__stat-lbl {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  // ── XP / Level ────────────────────────────────────────────────────────────

  &__xp {
    display: flex;
    flex-direction: column;
    gap: 3px;
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

  &__level-next { text-align: right; }

  &__bar-wrap {
    flex: 1;
    height: 6px;
    background: rgba(16,16,16,0.55);
    border-radius: $border-radius-full;
    overflow: hidden;
    flex-shrink: 0;
  }

  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #e84800 0%, #ff7a00 55%, #ffb830 100%);
    border-radius: $border-radius-full;
    transition: width $transition-slow;
  }

  &__xp-detail {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
    padding: 0 $spacing-3 $spacing-2;
  }

  &__xp-current {
    font-size: 10px;
    color: $color-text-muted;
  }

  &__xp-remaining {
    font-size: 10px;
    color: $color-text-muted;
    flex: 1;
  }

  &__xp-pts {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    color: $color-primary-light;
  }

  // ── Achievements ──────────────────────────────────────────────────────────

  &__achievements {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__timeline {
    width: min(100%, 400px);
    min-width: 320px;
    flex: 0 0 400px;
    margin-left: auto;
  }
}

// ── Mini achievement card ─────────────────────────────────────────────────────

.mini-ach {
  appearance: none;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: calc(#{$spacing-2} + 2px) $spacing-2 $spacing-2;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(13, 16, 23, 0.97), rgba(10, 12, 18, 0.97));
  cursor: default;
  color: inherit;
  font: inherit;
  text-align: left;
  transition: border-color 160ms ease, box-shadow 160ms ease;

  --rarity-stripe: rgba(200, 195, 185, 0.25);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--rarity-stripe);
    z-index: 2;
    pointer-events: none;
  }

  &__icon {
    font-size: 16px;
    line-height: 1;
  }

  &__name {
    font-size: 11px;
    color: $color-text;
    line-height: 1.25;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 1px;
  }

  &__pts {
    font-size: 10px;
    color: $color-accent;
    font-weight: $font-weight-semibold;
    line-height: 1;
  }

  &__count {
    font-size: 10px;
    color: rgba($color-text-muted, 0.75);
    line-height: 1;
  }

  // ── Rarity tiers ────────────────────────────────────────────────────────

  &--rarity-common {
    --rarity-stripe: #9e9070;
    border-color: rgba(158, 144, 112, 0.2);
    background: linear-gradient(180deg, rgba(18, 16, 12, 0.97), rgba(12, 11, 10, 0.97));

    &:hover { border-color: rgba(158, 144, 112, 0.38); }
    .mini-ach__name { color: #c8b898; }
  }

  &--rarity-uncommon {
    --rarity-stripe: #52c8a8;
    border-color: rgba(82, 200, 168, 0.26);
    background: linear-gradient(155deg, rgba(0, 30, 26, 0.18) 0%, transparent 60%),
      linear-gradient(180deg, rgba(10, 15, 15, 0.97), rgba(9, 12, 12, 0.97));

    &:hover { border-color: rgba(82, 200, 168, 0.44); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3), 0 0 10px rgba(82, 200, 168, 0.12); }
    .mini-ach__name { color: rgba($color-text, 0.95); }
  }

  &--rarity-rare {
    --rarity-stripe: #9b6ee8;
    border-color: rgba(155, 110, 232, 0.32);
    background: linear-gradient(155deg, rgba(30, 10, 55, 0.22) 0%, transparent 60%),
      linear-gradient(180deg, rgba(12, 9, 20, 0.97), rgba(10, 8, 17, 0.97));

    &:hover { border-color: rgba(155, 110, 232, 0.52); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3), 0 0 12px rgba(155, 110, 232, 0.18); }
    .mini-ach__name { font-family: $font-family-display; font-size: 10px; }
  }

  &--rarity-mythic {
    --rarity-stripe: #ff9030;
    border-color: rgba(255, 148, 50, 0.4);
    background: linear-gradient(150deg, rgba(55, 18, 0, 0.2) 0%, transparent 60%),
      linear-gradient(180deg, rgba(15, 10, 7, 0.97), rgba(10, 8, 6, 0.97));

    &::before { background: linear-gradient(90deg, #d04010, #ffb830, #ffe870, #ffb830, #d04010); }
    &:hover { border-color: rgba(255, 148, 50, 0.6); box-shadow: 0 6px 14px rgba(0, 0, 0, 0.3), 0 0 14px rgba(255, 130, 40, 0.22); }
    .mini-ach__name { font-family: $font-family-display; font-size: 10px; color: #fff0d8; }
    .mini-ach__pts { color: #ffb840; }
  }
}

@media (max-width: 1180px) {
  .player {
    &__placement-overview {
      grid-template-columns: 1fr;
    }

    &__league-panel {
      flex-direction: column;
    }

    &__league-achievements {
      width: 100%;
      flex-basis: auto;
    }

    &__league-achievements-list {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    }
  }

  .cmd-row {
    &__timeline {
      width: 100%;
      min-width: 0;
      flex-basis: 100%;
      margin-left: 0;
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

.prognosis-tooltip {
  width: min(320px, calc(100vw - 2rem));
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(123, 211, 255, 0.2);
  background:
    linear-gradient(180deg, rgba(10, 17, 24, 0.96), rgba(7, 11, 17, 0.98));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  color: $color-text;

  &__title {
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba($color-primary-light, 0.85);
  }

  &__line {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.92);

    & + & {
      margin-top: 6px;
    }

    &--muted {
      color: $color-text-muted;
    }
  }
}

.prognosis-pick-tooltip {
  width: min(280px, calc(100vw - 2rem));
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(123, 211, 255, 0.2);
  background:
    linear-gradient(180deg, rgba(10, 17, 24, 0.96), rgba(7, 11, 17, 0.98));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  color: $color-text;

  &__name {
    font-size: 13px;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__focus {
    margin-top: 4px;
    font-size: 10px;
    color: rgba($color-primary-light, 0.78);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  &__summary {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.9);
  }
}

.dependency-tooltip {
  width: min(340px, calc(100vw - 2rem));
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(123, 211, 255, 0.2);
  background:
    linear-gradient(180deg, rgba(10, 17, 24, 0.96), rgba(7, 11, 17, 0.98));
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.4);
  color: $color-text;

  &__title {
    margin-bottom: 8px;
    font-size: 11px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba($color-primary-light, 0.85);
  }

  &__line {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.92);

    & + & {
      margin-top: 6px;
    }

    &--muted {
      color: $color-text-muted;
    }
  }
}

@keyframes xp-pulse-bar {
  0%, 100% {
    box-shadow:
      0 0 12px rgba(255, 100, 0, 0.9),
      0 0 28px rgba(230, 60, 0, 0.55),
      0 0 3px rgba(255, 160, 30, 0.5) inset;
  }
  50% {
    box-shadow:
      0 0 20px rgba(255, 130, 0, 1),
      0 0 44px rgba(240, 70, 0, 0.8),
      0 0 5px rgba(255, 200, 60, 0.6) inset;
  }
}

@keyframes xp-pulse-text {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
</style>
