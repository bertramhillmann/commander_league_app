import type { CommanderState } from './useLeagueState'

export type { CommanderState }

export function useCommander() {
  const commanders = useState<Record<string, CommanderState>>('league:commanders', () => ({}))

  const commanderList = computed(() =>
    Object.values(commanders.value).sort((a, b) => b.totalPoints - a.totalPoints)
  )

  function getCommander(name: string): CommanderState | undefined {
    return commanders.value[name]
  }

  return { commanders, commanderList, getCommander }
}
