export type ArchidektNormalizedCard = {
  name: string
  quantity: number
  categories: string[]
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function extractCardName(entry: any) {
  return (
    entry?.card?.oracleCard?.name
    ?? entry?.card?.name
    ?? entry?.oracleCard?.name
    ?? entry?.printing?.oracleCard?.name
    ?? entry?.name
    ?? ''
  ).trim()
}

function extractQuantity(entry: any) {
  const raw = entry?.quantity ?? entry?.qty ?? entry?.count ?? entry?.copies ?? 1
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

function extractCategoryNames(entry: any) {
  const directCategories = asArray(entry?.categories)
    .map((category) => {
      if (typeof category === 'string') return category
      return category?.name ?? category?.label ?? ''
    })
    .map((value) => value.trim())
    .filter(Boolean)

  if (directCategories.length > 0) return directCategories

  const categoryMap = entry?.categoryMap
  if (categoryMap && typeof categoryMap === 'object') {
    return Object.values(categoryMap)
      .map((category: any) => category?.name ?? category?.label ?? '')
      .map((value) => String(value).trim())
      .filter(Boolean)
  }

  return []
}

function isInDeck(entry: any) {
  if (typeof entry?.inDeck === 'boolean') return entry.inDeck
  if (typeof entry?.isIncluded === 'boolean') return entry.isIncluded
  if (typeof entry?.includedInDeck === 'boolean') return entry.includedInDeck
  return true
}

export function normalizeArchidektCards(deck: any): ArchidektNormalizedCard[] {
  const rawCards = Array.isArray(deck?.cards)
    ? deck.cards
    : Array.isArray(deck?.cardMap)
      ? deck.cardMap
      : Object.values(deck?.cardMap ?? {})

  return rawCards
    .filter((entry: any) => isInDeck(entry))
    .map((entry: any) => ({
      name: extractCardName(entry),
      quantity: extractQuantity(entry),
      categories: extractCategoryNames(entry),
    }))
    .filter((entry: ArchidektNormalizedCard) => entry.name)
}

export async function fetchArchidektDeck(deckId: string) {
  const deck = await $fetch<any>(`https://archidekt.com/api/decks/${deckId}/`)

  return {
    deckId,
    name: deck?.name ?? `Archidekt Deck ${deckId}`,
    owner: (
      (typeof deck?.owner === 'string' ? deck.owner : '')
      || deck?.owner?.username
      || deck?.owner?.name
      || deck?.ownerName
      || deck?.owner_name
      || ''
    ),
    url: `https://archidekt.com/decks/${deckId}`,
    cards: normalizeArchidektCards(deck),
  }
}
