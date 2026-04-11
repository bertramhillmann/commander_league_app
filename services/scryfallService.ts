const BASE_URL = 'https://api.scryfall.com'

export interface ScryfallCard {
  id: string
  name: string
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
  // double-faced cards store images per face
  card_faces?: {
    name: string
    image_uris?: ScryfallCard['image_uris']
  }[]
  type_line: string
  oracle_text?: string
  colors?: string[]
  color_identity: string[]
  set: string
  set_name: string
  rarity: string
  scryfall_uri: string
}

// Module-level cache — persists for the lifetime of the page
const cache = new Map<string, ScryfallCard | null>()

/**
 * Fetch a card by exact or fuzzy name match.
 * Returns null when the card is not found.
 */
export async function fetchCardByName(name: string): Promise<ScryfallCard | null> {
  if (cache.has(name)) return cache.get(name)!

  try {
    const data = await $fetch<ScryfallCard>(`${BASE_URL}/cards/named`, {
      params: { fuzzy: name },
    })
    cache.set(name, data)
    return data
  } catch {
    cache.set(name, null)
    return null
  }
}

/**
 * Returns the best available image URI for a card.
 * Falls back to the front face for double-faced cards.
 */
export function getCardImageUrl(card: ScryfallCard, size: keyof NonNullable<ScryfallCard['image_uris']> = 'normal'): string | null {
  if (card.image_uris) return card.image_uris[size]
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size]
  return null
}
