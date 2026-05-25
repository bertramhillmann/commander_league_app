import { connectToDatabase } from '../../../../utils/mongoose'
import { Player } from '../../../../models/Player'
import { getPlayerSession, isAdminUser } from '../../../../utils/playerAuth'
import { flattenPlayerPurchases } from '../../../../utils/purchases'
import { formatPlayerName } from '~/utils/playerNames'

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  const config = useRuntimeConfig()

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can delete saved purchases' })
  }

  const playerName = formatPlayerName(getRouterParam(event, 'playerName') ?? '')
  const purchaseId = (getRouterParam(event, 'purchaseId') ?? '').trim()

  if (!playerName || !purchaseId) {
    throw createError({ statusCode: 400, statusMessage: 'playerName and purchaseId are required' })
  }

  await connectToDatabase()

  const updateResult = await Player.updateOne(
    { name: playerName },
    {
      $pull: {
        purchases: {
          _id: purchaseId,
        },
      },
    },
  )

  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Player not found' })
  }

  if (updateResult.modifiedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Purchase not found' })
  }

  const player = await Player.findOne({ name: playerName }).lean()
  return {
    ok: true,
    playerName,
    purchases: flattenPlayerPurchases(playerName, player?.purchases ?? []),
  }
})
