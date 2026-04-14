<template>
  <div class="game-card">
    <!-- Commander art strip on the left -->
    <div class="game-card__art">
      <!-- Winner — larger, full color -->
      <div class="game-card__art-winner">
        <img
          v-if="artUrls.get(winnerCommander)"
          :src="artUrls.get(winnerCommander)"
          :alt="winnerCommander"
          class="game-card__art-img"
        />
        <div v-else class="game-card__art-placeholder" />
      </div>

      <!-- Other commanders — grayscale row at bottom -->
      <div v-if="otherCommanders.length" class="game-card__art-others">
        <div
          v-for="cmd in otherCommanders"
          :key="cmd"
          class="game-card__art-other"
        >
          <img
            v-if="artUrls.get(cmd)"
            :src="artUrls.get(cmd)"
            :alt="cmd"
            class="game-card__art-img game-card__art-img--gray"
          />
          <div v-else class="game-card__art-placeholder" />
        </div>
      </div>
    </div>

    <!-- Game body -->
    <div class="game-card__body">
      <div class="game-card__header">
        <span class="game-card__id">{{ game.gameId }}</span>
        <span class="game-card__date">{{ formattedDate }}</span>
        <span class="game-card__week">W{{ game.week }}</span>
      </div>

      <div class="game-card__players">
        <div
          v-for="player in sortedPlayers"
          :key="player.name"
          class="game-card__player"
          :class="`game-card__player--place-${player.placement}`"
        >
          <span class="game-card__placement">{{ placementLabel(player.placement) }}</span>
          <span class="game-card__name-cell">
            <NuxtLink
              class="game-card__name"
              :to="`/players/${encodeURIComponent(player.name)}`"
              @mouseenter="onPlayerEnter(player.name, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onPlayerLeave"
            >{{ player.name }}</NuxtLink>
            <span
              v-if="rankDelta(player.name) !== 0"
              class="game-card__rank-delta"
              :class="rankDelta(player.name) > 0 ? 'game-card__rank-delta--up' : 'game-card__rank-delta--down'"
              :title="`Rank at game time: #${rankBefore(player.name)} → #${rankAfter(player.name)}`"
            >{{ rankDelta(player.name) > 0 ? '▲' : '▼' }}{{ Math.abs(rankDelta(player.name)) }}</span>
          </span>
          <span class="game-card__commander-cell">
            <IconsTierIcon
              v-if="playerTier(player.name, player.commander)"
              :tier="playerTier(player.name, player.commander)!"
              :size="13"
              :title="getTierMeta(player.name, player.commander)?.label"
            />
            <NuxtLink
              class="game-card__commander"
              :to="`/commanders/${encodeURIComponent(player.commander)}`"
              @mouseenter="onCommanderEnter(player.name, player.commander, $event)"
              @mousemove="onMouseMove($event)"
              @mouseleave="onCommanderLeave"
            >{{ player.commander }}</NuxtLink>
            <span
              v-for="ach in gameAchievements(player.name)"
              :key="ach.id"
              class="game-card__achievement"
              :title="ach.name + ': ' + ach.description"
            >{{ ach.icon }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Player info panel -->
  <Teleport to="body">
    <div
      v-if="playerHover.visible"
      class="floating-panel"
      :style="{ top: `${playerHover.y}px`, left: `${playerHover.x}px` }"
    >
      <GamesGameInformation
        :player-name="playerHover.name"
        :game-id="game.gameId"
      />
    </div>
  </Teleport>

  <!-- Commander tooltip -->
  <Teleport to="body">
    <div
      v-if="commanderHover.visible"
      class="floating-panel"
      :style="{ top: `${commanderHover.y}px`, left: `${commanderHover.x}px` }"
    >
      <GamesCommanderMetaInformation
        :player-name="commanderHover.playerName"
        :commander-name="commanderHover.name"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { ProcessedGame, ProcessedGamePlayer } from '~/composables/useLeagueState'
import { TIER_META, blendScore, getTier, type Tier } from '~/utils/tiers'
import { ACHIEVEMENTS } from '~/utils/achievements'

const props = defineProps<{ game: ProcessedGame }>()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()

const formattedDate = computed(() =>
  new Date(props.game.date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
)

const sortedPlayers = computed(() =>
  [...props.game.players].sort((a, b) => a.placement - b.placement)
)

function placementLabel(p: number) {
  return ['🥇', '🥈', '🥉'][p - 1] ?? `${p}.`
}

const { commanders, gameRecords } = useLeagueState()

const globalCommanderBaseline = computed(() => {
  const scores = Object.values(commanders.value)
    .filter((commander) => commander.gamesPlayed > 0)
    .map((commander) => blendScore(
      commander.totalBasePoints / commander.gamesPlayed,
      commander.wins / commander.gamesPlayed,
    ))

  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
})

function playerTier(playerName: string, commander: string): Tier | null {
  const records = Object.values(gameRecords.value[playerName] ?? {}).filter(
    (record) => record.commander === commander,
  )
  if (records.length === 0) return null

  const totalBasePoints = records.reduce((sum, record) => sum + record.basePoints, 0)
  const wins = records.filter((record) => record.basePoints === 1).length
  const rawScore = blendScore(totalBasePoints / records.length, wins / records.length)

  return getTier(rawScore, globalCommanderBaseline.value, records.length)
}

function getTierMeta(playerName: string, commander: string) {
  const tier = playerTier(playerName, commander)
  return tier ? TIER_META[tier] : null
}

function gameAchievements(playerName: string) {
  return (gameRecords.value[playerName]?.[props.game.gameId]?.achievements ?? [])
    .map((a) => ACHIEVEMENTS[a.id])
    .filter(Boolean)
}

// ── Commander art ──────────────────────────────────────────────────────────────

// Winner is the player at placement 1 (first after sort)
const winnerCommander = computed(
  () => (sortedPlayers.value[0] as ProcessedGamePlayer | undefined)?.commander ?? '',
)

// Unique commanders of non-winning players, preserving order, no duplicates
const otherCommanders = computed(() => {
  const seen = new Set([winnerCommander.value])
  const result: string[] = []
  for (const p of sortedPlayers.value.slice(1)) {
    if (!seen.has(p.commander)) {
      seen.add(p.commander)
      result.push(p.commander)
    }
  }
  return result
})

const artUrls = ref(new Map<string, string>())

watch(
  () => [winnerCommander.value, ...otherCommanders.value],
  async (commanders) => {
    const names = commanders.filter(Boolean)
    await preloadCommanderImages(names, ['art_crop'])

    const nextArtUrls = new Map<string, string>()
    for (const name of names) {
      nextArtUrls.set(name, getCachedCommanderImage(name, 'art_crop') ?? '')
    }
    artUrls.value = nextArtUrls
  },
  { immediate: true },
)

// ── Shared mouse helpers ───────────────────────────────────────────────────────

const OFFSET_X = 16
const OFFSET_Y = 16

function calcPosition(e: MouseEvent, width: number, height: number) {
  let x = e.clientX + OFFSET_X
  let y = e.clientY + OFFSET_Y
  if (x + width > window.innerWidth) x = e.clientX - width - OFFSET_X
  if (y + height > window.innerHeight) y = e.clientY - height - OFFSET_Y
  return { x: x + window.scrollX, y: y + window.scrollY }
}

function onMouseMove(e: MouseEvent) {
  if (playerHover.visible) {
    const pos = calcPosition(e, 260, 320)
    playerHover.x = pos.x
    playerHover.y = pos.y
  }
  if (commanderHover.visible) {
    const pos = calcPosition(e, 240, 380)
    commanderHover.x = pos.x
    commanderHover.y = pos.y
  }
}

// ── Player info hover ──────────────────────────────────────────────────────────

const playerHover = reactive({ visible: false, name: '', x: 0, y: 0 })

function onPlayerEnter(name: string, e: MouseEvent) {
  playerHover.name = name
  playerHover.visible = true
  const pos = calcPosition(e, 260, 320)
  playerHover.x = pos.x
  playerHover.y = pos.y
}

function onPlayerLeave() {
  playerHover.visible = false
}

// ── Commander card hover ───────────────────────────────────────────────────────

const commanderHover = reactive({
  visible: false,
  playerName: '',
  name: '',
  x: 0,
  y: 0,
})

function onCommanderEnter(playerName: string, commanderName: string, e: MouseEvent) {
  commanderHover.playerName = playerName
  commanderHover.name = commanderName
  commanderHover.visible = true
  const pos = calcPosition(e, 240, 380)
  commanderHover.x = pos.x
  commanderHover.y = pos.y
}

function onCommanderLeave() {
  commanderHover.visible = false
}

// ── Rank change helpers ────────────────────────────────────────────────────────

function rankBefore(playerName: string): number {
  return gameRecords.value[playerName]?.[props.game.gameId]?.rankBefore ?? 0
}

function rankAfter(playerName: string): number {
  return gameRecords.value[playerName]?.[props.game.gameId]?.rankAfter ?? 0
}

function rankDelta(playerName: string): number {
  const before = rankBefore(playerName)
  const after = rankAfter(playerName)
  if (!before || !after) return 0
  return before - after // positive = rose (rank number got smaller)
}
</script>

<style lang="scss" scoped>
.game-card {
  display: flex;
  background: rgba(16, 16, 16, 0.25);
  backdrop-filter:blur(3px);
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: border-color $transition-fast;
    transition:0.15s;

  &:hover {
    border-color: $color-primary;
    transform:scale(1.05);
    @include dropshadow();
    transition:0.3s;
  }

  // ── Art panel ──────────────────────────────────────────────────────────────

  &__art {
    flex-shrink: 0;
    width: 140px;
    display: flex;
    flex-direction: column;
  }

  &__art-winner {
    flex: 1;
    padding:10px;
    overflow: hidden;
  }

  &__art-others {
    display: flex;
    padding:5px;
    height: 58px;
    border-top: 1px solid $border-color;
  }

  &__art-other {
    flex: 1;
    margin:3px;
    overflow: hidden;

    & + & {
      border-left: 1px solid $border-color;
    }
  }

  &__art-img {
    width: 100%;
    height: 100%;
    border-radius:3px;
    object-fit: cover;
    object-position: center top;
    display: block;

    &--gray {
      filter: grayscale(80%) brightness(0.75);
    }
  }

  &__art-placeholder {
    width: 100%;
    height: 100%;
    background: $color-bg-elevated;
  }

  // ── Body ───────────────────────────────────────────────────────────────────

  &__body {
    flex: 1;
    padding: $spacing-4 $spacing-6;
    min-width: 0;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-3;
    padding-bottom: $spacing-3;
    border-bottom: 1px solid $border-color;
  }

  &__id {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-family: monospace;
  }

  &__date {
    font-size: $font-size-sm;
    color: $color-text-muted;
  }

  &__week {
    font-size: $font-size-xs;
    color: $color-text-muted;
    background: $color-bg-elevated;
    border: 1px solid $border-color;
    border-radius: $border-radius-sm;
    padding: 1px 5px;
  }

  &__players {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__player {
    display: grid;
    grid-template-columns: 2rem 5rem 1fr;
    align-items: center;
    gap: $spacing-3;
    font-size: $font-size-sm;

    &:nth-child(even) {
      background:rgba(0,0,0,0.15);
    }

    &--place-1 .game-card__name {
      color: $color-accent;
      font-weight: $font-weight-semibold;
    }
  }

  &__placement {
    font-size: $font-size-base;
    text-align: center;
  }

  &__name-cell {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
  }

  &__name {
    font-weight: $font-weight-medium;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: $color-text;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
      text-decoration: underline dotted;
    }
  }

  &__commander-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__commander {
    color: $color-text-muted;
    font-size: $font-size-xs;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: none;

    &:hover {
      color: $color-primary-light;
    }
  }

  &__rank-delta {
    font-size: 10px;
    font-weight: $font-weight-semibold;
    line-height: 1;
    flex-shrink: 0;

    &--up   { color: $color-success; }
    &--down { color: $color-danger; }
  }

  &__achievement {
    font-size: 11px;
    line-height: 1;
    flex-shrink: 0;
    cursor: default;
  }
}

.tier-badge {
  flex-shrink: 0;
  font-size: 9px;
  line-height: 1;

  &.tier--god      { color: $tier-god-color; }
  &.tier--legend   { color: $tier-legend-color; }
  &.tier--diamond  { color: $tier-diamond-color; }
  &.tier--platinum { color: $tier-platinum-color; }
  &.tier--gold     { color: $tier-gold-color; }
  &.tier--silver   { color: $tier-silver-color; }
  &.tier--bronze   { color: $tier-bronze-color; }
  &.tier--trash    { color: $tier-trash-color; }
}
</style>

<style lang="scss">
.floating-panel {
  position: absolute;
  z-index: 9999;
  pointer-events: none;
}

.card-preview__img {
  width: 245px;
  border-radius: 12px;
  display: block;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.8));
}
</style>
