import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'

export default defineEventHandler(async () => {
  await connectToDatabase()
  const players = await Player.find({}, { name: 1, commanderDecks: 1, _id: 0 }).lean()
  return players.flatMap((player) =>
    (player.commanderDecks ?? [])
      .filter((deck) => deck.retired)
      .map((deck) => ({ playerName: player.name, commanderName: deck.commanderName })),
  )
})
