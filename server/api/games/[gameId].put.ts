import { connectToDatabase } from '../../utils/mongoose'
import { Game } from '../../models/Game'
import { Player } from '../../models/Player'
import { fetchArchidektDeck } from '../../utils/archidekt'
import { getPlayerSession, isAdminUser } from '../../utils/playerAuth'
import { formatPlayerName } from '~/utils/playerNames'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'

type GameUpdatePlayerInput = {
  name: string
  commander: string
  placement: number
  eliminations?: number | null
  commanderCasts?: number | null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const gameId = getRouterParam(event, 'gameId')
  if (!gameId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing game id' })
  }

  const body = await readBody<{
    date?: string
    hidden?: boolean
    players?: GameUpdatePlayerInput[]
  }>(event)

  const update: Record<string, unknown> = {}

  if (body.date !== undefined) {
    if (!body.date) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid game date' })
    }
    update.date = new Date(body.date)
  }

  if (body.hidden !== undefined) {
    update.hidden = Boolean(body.hidden)
  }

  if (body.players !== undefined) {
    if (!Array.isArray(body.players) || body.players.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid game data' })
    }

    await connectToDatabase()
    update.players = await enrichPlayersWithDecklists(body.players)
  } else {
    await connectToDatabase()
  }

  if (Object.keys(update).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No changes provided' })
  }

  const updated = await Game.findOneAndUpdate(
    { gameId },
    { $set: update },
    { new: true },
  ).lean()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Game not found' })
  }

  return { ok: true, game: updated }
})

async function enrichPlayersWithDecklists(players: GameUpdatePlayerInput[]) {
  const normalizedPlayers = players.map((player) => ({
    name: formatPlayerName(player.name),
    commander: player.commander.trim(),
    placement: Math.max(1, Math.round(player.placement)),
    eliminations: player.eliminations ?? null,
    commanderCasts: player.commanderCasts ?? null,
  }))

  const uniquePlayerNames = [...new Set(normalizedPlayers.map((player) => player.name))]
  const playerDocs = await Player.find({ name: { $in: uniquePlayerNames } })
    .select('name commanderDecks')
    .lean()

  const playerDeckMap = new Map(
    playerDocs.map((player) => [player.name, player.commanderDecks ?? []]),
  )

  const fetchedDeckCache = new Map<string, Awaited<ReturnType<typeof fetchArchidektDeck>> | null>()

  return Promise.all(
    normalizedPlayers.map(async (player) => {
      const commanderKey = normalizeDeckIdentityKey(player.commander)
      const savedDeck = (playerDeckMap.get(player.name) ?? [])
        .find((deck) =>
          deck.commanderNameKey === commanderKey || normalizeDeckIdentityKey(deck.commanderName) === commanderKey,
        )

      let decklist: Awaited<ReturnType<typeof fetchArchidektDeck>> | null = null

      if (savedDeck?.archidektDeckId) {
        if (fetchedDeckCache.has(savedDeck.archidektDeckId)) {
          decklist = fetchedDeckCache.get(savedDeck.archidektDeckId) ?? null
        } else {
          try {
            decklist = await fetchArchidektDeck(savedDeck.archidektDeckId)
          } catch {
            decklist = null
          }
          fetchedDeckCache.set(savedDeck.archidektDeckId, decklist)
        }
      }

      return {
        name: player.name,
        commander: player.commander,
        placement: player.placement,
        points: null,
        eliminations: player.eliminations,
        commanderCasts: player.commanderCasts,
        decklist,
      }
    }),
  )
}
