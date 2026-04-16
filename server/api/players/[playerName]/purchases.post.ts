import { connectToDatabase } from '../../../utils/mongoose'
import { Player } from '../../../models/Player'
import { addCardsToPlayerCardpool, ensurePlayerExists, normalizeCardNames } from '../../../utils/playerData'
import { getPlayerSession, isAdminUser } from '../../../utils/playerAuth'
import { formatPlayerName } from '~/utils/playerNames'

type PurchaseBody = {
  name?: string
  type?: string
  cost?: number
  set?: string
  cards?: string[]
}

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const config = useRuntimeConfig()
  const playerName = formatPlayerName(getRouterParam(event, 'playerName') ?? '')
  const body = await readBody<PurchaseBody>(event)

  if (!playerName) {
    throw createError({ statusCode: 400, statusMessage: 'playerName is required' })
  }

  const isOwner = formatPlayerName(session.user).toLowerCase() === playerName.toLowerCase()
  const isAdmin = isAdminUser(config.admins, session.user)
  if (!isOwner && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'You can only add purchases to your own player record' })
  }

  const purchaseName = (body.name ?? '').trim()
  const type = (body.type ?? '').trim()
  const set = (body.set ?? '').trim()
  const cost = Number(body.cost ?? 0)
  const cards = normalizeCardNames(body.cards ?? [])

  if (!purchaseName || !type) {
    throw createError({ statusCode: 400, statusMessage: 'Purchase name and type are required' })
  }

  await connectToDatabase()
  await ensurePlayerExists(playerName)

  await Player.updateOne(
    { name: playerName },
    {
      $push: {
        purchases: {
          name: purchaseName,
          type,
          cost: Number.isFinite(cost) ? cost : 0,
          set,
          cards,
        },
      },
    },
  )

  await addCardsToPlayerCardpool(playerName, cards)

  const player = await Player.findOne({ name: playerName }).lean()
  return {
    ok: true,
    playerName,
    cardpool: player?.cardpool ?? [],
    purchases: player?.purchases ?? [],
  }
})
