<script setup lang="ts">
import { buildFairMatchmakingResult, buildMatchmakingPlayerOptions } from '~/utils/gameMatchMaking'

const props = withDefaults(defineProps<{
  allowCreate?: boolean
  showHeader?: boolean
}>(), {
  allowCreate: false,
  showHeader: true,
})

const { games, gameRecords, players, loading, error, refresh: refreshLeagueState } = useLeagueState()
const { preloadCommanderImages, getCachedCommanderImage } = useImageCache()
const { isAdmin } = useAuth()
const { settings } = useLeagueSettings()

const canCreateGame = computed(() => props.allowCreate && isAdmin.value)

const playerOptions = computed(() =>
  buildMatchmakingPlayerOptions(games.value, gameRecords.value, players.value),
)

const selectedPlayers = ref<string[]>([])
const selectedCommanderByPlayer = ref<Record<string, string>>({})
const showStatsByPlayer = ref<Record<string, boolean>>({})
const placementByPlayer = ref<Record<string, number>>({})
const gameDate = ref(new Date().toISOString().slice(0, 10))
const submitting = ref(false)
const successMsg = ref('')
const errorMsg = ref('')

watch(
  playerOptions,
  (options) => {
    const available = new Set(options.map((option) => option.name))
    const nextSelection = selectedPlayers.value.filter((name) => available.has(name)).slice(0, 5)

    if (nextSelection.length >= 3) {
      selectedPlayers.value = nextSelection
      return
    }

    selectedPlayers.value = options.slice(0, 4).map((option) => option.name)
  },
  { immediate: true },
)

const matchmaking = computed(() =>
  buildFairMatchmakingResult(
    selectedPlayers.value,
    selectedCommanderByPlayer.value,
    games.value,
    gameRecords.value,
    settings.value.playerRating.simpleMmr.enabled,
  ),
)

watch(
  matchmaking,
  (result) => {
    if (!result) return

    const nextSelections = { ...selectedCommanderByPlayer.value }
    const nextPlacements = { ...placementByPlayer.value }
    let changed = false

    result.suggestions.forEach((suggestion, index) => {
      if (!nextSelections[suggestion.playerName]) {
        nextSelections[suggestion.playerName] = suggestion.selectedCommander
        changed = true
      }
      if (!Number.isFinite(nextPlacements[suggestion.playerName])) {
        nextPlacements[suggestion.playerName] = index + 1
        changed = true
      }
    })

    const allowedPlayers = new Set(result.selectedPlayers)
    for (const playerName of Object.keys(nextSelections)) {
      if (!allowedPlayers.has(playerName)) {
        delete nextSelections[playerName]
        changed = true
      }
    }
    for (const playerName of Object.keys(nextPlacements)) {
      if (!allowedPlayers.has(playerName)) {
        delete nextPlacements[playerName]
        changed = true
      }
    }

    if (changed) {
      selectedCommanderByPlayer.value = nextSelections
      placementByPlayer.value = nextPlacements
    }
  },
  { immediate: true },
)

const canAddMorePlayers = computed(() => selectedPlayers.value.length < 5)

function togglePlayer(playerName: string) {
  const isActive = selectedPlayers.value.includes(playerName)
  if (isActive) {
    if (selectedPlayers.value.length <= 3) return
    selectedPlayers.value = selectedPlayers.value.filter((name) => name !== playerName)
    const nextSelections = { ...selectedCommanderByPlayer.value }
    delete nextSelections[playerName]
    selectedCommanderByPlayer.value = nextSelections
    return
  }

  if (!canAddMorePlayers.value) return
  selectedPlayers.value = [...selectedPlayers.value, playerName]
}

function isSelected(playerName: string) {
  return selectedPlayers.value.includes(playerName)
}

function isDisabled(playerName: string) {
  return !isSelected(playerName) && !canAddMorePlayers.value
}

function selectCommander(playerName: string, commanderName: string) {
  selectedCommanderByPlayer.value = {
    ...selectedCommanderByPlayer.value,
    [playerName]: commanderName,
  }
}

function cycleCommander(playerName: string, commanders: Array<{ commander: string }>, direction: -1 | 1) {
  if (commanders.length < 2) return
  const currentCommander = selectedCommanderByPlayer.value[playerName] ?? commanders[0].commander
  const currentIndex = Math.max(0, commanders.findIndex((entry) => entry.commander === currentCommander))
  const nextIndex = (currentIndex + direction + commanders.length) % commanders.length
  selectCommander(playerName, commanders[nextIndex].commander)
}

function toggleStats(playerName: string) {
  showStatsByPlayer.value = {
    ...showStatsByPlayer.value,
    [playerName]: !showStatsByPlayer.value[playerName],
  }
}

function setPlacement(playerName: string, placement: number) {
  placementByPlayer.value = {
    ...placementByPlayer.value,
    [playerName]: placement,
  }
}

function fmt(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

function pct(value: number) {
  return Math.round(value * 100)
}

function fmtAdj(value: number) {
  return `${value > 0 ? '+' : ''}${fmt(value)}`
}

function ordinal(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function normalizePlacement(value: number, playerCount: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(Math.round(value), 1), playerCount)
}

async function createGameFromPod() {
  if (!canCreateGame.value || !matchmaking.value) return

  submitting.value = true
  successMsg.value = ''
  errorMsg.value = ''

  try {
    const playerCount = matchmaking.value.suggestions.length
    const normalizedPlayers = matchmaking.value.suggestions.map((suggestion) => ({
      name: suggestion.playerName,
      commander: suggestion.selectedCommander,
      placement: normalizePlacement(placementByPlayer.value[suggestion.playerName] ?? 1, playerCount),
      eliminations: null,
      commanderCasts: null,
    }))
    const uniquePlacements = new Set(normalizedPlayers.map((player) => player.placement))

    if (uniquePlacements.size !== normalizedPlayers.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Each player needs a unique placement before the game can be created.',
      })
    }

    await $fetch('/api/games', {
      method: 'POST',
      body: {
        date: gameDate.value,
        players: normalizedPlayers,
      },
    })

    await refreshLeagueState()
    successMsg.value = 'Game created from the current pod.'
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage ?? 'Failed to create game.'
  } finally {
    submitting.value = false
  }
}

const artUrls = ref(new Map<string, string>())

watch(
  () => matchmaking.value?.suggestions?.map((suggestion) => suggestion.selectedCommander) ?? [],
  async (commanders) => {
    const names = commanders.filter(Boolean)
    if (!names.length) return
    await preloadCommanderImages(names, ['art_crop'])
    const next = new Map<string, string>()
    for (const name of names) {
      const url = getCachedCommanderImage(name, 'art_crop')
      if (url) next.set(name, url)
    }
    artUrls.value = next
  },
  { immediate: true },
)
</script>

<template>
  <div class="mm">
    <div v-if="showHeader" class="mm__head">
      <div class="mm__title-block">
        <h2 class="mm__title">Matchmaking</h2>
      </div>
      <span class="mm__counter">{{ selectedPlayers.length }}<span class="mm__counter-max">/5</span></span>
    </div>
    <div v-else class="mm__counter-row">
      <span class="mm__counter-label">Players selected</span>
      <span class="mm__counter">{{ selectedPlayers.length }}<span class="mm__counter-max">/5</span></span>
    </div>

    <div v-if="loading" class="mm__notice">Loading...</div>
    <div v-else-if="error" class="mm__notice mm__notice--err">Failed to load data.</div>
    <div v-else-if="playerOptions.length === 0" class="mm__notice">No player records yet.</div>

    <template v-else>
      <div class="mm__picker">
        <button
          v-for="opt in playerOptions"
          :key="opt.name"
          type="button"
          class="mm__chip"
          :class="{
            'mm__chip--on': isSelected(opt.name),
            'mm__chip--off': isDisabled(opt.name),
          }"
          :disabled="isDisabled(opt.name)"
          @click="togglePlayer(opt.name)"
        >
          <span class="mm__chip-check" aria-hidden="true">{{ isSelected(opt.name) ? 'x' : '' }}</span>
          <span>{{ opt.name }}</span>
          <span class="mm__chip-mmr">{{ fmt(opt.overallMMR) }} MMR</span>
        </button>
      </div>

      <div v-if="matchmaking" class="mm__layout">
        <aside class="mm__bar" aria-label="Pod overview">
          <div class="mm__bar-stat">
            <span class="mm__bar-val">{{ fmt(matchmaking.averageMMR) }}</span>
            <span class="mm__bar-key">Pod avg MMR</span>
          </div>
          <div class="mm__bar-divider" />
          <div class="mm__bar-stat">
            <span class="mm__bar-val">{{ fmt(matchmaking.fairnessSpreadBefore) }}</span>
            <span class="mm__bar-key">Player spread</span>
          </div>
          <div class="mm__bar-divider" />
          <div class="mm__bar-stat">
            <span
              class="mm__bar-val mm__bar-val--after"
              :class="matchmaking.fairnessSpreadAfter < matchmaking.fairnessSpreadBefore ? 'mm__bar-val--good' : 'mm__bar-val--bad'"
            >{{ fmt(matchmaking.fairnessSpreadAfter) }}</span>
            <span class="mm__bar-key">Commander spread</span>
          </div>
        </aside>

        <div class="mm__main">
          <div v-if="canCreateGame" class="mm__create">
            <div class="mm__create-head">
              <label class="mm__date-field">
                <span class="mm__date-label">Date</span>
                <input v-model="gameDate" type="date" class="mm__date-input">
              </label>
            </div>

            <div class="mm__placement-grid">
          <label
            v-for="suggestion in matchmaking.suggestions"
            :key="`placement-${suggestion.playerName}`"
            class="mm__placement-row"
          >
            <span class="mm__placement-player">{{ suggestion.playerName }}</span>
            <span class="mm__placement-commander">{{ suggestion.selectedCommander }}</span>
            <input
              :value="placementByPlayer[suggestion.playerName] ?? 1"
              type="number"
              class="mm__placement-input"
              :min="1"
              :max="matchmaking.suggestions.length"
              @input="setPlacement(suggestion.playerName, Number(($event.target as HTMLInputElement).value))"
            >
          </label>
            </div>

            <div class="mm__create-actions">
          <button
            type="button"
            class="mm__create-btn"
            :disabled="submitting"
            @click="createGameFromPod"
          >
            {{ submitting ? 'Saving...' : 'Create Game' }}
          </button>
          <span v-if="successMsg" class="mm__create-msg mm__create-msg--success">{{ successMsg }}</span>
          <span v-if="errorMsg" class="mm__create-msg mm__create-msg--error">{{ errorMsg }}</span>
            </div>
          </div>

          <div class="mm__cards">
        <article
          v-for="suggestion in matchmaking.suggestions"
          :key="suggestion.playerName"
          class="mm__card"
          :data-tooltip="suggestion.explanation"
        >
          <div class="mm__art">
            <img
              v-if="artUrls.get(suggestion.selectedCommander)"
              :src="artUrls.get(suggestion.selectedCommander)"
              :alt="suggestion.selectedCommander"
              class="mm__art-img"
            />
            <div v-else class="mm__art-placeholder" />
            <div class="mm__art-scrim" />
            <button
              type="button"
              class="mm__art-cycle mm__art-cycle--previous"
              :disabled="suggestion.availableCommanders.length < 2"
              aria-label="Show previous commander"
              @click.stop="cycleCommander(suggestion.playerName, suggestion.availableCommanders, -1)"
            >‹</button>
            <button
              type="button"
              class="mm__art-cycle mm__art-cycle--next"
              :disabled="suggestion.availableCommanders.length < 2"
              aria-label="Show next commander"
              @click.stop="cycleCommander(suggestion.playerName, suggestion.availableCommanders, 1)"
            >›</button>
          </div>

            <div class="mm__content">
              <div class="mm__content-top">
                <div class="mm__player-block">
                  <div class="mm__player-row">
                    <div class="mm__player">{{ suggestion.playerName }}</div>
                  </div>
              </div>

              <div
                class="mm__adj"
                :class="suggestion.adjustment <= 0 ? 'mm__adj--down' : 'mm__adj--up'"
              >
                {{ fmtAdj(suggestion.adjustment) }}
              </div>
            </div>

            <div class="mm__commander-row">
              <label class="mm__commander-select">
                <select
                  :value="suggestion.selectedCommander"
                  @change="selectCommander(suggestion.playerName, ($event.target as HTMLSelectElement).value)"
                >
                  <option
                    v-for="commander in suggestion.availableCommanders"
                    :key="commander.commander"
                    :value="commander.commander"
                  >{{ commander.commander }}</option>
                </select>
                <span class="mm__commander-select-arrow" aria-hidden="true">▾</span>
              </label>
              <span class="mm__tier" :class="`tier-text--${suggestion.tier}`">
                <IconsTierIcon :tier="suggestion.tier" :size="12" />
                {{ suggestion.tierLabel }}
              </span>
              <span class="mm__mmr">{{ fmt(suggestion.selectedMMR) }} MMR</span>
              <button
                type="button"
                class="mm__stats-toggle"
                :class="{ 'mm__stats-toggle--active': showStatsByPlayer[suggestion.playerName] }"
                :aria-expanded="Boolean(showStatsByPlayer[suggestion.playerName])"
                aria-label="Toggle commander details"
                @click="toggleStats(suggestion.playerName)"
              >⚙</button>
            </div>

            <div v-if="suggestion.isOverride" class="mm__recommended">
              Recommended: {{ suggestion.recommendedCommander }}
            </div>

            <div v-if="showStatsByPlayer[suggestion.playerName]" class="mm__stats">
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(suggestion.overallMMR) }}</span>
                <span class="mm__stat-k">Player MMR</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(suggestion.targetMMR) }}</span>
                <span class="mm__stat-k">Target MMR</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ suggestion.commanderPlays }}</span>
                <span class="mm__stat-k">Plays</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ pct(suggestion.commanderWinRate) }}%</span>
                <span class="mm__stat-k">Win rate</span>
              </div>
            </div>

            <div v-if="showStatsByPlayer[suggestion.playerName]" class="mm__stats">
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(suggestion.commanderAvgPoints) }}</span>
                <span class="mm__stat-k">Avg pts</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ fmt(suggestion.commanderPlacement) }}</span>
                <span class="mm__stat-k">Avg place</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ pct(suggestion.confidence) }}%</span>
                <span class="mm__stat-k">Sample</span>
              </div>
              <div class="mm__stat">
                <span class="mm__stat-v">{{ suggestion.placementOutcomes.length }}</span>
                <span class="mm__stat-k">Outcomes</span>
              </div>
            </div>

            <div class="mm__outcomes">
              <div class="mm__outcomes-title">
                MMR by placement in this pod
                <span v-if="canCreateGame" class="mm__outcomes-hint">· click to set placement</span>
              </div>
              <div class="mm__outcomes-grid">
                <div
                  v-for="outcome in suggestion.placementOutcomes"
                  :key="`${suggestion.playerName}-${outcome.placement}`"
                  class="mm__outcome"
                  :class="{ 'mm__outcome--active': canCreateGame && placementByPlayer[suggestion.playerName] === outcome.placement }"
                  @click="canCreateGame && setPlacement(suggestion.playerName, outcome.placement)"
                >
                  <div class="mm__outcome-place">{{ ordinal(outcome.placement) }}</div>
                  <div class="mm__outcome-delta" :class="outcome.delta >= 0 ? 'mm__outcome-delta--up' : 'mm__outcome-delta--down'">
                    {{ fmtAdj(outcome.delta) }}
                  </div>
                  <div class="mm__outcome-next">{{ fmt(outcome.newMMR) }} MMR</div>
                  <template v-if="settings.playerRating.simpleMmr.enabled && outcome.playerMmrAfter !== null">
                    <div
                      class="mm__outcome-player-delta"
                      :class="(outcome.playerMmrDelta ?? 0) >= 0 ? 'mm__outcome-player-delta--up' : 'mm__outcome-player-delta--down'"
                    >
                      Player {{ fmtAdj(outcome.playerMmrDelta ?? 0) }}
                    </div>
                    <div class="mm__outcome-player-next">{{ fmt(outcome.playerMmrAfter ?? 0) }} player MMR</div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
        </div>
      </div>

      <div v-else class="mm__notice">Select 3-5 players to generate a matchup.</div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.mm {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-3;
  }

  &__label {
    display: block;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: $color-primary-light;
    font-weight: $font-weight-semibold;
    margin-bottom: $spacing-1;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $color-text;
    margin: 0;
  }

  &__counter {
    font-size: $font-size-2xl;
    font-weight: $font-weight-bold;
    color: $color-text;
    line-height: 1;
    padding-top: 2px;
  }

  &__counter-max {
    font-size: $font-size-sm;
    color: $color-text-muted;
    font-weight: $font-weight-normal;
  }

  &__picker {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
  }

  &__chip {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px $spacing-3;
    border-radius: 6px;
    border: 1px solid rgba($border-color, 0.9);
    background: rgba($color-bg-elevated, 0.5);
    color: $color-text-muted;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    cursor: pointer;
    transition: border-color $transition-fast, color $transition-fast, background $transition-fast;

    &:hover:not(:disabled) {
      border-color: rgba($color-primary-light, 0.4);
      color: $color-text;
    }

    &--on {
      border-color: $color-primary-light;
      background: rgba($color-primary, 0.22);
      color: $color-text;
    }

    &--off {
      opacity: 0.35;
      cursor: not-allowed;
    }
  }

  &__chip-check {
    width: 12px;
    font-size: 10px;
    color: $color-primary-light;
    line-height: 1;
    text-align: center;
  }

  &__chip-mmr {
    color: rgba($color-text-muted, 0.8);
    font-variant-numeric: tabular-nums;
  }

  &__bar {
    display: flex;
    position: absolute;
    top: 0;
    left: calc(100% + #{$spacing-3});
    width: 170px;
    flex-direction: column;
    align-items: stretch;
    gap: $spacing-2;
    padding: $spacing-3;
    background: rgba($color-bg-elevated, 0.45);
    border: 1px solid rgba($border-color, 0.7);
    border-radius: $border-radius-lg;
  }

  &__bar-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: $spacing-1 $spacing-2;
  }

  &__bar-divider {
    width: 100%;
    height: 1px;
    background: rgba($border-color, 0.7);
    flex-shrink: 0;
  }

  &__bar-val {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $color-text;

    &--good { color: $color-success; }
    &--bad { color: $color-danger; }
  }

  &__bar-key {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: $color-text-muted;
  }

  &__counter-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
  }

  &__layout {
    position: relative;
  }

  &__main {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
    min-width: 0;
  }

  &__counter-label {
    font-size: $font-size-xs;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: $color-text-muted;
    font-weight: $font-weight-semibold;
  }

  &__cards {
    order: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: $spacing-3;
  }

  &__create {
    order: 2;
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    padding: $spacing-3 $spacing-4;
    border: 1px solid rgba($border-color, 0.75);
    border-radius: $border-radius-lg;
    background: rgba($color-bg-elevated, 0.42);
  }

  &__create-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__create-title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__create-subtitle {
    font-size: 11px;
    color: $color-text-muted;
    margin-top: 2px;
  }

  &__date-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__date-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-text-muted, 0.8);
  }

  &__date-input {
    border-radius: $border-radius-md;
    border: 1px solid rgba($border-color, 0.85);
    background: rgba(0, 0, 0, 0.24);
    color: $color-text;
    padding: 7px 10px;
    font: inherit;
    font-size: $font-size-sm;
  }

  &__placement-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: $spacing-2;
  }

  &__placement-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 72px;
    gap: $spacing-2;
    align-items: center;
    padding: $spacing-2;
    border-radius: $border-radius-md;
    background: rgba(0, 0, 0, 0.2);
  }

  &__placement-player {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text;
  }

  &__placement-commander {
    font-size: 11px;
    color: $color-text-muted;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__placement-input {
    width: 100%;
    border-radius: $border-radius-md;
    border: 1px solid rgba($border-color, 0.85);
    background: rgba(0, 0, 0, 0.24);
    color: $color-text;
    padding: 6px 8px;
    font: inherit;
    font-size: $font-size-sm;
  }

  &__create-actions {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__create-btn {
    appearance: none;
    border: 1px solid rgba($color-primary-light, 0.5);
    background: $color-primary;
    color: $color-text;
    border-radius: $border-radius-md;
    padding: 9px 16px;
    font: inherit;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__create-msg {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;

    &--success { color: $color-success; }
    &--error { color: $color-danger; }
  }

  &__card {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: $border-radius-lg;
    border: 1px solid rgba($border-color, 0.8);
    background: rgba(12, 10, 18, 0.85);
    overflow: hidden;
    transition: border-color $transition-fast, transform $transition-fast;

    &:hover {
      border-color: rgba($color-primary-light, 0.35);
      transform: translateY(-2px);
    }

    &[data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 6px);
      left: 0;
      right: 0;
      padding: $spacing-2 $spacing-3;
      border-radius: $border-radius-md;
      background: rgba(20, 16, 32, 0.97);
      border: 1px solid rgba($color-primary-light, 0.22);
      box-shadow: $shadow-lg;
      color: $color-text-muted;
      font-size: $font-size-xs;
      line-height: 1.55;
      white-space: normal;
      z-index: 10;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity $transition-fast, transform $transition-fast;
    }

    &[data-tooltip]:hover::after {
      opacity: 1;
      transform: translateY(0);
    }
  }

  &__art {
    width: 100%;
    aspect-ratio: 4/3;
    position: relative;
    overflow: hidden;
  }

  &__art-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 20%;
    display: block;
  }

  &__art-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(160deg, rgba($color-primary-dark, 0.4), rgba(0, 0, 0, 0.6));
  }

  &__art-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(12, 10, 18, 0.85));
  }

  &__art-cycle {
    position: absolute;
    z-index: 2;
    top: 50%;
    width: 28px;
    height: 36px;
    border: 0;
    border-radius: $border-radius-sm;
    background: rgba(7, 5, 13, 0.58);
    color: $color-text;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    transform: translateY(-50%);
    transition: background $transition-fast, color $transition-fast, opacity $transition-fast;

    &:hover:not(:disabled) {
      background: rgba($color-primary, 0.82);
      color: white;
    }

    &:disabled {
      cursor: default;
      opacity: 0.25;
    }

    &--previous { left: $spacing-2; }
    &--next { right: $spacing-2; }
  }

  &__content {
    flex: 1;
    min-width: 0;
    padding: $spacing-3;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__content-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: $spacing-2;
  }

  &__player-block {
    min-width: 0;
    flex: 1;
  }

  &__player-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__player {
    font-size: $font-size-xs;
    color: $color-text-muted;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: $font-weight-semibold;
    margin-bottom: 4px;
  }

  &__toggle-commanders {
    padding: 4px 10px;
    border-radius: $border-radius-full;
    border: 1px solid rgba($border-color, 0.72);
    background: rgba($color-bg-elevated, 0.52);
    color: $color-text-muted;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: color $transition-fast, border-color $transition-fast, background $transition-fast;

    &:hover {
      color: $color-accent;
      border-color: rgba($color-accent, 0.45);
      background: rgba($color-bg-elevated, 0.8);
    }
  }

  &__select-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__select-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-text-muted, 0.75);
  }

  &__select {
    width: 100%;
    border-radius: $border-radius-md;
    border: 1px solid rgba($border-color, 0.85);
    background: rgba(0, 0, 0, 0.28);
    color: $color-text;
    padding: 7px 10px;
    font-size: $font-size-sm;
  }

  &__adj {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    padding: 2px 7px;
    border-radius: $border-radius-full;
    white-space: nowrap;
    flex-shrink: 0;

    &--up { color: $color-success; background: rgba($color-success, 0.12); }
    &--down { color: $color-danger; background: rgba($color-danger, 0.12); }
  }

  &__commander-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__commander-select {
    position: relative;
    width: 100%;
    min-width: 0;

    select {
      width: 100%;
      padding: 0 16px 0 0;
      border: 0;
      appearance: none;
      background: transparent;
      color: $color-accent;
      color-scheme: dark;
      cursor: pointer;
      font: inherit;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &:focus-visible {
        outline: 1px solid rgba($color-primary-light, 0.75);
        outline-offset: 3px;
      }

      option {
        background: $color-bg-elevated;
        color: $color-text;
      }
    }
  }

  &__commander-select-arrow {
    position: absolute;
    top: 50%;
    right: 2px;
    color: rgba($color-accent, 0.8);
    font-size: 10px;
    pointer-events: none;
    transform: translateY(-45%);
  }

  &__tier {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }

  &__mmr {
    font-size: $font-size-sm;
    color: $color-text;
    font-variant-numeric: tabular-nums;
  }

  &__stats-toggle {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: $color-text-muted;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    transition: color $transition-fast, background $transition-fast, transform $transition-fast;

    &:hover,
    &--active {
      background: rgba($color-primary, 0.18);
      color: $color-primary-light;
    }

    &--active { transform: rotate(45deg); }
  }

  &__recommended {
    font-size: $font-size-xs;
    color: rgba($color-text-muted, 0.88);
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: $spacing-1;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 4px $spacing-1;
    background: rgba(0, 0, 0, 0.25);
    border-radius: $border-radius-sm;
  }

  &__stat-v {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text;
    font-variant-numeric: tabular-nums;
  }

  &__stat-k {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $color-text-muted;
  }

  &__outcomes {
    margin-top: $spacing-1;
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__outcomes-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba($color-text-muted, 0.8);
  }

  &__outcomes-hint {
    color: rgba($color-text-muted, 0.5);
    letter-spacing: 0.04em;
    text-transform: none;
  }

  &__outcomes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    gap: $spacing-2;
  }

  &__outcome {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: $spacing-2;
    border-radius: $border-radius-md;
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba($border-color, 0.45);
    cursor: pointer;
    transition: border-color $transition-fast, background $transition-fast;

    &:hover {
      border-color: rgba($color-primary-light, 0.35);
      background: rgba($color-primary, 0.1);
    }

    &--active {
      border-color: $color-primary-light;
      background: rgba($color-primary, 0.22);
    }
  }

  &__outcome-place {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba($color-text-muted, 0.78);
  }

  &__outcome-delta {
    font-size: $font-size-sm;
    font-weight: $font-weight-bold;
    font-variant-numeric: tabular-nums;

    &--up { color: $color-success; }
    &--down { color: $color-danger; }
  }

  &__outcome-next {
    font-size: 11px;
    color: $color-text;
    font-variant-numeric: tabular-nums;
  }

  &__outcome-player-delta {
    margin-top: 2px;
    font-size: 10px;
    font-weight: $font-weight-semibold;
    font-variant-numeric: tabular-nums;

    &--up { color: rgba($color-success, 0.9); }
    &--down { color: rgba($color-danger, 0.9); }
  }

  &__outcome-player-next {
    font-size: 10px;
    color: rgba($color-text-muted, 0.92);
    font-variant-numeric: tabular-nums;
  }

  &__notice {
    padding: $spacing-6 $spacing-4;
    text-align: center;
    color: $color-text-muted;
    font-size: $font-size-sm;

    &--err { color: $color-danger; }
  }

  @media (max-width: 720px) {
    &__layout {
      grid-template-columns: 1fr;
    }

    &__bar {
      position: static;
      width: auto;
      flex-direction: row;
      align-items: center;
      padding: $spacing-3 $spacing-4;
    }

    &__bar-stat {
      flex: 1;
      align-items: center;
      padding: 0;
    }

    &__bar-divider {
      width: 1px;
      height: 28px;
    }
  }
}
</style>
