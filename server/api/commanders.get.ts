import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'

export default defineEventHandler(async () => {
  await connectToDatabase()
  const games = await Game.find({}, { 'players.commander': 1, _id: 0 }).lean()

  const names = new Set<string>()
  for (const game of games) {
    for (const player of game.players) {
      if (player.commander) names.add(player.commander)
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b))
})
