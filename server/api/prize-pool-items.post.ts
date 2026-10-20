import { Player } from '../models/Player'
import { PrizePoolItem } from '../models/PrizePoolItem'
import { connectToDatabase } from '../utils/mongoose'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'
import { buildPlayerLookup } from '../utils/playerData'
import { serializePrizePoolItem } from '../utils/prizePoolItems'
import { formatPlayerName } from '~/utils/playerNames'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can add prize-pool items' })
  }

  const body = await readBody<{ playerName?: string, description?: string, priceEuro?: number, date?: string }>(event)
  const playerName = formatPlayerName(body.playerName ?? '')
  const description = String(body.description ?? '').trim()
  const priceEuro = Math.round(Number(body.priceEuro) * 100) / 100
  const dateText = String(body.date ?? '')
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? new Date(`${dateText}T00:00:00.000Z`) : null

  if (!playerName || !description || !Number.isFinite(priceEuro) || priceEuro <= 0 || !date || Number.isNaN(date.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Player, date, description, and a positive price are required.' })
  }

  await connectToDatabase()
  const player = await Player.findOne(buildPlayerLookup(playerName).query).select('_id').lean()
  if (!player) {
    throw createError({ statusCode: 400, statusMessage: 'The selected player does not exist.' })
  }

  const item = await PrizePoolItem.create({ playerName, description, priceEuro, date })
  return { ok: true, item: serializePrizePoolItem(item) }
})
