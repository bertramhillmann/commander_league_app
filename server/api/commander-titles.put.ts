import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { buildPlayerLookup, ensurePlayerExists } from '../utils/playerData'
import { getPlayerSession } from '../utils/playerAuth'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'
import { TITLES, type CommanderTitleId } from '~/utils/titles'

type CommanderTitleBody = {
  playerName?: string
  commanderName?: string
  selectedTitle?: CommanderTitleId
}

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readBody<CommanderTitleBody>(event)
  const playerName = (body.playerName ?? '').trim()
  const commanderName = (body.commanderName ?? '').trim()
  const selectedTitle = body.selectedTitle
  const playerNameKey = normalizeDeckIdentityKey(playerName)
  const commanderNameKey = normalizeDeckIdentityKey(commanderName)

  if (!playerName || !commanderName || !selectedTitle) {
    throw createError({ statusCode: 400, statusMessage: 'playerName, commanderName, and selectedTitle are required' })
  }

  if (!(selectedTitle in TITLES)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown commander title' })
  }

  if (normalizeDeckIdentityKey(session.user) !== playerNameKey) {
    throw createError({ statusCode: 403, statusMessage: 'You can only edit your own commander titles' })
  }

  await connectToDatabase()
  const ensuredPlayer = await ensurePlayerExists(playerName)
  const { query: playerLookup } = buildPlayerLookup(playerName)
  const existingPlayer = await Player.findOne(playerLookup).lean()
  const existingEntry = (existingPlayer?.commanderDecks ?? []).find((entry) =>
    entry.commanderNameKey === commanderNameKey || entry.commanderName === commanderName,
  )

  await Player.updateOne(
    playerLookup,
    {
      $pull: {
        commanderDecks: {
          $or: [
            { commanderNameKey },
            { commanderName },
          ],
        },
      },
    },
  )

  await Player.updateOne(
    playerLookup,
    {
      $set: {
        name: ensuredPlayer.name,
        nameKey: ensuredPlayer.nameKey,
      },
      $push: {
        commanderDecks: {
          commanderName: existingEntry?.commanderName ?? commanderName,
          commanderNameKey,
          archidektUrl: existingEntry?.archidektUrl ?? '',
          archidektDeckId: existingEntry?.archidektDeckId ?? '',
          selectedTitle,
        },
      },
    },
  )

  return {
    ok: true,
    selection: {
      playerName: ensuredPlayer.name,
      playerNameKey: ensuredPlayer.nameKey,
      commanderName: existingEntry?.commanderName ?? commanderName,
      commanderNameKey,
      selectedTitle,
    },
  }
})
