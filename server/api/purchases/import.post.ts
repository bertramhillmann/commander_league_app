import { connectToDatabase } from '../../utils/mongoose'
import { Settings } from '../../models/Settings'
import { Player } from '../../models/Player'
import { addCardsToPlayerCardpool, ensurePlayerExists } from '../../utils/playerData'
import { getPlayerSession, isAdminUser } from '../../utils/playerAuth'
import { normalizeEuroPrice, parsePurchaseDate, validateAndCanonicalizeOptionalCards } from '../../utils/purchases'
import { formatPlayerName } from '~/utils/playerNames'
import { DEFAULT_LOOSTER_COST } from '~/utils/leagueSettings'

type PurchaseImportEntry = {
  player?: string
  name?: string
  type?: string
  date?: string
  set?: string
  set_name?: string
  priceEuro?: number
  cards?: string[] | string
}

type ImportBody = {
  entries?: PurchaseImportEntry[]
}

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  const config = useRuntimeConfig()

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can import purchases' })
  }

  const body = await readBody<ImportBody>(event)
  const entries = Array.isArray(body.entries) ? body.entries : []

  if (entries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one purchase entry is required' })
  }

  await connectToDatabase()

  const settingsDoc = await Settings.findOne({ key: 'league' }).lean()
  const loosterCost = Number.isFinite(Number(settingsDoc?.shop?.loosterCost))
    ? Number(settingsDoc?.shop?.loosterCost)
    : DEFAULT_LOOSTER_COST

  let importedCount = 0

  for (const [index, entry] of entries.entries()) {
    const playerName = formatPlayerName(entry.player ?? '')
    const purchaseName = (entry.name ?? 'Looster').trim() || 'Looster'
    const type = (entry.type ?? 'looster').trim() || 'looster'
    const set = (entry.set ?? '').trim()
    const setName = (entry.set_name ?? '').trim()

    if (!playerName || !set || !setName) {
      throw createError({
        statusCode: 400,
        statusMessage: `Entry ${index + 1} is missing player, set, or set_name`,
      })
    }

    const date = parsePurchaseDate(entry.date)
    const priceEuro = normalizeEuroPrice(entry.priceEuro)
    const cards = await validateAndCanonicalizeOptionalCards(entry.cards)

    await ensurePlayerExists(playerName)
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
            date,
            priceEuro,
          },
        },
      },
    )

    if (cards.length > 0) {
      await addCardsToPlayerCardpool(playerName, cards)
    }

    importedCount += 1
  }

  return {
    ok: true,
    importedCount,
  }
})
