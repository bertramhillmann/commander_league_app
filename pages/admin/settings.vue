<template>
  <UITopMenu />

  <div class="page page--admin-settings">
    <div class="settings-shell">
      <header class="settings-hero">
        <div>
          <p class="settings-hero__eyebrow">Admin Controls</p>
          <h1 class="settings-hero__title">League Settings</h1>
          <p class="settings-hero__subtitle">
            Adjust placement scoring, commander XP, and achievement rewards. Saved values override the utils defaults.
          </p>
        </div>

        <div class="settings-hero__actions">
          <button type="button" class="btn btn--muted" @click="loadDefaultsLocally">Load Utils Defaults</button>
          <button type="button" class="btn btn--ghost" :disabled="saving" @click="clearOverrides">Clear Saved Overrides</button>
          <button type="button" class="btn btn--primary" :disabled="saving" @click="saveSettings">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </header>

      <p v-if="successMessage" class="form-msg form-msg--success">{{ successMessage }}</p>
      <p v-if="errorMessage" class="form-msg form-msg--error">{{ errorMessage }}</p>

      <section class="settings-card">
        <div class="settings-card__header">
          <div>
            <h2 class="settings-card__title">Placement Points</h2>
            <p class="settings-card__subtitle">Base points and l-points for 3-, 4-, and 5-player games.</p>
          </div>
        </div>

        <div class="placement-grid">
          <article v-for="playerCount in playerCounts" :key="playerCount" class="placement-panel">
            <h3 class="placement-panel__title">{{ playerCount }}-Player Game</h3>

            <div class="placement-panel__table">
              <div class="placement-panel__row placement-panel__row--head">
                <span>Place</span>
                <span>Points</span>
                <span>L-Points</span>
              </div>

              <div
                v-for="(rating, index) in form.points[playerCount]"
                :key="`${playerCount}-${index}`"
                class="placement-panel__row"
              >
                <span>{{ ordinal(index + 1) }}</span>
                <input v-model.number="rating.points" type="number" step="0.001" class="form-input" />
                <input v-model.number="rating.lPoints" type="number" step="0.001" class="form-input" />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__header">
          <div>
            <h2 class="settings-card__title">Commander XP</h2>
            <p class="settings-card__subtitle">Control XP gained per game, winner bonus XP, and the XP thresholds for each level.</p>
          </div>
        </div>

        <div class="xp-settings">
          <div class="xp-settings__group">
            <h3 class="xp-settings__title">XP Per Game</h3>
            <div class="xp-settings__row">
              <label v-for="playerCount in playerCounts" :key="`xp-${playerCount}`" class="form-field">
                <span class="form-label">{{ playerCount }} Players</span>
                <input v-model.number="form.level.xpPerGame[playerCount]" type="number" step="0.001" class="form-input" />
              </label>
            </div>
          </div>

          <div class="xp-settings__group">
            <h3 class="xp-settings__title">Winner Bonus XP</h3>
            <div class="xp-settings__row">
              <label v-for="playerCount in playerCounts" :key="`bonus-${playerCount}`" class="form-field">
                <span class="form-label">{{ playerCount }} Players</span>
                <input v-model.number="form.level.winBonusXp[playerCount]" type="number" step="0.001" class="form-input" />
              </label>
            </div>
          </div>

          <div class="xp-settings__group">
            <h3 class="xp-settings__title">XP Needed Per Level</h3>
            <div class="threshold-grid">
              <label
                v-for="threshold in levelThresholdRows"
                :key="threshold.level"
                class="form-field threshold-grid__item"
              >
                <span class="form-label">Level {{ threshold.level }}</span>
                <input
                  v-model.number="form.level.thresholds[threshold.index]"
                  type="number"
                  step="1"
                  min="0"
                  class="form-input"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <div class="settings-card__header">
          <div>
            <h2 class="settings-card__title">Standings</h2>
            <p class="settings-card__subtitle">Control whether the performance multiplier affects standings totals.</p>
          </div>
        </div>

        <label class="toggle-field">
          <input v-model="form.standings.usePerformanceModifier" type="checkbox" class="toggle-field__input" />
          <span class="toggle-field__copy">
            <span class="toggle-field__label">Use performance modifier</span>
            <span class="toggle-field__hint">When off, standings use a fixed multiplier of 1.0.</span>
          </span>
        </label>
      </section>

      <section class="settings-card">
        <div class="settings-card__header">
          <div>
            <h2 class="settings-card__title">Achievement Points</h2>
            <p class="settings-card__subtitle">Every achievement stays listed here, but only the points are adjustable.</p>
          </div>
        </div>

        <div class="achievement-table">
          <div class="achievement-table__row achievement-table__row--head">
            <span>Achievement</span>
            <span>Scope</span>
            <span>Rarity</span>
            <span>Points</span>
          </div>

          <div v-for="achievement in sortedAchievements" :key="achievement.id" class="achievement-table__row">
            <div class="achievement-table__main">
              <span class="achievement-table__icon">{{ achievement.icon }}</span>
              <div>
                <div class="achievement-table__name">{{ achievement.name }}</div>
                <div class="achievement-table__description">{{ achievement.description }}</div>
              </div>
            </div>
            <span class="achievement-table__meta">{{ achievement.scope }}</span>
            <span class="achievement-table__meta">{{ achievement.rarity }}</span>
            <input
              v-model.number="form.achievements[achievement.id]"
              type="number"
              step="0.001"
              class="form-input achievement-table__input"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getResolvedLeagueSettings, type LeagueSettingsDocument } from '~/utils/leagueSettings'
import { DEFAULT_MAX_LEVEL, type AchievementDef } from '~/utils/scoringDefaults'

definePageMeta({ middleware: [] })

const { ensureSession, isAdmin } = useAuth()
await ensureSession()

if (!isAdmin.value) {
  await navigateTo('/login')
}

const { settings, achievementDefs, init, applyLocalSettings } = useLeagueSettings()
const { refresh: refreshLeagueState } = useLeagueState()

await init(true)

const playerCounts = [3, 4, 5] as const

type EditableSettingsState = {
  points: Record<number, Array<{ points: number; lPoints: number }>>
  achievements: Record<string, number>
  level: {
    xpPerGame: Record<number, number>
    winBonusXp: Record<number, number>
    thresholds: number[]
  }
  standings: {
    usePerformanceModifier: boolean
  }
}

const form = reactive<EditableSettingsState>(createEditableSettings(settings.value))

watch(
  settings,
  (nextSettings) => {
    applyEditableSettings(form, nextSettings)
  },
  { deep: true },
)

const sortedAchievements = computed(() =>
  Object.values(achievementDefs.value).sort((a, b) => {
    const scopeDiff = a.scope.localeCompare(b.scope)
    if (scopeDiff !== 0) return scopeDiff
    const rarityDiff = getRarityRank(a.rarity) - getRarityRank(b.rarity)
    if (rarityDiff !== 0) return rarityDiff
    return a.name.localeCompare(b.name)
  }),
)

const levelThresholdRows = computed(() =>
  Array.from({ length: DEFAULT_MAX_LEVEL - 1 }, (_, index) => ({
    level: index + 2,
    index: index + 1,
  })),
)

const saving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

function loadDefaultsLocally() {
  successMessage.value = ''
  errorMessage.value = ''
  applyEditableSettings(form, getResolvedLeagueSettings(null))
}

async function saveSettings() {
  saving.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    normalizeThresholds(form.level.thresholds)

    const response = await $fetch<{ settings: LeagueSettingsDocument | null }>('/api/settings', {
      method: 'PUT',
      body: { settings: toDocument(form) },
    })

    applyLocalSettings(response.settings ?? null)
    await refreshLeagueState()
    successMessage.value = 'League settings saved.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to save settings.'
  } finally {
    saving.value = false
  }
}

async function clearOverrides() {
  saving.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const response = await $fetch<{ settings: LeagueSettingsDocument | null }>('/api/settings', {
      method: 'PUT',
      body: { settings: null },
    })

    applyLocalSettings(response.settings ?? null)
    applyEditableSettings(form, getResolvedLeagueSettings(null))
    await refreshLeagueState()
    successMessage.value = 'Saved overrides cleared. Utils defaults are active again.'
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage ?? 'Failed to clear saved overrides.'
  } finally {
    saving.value = false
  }
}

function createEditableSettings(source: ReturnType<typeof getResolvedLeagueSettings>): EditableSettingsState {
  return {
    points: Object.fromEntries(
      playerCounts.map((playerCount) => [
        playerCount,
        source.points[playerCount].map((rating) => ({ points: rating.points, lPoints: rating.lPoints })),
      ]),
    ) as EditableSettingsState['points'],
    achievements: Object.fromEntries(
      Object.values(source.achievements).map((achievement) => [achievement.id, achievement.points]),
    ),
    level: {
      xpPerGame: { ...source.level.xpPerGame },
      winBonusXp: { ...source.level.winBonusXp },
      thresholds: [...source.level.thresholds],
    },
    standings: {
      usePerformanceModifier: source.standings.usePerformanceModifier,
    },
  }
}

function applyEditableSettings(target: EditableSettingsState, source: ReturnType<typeof getResolvedLeagueSettings>) {
  for (const playerCount of playerCounts) {
    target.points[playerCount] = source.points[playerCount].map((rating) => ({
      points: rating.points,
      lPoints: rating.lPoints,
    }))
  }

  target.achievements = Object.fromEntries(
    Object.values(source.achievements).map((achievement) => [achievement.id, achievement.points]),
  )
  target.level.xpPerGame = { ...source.level.xpPerGame }
  target.level.winBonusXp = { ...source.level.winBonusXp }
  target.level.thresholds = [...source.level.thresholds]
  target.standings.usePerformanceModifier = source.standings.usePerformanceModifier
}

function toDocument(source: EditableSettingsState): LeagueSettingsDocument {
  normalizeThresholds(source.level.thresholds)

  return {
    points: Object.fromEntries(
      playerCounts.map((playerCount) => [
        playerCount,
        source.points[playerCount].map((rating) => ({
          points: sanitizeNumber(rating.points),
          lPoints: sanitizeNumber(rating.lPoints),
        })),
      ]),
    ),
    achievements: Object.fromEntries(
      Object.entries(source.achievements).map(([id, value]) => [id, sanitizeNumber(value)]),
    ),
    level: {
      xpPerGame: Object.fromEntries(
        playerCounts.map((playerCount) => [playerCount, sanitizePositiveNumber(source.level.xpPerGame[playerCount])]),
      ),
      winBonusXp: Object.fromEntries(
        playerCounts.map((playerCount) => [playerCount, sanitizePositiveNumber(source.level.winBonusXp[playerCount])]),
      ),
      thresholds: source.level.thresholds.map((value, index) =>
        index === 0 ? 0 : sanitizeInteger(value),
      ),
    },
    standings: {
      usePerformanceModifier: source.standings.usePerformanceModifier,
    },
  }
}

function normalizeThresholds(thresholds: number[]) {
  thresholds[0] = 0
  for (let index = 1; index < thresholds.length; index++) {
    thresholds[index] = Math.max(thresholds[index - 1], sanitizeInteger(thresholds[index]))
  }
}

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0
}

function sanitizeInteger(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
}

function sanitizePositiveNumber(value: number) {
  return Math.max(0, sanitizeNumber(value))
}

function ordinal(value: number) {
  return { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[value] ?? `${value}th`
}

function getRarityRank(rarity: AchievementDef['rarity']) {
  return { common: 1, uncommon: 2, rare: 3, mythic: 4 }[rarity]
}
</script>

<style lang="scss" scoped>
.page--admin-settings {
  min-height: 100vh;
}

.settings-shell {
  max-width: 1360px;
  margin: 0 auto;
  padding: $spacing-6 $spacing-6 $spacing-12;
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.settings-hero,
.settings-card {
  border: 1px solid rgba($border-color, 0.72);
  background: rgba($color-bg-card, 0.58);
  backdrop-filter: blur(10px);
  box-shadow: $shadow-md;
}

.settings-hero {
  display: flex;
  justify-content: space-between;
  gap: $spacing-6;
  padding: $spacing-6;
}

.settings-hero__eyebrow {
  margin: 0 0 $spacing-2;
  font-size: 11px;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba($color-primary-light, 0.8);
}

.settings-hero__title {
  margin: 0;
  color: $color-accent;
}

.settings-hero__subtitle {
  max-width: 720px;
  margin: $spacing-2 0 0;
  color: $color-text-muted;
}

.settings-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-end;
  gap: $spacing-2;
}

.settings-card {
  padding: $spacing-4;
}

.settings-card__header {
  margin-bottom: $spacing-4;
}

.settings-card__title {
  margin: 0;
  color: $color-accent;
}

.settings-card__subtitle {
  margin: $spacing-1 0 0;
  color: $color-text-muted;
}

.placement-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-4;
}

.placement-panel {
  padding: $spacing-4;
  border: 1px solid rgba($border-color, 0.58);
  background: rgba($color-bg-elevated, 0.54);
}

.placement-panel__title,
.xp-settings__title {
  margin: 0 0 $spacing-3;
  font-size: $font-size-base;
  color: $color-text;
}

.placement-panel__table {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.placement-panel__row {
  display: grid;
  grid-template-columns: 60px 1fr 1fr;
  gap: $spacing-2;
  align-items: center;
}

.placement-panel__row--head {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $color-text-muted;
}

.xp-settings {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.xp-settings__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-3;
}

.threshold-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: $spacing-3;
}

.achievement-table {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.achievement-table__row {
  display: grid;
  grid-template-columns: minmax(0, 2.6fr) 90px 90px 110px;
  gap: $spacing-3;
  align-items: center;
  padding: $spacing-3;
  border: 1px solid rgba($border-color, 0.48);
  background: rgba($color-bg-elevated, 0.45);
}

.achievement-table__row--head {
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: $color-text-muted;
}

.achievement-table__main {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
}

.achievement-table__icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: rgba($color-primary, 0.12);
  border: 1px solid rgba($color-primary-light, 0.18);
}

.achievement-table__name {
  color: $color-text;
  font-weight: $font-weight-semibold;
}

.achievement-table__description {
  margin-top: 2px;
  color: $color-text-muted;
  font-size: $font-size-xs;
}

.achievement-table__meta {
  color: $color-text-muted;
  text-transform: capitalize;
}

.achievement-table__input {
  width: 100%;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;
}

.toggle-field {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  padding: $spacing-3 0;
  cursor: pointer;
}

.toggle-field__input {
  margin-top: 2px;
}

.toggle-field__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toggle-field__label {
  color: $color-text;
  font-weight: $font-weight-semibold;
}

.toggle-field__hint {
  color: $color-text-muted;
  font-size: $font-size-sm;
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
  width: 100%;
  padding: 8px 10px;
  border: 1px solid rgba($border-color, 0.75);
  background: rgba($color-bg, 0.6);
  color: $color-text;
  font: inherit;
  transition: border-color $transition-fast, background $transition-fast;

  &:focus {
    outline: none;
    border-color: rgba($color-accent, 0.55);
    background: rgba($color-bg-elevated, 0.9);
  }
}

.btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: $border-radius-md;
  font: inherit;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  cursor: pointer;
  transition: background $transition-fast, color $transition-fast, border-color $transition-fast;
}

.btn--primary {
  background: $color-primary;
  border-color: rgba($color-primary-light, 0.4);
  color: $color-text;
}

.btn--muted {
  background: rgba($color-bg-elevated, 0.68);
  border-color: rgba($border-color, 0.75);
  color: $color-text-muted;
}

.btn--ghost {
  background: transparent;
  border-color: rgba($color-danger, 0.35);
  color: $color-danger;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.form-msg {
  padding: $spacing-3 $spacing-4;
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
}

.form-msg--success {
  border: 1px solid rgba($color-success, 0.3);
  background: rgba($color-success, 0.12);
  color: $color-success;
}

.form-msg--error {
  border: 1px solid rgba($color-danger, 0.3);
  background: rgba($color-danger, 0.12);
  color: $color-danger;
}

@media (max-width: 1100px) {
  .placement-grid,
  .xp-settings__row,
  .threshold-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .achievement-table__row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .settings-shell {
    padding-inline: $spacing-3;
  }

  .settings-hero {
    flex-direction: column;
  }

  .placement-grid,
  .xp-settings__row,
  .threshold-grid {
    grid-template-columns: 1fr;
  }

  .placement-panel__row {
    grid-template-columns: 50px 1fr 1fr;
  }
}
</style>
