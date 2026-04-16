import { Player } from '../models/Player'
import { normalizeDeckIdentityKey } from '~/utils/deckLinks'
import { formatPlayerName } from '~/utils/playerNames'

export function normalizeCardNames(cards: string[]) {
  return [...new Set(
    cards
      .map((card) => card.trim())
      .filter(Boolean)
      .map((card) => formatCardName(card)),
  )]
}

export function formatCardName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function buildPlayerLookup(name: string) {
  const formattedName = formatPlayerName(name)
  const nameKey = normalizeDeckIdentityKey(name)

  return {
    formattedName,
    nameKey,
    query: {
      $or: [
        { name: formattedName },
        { nameKey },
      ],
    },
  }
}

export async function ensurePlayerExists(name: string) {
  const { formattedName, nameKey, query } = buildPlayerLookup(name)
  return await Player.findOneAndUpdate(
    query,
    {
      $setOnInsert: {
        cardpool: [],
        purchases: [],
        commanderDecks: [],
      },
      $set: {
        name: formattedName,
        nameKey,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

export async function addCardsToPlayerCardpool(name: string, cards: string[]) {
  const normalizedCards = normalizeCardNames(cards)
  if (normalizedCards.length === 0) return await ensurePlayerExists(name)
  const { formattedName, nameKey, query } = buildPlayerLookup(name)

  return await Player.findOneAndUpdate(
    query,
    {
      $setOnInsert: {
        purchases: [],
        commanderDecks: [],
      },
      $set: {
        name: formattedName,
        nameKey,
      },
      $addToSet: {
        cardpool: { $each: normalizedCards },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}
