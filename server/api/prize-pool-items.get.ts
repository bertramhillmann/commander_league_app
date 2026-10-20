import { PrizePoolItem } from '../models/PrizePoolItem'
import { connectToDatabase } from '../utils/mongoose'
import { getPlayerSession } from '../utils/playerAuth'
import { serializePrizePoolItem } from '../utils/prizePoolItems'

export default defineEventHandler(async (event) => {
  if (!getPlayerSession(event)) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  await connectToDatabase()
  const items = await PrizePoolItem.find({}).sort({ date: -1, createdAt: -1 }).lean()
  return { items: items.map(serializePrizePoolItem) }
})
