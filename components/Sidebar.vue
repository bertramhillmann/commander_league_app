<template>
  <Teleport to="body">
    <div v-if="modelValue" class="rating-sidebar">
      <div class="rating-sidebar__scrim" @click="close" />

      <aside class="rating-sidebar__panel">
        <div class="rating-sidebar__header">
          <div>
            <div class="rating-sidebar__eyebrow">{{ sidebarEyebrow }}</div>
            <h2 class="rating-sidebar__title">{{ playerName }}</h2>
            <p class="rating-sidebar__meta">
              {{ sidebarMeta }}
            </p>
          </div>

          <button type="button" class="rating-sidebar__close" @click="close">
            Close
          </button>
        </div>

        <div v-if="mode === 'compare' && !isPlayerRatingMode" class="rating-sidebar__state">
          Player Rating mode is not active in league settings.
        </div>
        <div v-else-if="mode === 'compare' && !comparisonDetail" class="rating-sidebar__state">
          No comparison data available for these players yet.
        </div>
        <div v-else-if="mode === 'compare'" class="rating-sidebar__content">
          <section class="rating-sidebar__overview">
            <div class="rating-sidebar__stats">
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(comparisonDetail.target.rating) }}</span>
                <span class="rating-sidebar__stat-label">{{ comparisonDetail.target.playerName }} Rating</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(comparisonDetail.viewer.rating) }}</span>
                <span class="rating-sidebar__stat-label">{{ comparisonDetail.viewer.playerName }} Rating</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(comparisonDetail.ratingGap) }}</span>
                <span class="rating-sidebar__stat-label">Rating Gap</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ comparisonDetail.leadingFactors.length }}</span>
                <span class="rating-sidebar__stat-label">Target Advantages</span>
              </div>
            </div>

            <div class="rating-sidebar__formula">
              <div class="rating-sidebar__formula-title">How to close the gap</div>
              <div class="rating-sidebar__formula-line">
                {{ comparisonDetail.summary }}
              </div>
              <div
                v-for="line in comparisonDetail.improvementIdeas"
                :key="line"
                class="rating-sidebar__formula-line"
              >
                {{ line }}
              </div>
            </div>

            <ChartsPerformanceTimeline
              :labels="comparisonHistoryLabels"
              :series="comparisonOverallSeries"
              title="Player Rating Comparison"
              subtitle="Both players' live rating across the shared league timeline."
              class="rating-sidebar__chart"
            />
          </section>

          <section class="rating-sidebar__factors">
            <article
              v-for="factor in comparisonFactorPanels"
              :key="factor.key"
              class="rating-sidebar__factor"
            >
              <div class="rating-sidebar__factor-top">
                <div>
                  <h3 class="rating-sidebar__factor-title">{{ factor.label }}</h3>
                  <p class="rating-sidebar__factor-description">{{ factor.note }}</p>
                </div>
                <div class="rating-sidebar__factor-stats">
                  <span class="rating-sidebar__factor-pill rating-sidebar__factor-pill--target">
                    {{ comparisonDetail.target.playerName }} {{ fmt(factor.targetContribution) }}
                  </span>
                  <span class="rating-sidebar__factor-pill rating-sidebar__factor-pill--viewer">
                    {{ comparisonDetail.viewer.playerName }} {{ fmt(factor.viewerContribution) }}
                  </span>
                  <span class="rating-sidebar__factor-pill rating-sidebar__factor-pill--accent">
                    Gap {{ factor.delta > 0 ? '+' : '' }}{{ fmt(factor.delta) }}
                  </span>
                </div>
              </div>

              <div class="rating-sidebar__factor-formula">{{ factor.tip }}</div>

              <ChartsPerformanceTimeline
                :labels="comparisonHistoryLabels"
                :series="factor.series"
                :title="`${factor.label} Comparison`"
                subtitle="Weighted contribution across the shared league timeline."
                class="rating-sidebar__chart rating-sidebar__chart--factor"
              />
            </article>
          </section>
        </div>
        <div v-else-if="mode === 'rating' && !isPlayerRatingMode" class="rating-sidebar__state">
          Player Rating mode is not active in league settings.
        </div>
        <div v-else-if="mode === 'rating' && !detail" class="rating-sidebar__state">
          No Player Rating data available for this player yet.
        </div>
        <div v-else-if="mode === 'rating'" class="rating-sidebar__content">
          <section class="rating-sidebar__overview">
            <div class="rating-sidebar__stats">
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(detail.rating) }}</span>
                <span class="rating-sidebar__stat-label">Current Rating</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(detail.weightedScore) }}</span>
                <span class="rating-sidebar__stat-label">Weighted Score</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ Math.round(detail.confidenceMultiplier * 100) }}%</span>
                <span class="rating-sidebar__stat-label">Confidence</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ detail.gamesPlayed }}</span>
                <span class="rating-sidebar__stat-label">Games Counted</span>
              </div>
            </div>

            <div class="rating-sidebar__formula">
              <div class="rating-sidebar__formula-title">How the final rating is formed</div>
              <div class="rating-sidebar__formula-line">
                1. Each factor becomes a normalized 0-100 score.
              </div>
              <div class="rating-sidebar__formula-line">
                2. That score is multiplied by its configured weight and averaged into a weighted score of
                <strong>{{ fmt(detail.weightedScore) }}</strong>.
              </div>
              <div class="rating-sidebar__formula-line">
                3. The weighted score is scaled by confidence:
                <strong>{{ fmt(detail.weightedScore) }}</strong>
                ×
                <strong>{{ fmt(0.2 + detail.confidenceMultiplier) }}</strong>.
              </div>
              <div class="rating-sidebar__formula-line">
                4. The adjusted score is mapped into the rating band
                <strong>{{ detail.minRating }}</strong>
                -
                <strong>{{ detail.maxRating }}</strong>
                to produce
                <strong>{{ fmt(detail.rating) }}</strong>.
              </div>
              <div v-if="detail.provisional" class="rating-sidebar__formula-note">
                Provisional until {{ detail.provisionalGames }} games are reached.
              </div>
            </div>

            <ChartsPerformanceTimeline
              :labels="historyLabels"
              :series="overallSeries"
              title="Player Rating Over Time"
              subtitle="The final rating across the shared league timeline."
              class="rating-sidebar__chart"
            />
          </section>

          <section class="rating-sidebar__factors">
            <article
              v-for="factor in factorPanels"
              :key="factor.key"
              class="rating-sidebar__factor"
            >
              <div class="rating-sidebar__factor-top">
                <div>
                  <h3 class="rating-sidebar__factor-title">{{ factor.current.label }}</h3>
                  <p class="rating-sidebar__factor-description">{{ factor.current.description }}</p>
                </div>
                <div class="rating-sidebar__factor-stats">
                  <span class="rating-sidebar__factor-pill">raw {{ fmt(factor.current.rawValue) }}</span>
                  <span class="rating-sidebar__factor-pill">norm {{ fmt(factor.current.normalizedScore) }}</span>
                  <span class="rating-sidebar__factor-pill">weight {{ Math.round(factor.current.weight * 100) }}%</span>
                  <span class="rating-sidebar__factor-pill rating-sidebar__factor-pill--accent">
                    +{{ fmt(factor.current.weightedContribution) }}
                  </span>
                </div>
              </div>

              <div class="rating-sidebar__factor-formula">{{ formatFactorExplanation(factor.current) }}</div>

              <ul class="rating-sidebar__factor-list">
                <li v-for="line in factor.current.detailLines" :key="line">{{ line }}</li>
              </ul>

              <ChartsPerformanceTimeline
                :labels="historyLabels"
                :series="factor.series"
                :title="`${factor.current.label} Over Time`"
                subtitle="Weighted contribution across the shared league timeline."
                class="rating-sidebar__chart rating-sidebar__chart--factor"
              />
            </article>
          </section>
        </div>
        <div v-else-if="mode === 'achievements'" class="rating-sidebar__content">
          <section class="rating-sidebar__overview">
            <div class="rating-sidebar__stats">
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(achievementSummary.totalPoints) }}</span>
                <span class="rating-sidebar__stat-label">Achievement Pts</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ achievementSummary.totalUnlocks }}</span>
                <span class="rating-sidebar__stat-label">Unlocks</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ achievementSummary.uniqueAchievements }}</span>
                <span class="rating-sidebar__stat-label">Unique Achievements</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ achievementSummary.repeatableUnlocks }}</span>
                <span class="rating-sidebar__stat-label">Repeat Unlocks</span>
              </div>
            </div>

            <ChartsPerformanceTimeline
              :labels="achievementTimeline.labels"
              :series="achievementTimeline.series"
              title="Achievement Points Over Time"
              subtitle="Achievement points earned per calendar week."
              empty-label="No achievement history yet."
              class="rating-sidebar__chart"
            />
          </section>

          <section class="rating-sidebar__details">
            <div class="rating-sidebar__cards">
              <article
                v-for="achievement in achievementCards"
                :key="achievement.id"
                class="achievement-card"
                :class="[
                  `achievement-card--${achievement.scope}`,
                  `achievement-card--rarity-${achievement.rarity}`,
                ]"
              >
                <div class="achievement-card__inner">
                  <div class="achievement-card__glow" />
                  <div class="achievement-card__top">
                    <span class="achievement-card__scope">{{ achievement.scope }}</span>
                    <span class="achievement-card__rarity">{{ achievement.rarityLabel }}</span>
                  </div>

                  <div class="achievement-card__main">
                    <span class="achievement-card__icon">{{ achievement.icon }}</span>
                    <div class="achievement-card__text">
                      <h3 class="achievement-card__name">{{ achievement.name }}</h3>
                      <p class="achievement-card__description">{{ achievement.description }}</p>
                    </div>
                  </div>

                  <div class="achievement-card__footer">
                    <span class="achievement-card__points">{{ fmt(achievement.points) }} pts</span>
                    <span class="achievement-card__status">earned ×{{ achievement.count }}</span>
                  </div>

                  <p class="achievement-card__detail">
                    {{ achievement.dateLabel }}
                  </p>
                </div>
              </article>
            </div>
            <div v-if="achievementCards.length === 0" class="rating-sidebar__state">
              No achievements earned yet.
            </div>
          </section>
        </div>
        <div v-else class="rating-sidebar__content">
          <section class="rating-sidebar__overview">
            <div class="rating-sidebar__stats">
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ fmt(xpSummary.totalPoints) }}</span>
                <span class="rating-sidebar__stat-label">XP Pts</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ xpSummary.totalLevels }}</span>
                <span class="rating-sidebar__stat-label">Commander Levels</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ xpSummary.commanderCount }}</span>
                <span class="rating-sidebar__stat-label">Commanders With XP</span>
              </div>
              <div class="rating-sidebar__stat">
                <span class="rating-sidebar__stat-value">{{ xpSummary.topCommander }}</span>
                <span class="rating-sidebar__stat-label">Top XP Commander</span>
              </div>
            </div>

            <ChartsPerformanceTimeline
              :labels="commanderLevelTimeline.labels"
              :series="commanderLevelTimeline.series"
              title="Commander Levels Over Time"
              subtitle="Each line tracks one commander's current level after each game."
              empty-label="No commander XP history yet."
              class="rating-sidebar__chart"
            />
          </section>

          <section class="rating-sidebar__details">
            <div class="rating-sidebar__xp-cards">
              <article
                v-for="commander in commanderXpRows"
                :key="commander.commander"
                class="rating-sidebar__xp-card"
              >
                <div class="rating-sidebar__xp-art">
                  <img
                    v-if="commanderArtUrls.get(commander.commander)"
                    :src="commanderArtUrls.get(commander.commander)"
                    :alt="commander.commander"
                    class="rating-sidebar__xp-art-img"
                  >
                  <div v-else class="rating-sidebar__xp-art-placeholder" />
                </div>
                <div class="rating-sidebar__xp-body">
                  <div class="rating-sidebar__xp-head">
                    <h3 class="rating-sidebar__xp-name">{{ commander.commander }}</h3>
                    <span class="rating-sidebar__xp-level">Lv {{ commander.level }}</span>
                  </div>
                  <div class="rating-sidebar__xp-meta">
                    <span>{{ fmt(commander.xp) }} XP</span>
                    <span>{{ commander.games }} games</span>
                    <span>+{{ fmt(commander.level * settings.level.pointsPerLevel) }} pts</span>
                  </div>
                  <div class="rating-sidebar__xp-bar">
                    <div class="rating-sidebar__xp-bar-fill" :style="{ width: `${commander.progressPct}%` }" />
                  </div>
                </div>
              </article>
            </div>
            <div v-if="commanderXpRows.length === 0" class="rating-sidebar__state">
              No commander XP earned yet.
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type {
  PlayerRatingBreakdownKey,
  PlayerRatingDetail,
  PlayerRatingFactorDetail,
  PlayerRatingSnapshot,
} from '~/composables/usePlayerRating'
import { buildPlayerRatingDetail } from '~/composables/usePlayerRating'
import { useLeagueSettings } from '~/composables/useLeagueSettings'
import { getCommanderLevelProgress } from '~/utils/commanderExperience'
import { useImageCache } from '~/composables/useImageCache'

const props = defineProps<{
  modelValue: boolean
  playerName: string
  comparePlayerName?: string
  mode?: 'rating' | 'achievements' | 'xp' | 'compare'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { players, gameRecords, games } = useLeagueState()
const { settings, achievementDefs } = useLeagueSettings()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()
const mode = computed(() => props.mode ?? 'rating')
const sidebarEyebrow = computed(() => {
  if (mode.value === 'compare') return 'Player Matchup Analysis'
  if (mode.value === 'achievements') return 'Achievement Points Breakdown'
  if (mode.value === 'xp') return 'Commander XP Breakdown'
  return 'Player Rating Breakdown'
})
const sidebarMeta = computed(() => {
  if (mode.value === 'compare') return `Detailed Player Rating comparison against ${props.comparePlayerName ?? 'the selected player'}.`
  if (mode.value === 'achievements') return 'Detailed achievement progress for this player.'
  if (mode.value === 'xp') return 'Detailed commander XP and level progress for this player.'
  return 'Clickable factors use the same live data as the standings.'
})

const isPlayerRatingMode = computed(() => settings.value.playerRankingSystem === 'player_rating_based')
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const playerState = computed(() => players.value[props.playerName] ?? null)
const comparePlayerState = computed(() =>
  props.comparePlayerName ? players.value[props.comparePlayerName] ?? null : null,
)

const detail = computed<PlayerRatingDetail | null>(() => {
  if (!isPlayerRatingMode.value || !playerState.value) return null

  return buildPlayerRatingDetail({
    player: playerState.value,
    players: players.value,
    gameRecords: gameRecords.value,
    games: chronologicalGames.value,
    settings: settings.value,
  })
})

const compareDetail = computed<PlayerRatingDetail | null>(() => {
  if (!isPlayerRatingMode.value || !comparePlayerState.value) return null

  return buildPlayerRatingDetail({
    player: comparePlayerState.value,
    players: players.value,
    gameRecords: gameRecords.value,
    games: chronologicalGames.value,
    settings: settings.value,
  })
})

const leagueTimeline = computed(() =>
  chronologicalGames.value.map((game, index) => ({
    gameId: game.gameId,
    date: game.date,
    label: `${formatGameDate(game.date)} · L${index + 1}`,
  })),
)

const historyLabels = computed(() => leagueTimeline.value.map((entry) => entry.label))

const overallSeries = computed(() => [
  {
    name: 'Rating',
    color: '#f59e0b',
    data: buildAlignedRatingSeries(detail.value?.history ?? [], (entry) => entry.rating).data,
  },
])

const factorKeys: PlayerRatingBreakdownKey[] = [
  'recentPerformance',
  'allTimePerformance',
  'winRate',
  'commanderMMRContext',
  'averageCommanderMMR',
  'activityPoints',
  'achievements',
  'clutch',
  'commanderDiversity',
]

const factorColors: Record<PlayerRatingBreakdownKey, string> = {
  recentPerformance: '#fb7185',
  allTimePerformance: '#f97316',
  winRate: '#facc15',
  commanderMMRContext: '#38bdf8',
  averageCommanderMMR: '#0ea5e9',
  activityPoints: '#34d399',
  achievements: '#a78bfa',
  clutch: '#f472b6',
  commanderDiversity: '#22c55e',
}

const PLAYER_RATING_FACTOR_META: Record<PlayerRatingBreakdownKey, {
  label: string
  note: string
  tip: string
}> = {
  recentPerformance: {
    label: 'Recent Form',
    note: 'better finishes in recent games',
    tip: 'Improve recent form by turning your next few pods into podiums instead of trading middle placements.',
  },
  allTimePerformance: {
    label: 'Long-Term Performance',
    note: 'deeper full-history scoring base',
    tip: 'Build a longer stretch of above-average finishes so your long-term rating floor rises too.',
  },
  winRate: {
    label: 'Win Rate',
    note: 'more first places per game played',
    tip: 'Convert more top-table appearances into actual wins to close the cleanest rating gap.',
  },
  commanderMMRContext: {
    label: 'Finishes Against Stronger Opponents',
    note: 'beating stronger pods and expectations',
    tip: 'Gain here by outperforming the expected finish when your commander enters tougher MMR pods.',
  },
  averageCommanderMMR: {
    label: 'Average Commander MMR',
    note: 'bringing stronger commanders on average',
    tip: 'Raise this by succeeding with higher-MMR commanders instead of leaning only on lower-rated picks.',
  },
  activityPoints: {
    label: 'Activity',
    note: 'steady points volume and participation',
    tip: 'Show up consistently and keep banking real points so the activity component stays positive.',
  },
  achievements: {
    label: 'Achievements',
    note: 'earned bonus points from milestones',
    tip: 'Target repeatable and high-rarity achievements that fit your normal play patterns.',
  },
  clutch: {
    label: 'Clutch',
    note: 'closing out strong results from live pods',
    tip: 'Push more close games into wins and second places when the pod gets tight.',
  },
  commanderDiversity: {
    label: 'Commander Diversity',
    note: 'maintaining results across more commanders',
    tip: 'Keep a broader set of commanders active so your rating is less dependent on one deck.',
  },
}

const COMPARISON_TARGET_COLOR = '#f59e0b'
const COMPARISON_VIEWER_COLOR = '#38bdf8'

function formatFactorExplanation(factor: PlayerRatingFactorDetail) {
  switch (factor.key) {
    case 'commanderMMRContext':
      return 'Shows how often you finish better than your commander MMR would have predicted against the pods you faced.'
    case 'averageCommanderMMR':
      return 'Shows the average strength of the commanders you bring into league games.'
    case 'activityPoints':
      return 'A small rating boost based on the real points you have earned by playing.'
    default:
      return factor.formula
  }
}

function formatRawFactorValue(
  key: PlayerRatingBreakdownKey,
  rawValue: number,
  detailLines: string[] = [],
) {
  const detailSummary = detailLines
    .filter((line) => !line.toLowerCase().startsWith('raw ='))
    .slice(0, key === 'winRate' ? 2 : 1)
    .join(', ')

  const base = (() => {
  switch (key) {
    case 'recentPerformance':
      return `raw score ${round3(rawValue)}`
    case 'allTimePerformance':
      return `adjusted avg ${round3(rawValue)}`
    case 'winRate':
      return `win rate ${Math.round(rawValue * 100)}%`
    case 'commanderMMRContext':
      return `${Math.round(Math.max(0, Math.min(100, ((rawValue + 1.5) / 3) * 100)))}% MMR context`
    case 'averageCommanderMMR':
      return `avg commander MMR ${round3(rawValue)}`
    case 'activityPoints':
      return detailLines.find((line) => line.toLowerCase().startsWith('earned base points:'))
        ?.replace(/^earned base points:/i, 'total points:')
        .trim() ?? `total points ${round3(rawValue)}`
    case 'achievements':
      return `achievement value ${round3(rawValue)}`
    case 'clutch':
      return `clutch value ${round3(rawValue)}`
    case 'commanderDiversity':
      return `diversity score ${round3(rawValue)}`
    default:
      return `${round3(rawValue)}`
  }
  })()

  return detailSummary ? `${base}; ${detailSummary}` : base
}

function buildAlignedRatingSeries(
  history: PlayerRatingSnapshot[],
  valueGetter: (entry: PlayerRatingSnapshot) => number,
  tooltipGetter?: (entry: PlayerRatingSnapshot) => string,
) {
  const historyByGameId = new Map(history.map((entry) => [entry.gameId, entry]))
  let hasStarted = false
  let lastValue: number | null = null
  let lastTooltip: string | null = null

  const data = leagueTimeline.value.map((timelineEntry) => {
    const snapshot = historyByGameId.get(timelineEntry.gameId)
    if (snapshot) {
      hasStarted = true
      lastValue = valueGetter(snapshot)
      lastTooltip = tooltipGetter ? tooltipGetter(snapshot) : null
      return lastValue
    }

    return hasStarted ? lastValue : null
  })

  if (!tooltipGetter) {
    return { data }
  }

  hasStarted = false
  lastTooltip = null

  const tooltipData = leagueTimeline.value.map((timelineEntry) => {
    const snapshot = historyByGameId.get(timelineEntry.gameId)
    if (snapshot) {
      hasStarted = true
      lastTooltip = tooltipGetter(snapshot)
      return lastTooltip
    }

    return hasStarted ? lastTooltip : null
  })

  return { data, tooltipData }
}

const comparisonDetail = computed(() => {
  if (!detail.value || !compareDetail.value) return null

  const factorEntries = factorKeys
    .map((key) => {
      const targetCurrent = detail.value?.current?.factors[key]
      const viewerCurrent = compareDetail.value?.current?.factors[key]
      if (!targetCurrent || !viewerCurrent) return null

      return {
        key,
        label: PLAYER_RATING_FACTOR_META[key].label,
        note: PLAYER_RATING_FACTOR_META[key].note,
        tip: PLAYER_RATING_FACTOR_META[key].tip,
        delta: round3(targetCurrent.weightedContribution - viewerCurrent.weightedContribution),
        targetContribution: targetCurrent.weightedContribution,
        viewerContribution: viewerCurrent.weightedContribution,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))

  const leadingFactors = factorEntries.filter((entry) => entry.delta > 0.01)
  const viewerAdvantages = factorEntries.filter((entry) => entry.delta < -0.01)
  const topLabels = leadingFactors.slice(0, 3).map((entry) => entry.label)

  return {
    target: detail.value,
    viewer: compareDetail.value,
    ratingGap: round3(detail.value.rating - compareDetail.value.rating),
    leadingFactors,
    viewerAdvantages,
    summary: topLabels.length > 0
      ? `${detail.value.playerName} currently pulls ahead through ${joinNaturalLanguage(topLabels)}.`
      : `${compareDetail.value.playerName} already matches or exceeds ${detail.value.playerName} across the main rating factors.`,
    improvementIdeas: leadingFactors.slice(0, 4).map((entry) => PLAYER_RATING_FACTOR_META[entry.key].tip),
  }
})

const comparisonHistoryLabels = computed(() => leagueTimeline.value.map((entry) => entry.label))

const comparisonOverallSeries = computed(() => {
  if (!comparisonDetail.value) return []

  const targetSeries = buildAlignedRatingSeries(
    comparisonDetail.value.target.history,
    (entry) => entry.rating,
  )
  const viewerSeries = buildAlignedRatingSeries(
    comparisonDetail.value.viewer.history,
    (entry) => entry.rating,
  )

  return [
    {
      name: comparisonDetail.value.target.playerName,
      color: COMPARISON_TARGET_COLOR,
      data: targetSeries.data,
    },
    {
      name: comparisonDetail.value.viewer.playerName,
      color: COMPARISON_VIEWER_COLOR,
      data: viewerSeries.data,
    },
  ]
})

const comparisonFactorPanels = computed(() => {
  if (!comparisonDetail.value) return []

  return factorKeys
    .map((key) => {
      const targetCurrent = comparisonDetail.value?.target.current?.factors[key]
      const viewerCurrent = comparisonDetail.value?.viewer.current?.factors[key]
      if (!targetCurrent || !viewerCurrent) return null

      return {
        key,
        label: PLAYER_RATING_FACTOR_META[key].label,
        note: PLAYER_RATING_FACTOR_META[key].note,
        tip: PLAYER_RATING_FACTOR_META[key].tip,
        delta: round3(targetCurrent.weightedContribution - viewerCurrent.weightedContribution),
        targetContribution: targetCurrent.weightedContribution,
        viewerContribution: viewerCurrent.weightedContribution,
        series: [
          {
            name: comparisonDetail.value.target.playerName,
            color: COMPARISON_TARGET_COLOR,
            ...buildAlignedRatingSeries(
              comparisonDetail.value.target.history,
              (entry) => entry.factors[key].weightedContribution,
              (entry) => formatRawFactorValue(key, entry.factors[key].rawValue, entry.factors[key].detailLines),
            ),
          },
          {
            name: comparisonDetail.value.viewer.playerName,
            color: COMPARISON_VIEWER_COLOR,
            ...buildAlignedRatingSeries(
              comparisonDetail.value.viewer.history,
              (entry) => entry.factors[key].weightedContribution,
              (entry) => formatRawFactorValue(key, entry.factors[key].rawValue, entry.factors[key].detailLines),
            ),
          },
        ],
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
})

const factorPanels = computed(() =>
  factorKeys
    .map((key) => {
      const current = detail.value?.current?.factors[key]
      if (!current) return null

      return {
        key,
        current,
        series: [
          {
            name: 'Contribution',
            color: factorColors[key],
            ...buildAlignedRatingSeries(
              detail.value?.history ?? [],
              (entry) => entry.factors[key].weightedContribution,
              (entry) => formatRawFactorValue(key, entry.factors[key].rawValue, entry.factors[key].detailLines),
            ),
          },
        ],
      }
    })
    .filter((entry): entry is {
      key: PlayerRatingBreakdownKey
      current: PlayerRatingFactorDetail
      series: {
        name: string
        color: string
        data: Array<number | null>
        tooltipData?: Array<string | null>
      }[]
    } => Boolean(entry)),
)

const playerRecords = computed(() =>
  Object.values(gameRecords.value[props.playerName] ?? {})
    .sort((a, b) => compareGamesChronological(
      { date: games.value.find((game) => game.gameId === a.gameId)?.date ?? '', gameId: a.gameId },
      { date: games.value.find((game) => game.gameId === b.gameId)?.date ?? '', gameId: b.gameId },
    )),
)

const achievementSummary = computed(() => {
  const achievements = playerRecords.value.flatMap((record) => record.achievements)
  const totalPoints = achievements.reduce((sum, achievement) => sum + achievement.points, 0)
  const uniqueAchievements = new Set(achievements.map((achievement) => achievement.id)).size
  const counts = new Map<string, number>()
  for (const achievement of achievements) {
    counts.set(achievement.id, (counts.get(achievement.id) ?? 0) + 1)
  }

  return {
    totalPoints,
    totalUnlocks: achievements.length,
    uniqueAchievements,
    repeatableUnlocks: [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
  }
})

const achievementTimeline = computed(() => {
  const weeklyTotals = new Map<string, { label: string, total: number, sortValue: number }>()

  for (const record of playerRecords.value) {
    const gameDate = games.value.find((game) => game.gameId === record.gameId)?.date
    const week = getCalendarWeek(gameDate)
    const earnedPoints = record.achievements.reduce((sum, achievement) => sum + achievement.points, 0)
    if (earnedPoints <= 0) continue

    const current = weeklyTotals.get(week.key) ?? {
      label: week.label,
      total: 0,
      sortValue: week.sortValue,
    }
    current.total += earnedPoints
    weeklyTotals.set(week.key, current)
  }

  const orderedWeeks = [...weeklyTotals.values()].sort((a, b) => a.sortValue - b.sortValue)

  return {
    labels: orderedWeeks.map((entry) => entry.label),
    series: [
      {
        name: 'Achievement Pts',
        color: '#a78bfa',
        data: orderedWeeks.map((entry) => entry.total),
      },
    ],
  }
})

const achievementCards = computed(() => {
  const grouped = new Map<string, {
    id: string
    name: string
    icon: string
    points: number
    count: number
    dates: string[]
    rarity: string
    scope: string
    description: string
  }>()

  for (const record of playerRecords.value) {
    const gameDate = formatGameDate(games.value.find((game) => game.gameId === record.gameId)?.date)
    for (const achievement of record.achievements) {
      const def = achievementDefs.value[achievement.id]
      const current = grouped.get(achievement.id) ?? {
        id: achievement.id,
        name: achievement.name ?? def?.name ?? achievement.id,
        icon: achievement.icon ?? def?.icon ?? '🏆',
        points: achievement.points ?? def?.points ?? 0,
        count: 0,
        dates: [],
        rarity: def?.rarity ?? 'common',
        scope: def?.scope ?? 'league',
        description: def?.description ?? achievement.description ?? '',
      }
      current.count += 1
      current.dates.push(gameDate)
      grouped.set(achievement.id, current)
    }
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      name: entry.name || entry.id,
      rarityLabel: formatRarity(entry.rarity),
      dateLabel: entry.count === 1
        ? `Earned on ${entry.dates[0]}`
        : `Earned ${entry.count} times · latest ${entry.dates.at(-1)} · first ${entry.dates[0]}`,
    }))
    .sort((a, b) => {
      const countDiff = b.count - a.count
      if (countDiff !== 0) return countDiff
      const pointsDiff = b.points - a.points
      if (pointsDiff !== 0) return pointsDiff
      return (a.name || a.id).localeCompare(b.name || b.id)
    })
})

const xpSummary = computed(() => {
  const xpMap = players.value[props.playerName]?.commanderXP ?? {}
  const rows = Object.entries(xpMap).map(([commander, xp]) => {
    const { level } = getCommanderLevelProgress(xp)
    return { commander, level, xp }
  })
  const totalLevels = rows.reduce((sum, row) => sum + row.level, 0)
  const top = [...rows].sort((a, b) => b.level - a.level || b.xp - a.xp)[0]

  return {
    totalLevels,
    totalPoints: totalLevels * settings.value.level.pointsPerLevel,
    commanderCount: rows.length,
    topCommander: top?.commander ?? '—',
  }
})

const commanderGamesMap = computed(() => {
  const counts = new Map<string, number>()
  for (const record of playerRecords.value) {
    counts.set(record.commander, (counts.get(record.commander) ?? 0) + 1)
  }
  return counts
})

const commanderXpRows = computed(() => {
  const xpMap = players.value[props.playerName]?.commanderXP ?? {}
  return Object.entries(xpMap)
    .map(([commander, xp]) => {
      const { level, progressPct } = getCommanderLevelProgress(xp)
      return {
        commander,
        xp,
        level,
        progressPct,
        games: commanderGamesMap.value.get(commander) ?? 0,
      }
    })
    .sort((a, b) => b.level - a.level || b.xp - a.xp || a.commander.localeCompare(b.commander))
})

const commanderLevelTimeline = computed(() => {
  const labels = playerRecords.value.map((record) => {
    const gameDate = formatGameDate(games.value.find((game) => game.gameId === record.gameId)?.date)
    return `${gameDate} · ${record.commander}`
  })
  const commanders = [...new Set(playerRecords.value.map((record) => record.commander))]
  const levelState = new Map<string, number>()
  const dataMap = new Map<string, (number | null)[]>(commanders.map((commander) => [commander, []]))

  for (const record of playerRecords.value) {
    levelState.set(record.commander, Math.max(0, record.commanderLevelAfter ?? 0))
    for (const commander of commanders) {
      dataMap.get(commander)?.push(levelState.has(commander) ? levelState.get(commander) ?? 0 : null)
    }
  }

  return {
    labels,
    series: commanders.map((commander, index) => ({
      name: commander,
      color: TIMELINE_COLORS[index % TIMELINE_COLORS.length],
      data: dataMap.get(commander) ?? [],
    })),
  }
})

const commanderArtUrls = ref(new Map<string, string>())

watch(
  commanderXpRows,
  async (rows) => {
    const commanders = rows.map((row) => row.commander)
    await preloadCommanderImages(commanders, ['art_crop'])
    const next = new Map<string, string>()
    for (const commander of commanders) {
      next.set(commander, getCachedCommanderImage(commander, 'art_crop') ?? '')
    }
    commanderArtUrls.value = next
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
})

onMounted(() => {
  if (!import.meta.client) return
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('keydown', onKeyDown)
})

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    close()
  }
}

function close() {
  emit('update:modelValue', false)
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000
}

function joinNaturalLanguage(items: string[]) {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function compareGamesChronological(
  a: { date: string | Date, gameId: string },
  b: { date: string | Date, gameId: string },
) {
  const diff = new Date(a.date).getTime() - new Date(b.date).getTime()
  if (diff !== 0) return diff
  return a.gameId.localeCompare(b.gameId)
}

function fmt(value: number) {
  if (!Number.isFinite(value)) return '0'
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function formatGameDate(value: string | Date | undefined) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getCalendarWeek(value: string | Date | undefined) {
  const date = value ? new Date(value) : new Date(NaN)
  if (Number.isNaN(date.getTime())) {
    return { key: 'unknown', label: 'Unknown week', sortValue: Number.MAX_SAFE_INTEGER }
  }

  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay() || 7
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const year = utcDate.getUTCFullYear()

  return {
    key: `${year}-W${String(week).padStart(2, '0')}`,
    label: `W${String(week).padStart(2, '0')} ${year}`,
    sortValue: year * 100 + week,
  }
}

function formatRarity(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const TIMELINE_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#f472b6',
  '#34d399',
  '#a78bfa',
  '#fb7185',
  '#22c55e',
  '#f97316',
]
</script>

<style scoped lang="scss">
.rating-sidebar {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.rating-sidebar__scrim {
  position: absolute;
  inset: 0;
  background: rgba(6, 8, 14, 0.7);
  backdrop-filter: blur(3px);
}

.rating-sidebar__panel {
  position: absolute;
  top: 0;
  right: 0;
  width: min(760px, 100%);
  height: 100%;
  background:
    linear-gradient(180deg, rgba(20, 24, 38, 0.98), rgba(12, 16, 28, 0.98)),
    rgba(12, 16, 28, 0.98);
  border-left: 1px solid rgba($border-color, 0.85);
  box-shadow: -22px 0 50px rgba(0, 0, 0, 0.38);
  overflow-y: auto;
}

.rating-sidebar__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $spacing-4;
  padding: $spacing-4;
  background: rgba(12, 16, 28, 0.94);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba($border-color, 0.8);

  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba($color-primary-light, 0.35), transparent);
  }
}

.rating-sidebar__eyebrow {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba($color-primary-light, 0.8);
}

.rating-sidebar__title {
  margin: 6px 0 4px;
  font-size: clamp(1.7rem, 2.4vw, 2.2rem);
  color: $color-text;
  letter-spacing: -0.01em;
}

.rating-sidebar__meta {
  margin: 0;
  color: $color-text-muted;
  font-size: 0.95rem;
}

.rating-sidebar__close {
  border: 1px solid rgba($border-color, 0.8);
  background: rgba($color-bg-elevated, 0.75);
  color: $color-text-muted;
  border-radius: $border-radius-full;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;

  &:hover {
    background: rgba($color-bg-elevated, 1);
    color: $color-text;
    border-color: rgba($border-color, 1);
  }
}

.rating-sidebar__content {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-4;
}

.rating-sidebar__overview,
.rating-sidebar__factor {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-4;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.rating-sidebar__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: $spacing-3;
}

.rating-sidebar__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: $spacing-3;
  border-radius: $border-radius-lg;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba($border-color, 0.5);
  border-top: 2px solid rgba($color-primary-light, 0.3);
}

.rating-sidebar__stat-value {
  font-size: 1.4rem;
  font-weight: $font-weight-bold;
  color: $color-text;
  line-height: 1.1;
}

.rating-sidebar__stat-label {
  color: $color-text-muted;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.rating-sidebar__formula {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rating-sidebar__formula-title,
.rating-sidebar__factor-title {
  margin: 0;
  color: $color-text;
  font-size: 1rem;
  font-weight: $font-weight-semibold;
  letter-spacing: -0.01em;
}

.rating-sidebar__formula-line,
.rating-sidebar__formula-note,
.rating-sidebar__factor-description,
.rating-sidebar__factor-formula {
  color: $color-text-muted;
  line-height: 1.55;
}

.rating-sidebar__formula-note {
  color: #fbbf24;
}

.rating-sidebar__chart {
  min-height: 260px;
}

.rating-sidebar__chart--factor {
  min-height: 220px;
}

.rating-sidebar__factors {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.rating-sidebar__cards,
.rating-sidebar__xp-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: $spacing-3;
}

.rating-sidebar__xp-card {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: $spacing-3;
  padding: $spacing-3;
  border-radius: $border-radius-lg;
  border: 1px solid rgba($border-color, 0.6);
  border-top: 2px solid rgba($color-primary-light, 0.2);
  background: rgba(255, 255, 255, 0.035);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.rating-sidebar__xp-art {
  width: 92px;
  height: 128px;
  border-radius: $border-radius-md;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.rating-sidebar__xp-art-img,
.rating-sidebar__xp-art-placeholder {
  width: 100%;
  height: 100%;
  display: block;
}

.rating-sidebar__xp-art-img {
  object-fit: cover;
  object-position: center top;
}

.rating-sidebar__xp-art-placeholder {
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
}

.rating-sidebar__xp-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rating-sidebar__xp-head {
  display: flex;
  justify-content: space-between;
  gap: $spacing-2;
  align-items: flex-start;
}

.rating-sidebar__xp-name {
  margin: 0;
  font-size: 1rem;
  color: $color-text;
}

.rating-sidebar__xp-level {
  color: $color-primary-light;
  font-weight: $font-weight-semibold;
  white-space: nowrap;
}

.rating-sidebar__xp-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: $color-text-muted;
  font-size: 0.85rem;
}

.rating-sidebar__xp-bar {
  height: 8px;
  border-radius: $border-radius-full;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.rating-sidebar__xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-xp-start, $color-xp-end);
}

@keyframes mythic-shimmer {
  0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateX(220%) skewX(-18deg); opacity: 0; }
}

@keyframes mythic-pulse {
  0%, 100% { box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 18px rgba(255, 130, 40, 0.22); }
  50%       { box-shadow: 0 14px 30px rgba(0, 0, 0, 0.3), 0 0 30px rgba(255, 150, 60, 0.38); }
}

.achievement-card {
  position: relative;

  &__inner {
    --rarity-stripe: rgba(200, 195, 185, 0.25);
    --rarity-glow: rgba(200, 195, 185, 0.08);
    position: relative;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    padding: $spacing-3;
    padding-top: calc(#{$spacing-3} + 3px);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(180deg, rgba(13, 16, 23, 0.97), rgba(10, 12, 18, 0.97));
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.24);
    transition: box-shadow 200ms ease, border-color 200ms ease;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--rarity-stripe);
      z-index: 3;
      pointer-events: none;
    }
  }

  &__glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--rarity-glow), transparent 42%);
    pointer-events: none;
  }

  &__top,
  &__footer {
    display: flex;
    justify-content: space-between;
    gap: $spacing-2;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  &__main {
    display: flex;
    align-items: flex-start;
    gap: $spacing-2;
    min-height: 80px;
    position: relative;
    z-index: 1;
  }

  &__detail {
    position: relative;
    z-index: 1;
  }

  &__scope,
  &__status {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba($color-text-muted, 0.88);
  }

  &__rarity {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba($color-text, 0.9);
  }

  &__icon {
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    font-size: 24px;
    line-height: 1;
  }

  &__text {
    min-width: 0;
  }

  &__name {
    margin: 0 0 4px;
    font-size: 15px;
    line-height: 1.25;
    font-family: $font-family-base;
    color: $color-text;
  }

  &__description,
  &__detail {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: rgba($color-text, 0.78);
  }

  &__footer {
    margin-top: auto;
    padding-top: $spacing-2;
  }

  &__points {
    color: $color-accent;
    font-size: 12px;
    font-weight: $font-weight-bold;
  }

  &__status {
    color: rgba($color-text-muted, 0.92);
    font-size: 10px;
    font-weight: $font-weight-semibold;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  // ── Rarity tiers ──────────────────────────────────────────────────────────

  &--rarity-common .achievement-card__inner {
    --rarity-stripe: #9e9070;
    --rarity-glow: rgba(158, 144, 112, 0.13);
    border-color: rgba(158, 144, 112, 0.2);
    background: linear-gradient(180deg, rgba(18, 16, 12, 0.97), rgba(12, 11, 10, 0.97));
  }

  &--rarity-common .achievement-card__rarity { color: #b0a27e; }

  &--rarity-uncommon .achievement-card__inner {
    --rarity-stripe: #52c8a8;
    --rarity-glow: rgba(82, 200, 168, 0.16);
    border-color: rgba(82, 200, 168, 0.26);
    background: linear-gradient(160deg, rgba(0, 30, 26, 0.22) 0%, transparent 55%),
      linear-gradient(180deg, rgba(10, 15, 15, 0.97), rgba(9, 12, 12, 0.97));
  }

  &--rarity-uncommon .achievement-card__rarity { color: #52c8a8; }

  &--rarity-uncommon .achievement-card__icon {
    background: rgba(82, 200, 168, 0.1);
    border: 1px solid rgba(82, 200, 168, 0.15);
  }

  &--rarity-rare .achievement-card__inner {
    --rarity-stripe: #9b6ee8;
    --rarity-glow: rgba(155, 110, 232, 0.22);
    border-color: rgba(155, 110, 232, 0.34);
    background: linear-gradient(155deg, rgba(30, 10, 55, 0.26) 0%, transparent 55%),
      linear-gradient(180deg, rgba(12, 9, 20, 0.97), rgba(10, 8, 17, 0.97));
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.26), 0 0 0 1px rgba(155, 110, 232, 0.07);
  }

  &--rarity-rare .achievement-card__rarity { color: #9b6ee8; }

  &--rarity-rare .achievement-card__icon {
    background: rgba(155, 110, 232, 0.1);
    border: 1px solid rgba(155, 110, 232, 0.18);
  }

  &--rarity-mythic .achievement-card__inner {
    --rarity-stripe: #ff9030;
    --rarity-glow: rgba(255, 138, 40, 0.28);
    border-color: rgba(255, 148, 50, 0.44);
    background: linear-gradient(150deg, rgba(55, 18, 0, 0.28) 0%, rgba(30, 10, 0, 0.12) 50%, transparent 75%),
      linear-gradient(180deg, rgba(15, 10, 7, 0.97), rgba(10, 8, 6, 0.97));
    animation: mythic-pulse 3.2s ease-in-out infinite;

    &::before {
      background: linear-gradient(90deg, #d04010, #ffb830, #ffe870, #ffb830, #d04010);
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255, 210, 100, 0.07) 50%,
        transparent 60%
      );
      animation: mythic-shimmer 5s ease-in-out infinite;
      pointer-events: none;
      z-index: 2;
    }
  }

  &--rarity-mythic .achievement-card__rarity {
    color: #ffaa40;
    text-shadow: 0 0 10px rgba(255, 160, 50, 0.5);
  }

  &--rarity-mythic .achievement-card__name { color: #fff0d8; }

  &--rarity-mythic .achievement-card__icon {
    background: rgba(220, 110, 20, 0.14);
    border: 1px solid rgba(255, 148, 50, 0.24);
  }

  &--rarity-mythic .achievement-card__points {
    color: #ffb840;
    text-shadow: 0 0 8px rgba(255, 180, 60, 0.4);
  }
}

.rating-sidebar__factor-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $spacing-4;
}

.rating-sidebar__factor-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.rating-sidebar__factor-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba($border-color, 0.75);
  background: rgba(255, 255, 255, 0.04);
  color: $color-text-muted;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

.rating-sidebar__factor-pill--accent {
  border-color: rgba($color-primary-light, 0.45);
  color: $color-primary-light;
}

.rating-sidebar__factor-pill--target {
  border-color: rgba(#f59e0b, 0.4);
  color: #fcd34d;
}

.rating-sidebar__factor-pill--viewer {
  border-color: rgba(#38bdf8, 0.4);
  color: #7dd3fc;
}

.rating-sidebar__factor-list {
  margin: 0;
  padding-left: 1.2rem;
  color: $color-text-muted;
  display: grid;
  gap: 6px;
}

.rating-sidebar__state {
  padding: $spacing-4;
  color: $color-text-muted;
}

@media (max-width: 860px) {
  .rating-sidebar__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .rating-sidebar__factor-top {
    flex-direction: column;
  }

  .rating-sidebar__factor-stats {
    justify-content: flex-start;
  }

  .rating-sidebar__xp-card {
    grid-template-columns: 1fr;
  }

  .rating-sidebar__xp-art {
    width: 100%;
    height: 168px;
  }
}
</style>
