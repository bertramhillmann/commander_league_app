import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { buildPlayerLookup } from '../utils/playerData'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  const config = useRuntimeConfig()
  const body = await readBody<{ playerName?: string; commanderName?: string; retired?: boolean }>(event)
  const playerName = (body.playerName ?? '').trim()
  const commanderName = (body.commanderName ?? '').trim()

  if (!session || !playerName || !commanderName) {
    throw createError({ statusCode: 400, statusMessage: 'playerName and commanderName are required' })
  }
  if (normalizeDeckIdentityKey(session.user) !== normalizeDeckIdentityKey(playerName) && !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'You can only retire your own commanders' })
  }

  await connectToDatabase()
  const { query } = buildPlayerLookup(playerName)
  const key = normalizeDeckIdentityKey(commanderName)
  const player = await Player.findOne(query)
  if (!player) throw createError({ statusCode: 404, statusMessage: 'Player not found' })

  const entry = (player.commanderDecks ?? []).find((deck) => deck.commanderNameKey === key || deck.commanderName === commanderName)
  if (!entry) {
    player.commanderDecks.push({ commanderName, commanderNameKey: key, retired: Boolean(body.retired) })
  } else {
    entry.retired = Boolean(body.retired)
  }
  await player.save()
  return { ok: true, retired: Boolean(body.retired) }
})
