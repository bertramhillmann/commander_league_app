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
            <h2 class="settings-card__title">Standings</h2>
            <p class="settings-card__subtitle">Control which bonuses count toward standings totals and which standings columns stay visible.</p>
          </div>
        </div>

        <label class="form-field settings-mode-field">
          <span class="form-label">Player Ranking</span>
          <select v-model="form.playerRankingSystem" class="form-input">
            <option value="classic">Classic standings</option>
            <option value="player_rating_based">Player Rating Based System</option>
          </select>
        </label>

        <template v-if="form.playerRankingSystem === 'classic'">
          <label class="form-field settings-mode-field">
            <span class="form-label">Calculation System</span>
            <select v-model="form.standings.adjustmentMode" class="form-input">
              <option value="compensation">Current compensation system</option>
              <option value="freeGames">Free games on missed participation</option>
              <option value="penaltyGames">Penalty for excess games played</option>
            </select>
          </label>

          <label class="toggle-field">
            <input v-model="form.standings.usePerformanceModifier" type="checkbox" class="toggle-field__input" />
            <span class="toggle-field__copy">
              <span class="toggle-field__label">Use performance modifier</span>
              <span class="toggle-field__hint">When off, standings use a fixed multiplier of 1.0.</span>
            </span>
          </label>

          <label class="toggle-field">
            <input v-model="form.standings.includeCommanderXp" type="checkbox" class="toggle-field__input" />
            <span class="toggle-field__copy">
              <span class="toggle-field__label">Include Commander XP</span>
              <span class="toggle-field__hint">When off, Commander XP adds 0 points to standings and the XP column is hidden on the dashboard.</span>
            </span>
          </label>

          <label class="toggle-field">
            <input v-model="form.standings.includeAchievementPoints" type="checkbox" class="toggle-field__input" />
            <span class="toggle-field__copy">
              <span class="toggle-field__label">Include achievement points</span>
              <span class="toggle-field__hint">When off, achievement points add 0 points to standings and the achievement column is hidden on the dashboard.</span>
            </span>
          </label>

          <div v-if="form.standings.adjustmentMode === 'freeGames'" class="settings-subgrid">
            <label class="form-field">
              <span class="form-label">Starting Avg For Pre-Participation Misses</span>
              <input v-model.number="form.standings.freeGamesBaselineAvg" type="number" step="0.001" min="0" class="form-input" />
            </label>
            <label class="form-field">
              <span class="form-label">Misses Before Free Games Start</span>
              <input v-model.number="form.standings.freeGamesGraceMisses" type="number" step="1" min="0" class="form-input" />
            </label>
            <label class="form-field">
              <span class="form-label">Consecutive Miss Reduction</span>
              <input v-model.number="form.standings.freeGamesConsecutivePenalty" type="number" step="0.001" min="0" class="form-input" />
            </label>
            <label class="form-field">
              <span class="form-label">Minimum Avg Floor</span>
              <input v-model.number="form.standings.freeGamesMinimumAvg" type="number" step="0.001" min="0" class="form-input" />
            </label>
          </div>

          <div v-if="form.standings.adjustmentMode === 'penaltyGames'" class="settings-subgrid settings-subgrid--single">
            <label class="form-field">
              <span class="form-label">Penalty Factor</span>
              <input v-model.number="form.standings.penaltyFactor" type="number" step="0.001" min="0" class="form-input" />
            </label>
          </div>
        </template>

        <div v-if="form.playerRankingSystem === 'player_rating_based'" class="settings-subgrid">
          <label class="form-field">
            <span class="form-label">Provisional Games</span>
            <input v-model.number="form.playerRating.provisionalGames" type="number" step="1" min="1" class="form-input" />
          </label>
          <label class="toggle-field">
            <input v-model="form.playerRating.commanderMMRPointModifier.enabled" type="checkbox" class="toggle-field__input" />
            <span class="toggle-field__copy">
              <span class="toggle-field__label">Use commander MMR point modifier</span>
              <span class="toggle-field__hint">Boost or soften point-based rating components depending on pod commander strength.</span>
            </span>
          </label>
          <label class="form-field">
            <span class="form-label">MMR Point Modifier Cap %</span>
            <input v-model.number="form.playerRating.commanderMMRPointModifier.maxModifierPercent" type="number" step="1" min="0" class="form-input" />
          </label>
        </div>
      </section>
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
            <h3 class="xp-settings__title">XP Score Value</h3>
            <div class="xp-settings__row xp-settings__row--single">
              <label class="form-field">
                <span class="form-label">Points Per Commander Level</span>
                <input v-model.number="form.level.pointsPerLevel" type="number" step="0.001" min="0" class="form-input" />
              </label>
            </div>
          </div>

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
            <h2 class="settings-card__title">Shop</h2>
            <p class="settings-card__subtitle">Configure league shop defaults for Looster purchases.</p>
          </div>
        </div>

        <div class="settings-subgrid settings-subgrid--single">
          <label class="form-field">
            <span class="form-label">Looster Cost (L-Points)</span>
            <input v-model.number="form.shop.loosterCost" type="number" step="0.001" min="0" class="form-input" />
          </label>
        </div>
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
import {
  getResolvedLeagueSettings,
  type LeagueSettingsDocument,
  type PlayerRankingSystem,
  type StandingsAdjustmentMode,
} from '~/utils/leagueSettings'
import { DEFAULT_MAX_LEVEL, type AchievementDef } from '~/utils/scoringDefaults'

definePageMeta({ middleware: [] })

const { refreshSession: refreshAuthSession, isAdmin } = useAuth()
await refreshAuthSession()

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
  playerRankingSystem: PlayerRankingSystem
  playerRating: {
    provisionalGames: number
    commanderMMRPointModifier: {
      enabled: boolean
      maxModifierPercent: number
    }
  }
  level: {
    xpPerGame: Record<number, number>
    winBonusXp: Record<number, number>
    thresholds: number[]
    pointsPerLevel: number
  }
  standings: {
    usePerformanceModifier: boolean
    includeCommanderXp: boolean
    includeAchievementPoints: boolean
    adjustmentMode: StandingsAdjustmentMode
    freeGamesBaselineAvg: number
    freeGamesConsecutivePenalty: number
    freeGamesMinimumAvg: number
    freeGamesGraceMisses: number
    penaltyFactor: number
  }
  shop: {
    loosterCost: number
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
    if (error?.statusCode === 403 || error?.data?.statusCode === 403) {
      await refreshAuthSession()
      errorMessage.value = 'Your admin session expired. Please log in again.'
      if (!isAdmin.value) {
        await navigateTo('/login')
      }
    } else {
      errorMessage.value = error?.data?.statusMessage ?? 'Failed to save settings.'
    }
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
    if (error?.statusCode === 403 || error?.data?.statusCode === 403) {
      await refreshAuthSession()
      errorMessage.value = 'Your admin session expired. Please log in again.'
      if (!isAdmin.value) {
        await navigateTo('/login')
      }
    } else {
      errorMessage.value = error?.data?.statusMessage ?? 'Failed to clear saved overrides.'
    }
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
    playerRankingSystem: source.playerRankingSystem,
    playerRating: {
      provisionalGames: source.playerRating.provisionalGames,
      commanderMMRPointModifier: {
        enabled: source.playerRating.commanderMMRPointModifier.enabled,
        maxModifierPercent: source.playerRating.commanderMMRPointModifier.maxModifierPercent,
      },
    },
    level: {
      xpPerGame: { ...source.level.xpPerGame },
      winBonusXp: { ...source.level.winBonusXp },
      thresholds: [...source.level.thresholds],
      pointsPerLevel: source.level.pointsPerLevel,
    },
    standings: {
      usePerformanceModifier: source.standings.usePerformanceModifier,
      includeCommanderXp: source.standings.includeCommanderXp,
      includeAchievementPoints: source.standings.includeAchievementPoints,
      adjustmentMode: source.standings.adjustmentMode,
      freeGamesBaselineAvg: source.standings.freeGamesBaselineAvg,
      freeGamesConsecutivePenalty: source.standings.freeGamesConsecutivePenalty,
      freeGamesMinimumAvg: source.standings.freeGamesMinimumAvg,
      freeGamesGraceMisses: source.standings.freeGamesGraceMisses,
      penaltyFactor: source.standings.penaltyFactor,
    },
    shop: {
      loosterCost: source.shop.loosterCost,
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
  target.playerRankingSystem = source.playerRankingSystem
  target.playerRating.provisionalGames = source.playerRating.provisionalGames
  target.playerRating.commanderMMRPointModifier.enabled = source.playerRating.commanderMMRPointModifier.enabled
  target.playerRating.commanderMMRPointModifier.maxModifierPercent = source.playerRating.commanderMMRPointModifier.maxModifierPercent
  target.level.xpPerGame = { ...source.level.xpPerGame }
  target.level.winBonusXp = { ...source.level.winBonusXp }
  target.level.thresholds = [...source.level.thresholds]
  target.level.pointsPerLevel = source.level.pointsPerLevel
  target.standings.usePerformanceModifier = source.standings.usePerformanceModifier
  target.standings.includeCommanderXp = source.standings.includeCommanderXp
  target.standings.includeAchievementPoints = source.standings.includeAchievementPoints
  target.standings.adjustmentMode = source.standings.adjustmentMode
  target.standings.freeGamesBaselineAvg = source.standings.freeGamesBaselineAvg
  target.standings.freeGamesConsecutivePenalty = source.standings.freeGamesConsecutivePenalty
  target.standings.freeGamesMinimumAvg = source.standings.freeGamesMinimumAvg
  target.standings.freeGamesGraceMisses = source.standings.freeGamesGraceMisses
  target.standings.penaltyFactor = source.standings.penaltyFactor
  target.shop.loosterCost = source.shop.loosterCost
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
    playerRankingSystem: source.playerRankingSystem,
    playerRating: {
      provisionalGames: sanitizeInteger(source.playerRating.provisionalGames),
      commanderMMRPointModifier: {
        enabled: source.playerRating.commanderMMRPointModifier.enabled,
        maxModifierPercent: sanitizePositiveNumber(source.playerRating.commanderMMRPointModifier.maxModifierPercent),
      },
    },
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
      pointsPerLevel: sanitizePositiveNumber(source.level.pointsPerLevel),
    },
    standings: {
      usePerformanceModifier: source.standings.usePerformanceModifier,
      includeCommanderXp: source.standings.includeCommanderXp,
      includeAchievementPoints: source.standings.includeAchievementPoints,
      adjustmentMode: source.standings.adjustmentMode,
      freeGamesBaselineAvg: sanitizePositiveNumber(source.standings.freeGamesBaselineAvg),
      freeGamesConsecutivePenalty: sanitizePositiveNumber(source.standings.freeGamesConsecutivePenalty),
      freeGamesMinimumAvg: sanitizePositiveNumber(source.standings.freeGamesMinimumAvg),
      freeGamesGraceMisses: sanitizeInteger(source.standings.freeGamesGraceMisses),
      penaltyFactor: sanitizePositiveNumber(source.standings.penaltyFactor),
    },
    shop: {
      loosterCost: sanitizePositiveNumber(source.shop.loosterCost),
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

.settings-mode-field {
  margin-bottom: $spacing-4;
  max-width: 420px;
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

.xp-settings__row--single {
  grid-template-columns: minmax(0, 280px);
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

.settings-subgrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: $spacing-3;
  margin-top: $spacing-2;
}

.settings-subgrid--single {
  grid-template-columns: minmax(0, 280px);
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
  .threshold-grid,
  .settings-subgrid {
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
  .threshold-grid,
  .settings-subgrid {
    grid-template-columns: 1fr;
  }

  .placement-panel__row {
    grid-template-columns: 50px 1fr 1fr;
  }
}
</style>
