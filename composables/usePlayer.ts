import { useLeagueState, type LeagueStanding, type PlayerState } from './useLeagueState'

export type { LeagueStanding, PlayerState }

export function usePlayer() {
  const players = useState<Record<string, PlayerState>>('league:players', () => ({}))
  const { standings } = useLeagueState()

  const playerList = computed(() => standings.value)

  function getPlayer(name: string): PlayerState | undefined {
    return players.value[name]
  }

  return { players, playerList, getPlayer }
}
