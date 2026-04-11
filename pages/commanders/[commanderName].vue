<template>
  <div class="page page--commander">
    <NuxtLink class="cmd-page__back" to="/">← Standings</NuxtLink>

    <template v-if="cmdState">

      <!-- ── Top: card + aggregate stats ──────────────────────────────── -->
      <div class="cmd-page__hero">

        <div class="cmd-page__card-wrap">
          <div class="cmd-page__card">
            <img
              v-if="imageUrl"
              :src="imageUrl"
              :alt="commanderName"
              class="cmd-page__card-img"
            />
            <div v-else class="cmd-page__card-placeholder" />
          </div>
        </div>

        <div class="cmd-page__hero-body">
          <div class="cmd-page__hero-header">
            <h1 class="cmd-page__title">{{ commanderName }}</h1>
            <span v-if="globalTier" class="cmd-page__tier">
              <IconsTierIcon :tier="globalTier" :size="15" />
              <span class="cmd-page__tier-label" :class="`tier-text--${globalTier}`">
                {{ TIER_META[globalTier].label }}
              </span>
            </span>
          </div>

          <div class="cmd-page__agg-stats">
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val">{{ cmdState.gamesPlayed }}</span>
              <span class="cmd-page__agg-lbl">Total Plays</span>
            </div>
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val">{{ globalWinRate }}%</span>
              <span class="cmd-page__agg-lbl">Win %</span>
            </div>
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val cmd-page__agg-val--secondary">{{ fmt(globalAvgPts) }}</span>
              <span class="cmd-page__agg-lbl">Avg Pts</span>
            </div>
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val">{{ cmdState.wins }}</span>
              <span class="cmd-page__agg-lbl">Wins</span>
            </div>
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val cmd-page__agg-val--muted">{{ cmdState.uniquePlayers.length }}</span>
              <span class="cmd-page__agg-lbl">Players</span>
            </div>
            <div class="cmd-page__agg-stat">
              <span class="cmd-page__agg-val cmd-page__agg-val--lp">{{ fmt(cmdState.totalLPoints) }}</span>
              <span class="cmd-page__agg-lbl">L-Points</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Player list ───────────────────────────────────────────────── -->
      <div class="cmd-page__section">
        <div class="cmd-page__section-header">
          <h2 class="cmd-page__section-title">Players</h2>
          <div class="cmd-page__sort">
            <button
              v-for="s in sortOptions"
              :key="s.key"
              class="cmd-page__sort-btn"
              :class="{ 'cmd-page__sort-btn--active': sortKey === s.key }"
              @click="sortKey = s.key"
            >{{ s.label }}</button>
          </div>
        </div>

        <div class="player-list">
          <div
            v-for="row in sortedPlayers"
            :key="row.playerName"
            class="player-row"
          >
            <div class="player-row__body">

              <!-- Name + tier -->
              <div class="player-row__header">
                <NuxtLink
                  class="player-row__name"
                  :to="`/players/${encodeURIComponent(row.playerName)}`"
                >{{ row.playerName }}</NuxtLink>
                <span v-if="row.tier" class="player-row__tier">
                  <IconsTierIcon :tier="row.tier" :size="12" />
                  <span class="player-row__tier-label" :class="`tier-text--${row.tier}`">
                    {{ TIER_META[row.tier].label }}
                  </span>
                </span>
                <span
                  v-if="row.plays < 20 && row.projectedTier"
                  class="player-row__tier player-row__tier--projected"
                >
                  <IconsTierIcon :tier="row.projectedTier" :size="12" />
                  <span class="player-row__tier-prefix">Projected</span>
                  <span class="player-row__tier-label" :class="`tier-text--${row.projectedTier}`">
                    {{ TIER_META[row.projectedTier].label }}
                  </span>
                </span>
              </div>

              <div class="player-row__stats-band">
                <!-- Stats pills -->
                <div class="player-row__stats">
                  <div class="player-row__stat" :class="{ 'player-row__stat--sorted': sortKey === 'plays' }">
                    <span class="player-row__stat-val">{{ row.plays }}</span>
                    <span class="player-row__stat-lbl">Plays</span>
                  </div>
                  <div class="player-row__stat" :class="{ 'player-row__stat--sorted': sortKey === 'avgPoints' }">
                    <span class="player-row__stat-val player-row__stat-val--secondary">{{ fmt(row.avgPoints) }}</span>
                    <span class="player-row__stat-lbl">Avg Pts</span>
                  </div>
                  <div class="player-row__stat" :class="{ 'player-row__stat--sorted': sortKey === 'winRate' }">
                    <span class="player-row__stat-val">{{ row.winRate }}%</span>
                    <span class="player-row__stat-lbl">Win %</span>
                  </div>
                  <div class="player-row__stat player-row__stat--gold">
                    <span class="player-row__stat-val">{{ row.first }}</span>
                    <span class="player-row__stat-lbl">🥇 1st</span>
                  </div>
                  <div class="player-row__stat">
                    <span class="player-row__stat-val">{{ row.second }}</span>
                    <span class="player-row__stat-lbl">🥈 2nd</span>
                  </div>
                  <div class="player-row__stat player-row__stat--danger">
                    <span class="player-row__stat-val">{{ row.last }}</span>
                    <span class="player-row__stat-lbl">💀 Last</span>
                  </div>
                </div>

                <ChartsPlacementTimeline
                  v-if="row.timeline.length > 0"
                  :points="row.timeline"
                  class="player-row__timeline"
                  compact
                />
              </div>

              <!-- XP / Level -->
              <div class="player-row__xp">
                <div class="player-row__level-row">
                  <span class="player-row__level-label">Lv {{ row.level }}</span>
                  <div class="player-row__bar-wrap">
                    <div class="player-row__bar-fill" :style="{ width: `${row.levelPct}%` }" />
                  </div>
                  <span class="player-row__level-next">{{ row.isMaxLevel ? 'MAX' : `Lv ${row.level + 1}` }}</span>
                  <span class="player-row__xp-current">{{ row.xp }} XP</span>
                  <span v-if="!row.isMaxLevel" class="player-row__xp-remaining">· {{ row.xpToNext }} to next</span>
                  <span class="player-row__xp-pts" title="Score points from XP levels">+{{ row.xpScorePts }} pts</span>
                </div>
              </div>

              <!-- Commander-scoped achievements for this player -->
              <div v-if="row.achievements.length > 0" class="player-row__achievements">
                <div
                  v-for="ach in row.achievements"
                  :key="ach.id"
                  class="player-row__ach"
                  :title="ach.description"
                >
                  <span class="player-row__ach-icon">{{ ach.icon }}</span>
                  <span class="player-row__ach-name">{{ ach.name }}</span>
                  <span class="player-row__ach-pts">+{{ ach.points }}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

    </template>

    <div v-else class="cmd-page__not-found">
      Commander "{{ commanderName }}" not found.
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchCardByName, getCardImageUrl } from '~/services/scryfallService'
import { xpToLevel, LEVEL_THRESHOLDS, MAX_LEVEL } from '~/utils/commanderExperience'
import { buildCommanderPlacementTimeline, type PlacementTimelinePoint } from '~/utils/commanderTimeline'
import { TIER_META, blendScore, getTier, smoothedTierScore } from '~/utils/tiers'
import { ACHIEVEMENTS } from '~/utils/achievements'
import type { Tier } from '~/utils/tiers'

const route = useRoute()
const commanderName = computed(() => route.params.commanderName as string)

const { games, commanders, players, gameRecords } = useLeagueState()

const cmdState = computed(() => commanders.value[commanderName.value] ?? null)
const chronologicalGames = computed(() => [...games.value].reverse())

// ── Card image ────────────────────────────────────────────────────────────────

const imageUrl = ref<string | null>(null)

watch(
  commanderName,
  async (name) => {
    imageUrl.value = null
    const card = await fetchCardByName(name)
    if (card) imageUrl.value = getCardImageUrl(card, 'normal')
  },
  { immediate: true },
)

// ── Global tier ───────────────────────────────────────────────────────────────

const globalTier = computed((): Tier | null => {
  const allCmds = Object.values(commanders.value).filter((c) => c.gamesPlayed > 0)
  if (allCmds.length === 0) return null
  const globalScores = allCmds.map((c) =>
    blendScore(c.totalBasePoints / c.gamesPlayed, c.wins / c.gamesPlayed),
  )
  const globalAvg = globalScores.reduce((s, r) => s + r, 0) / globalScores.length
  const cmd = cmdState.value
  if (!cmd || cmd.gamesPlayed === 0) return null
  const score = blendScore(cmd.totalBasePoints / cmd.gamesPlayed, cmd.wins / cmd.gamesPlayed)
  return getTier(score, globalAvg)
})

// ── Aggregate stats ───────────────────────────────────────────────────────────

const globalWinRate = computed(() => {
  const cmd = cmdState.value
  if (!cmd || cmd.gamesPlayed === 0) return 0
  return Math.round((cmd.wins / cmd.gamesPlayed) * 100)
})

const globalAvgPts = computed(() => {
  const cmd = cmdState.value
  if (!cmd || cmd.gamesPlayed === 0) return 0
  return Math.round((cmd.totalBasePoints / cmd.gamesPlayed) * 1000) / 1000
})

// ── Per-player rows ───────────────────────────────────────────────────────────

interface PlayerRow {
  playerName: string
  plays: number
  first: number
  second: number
  last: number
  winRate: number
  avgPoints: number
  tier: Tier | null
  projectedTier: Tier | null
  level: number
  levelPct: number
  xp: number
  xpToNext: number
  isMaxLevel: boolean
  xpScorePts: number
  timeline: PlacementTimelinePoint[]
  achievements: Array<{ id: string; name: string; description: string; icon: string; points: number }>
}

const playerRows = computed((): PlayerRow[] => {
  const name = commanderName.value
  const rows: PlayerRow[] = []
  const allCommanderScores = Object.values(commanders.value)
    .filter((c) => c.gamesPlayed > 0)
    .map((c) => blendScore(c.totalBasePoints / c.gamesPlayed, c.wins / c.gamesPlayed))
  const globalAvgScore = allCommanderScores.length
    ? allCommanderScores.reduce((sum, score) => sum + score, 0) / allCommanderScores.length
    : 0

  for (const [playerName, records] of Object.entries(gameRecords.value)) {
    const cmdRecords = Object.values(records).filter((r) => r.commander === name)
    if (cmdRecords.length === 0) continue

    const plays = cmdRecords.length
    const first = cmdRecords.filter((r) => r.placement === 1).length
    const second = cmdRecords.filter((r) => r.placement === 2).length
    const last = cmdRecords.filter((r) => r.placement === r.playerCount).length
    const totalPts = cmdRecords.reduce((s, r) => s + r.basePoints, 0)
    const avgPoints = Math.round((totalPts / plays) * 1000) / 1000
    const winRatePct = Math.round((first / plays) * 100)

    const rawScore = plays > 0 ? blendScore(totalPts / plays, first / plays) : 0
    const tier = plays > 0 ? getTier(rawScore, globalAvgScore) : null
    const playerAvgPts = players.value[playerName]?.gamesPlayed
      ? players.value[playerName].totalBasePoints / players.value[playerName].gamesPlayed
      : 0
    const playerWinRate = players.value[playerName]?.gamesPlayed
      ? players.value[playerName].baseWins / players.value[playerName].gamesPlayed
      : 0
    const projectedScore = plays > 0
      ? smoothedTierScore(totalPts, first, plays, playerAvgPts, playerWinRate)
      : 0
    const projectedTier = plays > 0 ? getTier(projectedScore, globalAvgScore) : null
    const xp = players.value[playerName]?.commanderXP?.[name] ?? 0
    const level = xpToLevel(xp)
    const isMaxLevel = level >= MAX_LEVEL
    const maxXP = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    const levelStart = LEVEL_THRESHOLDS[level - 1] ?? 0
    const levelEnd = isMaxLevel ? maxXP : (LEVEL_THRESHOLDS[level] ?? maxXP)
    const levelPct = isMaxLevel ? 100
      : levelEnd === levelStart ? 100
      : Math.min(100, Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100))
    const xpToNext = isMaxLevel ? 0 : levelEnd - xp
    const xpScorePts = level
    const timeline = buildCommanderPlacementTimeline(
      chronologicalGames.value,
      gameRecords.value,
      playerName,
      name,
    )

    // Commander-scoped achievements for this player with this commander
    const earnedIds = new Set(
      (players.value[playerName]?.earnedAchievements ?? [])
        .filter((a) => a.commander === name)
        .map((a) => a.id),
    )
    const achievements = [...earnedIds]
      .map((id) => ACHIEVEMENTS[id])
      .filter(Boolean)
      .map((def) => ({ id: def.id, name: def.name, description: def.description, icon: def.icon, points: def.points }))

    rows.push({
      playerName, plays, first, second, last, winRate: winRatePct, avgPoints,
      tier, projectedTier, level, levelPct, xp, xpToNext, isMaxLevel, xpScorePts, timeline, achievements,
    })
  }

  return rows
})

// ── Sort ──────────────────────────────────────────────────────────────────────

const TIER_ORDER: Record<string, number> = {
  diamond: 0, platinum: 1, gold: 2, silver: 3, bronze: 4, trash: 5,
}

const sortOptions = [
  { key: 'avgPoints', label: 'Avg Pts' },
  { key: 'plays',     label: 'Plays' },
  { key: 'winRate',   label: 'Win %' },
  { key: 'tier',      label: 'Tier' },
]

const sortKey = ref<string>('avgPoints')

const sortedPlayers = computed(() => {
  const rows = [...playerRows.value]
  switch (sortKey.value) {
    case 'plays':     return rows.sort((a, b) => b.plays - a.plays)
    case 'winRate':   return rows.sort((a, b) => b.winRate - a.winRate)
    case 'tier':      return rows.sort((a, b) => (TIER_ORDER[a.tier ?? 'trash'] ?? 5) - (TIER_ORDER[b.tier ?? 'trash'] ?? 5))
    default:          return rows.sort((a, b) => b.avgPoints - a.avgPoints)
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
// ── Page shell ────────────────────────────────────────────────────────────────

.cmd-page {
  &__back {
    display: inline-block;
    font-size: $font-size-sm;
    color: $color-text-muted;
    margin-bottom: $spacing-6;
    transition: color $transition-fast;

    &:hover { color: $color-primary-light; }
  }

  &__not-found {
    margin-top: $spacing-8;
    color: $color-text-muted;
    font-size: $font-size-lg;
  }

  // ── Hero ─────────────────────────────────────────────────────────────────

  &__hero {
    display: flex;
    gap: $spacing-6;
    margin-bottom: $spacing-8;
    align-items: flex-start;
  }

  &__card-wrap {
    flex-shrink: 0;
    padding: $spacing-3;
  }

  &__card {
    border-radius: $border-radius-md;
    overflow: hidden;
    box-shadow: $shadow-lg;
    width: 220px;
  }

  &__card-img {
    width: 100%;
    display: block;
  }

  &__card-placeholder {
    width: 220px;
    height: 308px;
    background: $color-bg-elevated;
    border-radius: $border-radius-md;
  }

  &__hero-body {
    flex: 1;
    padding-top: $spacing-3;
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
  }

  &__hero-header {
    display: flex;
    align-items: baseline;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__title {
    font-size: $font-size-3xl;
    font-weight: $font-weight-bold;
    color: $color-text;
  }

  &__tier {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  &__tier-label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    text-transform: uppercase;
    letter-spacing: 0.06em;

    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }

  &__agg-stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
  }

  &__agg-stat {
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

  &__agg-val {
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;

    &--secondary { color: $color-secondary; }
    &--muted     { color: $color-text-muted; }
    &--lp        { color: $color-danger; }
  }

  &__agg-lbl {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  // ── Section ───────────────────────────────────────────────────────────────

  &__section {
    margin-top: $spacing-2;
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
}

// ── Player list ───────────────────────────────────────────────────────────────

.player-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.player-row {
  background: $color-bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: border-color $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.4);
  }

  &__body {
    padding: $spacing-3 $spacing-4;
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

    &.tier-text--diamond  { color: $tier-diamond-color; }
    &.tier-text--platinum { color: $tier-platinum-color; }
    &.tier-text--gold     { color: $tier-gold-color; }
    &.tier-text--silver   { color: $tier-silver-color; }
    &.tier-text--bronze   { color: $tier-bronze-color; }
    &.tier-text--trash    { color: $tier-trash-color; }
  }

  // ── Stats pills ───────────────────────────────────────────────────────────

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

      .player-row__stat-lbl { color: $color-primary-light; }
    }

    &--gold   .player-row__stat-val { color: $color-accent; }
    &--danger .player-row__stat-val { color: $color-danger; }
  }

  &__stat-val {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;

    &--secondary { color: $color-secondary; }
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
    flex-wrap: wrap;
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
    width: 120px;
    height: 5px;
    background: $color-bg-elevated;
    border-radius: $border-radius-full;
    overflow: hidden;
    flex-shrink: 0;
  }

  &__bar-fill {
    height: 100%;
    background: linear-gradient(90deg, $color-primary, $color-primary-light);
    border-radius: $border-radius-full;
    transition: width $transition-slow;
  }

  &__xp-current  { font-size: $font-size-xs; color: $color-text-muted; }
  &__xp-remaining { font-size: $font-size-xs; color: $color-text-muted; }

  &__xp-pts {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-primary-light;
    margin-left: auto;
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

  &__ach {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba($color-accent, 0.08);
    border: 1px solid rgba($color-accent, 0.2);
    border-radius: $border-radius-full;
    padding: 2px $spacing-2;
    cursor: default;
  }

  &__ach-icon  { font-size: 11px; line-height: 1; }
  &__ach-name  { font-size: $font-size-xs; color: $color-text-muted; }
  &__ach-pts   { font-size: $font-size-xs; color: $color-accent; font-weight: $font-weight-semibold; }
}

@media (max-width: 1180px) {
  .player-row {
    &__timeline {
      width: 100%;
      min-width: 0;
      flex-basis: 100%;
      margin-left: 0;
    }
  }
}
</style>
