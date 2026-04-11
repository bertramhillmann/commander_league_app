import type { ProcessedGame, ProcessedGamePlayer } from './useLeagueState'

export type { ProcessedGame, ProcessedGamePlayer }

export function useGame() {
  const games = useState<ProcessedGame[]>('league:games', () => [])

  function getGame(gameId: string): ProcessedGame | undefined {
    return games.value.find((g) => g.gameId === gameId)
  }

  return { games, getGame }
}
