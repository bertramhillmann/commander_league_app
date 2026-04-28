import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  const isAdmin = Boolean(session && isAdminUser(config.admins, session.user))
  const query = getQuery(event)
  const includeHidden = isAdmin && String(query.includeHidden ?? '') === '1'

  await connectToDatabase()
  const games = await Game.find(includeHidden ? {} : { hidden: { $ne: true } }).sort({ date: -1 }).lean()
  return games
})
