import { Game } from '../../models/Game'
import { Player } from '../../models/Player'
import { connectToDatabase } from '../../utils/mongoose'
import { getPlayerSession, isAdminUser } from '../../utils/playerAuth'
import { formatPlayerName } from '~/utils/playerNames'

type RandomGamePlayer = {
  name: string
  commander: string
  placement: number
  points: null
  eliminations: null
  commanderCasts: null
  decklist: null
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (String(config.environment ?? '').toLowerCase() !== 'test') {
    throw createError({ statusCode: 403, statusMessage: 'Only available in test environment' })
  }

  await connectToDatabase()

  const playerDocs = await Player.find({})
    .select('name commanderDecks')
    .lean()
  const games = await Game.find({})
    .select('gameId date players')
    .lean()

  const commandersByPlayer = new Map<string, string[]>()

  for (const player of playerDocs) {
    const playerName = formatPlayerName(player.name)
    const existing = commandersByPlayer.get(playerName) ?? []

    for (const deck of player.commanderDecks ?? []) {
      const commanderName = deck.commanderName?.trim()
      if (commanderName && !existing.includes(commanderName)) existing.push(commanderName)
    }

    if (existing.length > 0) commandersByPlayer.set(playerName, existing)
  }

  for (const game of games) {
    for (const player of game.players ?? []) {
      const playerName = formatPlayerName(player.name)
      const existing = commandersByPlayer.get(playerName) ?? []
      if (!existing.includes(player.commander)) existing.push(player.commander)
      commandersByPlayer.set(playerName, existing)
    }
  }

  const availablePlayers = Array.from(commandersByPlayer.entries())
    .filter(([, commanders]) => commanders.length > 0)
    .map(([playerName]) => playerName)

  if (availablePlayers.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Need at least 3 players with known commanders to generate a random game' })
  }

  const maxPlayerCount = Math.min(5, availablePlayers.length)
  const playerCount = randomIntInclusive(3, maxPlayerCount)
  const selectedPlayers = shuffle(availablePlayers).slice(0, playerCount)
  const placements = shuffle(Array.from({ length: playerCount }, (_, index) => index + 1))

  const players: RandomGamePlayer[] = selectedPlayers.map((name, index) => {
    const commanders = commandersByPlayer.get(name) ?? []
    return {
      name,
      commander: commanders[randomIntInclusive(0, commanders.length - 1)],
      placement: placements[index],
      points: null,
      eliminations: null,
      commanderCasts: null,
      decklist: null,
    }
  })

  const last = await Game.findOne({ gameId: /^G\d+$/ })
    .sort({ gameId: -1 })
    .select('gameId')
    .lean()

  let nextNum = 1
  if (last?.gameId) {
    const parsed = Number.parseInt(last.gameId.slice(1), 10)
    if (Number.isFinite(parsed)) nextNum = parsed + 1
  }

  const gameId = `G${String(nextNum).padStart(4, '0')}`
  const date = buildRandomRecentDate()

  const created = await Game.create({
    gameId,
    date,
    players,
  })

  return {
    ok: true,
    gameId: created.gameId,
    date: created.date,
    playerCount,
  }
})

function randomIntInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const target = randomIntInclusive(0, index)
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

function buildRandomRecentDate() {
  const now = new Date()
  const daysAgo = randomIntInclusive(0, 180)
  const result = new Date(now)
  result.setDate(result.getDate() - daysAgo)
  result.setHours(12, 0, 0, 0)
  return result
}
