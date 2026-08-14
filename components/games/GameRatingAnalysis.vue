<script setup lang="ts">
import {
  buildPlayerRatingDetail,
  type PlayerRatingBreakdownKey,
  type PlayerRatingSnapshot,
} from '~/composables/usePlayerRating'
import { compareGamesChronological, type ProcessedGame } from '~/composables/useLeagueState'
import { formatPlayerName } from '~/utils/playerNames'
import { getResolvedLeagueSettings } from '~/utils/leagueSettings'

const props = defineProps<{
  game: ProcessedGame | null
}>()

const { games, players, gameRecords } = useLeagueState()
const { settings } = useLeagueSettings()

type RatingRow = {
  key: PlayerRatingBreakdownKey
  label: string
  rawBefore: number
  rawAfter: number
  ratingContributionBefore: number
  ratingContributionAfter: number
}

type PlayerAnalysis = {
  name: string
  commander: string
  placement: number
  gamePoints: number
  lPoints: number
  ratingBefore: number
  ratingAfter: number
  rows: RatingRow[]
}

const resolvedSettings = computed(() => getResolvedLeagueSettings(settings.value))
const isPlayerRatingMode = computed(() =>
  resolvedSettings.value.playerRankingSystem === 'player_rating_based'
  && !resolvedSettings.value.playerRating.simpleMmr.enabled,
)
const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))
const totalFactorWeight = computed(() =>
  Object.values(resolvedSettings.value.playerRating.weights).reduce((sum, weight) => sum + weight, 0) || 1,
)

const analyses = computed<PlayerAnalysis[]>(() => {
  if (!props.game || !isPlayerRatingMode.value) return []

  const minimumRating = resolvedSettings.value.playerRating.minRating
  return [...props.game.players]
    .sort((a, b) => a.placement - b.placement || a.name.localeCompare(b.name))
    .map((gamePlayer) => {
      const playerName = formatPlayerName(gamePlayer.name)
      const player = players.value[playerName]
      const record = gameRecords.value[playerName]?.[props.game!.gameId]
      if (!player || !record) return null

      const detail = buildPlayerRatingDetail({
        player,
        players: players.value,
        gameRecords: gameRecords.value,
        games: chronologicalGames.value,
        settings: settings.value,
      })
      const snapshotIndex = detail.history.findIndex((snapshot) => snapshot.gameId === props.game!.gameId)
      const after = detail.history[snapshotIndex]
      if (!after) return null
      const before = detail.history[snapshotIndex - 1] ?? emptySnapshot(minimumRating)

      const rows = (Object.keys(after.breakdown) as PlayerRatingBreakdownKey[])
        .filter((key) => after.breakdown[key].weight > 0)
        .map((key) => ({
          key,
          label: after.factors[key].label,
          rawBefore: before.breakdown[key].rawValue,
          rawAfter: after.breakdown[key].rawValue,
          ratingContributionBefore: toRatingContribution(before, key),
          ratingContributionAfter: toRatingContribution(after, key),
        }))

      return {
        name: playerName,
        commander: record.commander,
        placement: record.placement,
        gamePoints: record.finalPoints,
        lPoints: record.lPoints,
        ratingBefore: before.rating,
        ratingAfter: after.rating,
        rows,
      }
    })
    .filter((analysis): analysis is PlayerAnalysis => analysis !== null)
})

function emptySnapshot(rating: number): PlayerRatingSnapshot {
  const breakdown = Object.fromEntries(
    [
      'recentPerformance', 'allTimePerformance', 'seasonPoints', 'winRate', 'commanderMMRContext',
      'averageCommanderMMR', 'activityPoints', 'achievements', 'clutch', 'commanderDiversity',
    ].map((key) => [key, { rawValue: 0, normalizedScore: 0, weight: 0, weightedContribution: 0 }]),
  ) as PlayerRatingSnapshot['breakdown']
  return {
    gameId: '', date: '', label: '', system: 'composite', commander: '', placement: 0,
    rating, weightedScore: 0, provisional: true, gamesPlayed: 0, confidenceMultiplier: 0,
    breakdown, factors: {} as PlayerRatingSnapshot['factors'],
  }
}

function placementLabel(placement: number) {
  return `${placement}${placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th'}`
}

function signed(value: number, digits = 2) {
  const rounded = Number(value.toFixed(digits))
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US', { maximumFractionDigits: digits })}`
}

function factorChange(row: RatingRow) {
  if (row.key === 'seasonPoints') {
    return `${row.rawBefore.toFixed(3)} → ${row.rawAfter.toFixed(3)}`
  }
  if (row.key === 'winRate') {
    return `${(row.rawBefore * 100).toFixed(1)}% → ${(row.rawAfter * 100).toFixed(1)}%`
  }
  return signed(row.rawAfter - row.rawBefore)
}

function toRatingContribution(snapshot: PlayerRatingSnapshot, key: PlayerRatingBreakdownKey) {
  const ratingSpan = resolvedSettings.value.playerRating.maxRating - resolvedSettings.value.playerRating.minRating
  const scoreShare = snapshot.breakdown[key].weightedContribution / totalFactorWeight.value
  const confidenceAdjustedShare = scoreShare * snapshot.confidenceMultiplier
  return (confidenceAdjustedShare / 100) * ratingSpan
}
</script>

<template>
  <section class="game-rating-analysis">
    <template v-if="game">
      <header class="game-rating-analysis__header">
        <span class="game-rating-analysis__eyebrow">Selected game</span>
        <strong>{{ new Date(game.date).toLocaleDateString('de-DE') }}</strong>
        <span>{{ game.gameId }}</span>
      </header>

      <p v-if="!isPlayerRatingMode" class="game-rating-analysis__empty">
        Per-game factor changes are available when Player Rating is the active ranking system.
      </p>

      <div v-else class="game-rating-analysis__players">
        <article v-for="player in analyses" :key="player.name" class="game-rating-analysis__player">
          <header class="game-rating-analysis__player-header">
            <div>
              <strong>{{ player.name }}</strong>
              <span>{{ player.commander }}</span>
            </div>
            <span class="game-rating-analysis__placement">{{ placementLabel(player.placement) }}</span>
          </header>

          <div class="game-rating-analysis__game-points">
            <span>Game points <strong>{{ signed(player.gamePoints) }}</strong></span>
            <span>L-points <strong>{{ signed(player.lPoints) }}</strong></span>
          </div>

          <div class="game-rating-analysis__factor-head">
            <span>Rating factor</span><span>Value / change</span><span>Partial rating</span>
          </div>
          <div v-for="row in player.rows" :key="row.key" class="game-rating-analysis__factor">
            <span>{{ row.label }}</span>
            <span :class="{ 'is-positive': row.key !== 'seasonPoints' && row.key !== 'winRate' && row.rawAfter - row.rawBefore > 0, 'is-negative': row.key !== 'seasonPoints' && row.key !== 'winRate' && row.rawAfter - row.rawBefore < 0 }">
              {{ factorChange(row) }}
            </span>
            <span :class="{ 'is-positive': row.ratingContributionAfter - row.ratingContributionBefore > 0, 'is-negative': row.ratingContributionAfter - row.ratingContributionBefore < 0 }">
              {{ signed(row.ratingContributionAfter - row.ratingContributionBefore) }}
            </span>
          </div>

          <footer class="game-rating-analysis__total">
            <span>Player rating</span>
            <div>
              <strong :class="{ 'is-positive': player.ratingAfter - player.ratingBefore > 0, 'is-negative': player.ratingAfter - player.ratingBefore < 0 }">
                {{ signed(player.ratingAfter - player.ratingBefore) }}
              </strong>
              <strong>{{ player.ratingAfter.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</strong>
            </div>
          </footer>
        </article>
      </div>
    </template>
    <p v-else class="game-rating-analysis__empty">Select a game to inspect its Player Rating impact.</p>
  </section>
</template>

<style lang="scss" scoped>
.game-rating-analysis { padding: $spacing-4; border: 1px solid rgba($color-primary-light, .25); border-radius: $border-radius-lg; background: rgba($color-bg-elevated, .72); }
.game-rating-analysis__header { display: grid; gap: 2px; margin-bottom: $spacing-4; color: $color-text-muted; font-size: $font-size-xs; }
.game-rating-analysis__header strong { color: $color-text; font-size: $font-size-base; }
.game-rating-analysis__eyebrow { color: $color-primary-light; font-size: $font-size-xs; font-weight: $font-weight-semibold; text-transform: uppercase; letter-spacing: .08em; }
.game-rating-analysis__players { display: grid; gap: $spacing-4; }
.game-rating-analysis__player { overflow: hidden; border: 1px solid rgba($border-color, .7); border-radius: $border-radius-md; background: rgba($color-bg, .45); }
.game-rating-analysis__player-header { display:flex; justify-content:space-between; gap:$spacing-3; padding:$spacing-3; border-bottom:1px solid rgba($border-color,.55); }
.game-rating-analysis__player-header div { display:grid; gap:2px; min-width:0; }
.game-rating-analysis__player-header span { color:$color-text-muted; font-size:$font-size-xs; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.game-rating-analysis__placement { color:$color-primary-light !important; font-weight:$font-weight-bold; }
.game-rating-analysis__game-points { display:flex; justify-content:space-between; gap:$spacing-2; padding:$spacing-2 $spacing-3; color:$color-text-muted; font-size:$font-size-xs; }
.game-rating-analysis__game-points strong { color:$color-text; }
.game-rating-analysis__factor-head, .game-rating-analysis__factor { display:grid; grid-template-columns:minmax(0,1fr) 94px 86px; gap:$spacing-2; align-items:center; padding:$spacing-2 $spacing-3; font-size:$font-size-xs; }
.game-rating-analysis__factor-head { border-top:1px solid rgba($border-color,.55); color:$color-text-muted; font-size:10px; text-transform:uppercase; letter-spacing:.03em; }
.game-rating-analysis__factor { border-top:1px solid rgba($border-color,.35); }
.game-rating-analysis__factor span:not(:first-child) { text-align:right; font-variant-numeric:tabular-nums; }
.game-rating-analysis__total { display:grid; gap:$spacing-2; margin-top:$spacing-2; padding:$spacing-3; border-top:1px solid rgba($color-primary-light,.3); background:rgba($color-primary,.08); font-size:$font-size-sm; }
.game-rating-analysis__total > div { display:grid; gap:$spacing-2; justify-items:end; font-variant-numeric:tabular-nums; }
.game-rating-analysis__total > div strong:last-child { width:100%; padding-top:$spacing-2; border-top:1px solid rgba($color-primary-light,.35); text-align:right; color:$color-text; }
.game-rating-analysis__empty { margin:0; color:$color-text-muted; font-size:$font-size-sm; line-height:1.5; }
.is-positive { color:$color-success; }
.is-negative { color:$color-danger; }
</style>
