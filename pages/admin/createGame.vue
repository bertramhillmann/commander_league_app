<template>
  <UITopMenu />
  <div class="page page--create-game">

    <div class="page-inner">
      <div class="page-header">
        <h1 class="page-title">Create Game</h1>
        <div class="form-field form-field--date">
          <label class="form-label">Date</label>
          <input v-model="gameDate" type="date" class="form-input" required />
        </div>
      </div>

      <form class="game-form" @submit.prevent="submitGame">
        <!-- Players 2-column grid -->
        <div class="players-grid">
          <div
            v-for="(player, index) in players"
            :key="index"
            class="player-card"
            :class="index % 2 === 0 ? 'player-card--right' : 'player-card--left'"
          >
            <!-- Commander art — outer left for odd nth-child cards -->
            <div
              v-if="index % 2 === 1"
              class="commander-art commander-art--right"
            >
              <img
                v-if="commanderState[index]?.imageUrl"
                :src="commanderState[index]!.imageUrl!"
                :alt="player.commander"
                class="commander-art__img"
              />
              <div v-else class="commander-art__placeholder">
                <span class="commander-art__placeholder-icon">⚔</span>
              </div>
            </div>

            <!-- Fields -->
            <div class="player-card__body">
              <div class="player-card__header">
                <span class="player-card__title">Player {{ index + 1 }}</span>
                <div class="player-card__actions">
                  <button
                    type="button"
                    class="btn btn--muted btn--sm"
                    @click="resetPlayer(index)"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    class="btn btn--ghost btn--sm"
                    :disabled="players.length <= 3"
                    @click="removePlayer(index)"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div class="player-card__fields">
                <!-- Player name -->
                <div class="form-field">
                  <label class="form-label">Player Name</label>
                  <div class="autocomplete-wrap">
                    <input
                      v-model="player.name"
                      type="text"
                      class="form-input"
                      placeholder="e.g. birt"
                      autocomplete="off"
                      required
                      @input="onPlayerNameInput(index)"
                      @focus="openPlayerSuggest(index)"
                      @blur="closePlayerSuggest(index)"
                    />
                    <ul
                      v-if="playerSuggestOpen[index] && filteredPlayerSuggestions(index).length"
                      class="suggest-list"
                    >
                      <li
                        v-for="name in filteredPlayerSuggestions(index)"
                        :key="name"
                        class="suggest-item"
                        @mousedown.prevent="selectPlayer(index, name)"
                      >
                        {{ name }}
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Commander -->
                <div class="form-field">
                  <label class="form-label">Commander</label>
                  <div class="autocomplete-wrap">
                    <input
                      v-model="player.commander"
                      type="text"
                      class="form-input"
                      :class="{
                        'form-input--valid': commanderState[index]?.valid === true,
                        'form-input--invalid': commanderState[index]?.valid === false,
                      }"
                      placeholder="e.g. Atraxa, Praetors' Voice"
                      autocomplete="off"
                      required
                      @input="onCommanderInput(index)"
                      @focus="openCommanderSuggest(index)"
                      @blur="closeCommanderSuggest(index)"
                    />
                    <span v-if="commanderState[index]?.checking" class="commander-status commander-status--checking">checking…</span>
                    <span v-else-if="commanderState[index]?.valid === true" class="commander-status commander-status--ok">✓</span>
                    <span v-else-if="commanderState[index]?.valid === false" class="commander-status commander-status--err">not found</span>
                    <ul
                      v-if="commanderSuggestOpen[index] && filteredCommanderSuggestions(index).length"
                      class="suggest-list"
                    >
                      <li
                        v-for="name in filteredCommanderSuggestions(index)"
                        :key="name"
                        class="suggest-item"
                        @mousedown.prevent="selectCommander(index, name)"
                      >
                        {{ name }}
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Placement -->
                <div class="form-field form-field--narrow">
                  <label class="form-label">Place</label>
                  <input
                    v-model.number="player.placement"
                    type="number"
                    class="form-input"
                    :min="1"
                    :max="players.length"
                    required
                  />
                </div>
              </div>
            </div>

            <!-- Commander art — outer right for odd nth-child cards -->
            <div
              v-if="index % 2 === 0"
              class="commander-art commander-art--left"
            >
              <img
                v-if="commanderState[index]?.imageUrl"
                :src="commanderState[index]!.imageUrl!"
                :alt="player.commander"
                class="commander-art__img"
              />
              <div v-else class="commander-art__placeholder">
                <span class="commander-art__placeholder-icon">⚔</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn--secondary" :disabled="players.length >= 5" @click="addPlayer">+ Add Player</button>
          <button type="submit" class="btn btn--primary" :disabled="submitting">
            {{ submitting ? 'Saving…' : 'Save Game' }}
          </button>
        </div>

        <p v-if="successMsg" class="form-msg form-msg--success">{{ successMsg }}</p>
        <p v-if="errorMsg" class="form-msg form-msg--error">{{ errorMsg }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchCardByName, getCardImageUrl } from '~/services/scryfallService'

definePageMeta({ middleware: [] })

const { isAdmin } = useAuth()
const { refresh: refreshLeagueState } = useLeagueState()
if (!isAdmin.value) {
  await navigateTo('/login')
}

// ── Data fetched from server ────────────────────────────────────────────────
const { data: allPlayers } = await useFetch<string[]>('/api/players')
const { data: allCommanders } = await useFetch<string[]>('/api/commanders')

// ── Form state ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const gameDate = ref(today)

interface PlayerRow {
  name: string
  commander: string
  placement: number
  eliminations: number | null
  commanderCasts: number | null
}

const players = ref<PlayerRow[]>([
  { name: '', commander: '', placement: 1, eliminations: null, commanderCasts: null },
  { name: '', commander: '', placement: 2, eliminations: null, commanderCasts: null },
  { name: '', commander: '', placement: 3, eliminations: null, commanderCasts: null },
  { name: '', commander: '', placement: 4, eliminations: null, commanderCasts: null },
])

// ── Player autocomplete ─────────────────────────────────────────────────────
const playerSuggestOpen = ref<boolean[]>(players.value.map(() => false))

function onPlayerNameInput(index: number) {
  playerSuggestOpen.value[index] = true
}
function openPlayerSuggest(index: number) {
  playerSuggestOpen.value[index] = true
}
function closePlayerSuggest(index: number) {
  setTimeout(() => { playerSuggestOpen.value[index] = false }, 150)
}
function filteredPlayerSuggestions(index: number) {
  const q = players.value[index].name.toLowerCase()
  if (!q) return allPlayers.value ?? []
  return (allPlayers.value ?? []).filter((n) => n.toLowerCase().includes(q))
}
function selectPlayer(index: number, name: string) {
  players.value[index].name = name
  playerSuggestOpen.value[index] = false
}

// ── Commander autocomplete + Scryfall validation ────────────────────────────
interface CommanderState {
  checking: boolean
  valid: boolean | null
  imageUrl: string | null
}

const commanderState = ref<CommanderState[]>(players.value.map(() => ({ checking: false, valid: null, imageUrl: null })))
const commanderSuggestOpen = ref<boolean[]>(players.value.map(() => false))
const commanderTimers = new Map<number, ReturnType<typeof setTimeout>>()

function openCommanderSuggest(index: number) {
  commanderSuggestOpen.value[index] = true
}
function closeCommanderSuggest(index: number) {
  setTimeout(() => { commanderSuggestOpen.value[index] = false }, 150)
}
function filteredCommanderSuggestions(index: number) {
  const q = players.value[index].commander.toLowerCase()
  if (!q) return allCommanders.value ?? []
  return (allCommanders.value ?? []).filter((n) => n.toLowerCase().includes(q))
}
function selectCommander(index: number, name: string) {
  players.value[index].commander = name
  commanderSuggestOpen.value[index] = false
  checkCommander(index)
}

function onCommanderInput(index: number) {
  commanderSuggestOpen.value[index] = true
  commanderState.value[index] = { checking: false, valid: null, imageUrl: null }

  if (commanderTimers.has(index)) clearTimeout(commanderTimers.get(index)!)
  const val = players.value[index].commander.trim()
  if (!val) return

  commanderTimers.set(index, setTimeout(() => checkCommander(index), 700))
}

async function checkCommander(index: number) {
  const name = players.value[index].commander.trim()
  if (!name) return

  commanderState.value[index] = { checking: true, valid: null, imageUrl: null }
  const card = await fetchCardByName(name)
  if (card) {
    const imageUrl = getCardImageUrl(card, 'art_crop')
    commanderState.value[index] = { checking: false, valid: true, imageUrl }
  } else {
    commanderState.value[index] = { checking: false, valid: false, imageUrl: null }
  }
}

// ── Add / remove players ────────────────────────────────────────────────────
function addPlayer() {
  players.value.push({ name: '', commander: '', placement: players.value.length + 1, eliminations: null, commanderCasts: null })
  playerSuggestOpen.value.push(false)
  commanderSuggestOpen.value.push(false)
  commanderState.value.push({ checking: false, valid: null, imageUrl: null })
}

function removePlayer(index: number) {
  players.value.splice(index, 1)
  playerSuggestOpen.value.splice(index, 1)
  commanderSuggestOpen.value.splice(index, 1)
  commanderState.value.splice(index, 1)
}

function resetPlayer(index: number) {
  players.value[index] = { name: '', commander: '', placement: index + 1, eliminations: null, commanderCasts: null }
  playerSuggestOpen.value[index] = false
  commanderSuggestOpen.value[index] = false
  commanderState.value[index] = { checking: false, valid: null, imageUrl: null }
}

// ── Submit ──────────────────────────────────────────────────────────────────
const submitting = ref(false)
const successMsg = ref('')
const errorMsg = ref('')

async function submitGame() {
  submitting.value = true
  successMsg.value = ''
  errorMsg.value = ''

  try {
    await $fetch('/api/games', {
      method: 'POST',
      body: {
        date: gameDate.value,
        players: players.value.map((p) => ({
          name: p.name.trim(),
          commander: p.commander.trim(),
          placement: p.placement,
          eliminations: p.eliminations,
          commanderCasts: p.commanderCasts,
        })),
      },
    })
    await refreshLeagueState()
    successMsg.value = 'Game saved successfully!'
    gameDate.value = today
    players.value = [
      { name: '', commander: '', placement: 1, eliminations: null, commanderCasts: null },
      { name: '', commander: '', placement: 2, eliminations: null, commanderCasts: null },
      { name: '', commander: '', placement: 3, eliminations: null, commanderCasts: null },
      { name: '', commander: '', placement: 4, eliminations: null, commanderCasts: null },
    ]
    commanderState.value = players.value.map(() => ({ checking: false, valid: null, imageUrl: null }))
    playerSuggestOpen.value = players.value.map(() => false)
    commanderSuggestOpen.value = players.value.map(() => false)
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage ?? 'Failed to save game.'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page--create-game {
  min-height: 100vh;
}

.page-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: $spacing-6 $spacing-6 $spacing-12;
}

// ── Header ───────────────────────────────────────────────────────────────────
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-6;
  margin-bottom: $spacing-8;
}

.page-title {
  font-size: $font-size-3xl;
  color: $color-accent;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.form-field--date {
  flex-shrink: 0;
  width: auto;

  .form-input { width: auto; }
}

// ── Form ─────────────────────────────────────────────────────────────────────
.game-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

// ── Players grid (2 columns) ─────────────────────────────────────────────────
.players-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-6;
}

// ── Player card ──────────────────────────────────────────────────────────────
.player-card {
  display: flex;
  position: relative;
  z-index: 1;
  background: rgba($color-bg-card, 0.5);
  border: 1px solid rgba($border-color, 0.55);
  overflow: visible;
  backdrop-filter: blur(3px);
  transition: border-color $transition-fast, box-shadow $transition-fast;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    background: url('/assets/img/xp_texture.jpg') center / cover no-repeat;
    opacity: 0.18;
    filter: grayscale(80%) blur(3px) contrast(160%) brightness(25%);
    pointer-events: none;
  }

  &:hover {
    border-color: rgba($color-accent, 0.3);
    box-shadow: 0 4px 24px rgba($color-accent, 0.08);
  }

  &:focus-within {
    z-index: 10;
  }

  &--left {
    flex-direction: row; // art | fields
  }

  &--right {
    flex-direction: row; // fields | art handled by template order
  }

  &__body {
    flex: 1;
    padding: $spacing-4;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-3;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-accent;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__actions {
    display: flex;
    gap: $spacing-2;
  }

  &__fields {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
  }
}

// ── Commander art panel ───────────────────────────────────────────────────────
.commander-art {
  flex-shrink: 0;
  width: 140px;
  position: relative;
  z-index: 1;
  overflow: hidden;

  &:after {
    content:"";
    position:absolute;
    top:0;
    left:0;
    width:100%;
    height:100%;
    background:#111;
    z-index:0;
  }

  &--left {
    border-left: 1px solid rgba($border-color, 0.4);
  }

  &--right {
    border-right: 1px solid rgba($border-color, 0.4);
    order:1;
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
    transition: transform 0.4s ease;
    z-index:1;
    position:relative;

    .player-card:hover & {
      transform: scale(1.04);
    }
  }

  &__placeholder {
    position:relative;
    width: 100%;
    height: 100%;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: repeating-linear-gradient(
      135deg,
      rgba($color-bg-elevated, 0.3) 0px,
      rgba($color-bg-elevated, 0.3) 2px,
      transparent 2px,
      transparent 12px
    );
    z-index:1;
  }

  &__placeholder-icon {
    font-size: 2rem;
    opacity: 0.15;
  }
}

// Glow overlay on the art for left-column cards
.player-card--left .commander-art--left::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, transparent 60%, rgba($color-bg-card, 0.7) 100%);
  pointer-events: none;
}

// Glow overlay on the art for right-column cards
.player-card--right .commander-art--right::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, transparent 60%, rgba($color-bg-card, 0.7) 100%);
  pointer-events: none;
}

// ── Form fields ───────────────────────────────────────────────────────────────
.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
  flex: 0 0 300px;
  min-width: 120px;
  position: relative;

  &--narrow {
    flex: 0 0 64px;
    min-width: 64px;
  }
}

.form-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: $color-text-muted;
}

.form-input {
  appearance: none;
  background: rgba($color-bg-elevated, 0.6);
  border: 1px solid rgba($border-color, 0.75);
  border-radius: $border-radius-md;
  color: $color-text;
  font: inherit;
  font-size: $font-size-sm;
  padding: 7px 9px;
  width: 100%;
  transition: border-color $transition-fast;

  &:focus {
    outline: none;
    border-color: rgba($color-accent, 0.55);
  }

  &--valid  { border-color: rgba($color-success, 0.65); }
  &--invalid { border-color: rgba($color-danger, 0.65); }
}

// ── Autocomplete ──────────────────────────────────────────────────────────────
.autocomplete-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.suggest-list {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 50;
  background: $color-bg-elevated;
  border: 1px solid rgba($border-color, 0.9);
  border-radius: $border-radius-md;
  max-height: 160px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: $spacing-1 0;
  box-shadow: $shadow-md;
}

.suggest-item {
  padding: 6px 10px;
  font-size: $font-size-sm;
  color: $color-text-muted;
  cursor: pointer;

  &:hover {
    background: rgba($color-accent, 0.12);
    color: $color-text;
  }
}

.commander-status {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;

  &--checking { color: $color-text-muted; }
  &--ok       { color: $color-success; }
  &--err      { color: $color-danger; }
}

// ── Actions ───────────────────────────────────────────────────────────────────
.form-actions {
  display: flex;
  gap: $spacing-3;
  align-items: center;
}

// ── Buttons ───────────────────────────────────────────────────────────────────
.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  padding: 9px 18px;
  border-radius: $border-radius-md;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background $transition-fast, border-color $transition-fast, color $transition-fast;

  &--primary {
    background: $color-primary;
    border: 1px solid rgba($color-primary-light, 0.5);
    color: $color-text;

    &:hover:not(:disabled) { background: $color-primary-light; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  }

  &--secondary {
    background: rgba($color-bg-elevated, 0.7);
    border: 1px solid rgba($border-color, 0.8);
    color: $color-text-muted;

    &:hover:not(:disabled) {
      color: $color-text;
      border-color: rgba($color-accent, 0.4);
    }

    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  &--ghost {
    background: transparent;
    border: 1px solid rgba($color-danger, 0.4);
    color: $color-danger;

    &:hover:not(:disabled) { background: rgba($color-danger, 0.1); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  &--muted {
    background: transparent;
    border: 1px solid rgba($border-color, 0.6);
    color: $color-text-muted;

    &:hover { color: $color-text; border-color: rgba($border-color, 1); }
  }

  &--sm {
    padding: 4px 10px;
    font-size: $font-size-xs;
  }
}

// ── Status messages ────────────────────────────────────────────────────────────
.form-msg {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  padding: $spacing-3 $spacing-4;
  border-radius: $border-radius-md;

  &--success {
    background: rgba($color-success, 0.12);
    color: $color-success;
    border: 1px solid rgba($color-success, 0.3);
  }

  &--error {
    background: rgba($color-danger, 0.12);
    color: $color-danger;
    border: 1px solid rgba($color-danger, 0.3);
  }
}

// ── Responsive ────────────────────────────────────────────────────────────────
@media (max-width: 900px) {
  .players-grid {
    grid-template-columns: 1fr;
  }

  .commander-art {
    width: 110px;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .commander-art {
    display: none;
  }
}
</style>
