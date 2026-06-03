import type { PlayerRatingDetail } from '~/composables/usePlayerRating'

export function buildAveragePlayerRatingSeries(
  details: PlayerRatingDetail[],
  timelineGameIds: string[],
): Array<number | null> {
  const historyMaps = details
    .map((detail) => new Map(detail.history.map((entry) => [entry.gameId, entry.rating])))

  const lastRatings = new Array<number | null>(historyMaps.length).fill(null)
  const started = new Array<boolean>(historyMaps.length).fill(false)

  return timelineGameIds.map((gameId) => {
    const activeRatings: number[] = []

    historyMaps.forEach((historyMap, index) => {
      const rating = historyMap.get(gameId)
      if (rating !== undefined) {
        started[index] = true
        lastRatings[index] = rating
      }

      if (started[index] && lastRatings[index] !== null) {
        activeRatings.push(lastRatings[index])
      }
    })

    if (activeRatings.length === 0) return null
    return activeRatings.reduce((sum, rating) => sum + rating, 0) / activeRatings.length
  })
}
