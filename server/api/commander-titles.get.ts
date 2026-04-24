import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'

export default defineEventHandler(async () => {
  await connectToDatabase()

  const players = await Player.find({})
    .select('name nameKey commanderDecks')
    .lean()

  return players.flatMap((player) =>
    (player.commanderDecks ?? [])
      .filter((entry) => entry.selectedTitle)
      .map((entry) => ({
        playerName: player.name,
        playerNameKey: player.nameKey,
        commanderName: entry.commanderName,
        commanderNameKey: entry.commanderNameKey,
        selectedTitle: entry.selectedTitle,
      })),
  )
})
