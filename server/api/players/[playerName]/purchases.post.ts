import { connectToDatabase } from '../../../utils/mongoose'
import { Player } from '../../../models/Player'
import { addCardsToPlayerCardpool, ensurePlayerExists } from '../../../utils/playerData'
import { getPlayerSession, isAdminUser } from '../../../utils/playerAuth'
import { flattenPlayerPurchases, normalizeEuroPrice, parsePurchaseDate, validateAndCanonicalizeCards } from '../../../utils/purchases'
import { Settings } from '../../../models/Settings'
import { formatPlayerName } from '~/utils/playerNames'
import { DEFAULT_LOOSTER_COST } from '~/utils/leagueSettings'

type PurchaseBody = {
  name?: string
  type?: string
  cost?: number
  set?: string
  set_name?: string
  cards?: string[] | string
  date?: string
  priceEuro?: number
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

  const purchaseName = (body.name ?? 'Looster').trim() || 'Looster'
  const type = (body.type ?? 'looster').trim() || 'looster'
  const set = (body.set ?? '').trim()
  const setName = (body.set_name ?? '').trim()
  const cards = await validateAndCanonicalizeCards(body.cards)
  const purchaseDate = parsePurchaseDate(body.date)
  const priceEuro = normalizeEuroPrice(body.priceEuro)

  if (!purchaseName || !type || !set || !setName) {
    throw createError({ statusCode: 400, statusMessage: 'Purchase name, type, set, and set name are required' })
  }

  await connectToDatabase()
  await ensurePlayerExists(playerName)
  const settingsDoc = await Settings.findOne({ key: 'league' }).lean()
  const loosterCost = Number.isFinite(Number(settingsDoc?.shop?.loosterCost))
    ? Number(settingsDoc?.shop?.loosterCost)
    : DEFAULT_LOOSTER_COST

  await Player.updateOne(
    { name: playerName },
    {
      $push: {
        purchases: {
          name: purchaseName,
          type,
          cost: loosterCost,
          set,
          set_name: setName,
          cards,
          date: purchaseDate,
          priceEuro,
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
    purchases: flattenPlayerPurchases(playerName, player?.purchases ?? []),
  }
})
