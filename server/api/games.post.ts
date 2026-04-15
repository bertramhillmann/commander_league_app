import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)

  const { date, players } = body as {
    date: string
    players: { name: string; commander: string; placement: number; eliminations: number | null; commanderCasts: number | null }[]
  }

  if (!date || !Array.isArray(players) || players.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game data' })
  }

  await connectToDatabase()

  // Derive next gameId by finding the highest existing numeric suffix
  const last = await Game.findOne({ gameId: /^G\d+$/ })
    .sort({ gameId: -1 })
    .select('gameId')
    .lean()

  let nextNum = 1
  if (last?.gameId) {
    const parsed = parseInt(last.gameId.slice(1), 10)
    if (!isNaN(parsed)) nextNum = parsed + 1
  }

  const gameId = `G${String(nextNum).padStart(4, '0')}`
  const game = await Game.create({
    gameId,
    date: new Date(date),
    players: players.map((p, i) => ({
      name: p.name,
      commander: p.commander,
      placement: p.placement,
      points: null,
      eliminations: p.eliminations ?? null,
      commanderCasts: p.commanderCasts ?? null,
    })),
  })

  return { ok: true, gameId: game.gameId }
})
