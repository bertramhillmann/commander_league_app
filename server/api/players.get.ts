import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { ensurePlayerExists } from '../utils/playerData'
import { parsePlayerLogins } from '~/server/utils/playerAuth'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const loginPlayers = Object.values(parsePlayerLogins(config.playerLogins))
    .map((entry) => entry.username)

  await connectToDatabase()
  await Promise.all(loginPlayers.map((playerName) => ensurePlayerExists(playerName)))

  const players = await Player.find({})
    .sort({ name: 1 })
    .select('name')
    .lean()

  return players.map((player) => player.name)
})
