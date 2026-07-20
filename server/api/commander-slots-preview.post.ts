import { fetchCardsByName, getCardImageUrl } from '~/services/scryfallService'

type CommanderSlotPreviewBody = {
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
  const body = await readBody<CommanderSlotPreviewBody>(event)
  const names = normalizeSlotNames(typeof body.cardNames === 'string' ? body.cardNames : '')

  if (names.length === 0) {
    return {
      ok: true,
      names: [],
      missingNames: [],
      cards: [],
    }
  }

  const lookup = await fetchCardsByName(names)
  const missingNames = names.filter((name) => !lookup.get(name))

  return {
    ok: missingNames.length === 0,
    names,
    missingNames,
    cards: names.flatMap((name) => {
      const card = lookup.get(name)
      if (!card) return []

      return [{
        name,
        imageUrl: getCardImageUrl(card, 'small') ?? getCardImageUrl(card, 'normal') ?? '',
        previewUrl: getCardImageUrl(card, 'normal') ?? getCardImageUrl(card, 'large') ?? '',
        scryfallUrl: card.scryfall_uri ?? '',
      }]
    }),
  }
})
