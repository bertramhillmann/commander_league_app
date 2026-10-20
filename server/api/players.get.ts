import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { ensurePlayerExists } from '../utils/playerData'
import { parsePlayerLogins } from '~/server/utils/playerAuth'

// Login players only need to be upserted once per server process, not on every
// request (this endpoint is hit on every league load).
let ensuredLoginPlayers: { source: string; done: Promise<unknown> } | null = null

function ensureLoginPlayers(playerLogins: string | undefined) {
  const source = playerLogins ?? ''
  if (ensuredLoginPlayers?.source !== source) {
    const loginPlayers = Object.values(parsePlayerLogins(playerLogins))
      .map((entry) => entry.username)
    const done = Promise.all(loginPlayers.map((playerName) => ensurePlayerExists(playerName)))
    ensuredLoginPlayers = { source, done }
    done.catch(() => {
      if (ensuredLoginPlayers?.done === done) ensuredLoginPlayers = null
    })
  }
  return ensuredLoginPlayers.done
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  await connectToDatabase()
  await ensureLoginPlayers(config.playerLogins)

  const players = await Player.find({})
    .sort({ name: 1 })
    .select('name')
    .lean()

  return players.map((player) => player.name)
})
