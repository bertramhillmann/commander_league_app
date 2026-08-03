import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  const isAdmin = Boolean(session && isAdminUser(config.admins, session.user))
  const query = getQuery(event)
  const includeHidden = isAdmin && String(query.includeHidden ?? '') === '1'
  const afterId = String(query.afterId ?? '').trim()
  const afterGameId = /^G\d+$/.test(afterId) ? afterId : ''

  await connectToDatabase()
  const filter: Record<string, unknown> = includeHidden ? {} : { hidden: { $ne: true } }
  if (afterGameId) {
    filter.gameId = { $gt: afterGameId }
  }
  const games = await Game.find(filter).sort({ gameId: 1 }).lean()
  return games
})
