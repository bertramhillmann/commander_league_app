const BASE_URL = 'https://api.scryfall.com'
const COLLECTION_CHUNK_SIZE = 75

export interface ScryfallCard {
  id: string
  name: string
  cmc?: number
  mana_cost?: string
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
  // Double-faced cards store images per face.
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

interface ScryfallCollectionResponse {
  data: ScryfallCard[]
}

// Module-level cache persists for the lifetime of the page.
const cache = new Map<string, ScryfallCard | null>()

function normalizeCardName(name: string) {
  return name.trim().toLowerCase()
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

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
 * Fetch many cards at once through Scryfall's collection endpoint.
 * Falls back to fuzzy single-card lookups for any unresolved chunk.
 */
export async function fetchCardsByName(names: string[]): Promise<Map<string, ScryfallCard | null>> {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const results = new Map<string, ScryfallCard | null>()

  if (uniqueNames.length === 0) return results

  const uncachedNames = uniqueNames.filter((name) => !cache.has(name))

  for (const namesChunk of chunk(uncachedNames, COLLECTION_CHUNK_SIZE)) {
    try {
      const response = await $fetch<ScryfallCollectionResponse>(`${BASE_URL}/cards/collection`, {
        method: 'POST',
        body: {
          identifiers: namesChunk.map((name) => ({ name })),
        },
      })

      const cardsByName = new Map(
        response.data.map((card) => [normalizeCardName(card.name), card] as const),
      )

      for (const requestedName of namesChunk) {
        const match = cardsByName.get(normalizeCardName(requestedName)) ?? null

        if (match) {
          cache.set(requestedName, match)
          continue
        }

        await fetchCardByName(requestedName)
      }
    } catch {
      await Promise.all(namesChunk.map(async (name) => {
        if (!cache.has(name)) {
          await fetchCardByName(name)
        }
      }))
    }
  }

  for (const name of uniqueNames) {
    results.set(name, cache.get(name) ?? null)
  }

  return results
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
