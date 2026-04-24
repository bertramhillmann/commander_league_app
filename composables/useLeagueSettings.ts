import { computed } from 'vue'

import {
  getResolvedAchievementDefinitions,
  getResolvedLeagueSettings,
  setRuntimeLeagueSettings,
  type LeagueSettingsDocument,
} from '~/utils/leagueSettings'

const useRawLeagueSettingsState = () => useState<LeagueSettingsDocument | null>('league:settings:raw', () => null)
const useLeagueSettingsLoadedState = () => useState<boolean>('league:settings:loaded', () => false)
const useLeagueSettingsLoadingState = () => useState<boolean>('league:settings:loading', () => false)
const useLeagueSettingsErrorState = () => useState<string | null>('league:settings:error', () => null)

let pendingLeagueSettingsInit: Promise<void> | null = null

export function useLeagueSettings() {
  const rawSettings = useRawLeagueSettingsState()
  const loaded = useLeagueSettingsLoadedState()
  const loading = useLeagueSettingsLoadingState()
  const error = useLeagueSettingsErrorState()

  const settings = computed(() => getResolvedLeagueSettings(rawSettings.value))
  const achievementDefs = computed(() => getResolvedAchievementDefinitions(rawSettings.value))

  async function init(force = false) {
    if (loaded.value && !force) {
      setRuntimeLeagueSettings(rawSettings.value)
      return
    }
    if (pendingLeagueSettingsInit) return await pendingLeagueSettingsInit

    pendingLeagueSettingsInit = (async () => {
      loading.value = true
      error.value = null

      try {
        const response = await $fetch<{ settings: LeagueSettingsDocument | null }>('/api/settings')
        rawSettings.value = response.settings ?? null
        setRuntimeLeagueSettings(rawSettings.value)
        loaded.value = true
      } catch (err: any) {
        rawSettings.value = null
        setRuntimeLeagueSettings(null)
        loaded.value = true
        error.value = err?.data?.statusMessage ?? err?.message ?? 'Failed to load league settings'
      } finally {
        loading.value = false
        pendingLeagueSettingsInit = null
      }
    })()

    await pendingLeagueSettingsInit
  }

  async function refresh() {
    await init(true)
  }

  function applyLocalSettings(nextSettings: LeagueSettingsDocument | null) {
    rawSettings.value = nextSettings
    setRuntimeLeagueSettings(nextSettings)
    loaded.value = true
  }

  return {
    rawSettings,
    settings,
    achievementDefs,
    loaded,
    loading,
    error,
    init,
    refresh,
    applyLocalSettings,
  }
}
