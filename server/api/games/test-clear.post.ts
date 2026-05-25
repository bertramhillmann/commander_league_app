import { Game } from '../../models/Game'
import { connectToDatabase } from '../../utils/mongoose'
import { getPlayerSession, isAdminUser } from '../../utils/playerAuth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (String(config.environment ?? '').toLowerCase() !== 'test') {
    throw createError({ statusCode: 403, statusMessage: 'Only available in test environment' })
  }

  await connectToDatabase()
  const result = await Game.deleteMany({})

  return {
    ok: true,
    deletedCount: result.deletedCount ?? 0,
  }
})
