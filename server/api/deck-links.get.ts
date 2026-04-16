import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { buildPlayerLookup, ensurePlayerExists } from '../utils/playerData'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const playerName = typeof query.playerName === 'string' ? query.playerName : ''

  if (!playerName) {
    throw createError({ statusCode: 400, statusMessage: 'playerName is required' })
  }

  await connectToDatabase()
  const ensuredPlayer = await ensurePlayerExists(playerName)
  const { query: playerLookup } = buildPlayerLookup(playerName)

  const player = await Player.findOne(playerLookup).lean()
  const commanderDecks = player?.commanderDecks ?? []

  return commanderDecks
    .map((link) => ({
      playerName: player?.name ?? ensuredPlayer.name,
      playerNameKey: player?.nameKey ?? ensuredPlayer.nameKey,
      commanderName: link.commanderName,
      commanderNameKey: link.commanderNameKey,
      archidektUrl: link.archidektUrl,
      archidektDeckId: link.archidektDeckId,
      updatedAt: link.updatedAt,
    }))
    .sort((a, b) => a.commanderName.localeCompare(b.commanderName))
})
