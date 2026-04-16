<template>
  <div class="page page--players">
    <header class="players-page__header">
      <h1 class="players-page__title">Players</h1>
      <span class="players-page__count">{{ standings.length }} players</span>
    </header>

    <div class="players-page__list">
      <NuxtLink
        v-for="player in standings"
        :key="player.name"
        class="player-card"
        :class="{
          'player-card--top1': player.rank === 1,
          'player-card--top2': player.rank === 2,
          'player-card--top3': player.rank === 3,
        }"
        :to="`/players/${encodeURIComponent(player.name)}`"
      >
        <!-- Portrait -->
        <div class="player-card__portrait-wrap">
          <img
            v-if="getPortrait(player.name)"
            :src="getPortrait(player.name)!"
            :alt="player.name"
            class="player-card__portrait"
          />
          <div v-else class="player-card__portrait-placeholder">
            {{ player.name.slice(0, 2).toUpperCase() }}
          </div>
          <div class="player-card__portrait-overlay" />
        </div>

        <!-- Body -->
        <div class="player-card__body">
          <div class="player-card__header">
            <span class="player-card__rank">{{ rankLabel(player.rank) }}</span>
            <span class="player-card__name">{{ player.name }}</span>
            <span v-if="getSignal(player.name)" class="player-card__signal-badge">
              {{ getSignal(player.name)!.title }}
            </span>
          </div>

          <div class="player-card__stats">
            <div class="player-card__stat">
              <span class="player-card__stat-val player-card__stat-val--score">{{ fmt(player.totalScore) }}</span>
              <span class="player-card__stat-lbl">Score</span>
            </div>
            <div class="player-card__stat">
              <span class="player-card__stat-val">{{ player.gamesPlayed }}</span>
              <span class="player-card__stat-lbl">Games</span>
            </div>
            <div class="player-card__stat">
              <span class="player-card__stat-val">{{ winRate(player) }}%</span>
              <span class="player-card__stat-lbl">Win %</span>
            </div>
            <div class="player-card__stat">
              <span class="player-card__stat-val player-card__stat-val--muted">{{ fmt(player.avgPerGame) }}</span>
              <span class="player-card__stat-lbl">Avg / Game</span>
            </div>
            <div v-if="topCommander(player.name)" class="player-card__stat player-card__stat--wide">
              <span class="player-card__stat-val player-card__stat-val--commander">{{ topCommander(player.name) }}</span>
              <span class="player-card__stat-lbl">Top Cmdr</span>
            </div>
            <div v-if="player.totalLPoints" class="player-card__stat">
              <span class="player-card__stat-val player-card__stat-val--lp">{{ fmt(player.totalLPoints) }}</span>
              <span class="player-card__stat-lbl">L-Pts</span>
            </div>
          </div>

          <p v-if="getSignal(player.name)" class="player-card__signal-summary">
            {{ getSignal(player.name)!.summary }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getFeaturedPlayers, type FeaturedPlayerCandidate } from '~/utils/featuredPlayer'
import { compareGamesChronological } from '~/composables/useLeagueState'

const { standings, gameRecords, games } = useLeagueState()

// ── Portrait images ────────────────────────────────────────────────────────────

const portraitModules = import.meta.glob('../../assets/img/*.png', { eager: true, import: 'default' }) as Record<string, string>

const portraits = Object.fromEntries(
  Object.entries(portraitModules).map(([path, url]) => {
    const name = path.split('/').pop()?.replace(/\.png$/i, '').toLowerCase() ?? ''
    return [name, url]
  }),
)

function getPortrait(playerName: string): string | null {
  return portraits[playerName.toLowerCase()] ?? null
}

// ── Game ordering ──────────────────────────────────────────────────────────────

const chronologicalGames = computed(() => [...games.value].sort(compareGamesChronological))

const gameOrderMap = computed(() =>
  new Map(chronologicalGames.value.map((game, i) => [game.gameId, i])),
)

// ── Featured signals (one per player where data is sufficient) ─────────────────

const featuredMap = computed((): Map<string, FeaturedPlayerCandidate> => {
  const candidates = getFeaturedPlayers(gameRecords.value, gameOrderMap.value)
  return new Map(candidates.map((c) => [c.name, c]))
})

function getSignal(playerName: string): FeaturedPlayerCandidate | null {
  return featuredMap.value.get(playerName) ?? null
}

// ── Per-player stats ───────────────────────────────────────────────────────────

function topCommander(playerName: string): string | null {
  const records = Object.values(gameRecords.value[playerName] ?? {})
  if (!records.length) return null
  const counts: Record<string, number> = {}
  for (const r of records) counts[r.commander] = (counts[r.commander] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function winRate(player: { gamesPlayed: number; baseWins: number }): number {
  return player.gamesPlayed > 0 ? Math.round((player.baseWins / player.gamesPlayed) * 100) : 0
}

function rankLabel(rank: number): string {
  return ['🥇', '🥈', '🥉'][rank - 1] ?? `#${rank}`
}

function fmt(n: number): string {
  if (n === 0) return '0'
  return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, '')
}
</script>

<style lang="scss" scoped>
.players-page {
  &__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-6;
    flex-wrap: wrap;
  }

  &__title {
    font-size: $font-size-2xl;
    color: $color-text;
  }

  &__count {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    max-width: 900px;
  }
}

// ── Player card ────────────────────────────────────────────────────────────────

.player-card {
  display: flex;
  align-items: stretch;
  background: $color-bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  color: $color-text;
  text-decoration: none;
  transition: border-color $transition-fast, transform $transition-fast, box-shadow $transition-fast;

  &:hover {
    border-color: rgba($color-primary, 0.5);
    transform: translateY(-1px);
    box-shadow: $shadow-md;
  }

  &--top1 {
    background: linear-gradient(105deg, rgba($color-primary, 0.2) 0%, $color-bg-card 55%);
    border-color: rgba($color-accent, 0.35);
  }

  &--top2 {
    background: linear-gradient(105deg, rgba($color-primary, 0.13) 0%, $color-bg-card 55%);
    border-color: rgba($color-primary-light, 0.22);
  }

  &--top3 {
    background: linear-gradient(105deg, rgba($color-primary, 0.08) 0%, $color-bg-card 55%);
    border-color: rgba($color-primary-light, 0.16);
  }

  // ── Portrait ─────────────────────────────────────────────────────────────────

  &__portrait-wrap {
    flex-shrink: 0;
    width: 82px;
    position: relative;
    overflow: hidden;
  }

  &__portrait {
    width: 100%;
    height: 100%;
    min-height: 90px;
    display: block;
    object-fit: cover;
    object-position: center top;
  }

  &__portrait-placeholder {
    width: 100%;
    height: 100%;
    min-height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: $font-size-xl;
    font-weight: $font-weight-bold;
    letter-spacing: 0.04em;
    color: rgba($color-text, 0.55);
    background:
      radial-gradient(ellipse at top, rgba($color-primary-light, 0.22), transparent 65%),
      linear-gradient(180deg, rgba($color-primary-dark, 0.55), rgba($color-bg-elevated, 0.85));
  }

  &__portrait-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 60%, rgba(0, 0, 0, 0.25));
    pointer-events: none;
  }

  // ── Body ─────────────────────────────────────────────────────────────────────

  &__body {
    flex: 1;
    min-width: 0;
    padding: $spacing-3 $spacing-4;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    justify-content: center;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex-wrap: wrap;
    row-gap: $spacing-1;
  }

  &__rank {
    font-size: $font-size-base;
    flex-shrink: 0;
  }

  &__name {
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    letter-spacing: 0.01em;
    color: $color-text;
  }

  &__signal-badge {
    margin-left: auto;
    padding: 2px 9px;
    border-radius: $border-radius-full;
    background: rgba($color-primary, 0.16);
    border: 1px solid rgba($color-primary-light, 0.28);
    color: $color-primary-light;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: $spacing-1 $spacing-2;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid $border-color;
    border-radius: $border-radius-md;
    min-width: 52px;

    &--wide {
      min-width: 80px;
      max-width: 160px;
      align-items: flex-start;
    }
  }

  &__stat-val {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    color: $color-text;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    line-height: 1.3;

    &--score     { color: $color-secondary; }
    &--lp        { color: $color-danger; }
    &--muted     { color: $color-text-muted; }
    &--commander { color: $color-text-muted; font-size: $font-size-xs; font-weight: $font-weight-normal; }
  }

  &__stat-lbl {
    font-size: 10px;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  // ── Signal summary ─────────────────────────────────────────────────────────────

  &__signal-summary {
    margin: 0;
    font-size: $font-size-xs;
    color: rgba($color-text-muted, 0.82);
    font-style: italic;
    line-height: 1.45;
    max-width: 70ch;
  }
}

// ── Responsive ────────────────────────────────────────────────────────────────

@media (max-width: $breakpoint-sm) {
  .player-card {
    &__portrait-wrap {
      width: 60px;
    }

    &__body {
      padding: $spacing-2 $spacing-3;
    }

    &__signal-badge {
      font-size: 9px;
      padding: 2px 6px;
    }

    &__signal-summary {
      display: none;
    }
  }
}
</style>
