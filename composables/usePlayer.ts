import type { PlayerState } from './useLeagueState'

export type { PlayerState }

export function usePlayer() {
  const players = useState<Record<string, PlayerState>>('league:players', () => ({}))

  const playerList = computed(() =>
    Object.values(players.value).sort((a, b) => b.totalPoints - a.totalPoints),
  )

  function getPlayer(name: string): PlayerState | undefined {
    return players.value[name]
  }

  return { players, playerList, getPlayer }
}
