import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'
import { Player } from '../models/Player'
import { fetchArchidektDeck } from '../utils/archidekt'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'
import { formatPlayerName } from '~/utils/playerNames'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody(event)

  const { date, players } = body as {
    date: string
    players: { name: string; commander: string; placement: number; eliminations: number | null; commanderCasts: number | null }[]
  }

  if (!date || !Array.isArray(players) || players.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid game data' })
  }

  await connectToDatabase()

  const normalizedPlayers = players.map((player) => ({
    ...player,
    name: formatPlayerName(player.name),
    commander: player.commander.trim(),
  }))

  const uniquePlayerNames = [...new Set(normalizedPlayers.map((player) => player.name))]
  const playerDocs = await Player.find({ name: { $in: uniquePlayerNames } })
    .select('name commanderDecks')
    .lean()

  const playerDeckMap = new Map(
    playerDocs.map((player) => [player.name, player.commanderDecks ?? []]),
  )

  const fetchedDeckCache = new Map<string, Awaited<ReturnType<typeof fetchArchidektDeck>> | null>()

  const playersWithDecklists = await Promise.all(
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
        eliminations: player.eliminations ?? null,
        commanderCasts: player.commanderCasts ?? null,
        decklist,
      }
    }),
  )

  // Derive next gameId by finding the highest existing numeric suffix
  const last = await Game.findOne({ gameId: /^G\d+$/ })
    .sort({ gameId: -1 })
    .select('gameId')
    .lean()

  let nextNum = 1
  if (last?.gameId) {
    const parsed = parseInt(last.gameId.slice(1), 10)
    if (!isNaN(parsed)) nextNum = parsed + 1
  }

  const gameId = `G${String(nextNum).padStart(4, '0')}`
  const game = await Game.create({
    gameId,
    date: new Date(date),
    players: playersWithDecklists,
  })

  return { ok: true, gameId: game.gameId }
})
