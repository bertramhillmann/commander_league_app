import mongoose from 'mongoose'
import { PrizePoolItem } from '../../models/PrizePoolItem'
import { connectToDatabase } from '../../utils/mongoose'
import { getPlayerSession, isAdminUser } from '../../utils/playerAuth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can delete prize-pool items' })
  }

  const itemId = getRouterParam(event, 'itemId') ?? ''
  if (!mongoose.isValidObjectId(itemId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid prize-pool item.' })
  }

  await connectToDatabase()
  const deleted = await PrizePoolItem.findByIdAndDelete(itemId)
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Prize-pool item not found.' })
  return { ok: true }
})
