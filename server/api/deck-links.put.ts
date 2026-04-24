import { connectToDatabase } from '../utils/mongoose'
import { Player } from '../models/Player'
import { fetchArchidektDeck } from '../utils/archidekt'
import { addCardsToPlayerCardpool, buildPlayerLookup, ensurePlayerExists } from '../utils/playerData'
import { getPlayerSession } from '../utils/playerAuth'
import { extractArchidektDeckId } from '~/utils/archidekt'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'

type DeckLinkBody = {
  playerName?: string
  commanderName?: string
  archidektUrl?: string
}

export default defineEventHandler(async (event) => {
  const session = getPlayerSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readBody<DeckLinkBody>(event)
  const playerName = (body.playerName ?? '').trim()
  const commanderName = (body.commanderName ?? '').trim()
  const archidektUrl = (body.archidektUrl ?? '').trim()
  const playerNameKey = normalizeDeckIdentityKey(playerName)
  const commanderNameKey = normalizeDeckIdentityKey(commanderName)

  if (!playerName || !commanderName) {
    throw createError({ statusCode: 400, statusMessage: 'playerName and commanderName are required' })
  }

  if (normalizeDeckIdentityKey(session.user) !== playerNameKey) {
    throw createError({ statusCode: 403, statusMessage: 'You can only edit your own commander decks' })
  }

  await connectToDatabase()
  const ensuredPlayer = await ensurePlayerExists(playerName)
  const { query: playerLookup } = buildPlayerLookup(playerName)
  const existingPlayer = await Player.findOne(playerLookup).lean()
  const existingEntry = (existingPlayer?.commanderDecks ?? []).find((entry) =>
    entry.commanderNameKey === commanderNameKey || entry.commanderName === commanderName,
  )

  if (!archidektUrl) {
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

    if (existingEntry?.selectedTitle) {
      await Player.updateOne(
        playerLookup,
        {
          $push: {
            commanderDecks: {
              commanderName: existingEntry.commanderName,
              commanderNameKey,
              archidektUrl: '',
              archidektDeckId: '',
              selectedTitle: existingEntry.selectedTitle,
            },
          },
        },
      )
    }

    return { ok: true, deleted: true }
  }

  const archidektDeckId = extractArchidektDeckId(archidektUrl)
  if (!archidektDeckId) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter a valid Archidekt deck URL' })
  }

  const normalizedUrl = `https://archidekt.com/decks/${archidektDeckId}`
  const deck = await fetchArchidektDeck(archidektDeckId).catch((error: any) => {
    throw createError({
      statusCode: error?.response?.status ?? 502,
      statusMessage: 'Failed to load deck from Archidekt',
    })
  })

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
          commanderName,
          commanderNameKey,
          archidektUrl: normalizedUrl,
          archidektDeckId,
          selectedTitle: existingEntry?.selectedTitle ?? '',
        },
      },
    },
  )

  await addCardsToPlayerCardpool(playerName, deck.cards.map((card) => card.name))

  const player = await Player.findOne(playerLookup).lean()
  const link = (player?.commanderDecks ?? []).find((entry) =>
    entry.commanderNameKey === commanderNameKey || entry.commanderName === commanderName,
  )

  return {
    ok: true,
    link: link
      ? {
          playerName: player?.name ?? ensuredPlayer.name,
          playerNameKey: player?.nameKey ?? ensuredPlayer.nameKey,
          commanderName: link.commanderName,
          commanderNameKey: link.commanderNameKey,
          archidektUrl: link.archidektUrl,
          archidektDeckId: link.archidektDeckId,
          selectedTitle: link.selectedTitle || undefined,
          updatedAt: link.updatedAt,
        }
      : null,
  }
})
