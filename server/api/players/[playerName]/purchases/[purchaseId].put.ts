import { connectToDatabase } from '../../../../utils/mongoose'
import { Player } from '../../../../models/Player'
import { addCardsToPlayerCardpool, normalizeCardNames } from '../../../../utils/playerData'
import { getPlayerSession, isAdminUser } from '../../../../utils/playerAuth'
import { flattenPlayerPurchases, normalizeCardPrintings, normalizeEuroPrice, parseCardListInput, parsePurchaseDate } from '../../../../utils/purchases'
import { formatPlayerName } from '~/utils/playerNames'

type PurchaseBody = {
  name?: string
  type?: string
  set?: string
  set_name?: string
  cards?: string[] | string
  cardPrintings?: unknown
  date?: string
  priceEuro?: number
}

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  const config = useRuntimeConfig()

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can edit saved purchases' })
  }

  const playerName = formatPlayerName(getRouterParam(event, 'playerName') ?? '')
  const purchaseId = (getRouterParam(event, 'purchaseId') ?? '').trim()
  const body = await readBody<PurchaseBody>(event)

  if (!playerName || !purchaseId) {
    throw createError({ statusCode: 400, statusMessage: 'playerName and purchaseId are required' })
  }

  const name = (body.name ?? 'Looster').trim() || 'Looster'
  const type = (body.type ?? 'looster').trim() || 'looster'
  const set = (body.set ?? '').trim()
  const setName = (body.set_name ?? '').trim()
  // Looster cards are optional user-entered notes. Do not block saving when
  // Scryfall cannot find a card in the selected set.
  const cards = normalizeCardNames(parseCardListInput(body.cards))
  const cardPrintings = normalizeCardPrintings(body.cardPrintings, cards)
  const date = parsePurchaseDate(body.date)
  const priceEuro = normalizeEuroPrice(body.priceEuro)

  await connectToDatabase()

  const updateResult = await Player.updateOne(
    {
      name: playerName,
      'purchases._id': purchaseId,
    },
    {
      $set: {
        'purchases.$.name': name,
        'purchases.$.type': type,
        'purchases.$.set': set,
        'purchases.$.set_name': setName,
        'purchases.$.cards': cards,
        'purchases.$.cardPrintings': cardPrintings,
        'purchases.$.date': date,
        'purchases.$.priceEuro': priceEuro,
      },
    },
  )

  if (updateResult.matchedCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Purchase not found' })
  }

  await addCardsToPlayerCardpool(playerName, cards)

  const player = await Player.findOne({ name: playerName }).lean()
  return {
    ok: true,
    playerName,
    purchases: flattenPlayerPurchases(playerName, player?.purchases ?? []),
  }
})
