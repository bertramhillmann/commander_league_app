import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { getPlayerSession } from '../utils/playerAuth'
import { flattenPlayerPurchases } from '../utils/purchases'

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  await connectToDatabase()

  const players = await Player.find({})
    .sort({ name: 1 })
    .select('name purchases')
    .lean()

  const purchases = players
    .flatMap((player) => flattenPlayerPurchases(player.name, player.purchases ?? []))
    .sort((a, b) => {
      const dateDiff = (b.date ?? '').localeCompare(a.date ?? '')
      if (dateDiff !== 0) return dateDiff
      const createdAtDiff = (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      if (createdAtDiff !== 0) return createdAtDiff
      return a.playerName.localeCompare(b.playerName)
    })

  return { purchases }
})
