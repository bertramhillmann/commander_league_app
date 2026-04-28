<template>
  <div class="game-card" :class="{ 'game-card--hidden': game.hidden, 'game-card--editing': isEditing }">
    <div class="game-card__art">
      <div class="game-card__art-winner">
        <img
          v-if="artUrls.get(winnerCommander)"
          :src="artUrls.get(winnerCommander)"
          :alt="winnerCommander"
          class="game-card__art-img"
        />
        <div v-else class="game-card__art-placeholder" />
      </div>

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

    <div class="game-card__body">
      <div class="game-card__header">
        <div class="game-card__header-meta">
          <span class="game-card__id">{{ game.gameId }}</span>
          <span class="game-card__date">{{ formattedDate }}</span>
          <span class="game-card__week">W{{ game.week }}</span>
          <span v-if="game.hidden" class="game-card__hidden-pill">Hidden</span>
        </div>

        <div v-if="canManageGame" class="game-card__admin-actions">
          <input
            v-if="isEditing"
            v-model="draftDate"
            type="date"
            class="game-card__date-input"
          />
          <button
            type="button"
            class="game-card__admin-btn"
            :disabled="saving"
            @click="toggleHidden"
          >
            {{ game.hidden ? 'Unhide' : 'Hide' }}
          </button>
          <button
            v-if="!isEditing"
            type="button"
            class="game-card__admin-btn game-card__admin-btn--primary"
            :disabled="saving"
            @click="startEditing"
          >
            Edit
          </button>
          <button
            v-else
            type="button"
            class="game-card__admin-btn game-card__admin-btn--primary"
            :disabled="saving"
            @click="saveChanges"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
          <button
            v-if="isEditing"
            type="button"
            class="game-card__admin-btn"
            :disabled="saving"
            @click="cancelEditing"
          >
            Cancel
          </button>
        </div>
      </div>

      <p v-if="editorError" class="game-card__error">{{ editorError }}</p>

      <div v-if="!isEditing" class="game-card__players">
        <div
          v-for="player in sortedPlayers"
          :key="player.name"
          class="game-card__player"
          :class="[`game-card__player--place-${player.placement}`, { 'game-card__player--highlighted': props.highlightPlayer && player.name === props.highlightPlayer }]"
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

      <div v-else class="game-card__editor">
        <div class="game-card__editor-hint">Drag rows to reseed placements. Name, commander, and placement remain editable.</div>
        <div
          v-for="(player, index) in draftPlayers"
          :key="`${game.gameId}-edit-${index}`"
          class="game-card__editor-row"
          @dragover.prevent
          @drop="onDrop(index)"
        >
          <button
            type="button"
            class="game-card__drag-handle"
            title="Drag to reorder"
            draggable="true"
            @dragstart="onDragStart(index)"
          >
            ⋮⋮
          </button>
          <input
            v-model="player.name"
            :list="playerOptionsId"
            type="text"
            class="game-card__editor-input"
            placeholder="Player"
          />
          <input
            v-model="player.commander"
            :list="commanderOptionsId"
            type="text"
            class="game-card__editor-input game-card__editor-input--wide"
            placeholder="Commander"
          />
          <input
            v-model.number="player.placement"
            type="number"
            min="1"
            :max="draftPlayers.length"
            class="game-card__editor-input game-card__editor-input--placement"
            @change="sortDraftByPlacement"
          />
        </div>
        <datalist :id="playerOptionsId">
          <option v-for="name in props.allPlayerOptions" :key="name" :value="name" />
        </datalist>
        <datalist :id="commanderOptionsId">
          <option v-for="name in props.allCommanderOptions" :key="name" :value="name" />
        </datalist>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="playerHover.visible && !isEditing"
      class="floating-panel"
      :style="{ top: `${playerHover.y}px`, left: `${playerHover.x}px` }"
    >
      <GamesGameInformation
        :player-name="playerHover.name"
        :game-id="game.gameId"
      />
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="commanderHover.visible && !isEditing"
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
import type { EditableGamePlayer, GameDocument } from '~/utils/gameTypes'
import { TIER_META, type Tier } from '~/utils/tiers'
import { getAchievementDefinition } from '~/utils/achievements'
import { getHistoricalCommanderTierAtGame } from '~/utils/historicalCommanderTier'

const props = withDefaults(defineProps<{
  game: ProcessedGame
  highlightPlayer?: string | null
  adminRawGame?: GameDocument | null
  allPlayerOptions?: string[]
  allCommanderOptions?: string[]
}>(), {
  highlightPlayer: null,
  adminRawGame: null,
  allPlayerOptions: () => [],
  allCommanderOptions: () => [],
})

const emit = defineEmits<{
  updated: []
}>()

const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()
const { games, gameRecords } = useLeagueState()
const { isAdmin } = useAuth()

const canManageGame = computed(() => isAdmin.value && Boolean(props.adminRawGame))
const isEditing = ref(false)
const saving = ref(false)
const editorError = ref('')
const draftDate = ref('')
const draftPlayers = ref<EditableGamePlayer[]>([])
const dragIndex = ref<number | null>(null)

const playerOptionsId = computed(() => `game-player-options-${props.game.gameId}`)
const commanderOptionsId = computed(() => `game-commander-options-${props.game.gameId}`)

watch(
  () => props.adminRawGame,
  () => {
    resetDraft()
  },
  { immediate: true },
)

const formattedDate = computed(() =>
  new Date(props.game.date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
)

const sortedPlayers = computed(() =>
  [...props.game.players].sort((a, b) => a.placement - b.placement),
)

function placementLabel(p: number) {
  return ['🥇', '🥈', '🥉'][p - 1] ?? `${p}.`
}

function playerTier(playerName: string, commander: string): Tier | null {
  return getHistoricalCommanderTierAtGame(
    playerName,
    commander,
    props.game.gameId,
    games.value,
    gameRecords.value,
  )
}

function getTierMeta(playerName: string, commander: string) {
  const tier = playerTier(playerName, commander)
  return tier ? TIER_META[tier] : null
}

function gameAchievements(playerName: string) {
  return (gameRecords.value[playerName]?.[props.game.gameId]?.achievements ?? [])
    .map((achievement) => getAchievementDefinition(achievement.id))
    .filter(Boolean)
}

const winnerCommander = computed(
  () => (sortedPlayers.value[0] as ProcessedGamePlayer | undefined)?.commander ?? '',
)

const otherCommanders = computed(() => {
  const seen = new Set([winnerCommander.value])
  const result: string[] = []
  for (const player of sortedPlayers.value.slice(1)) {
    if (!seen.has(player.commander)) {
      seen.add(player.commander)
      result.push(player.commander)
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
  return before - after
}

function resetDraft() {
  draftDate.value = toDateInputValue(props.adminRawGame?.date ?? props.game.date)
  draftPlayers.value = [...(props.adminRawGame?.players ?? props.game.players)]
    .map((player) => ({
      name: player.name,
      commander: player.commander,
      placement: player.placement,
      eliminations: player.eliminations ?? null,
      commanderCasts: player.commanderCasts ?? null,
    }))
    .sort((a, b) => a.placement - b.placement)
  editorError.value = ''
  dragIndex.value = null
}

function startEditing() {
  resetDraft()
  isEditing.value = true
}

function cancelEditing() {
  isEditing.value = false
  resetDraft()
}

function sortDraftByPlacement() {
  draftPlayers.value = [...draftPlayers.value].sort((a, b) => a.placement - b.placement)
}

function onDragStart(index: number) {
  dragIndex.value = index
}

function onDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return

  const nextPlayers = [...draftPlayers.value]
  const [moved] = nextPlayers.splice(dragIndex.value, 1)
  if (!moved) return
  nextPlayers.splice(index, 0, moved)
  draftPlayers.value = nextPlayers.map((player, playerIndex) => ({
    ...player,
    placement: playerIndex + 1,
  }))
  dragIndex.value = null
}

async function toggleHidden() {
  if (!props.adminRawGame || saving.value) return

  saving.value = true
  editorError.value = ''

  try {
    await $fetch(`/api/games/${encodeURIComponent(props.game.gameId)}`, {
      method: 'PUT',
      body: { hidden: !props.game.hidden },
    })
    emit('updated')
  } catch (error: any) {
    editorError.value = error?.data?.statusMessage ?? 'Failed to update game visibility.'
  } finally {
    saving.value = false
  }
}

async function saveChanges() {
  if (!props.adminRawGame || saving.value) return

  saving.value = true
  editorError.value = ''

  try {
    await $fetch(`/api/games/${encodeURIComponent(props.game.gameId)}`, {
      method: 'PUT',
      body: {
        date: draftDate.value,
        players: draftPlayers.value.map((player) => ({
          name: player.name.trim(),
          commander: player.commander.trim(),
          placement: player.placement,
          eliminations: player.eliminations,
          commanderCasts: player.commanderCasts,
        })),
      },
    })
    isEditing.value = false
    emit('updated')
  } catch (error: any) {
    editorError.value = error?.data?.statusMessage ?? 'Failed to save game.'
  } finally {
    saving.value = false
  }
}

function toDateInputValue(value: string | Date) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<style lang="scss" scoped>
.game-card {
  display: flex;
  background: rgba(16, 16, 16, 0.25);
  backdrop-filter: blur(3px);
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: border-color $transition-fast, transform $transition-fast;

  &:hover {
    border-color: $color-primary;
    transform: scale(1.03);
    @include dropshadow();
  }

  &--hidden {
    opacity: 0.72;
    border-style: dashed;
  }

  &--editing {
    border-color: rgba($color-primary-light, 0.55);
  }

  &__art {
    flex-shrink: 0;
    width: 140px;
    display: flex;
    flex-direction: column;
  }

  &__art-winner {
    flex: 1;
    padding: 10px;
    overflow: hidden;
  }

  &__art-others {
    display: flex;
    padding: 5px;
    height: 58px;
    border-top: 1px solid $border-color;
  }

  &__art-other {
    flex: 1;
    margin: 3px;
    overflow: hidden;

    & + & {
      border-left: 1px solid $border-color;
    }
  }

  &__art-img {
    width: 100%;
    height: 100%;
    border-radius: 3px;
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

  &__body {
    flex: 1;
    padding: $spacing-4 $spacing-6;
    min-width: 0;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: $spacing-3;
    margin-bottom: $spacing-2;
    padding: $spacing-2 $spacing-4;
    background: rgba(0, 0, 0, 0.25);
  }

  &__header-meta {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__admin-actions {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex-wrap: wrap;
    justify-content: flex-end;
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

  &__week,
  &__hidden-pill {
    font-size: $font-size-xs;
    color: $color-text-muted;
    background: $color-bg-elevated;
    border: 1px solid $border-color;
    border-radius: $border-radius-sm;
    padding: 1px 5px;
  }

  &__hidden-pill {
    color: $color-danger;
    border-color: rgba($color-danger, 0.35);
  }

  &__date-input,
  &__editor-input {
    appearance: none;
    background: rgba($color-bg-elevated, 0.7);
    border: 1px solid rgba($border-color, 0.75);
    border-radius: $border-radius-md;
    color: $color-text;
    font: inherit;
    font-size: $font-size-sm;
    padding: 7px 9px;
  }

  &__date-input {
    width: 142px;
  }

  &__admin-btn {
    appearance: none;
    border: 1px solid rgba($border-color, 0.8);
    background: rgba($color-bg-elevated, 0.75);
    color: $color-text-muted;
    border-radius: $border-radius-md;
    padding: 7px 10px;
    font: inherit;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: $color-text;
      border-color: rgba($color-primary-light, 0.4);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    &--primary {
      color: $color-text;
      border-color: rgba($color-primary-light, 0.35);
      background: rgba($color-primary, 0.18);
    }
  }

  &__error {
    margin: 0 0 $spacing-3;
    color: $color-danger;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
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
      background: rgba(0, 0, 0, 0.15);
    }

    &--place-1 .game-card__name {
      color: $color-accent;
      font-weight: $font-weight-semibold;
    }

    &--highlighted,
    &--highlighted:nth-child(even) {
      background: rgba($color-primary, 0.3);
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

    &--up { color: $color-success; }
    &--down { color: $color-danger; }
  }

  &__achievement {
    font-size: 11px;
    line-height: 1;
    flex-shrink: 0;
    cursor: default;
  }

  &__editor {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__editor-hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__editor-row {
    display: grid;
    grid-template-columns: 38px minmax(120px, 1fr) minmax(180px, 1.4fr) 76px;
    gap: $spacing-2;
    align-items: center;
    padding: $spacing-2;
    border: 1px solid rgba($border-color, 0.55);
    background: rgba(0, 0, 0, 0.18);
  }

  &__drag-handle {
    appearance: none;
    border: 1px dashed rgba($border-color, 0.75);
    background: rgba($color-bg-elevated, 0.55);
    color: $color-text-muted;
    border-radius: $border-radius-md;
    height: 34px;
    cursor: grab;
    font-size: 16px;
    line-height: 1;
  }

  &__editor-input--wide {
    min-width: 0;
  }

  &__editor-input--placement {
    text-align: center;
  }
}

@media (max-width: $breakpoint-sm) {
  .game-card {
    &:hover {
      transform: none;
    }

    &__art {
      width: 90px;
    }

    &__art-others {
      height: 44px;
    }

    &__body {
      padding: $spacing-3;
    }

    &__player {
      grid-template-columns: 1.8rem 4rem 1fr;
      gap: $spacing-2;
    }

    &__header {
      padding: $spacing-1 $spacing-2;
      flex-direction: column;
    }

    &__admin-actions {
      width: 100%;
      justify-content: flex-start;
    }

    &__editor-row {
      grid-template-columns: 32px 1fr;
    }

    &__editor-input--wide,
    &__editor-input--placement {
      grid-column: 2;
    }
  }
}

@media (max-width: 400px) {
  .game-card {
    flex-direction: column;

    &__art {
      width: 100%;
      flex-direction: row;
      height: 80px;
    }

    &__art-winner {
      flex: 1;
      padding: 6px;
    }

    &__art-others {
      flex-direction: column;
      width: 60px;
      height: 100%;
      border-top: 0;
      border-left: 1px solid $border-color;
    }

    &__art-other {
      flex: 1;
      margin: 2px;

      & + & {
        border-left: 0;
        border-top: 1px solid $border-color;
      }
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
  width: 245px;
  border-radius: 12px;
  display: block;
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.8));
}
</style>
