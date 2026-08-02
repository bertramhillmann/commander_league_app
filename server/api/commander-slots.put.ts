import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { buildPlayerLookup, ensurePlayerExists } from '../utils/playerData'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'
import { fetchCardsByName } from '~/services/scryfallService'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'

type CommanderSlotBody = {
  playerName?: string
  commanderName?: string
  slotIndex?: number
  cardNames?: string
}

function normalizeSlotNames(input: string) {
  return input
    .split(',')
    .map((name) => name.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 2)
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readBody<CommanderSlotBody>(event)
  const playerName = (body.playerName ?? '').trim()
  const commanderName = (body.commanderName ?? '').trim()
  const slotIndex = Number(body.slotIndex ?? -1)
  const cardNames = typeof body.cardNames === 'string' ? body.cardNames.trim() : ''
  const playerNameKey = normalizeDeckIdentityKey(playerName)
  const commanderNameKey = normalizeDeckIdentityKey(commanderName)

  if (!playerName || !commanderName) {
    throw createError({ statusCode: 400, statusMessage: 'playerName and commanderName are required' })
  }

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    throw createError({ statusCode: 400, statusMessage: 'slotIndex must be 0, 1, or 2' })
  }

  const isOwner = normalizeDeckIdentityKey(session.user) === playerNameKey
  const isAdmin = isAdminUser(config.admins, session.user)
  if (!isOwner && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'You can only edit your own commander slots' })
  }

  const normalizedNames = normalizeSlotNames(cardNames)
  if (cardNames && normalizedNames.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter at least one card name' })
  }

  if (normalizedNames.length > 0) {
    const lookup = await fetchCardsByName(normalizedNames)
    const missingNames = normalizedNames.filter((name) => !lookup.get(name))
    if (missingNames.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Could not find: ${missingNames.join(', ')}.`,
      })
    }
  }

  await connectToDatabase()
  const ensuredPlayer = await ensurePlayerExists(playerName)
  const { query: playerLookup } = buildPlayerLookup(playerName)
  const player = await Player.findOne(playerLookup)
  if (!player) {
    throw createError({ statusCode: 500, statusMessage: 'Could not load player record' })
  }

  const existingEntry = (player.commanderDecks ?? []).find((entry) =>
    entry.commanderNameKey === commanderNameKey || entry.commanderName === commanderName,
  )

  const nextSlots = Array.isArray(existingEntry?.gameChangerSlots)
    ? [...existingEntry!.gameChangerSlots]
    : []

  nextSlots[slotIndex] = normalizedNames.join(', ')

  while (nextSlots.length > 0 && !nextSlots[nextSlots.length - 1]?.trim()) {
    nextSlots.pop()
  }

  player.name = ensuredPlayer.name
  player.nameKey = ensuredPlayer.nameKey
  player.commanderDecks = (player.commanderDecks ?? []).filter((entry) => (
    entry.commanderNameKey !== commanderNameKey && entry.commanderName !== commanderName
  ))
  player.commanderDecks.push({
    commanderName: existingEntry?.commanderName ?? commanderName,
    commanderNameKey,
    archidektUrl: existingEntry?.archidektUrl ?? '',
    archidektDeckId: existingEntry?.archidektDeckId ?? '',
    selectedTitle: existingEntry?.selectedTitle ?? '',
    gameChangerSlots: nextSlots,
  })
  await player.save()

  const entry = (player.commanderDecks ?? []).find((item) =>
    item.commanderNameKey === commanderNameKey || item.commanderName === commanderName,
  )

  return {
    ok: true,
    entry: entry
      ? {
          playerName: player?.name ?? ensuredPlayer.name,
          playerNameKey: player?.nameKey ?? ensuredPlayer.nameKey,
          commanderName: entry.commanderName,
          commanderNameKey: entry.commanderNameKey,
          archidektUrl: entry.archidektUrl ?? '',
          archidektDeckId: entry.archidektDeckId ?? '',
          selectedTitle: entry.selectedTitle || undefined,
          gameChangerSlots: Array.isArray(entry.gameChangerSlots) ? entry.gameChangerSlots : [],
          updatedAt: entry.updatedAt,
        }
      : null,
  }
})
