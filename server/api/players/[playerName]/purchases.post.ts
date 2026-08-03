import { connectToDatabase } from '../../../utils/mongoose'
import { Player } from '../../../models/Player'
import { addCardsToPlayerCardpool, ensurePlayerExists } from '../../../utils/playerData'
import { getPlayerSession, isAdminUser } from '../../../utils/playerAuth'
import { flattenPlayerPurchases, normalizeCardPrintings, normalizeEuroPrice, parseCardListInput, parsePurchaseDate } from '../../../utils/purchases'
import { normalizeCardNames } from '../../../utils/playerData'
import { Settings } from '../../../models/Settings'
import { formatPlayerName } from '~/utils/playerNames'
import { DEFAULT_LOOSTER_COST } from '~/utils/leagueSettings'
import { getShopItemByType, getStartedSeasonCount } from '~/utils/shopOptions'

type PurchaseBody = {
  name?: string
  type?: string
  cost?: number
  set?: string
  set_name?: string
  cards?: string[] | string
  cardPrintings?: unknown
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
  const purchaseDate = parsePurchaseDate(body.date)
  const priceEuro = normalizeEuroPrice(body.priceEuro)

  await connectToDatabase()
  await ensurePlayerExists(playerName)
  const settingsDoc = await Settings.findOne({ key: 'league' }).lean()
  const loosterCost = Number.isFinite(Number(settingsDoc?.shop?.loosterCost))
    ? Number(settingsDoc?.shop?.loosterCost)
    : DEFAULT_LOOSTER_COST
  const shopItem = getShopItemByType(type as 'looster' | 'commander_slot_2' | 'commander_slot_3', settingsDoc, loosterCost)

  if (!purchaseName || !type || !shopItem) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown shop item.' })
  }

  if (shopItem.requiredStartedSeasons > getStartedSeasonCount(settingsDoc)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${shopItem.name} unlocks at the start of Season ${shopItem.requiredStartedSeasons}.`,
    })
  }

  // A Looster can be registered before its cards (or even its set) are known.
  // Card art is resolved asynchronously by the client and scoped to its set where possible.
  const cards = shopItem.purchaseType === 'looster'
    ? normalizeCardNames(parseCardListInput(body.cards))
    : []
  const cardPrintings = shopItem.purchaseType === 'looster'
    ? normalizeCardPrintings(body.cardPrintings, cards)
    : []

  if (shopItem.purchaseType !== 'looster') {
    const existingUnlock = await Player.findOne({
      name: playerName,
      'purchases.type': shopItem.purchaseType,
    }).lean()

    if (existingUnlock) {
      throw createError({ statusCode: 400, statusMessage: `${shopItem.name} has already been purchased.` })
    }
  }

  await Player.updateOne(
    { name: playerName },
    {
      $push: {
        purchases: {
          name: purchaseName,
          type,
          cost: shopItem.cost,
          set,
          set_name: setName,
          cards,
          cardPrintings,
          date: purchaseDate,
          priceEuro,
        },
      },
    },
  )

  if (cards.length > 0) {
    await addCardsToPlayerCardpool(playerName, cards)
  }

  const player = await Player.findOne({ name: playerName }).lean()
  return {
    ok: true,
    playerName,
    cardpool: player?.cardpool ?? [],
    purchases: flattenPlayerPurchases(playerName, player?.purchases ?? []),
  }
})
