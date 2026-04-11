<template>
  <div class="page page--player">
    <NuxtLink class="player__back" to="/">← Standings</NuxtLink>

    <template v-if="player">
      <h1 class="player__title">{{ playerId }}</h1>

      <!-- ── Stats cards ──────────────────────────────────────── -->
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

      <div v-if="leagueTimeline.length > 0" class="player__league-chart">
        <ChartsLeagueRankTimeline :points="leagueTimeline" />
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
                @mouseenter="onCardPreviewEnter(cmd.name, $event)"
                @mousemove="onCardPreviewMove($event)"
                @mouseleave="onCardPreviewLeave"
              >
                <img
                  v-if="artUrls.get(cmd.name)"
                  :src="artUrls.get(cmd.name)"
                  :alt="cmd.name"
                  class="cmd-row__card-img"
                />
                <div v-else class="cmd-row__card-placeholder" />
              </div>
              <div class="cmd-row__card-xp">
                <div class="cmd-row__level-row">
                  <span class="cmd-row__level-label">Lv {{ cmd.level }}</span>
                  <div class="cmd-row__bar-wrap">
                    <div class="cmd-row__bar-fill" :style="{ width: `${cmd.levelPct}%` }" />
                  </div>
                  <span class="cmd-row__level-next">{{ cmd.isMaxLevel ? 'MAX' : `Lv ${cmd.level + 1}` }}</span>
                </div>
                <div class="cmd-row__xp-detail">
                  <span class="cmd-row__xp-current">{{ cmd.xp }} XP</span>
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
                <span v-if="cmd.tier" class="cmd-row__tier">
                  <IconsTierIcon :tier="cmd.tier" :size="13" />
                  <span class="cmd-row__tier-label" :class="`tier-text--${cmd.tier}`">
                    {{ TIER_META[cmd.tier].label }}
                  </span>
                </span>
                <span
                  v-if="cmd.plays < 20 && cmd.projectedTier"
                  class="cmd-row__tier cmd-row__tier--projected"
                >
                  <IconsTierIcon :tier="cmd.projectedTier" :size="13" />
                  <span class="cmd-row__tier-prefix">Projected</span>
                  <span class="cmd-row__tier-label" :class="`tier-text--${cmd.projectedTier}`">
                    {{ TIER_META[cmd.projectedTier].label }}
                  </span>
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
                  <div class="cmd-row__stat">
                    <span class="cmd-row__stat-val cmd-row__stat-val--accent">{{ fmt(cmd.bestGame) }}</span>
                    <span class="cmd-row__stat-lbl">Best</span>
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
                <div
                  v-for="ach in cmd.achievements"
                  :key="ach.id"
                  class="cmd-row__ach"
                  :title="ach.description"
                >
                  <span class="cmd-row__ach-icon">{{ ach.icon }}</span>
                  <span class="cmd-row__ach-name">{{ ach.name }}</span>
                  <span class="cmd-row__ach-pts">+{{ ach.points }}</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-else class="player__not-found">
      Player "{{ playerId }}" not found.
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
import { fetchCardByName, getCardImageUrl } from '~/services/scryfallService'
import { xpToLevel, LEVEL_THRESHOLDS, MAX_LEVEL } from '~/utils/commanderExperience'
import { buildCommanderPlacementTimeline, type PlacementTimelinePoint } from '~/utils/commanderTimeline'
import { buildPlayerLeagueTimeline } from '~/utils/playerLeagueTimeline'
import { TIER_META, blendScore, getTier, smoothedTierScore } from '~/utils/tiers'
import { ACHIEVEMENTS } from '~/utils/achievements'
import type { Tier } from '~/utils/tiers'

const route = useRoute()
const playerId = computed(() => route.params.playerId as string)

const { games, commanders, players, gameRecords } = useLeagueState()

const player = computed(() => players.value[playerId.value] ?? null)
const chronologicalGames = computed(() => [...games.value].reverse())
const leagueTimeline = computed(() =>
  buildPlayerLeagueTimeline(chronologicalGames.value, gameRecords.value, playerId.value),
)

// ── Player-level stats ────────────────────────────────────────────────────────

function xpPoints(playerName: string): number {
  const xpMap = players.value[playerName]?.commanderXP ?? {}
  return Object.values(xpMap).reduce((s, xp) => s + xpToLevel(xp), 0)
}

const xpPts = computed(() => xpPoints(playerId.value))

const totalScore = computed(() => {
  if (!player.value) return 0
  return Math.round((player.value.totalPoints + player.value.achievementPoints + xpPts.value) * 1000) / 1000
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
  bestGame: number
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

const commanderRows = computed((): CommanderRow[] => {
  const allCommanderScores = Object.values(commanders.value)
    .filter((c) => c.gamesPlayed > 0)
    .map((c) => blendScore(c.totalBasePoints / c.gamesPlayed, c.wins / c.gamesPlayed))
  const globalAvgScore = allCommanderScores.length
    ? allCommanderScores.reduce((sum, score) => sum + score, 0) / allCommanderScores.length
    : 0

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
    const plays = records.length
    const first = records.filter((r) => r.placement === 1).length
    const second = records.filter((r) => r.placement === 2).length
    const last = records.filter((r) => r.placement === r.playerCount).length
    const totalPts = records.reduce((s, r) => s + r.basePoints, 0)
    const avgPoints = plays > 0 ? Math.round((totalPts / plays) * 1000) / 1000 : 0
    const winRatePct = plays > 0 ? Math.round((first / plays) * 100) : 0
    const sumPlace = records.reduce((s, r) => s + r.placement, 0)
    const avgPlacement = plays > 0 ? Math.round((sumPlace / plays) * 100) / 100 : 0
    const bestGame = Math.max(...records.map((r) => r.basePoints), 0)

    const rawScore = plays > 0 ? blendScore(totalPts / plays, first / plays) : 0
    const tier = plays > 0 ? getTier(rawScore, globalAvgScore) : null
    const playerAvgPts = player.value && player.value.gamesPlayed > 0
      ? player.value.totalBasePoints / player.value.gamesPlayed
      : 0
    const playerWinRate = player.value && player.value.gamesPlayed > 0
      ? player.value.baseWins / player.value.gamesPlayed
      : 0
    const projectedScore = plays > 0
      ? smoothedTierScore(totalPts, first, plays, playerAvgPts, playerWinRate)
      : 0
    const projectedTier = plays > 0 ? getTier(projectedScore, globalAvgScore) : null
    const xp = player.value?.commanderXP?.[name] ?? 0
    const level = xpToLevel(xp)
    const isMaxLevel = level >= MAX_LEVEL
    const maxXP = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
    const levelStart = LEVEL_THRESHOLDS[level - 1] ?? 0
    const levelEnd = isMaxLevel ? maxXP : (LEVEL_THRESHOLDS[level] ?? maxXP)
    const levelPct = isMaxLevel ? 100 : levelEnd === levelStart ? 100
      : Math.min(100, Math.round(((xp - levelStart) / (levelEnd - levelStart)) * 100))
    const xpToNext = isMaxLevel ? 0 : levelEnd - xp

    // XP score contribution: 1 point per level
    const xpScorePts = level
    const timeline = buildCommanderPlacementTimeline(
      chronologicalGames.value,
      gameRecords.value,
      playerId.value,
      name,
    )

    // Commander-scoped achievements (deduplicated by id)
    const cmdAchIds = earnedByCommander[name] ?? new Set()
    const achievements = [...cmdAchIds]
      .map((id) => ACHIEVEMENTS[id])
      .filter(Boolean)
      .map((def) => ({ id: def.id, name: def.name, description: def.description, icon: def.icon, points: def.points }))

    return {
      name, plays, first, second, last, winRate: winRatePct, avgPoints, avgPlacement,
      bestGame, tier, projectedTier, level, levelPct, xp, xpToNext, isMaxLevel, xpScorePts, timeline, achievements,
    }
  })
})

// ── Card art images ───────────────────────────────────────────────────────────

const artUrls = ref(new Map<string, string>())
const previewUrls = ref(new Map<string, string>())

watch(
  commanderRows,
  async (rows) => {
    const missing = rows.map((r) => r.name).filter((n) => !artUrls.value.has(n))
    if (missing.length === 0) return
    const results = await Promise.all(missing.map((n) => fetchCardByName(n)))
    results.forEach((card, i) => {
      const artUrl = card ? getCardImageUrl(card, 'art_crop') : null
      const previewUrl = card ? getCardImageUrl(card, 'normal') : null
      artUrls.value = new Map(artUrls.value).set(missing[i], artUrl ?? '')
      previewUrls.value = new Map(previewUrls.value).set(missing[i], previewUrl ?? '')
    })
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

// ── Sort ──────────────────────────────────────────────────────────────────────

const sortOptions = [
  { key: 'plays',     label: 'Plays' },
  { key: 'avgPoints', label: 'Avg Pts' },
  { key: 'winRate',   label: 'Win %' },
  { key: 'alpha',     label: 'A–Z' },
]

const sortKey = ref<string>('plays')

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
    margin-top: $spacing-6;
  }

  &__league-chart {
    margin-bottom: $spacing-8;
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
    width: 220px;
    display: flex;
    flex-direction: column;
    padding: $spacing-3 0 $spacing-3 $spacing-3;
    gap: $spacing-2;
  }

  &__card {
    border-radius: $border-radius-md;
    overflow: hidden;
    box-shadow: $shadow-md;
    flex-shrink: 0;
    cursor: zoom-in;
  }

  &__card-img {
    width: 100%;
    height: 170px;
    object-fit: cover;
    object-position: center top;
    display: block;
  }

  &__card-placeholder {
    width: 100%;
    height: 170px;
    background: $color-bg-elevated;
    border-radius: $border-radius-md;
  }

  &__card-xp {
    display: flex;
    flex-direction: column;
    gap: 3px;
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
  }

  &__stat-val {
    font-size: $font-size-base;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;

    &--secondary { color: $color-secondary; }
    &--accent    { color: $color-primary-light; }
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
    flex: 1;
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

  &__xp-detail {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
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

  &__ach-icon {
    font-size: 11px;
    line-height: 1;
  }

  &__ach-name {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__ach-pts {
    font-size: $font-size-xs;
    color: $color-accent;
    font-weight: $font-weight-semibold;
  }
}

@media (max-width: 1180px) {
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
</style>
