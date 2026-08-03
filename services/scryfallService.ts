const BASE_URL = 'https://api.scryfall.com'
const COLLECTION_CHUNK_SIZE = 75
const CARD_STORAGE_KEY = 'scryfall-card-cache:v2'
const SET_STORAGE_KEY = 'scryfall-set-cache:v1'

// Scryfall asks for 50-100 ms of delay between requests sent in a single-threaded
// manner (~10 req/s). All outbound requests share one queue so bursts from unrelated
// callers (shop, dashboard, sidebar, deck views, ...) never stack up concurrently.
const MIN_REQUEST_INTERVAL_MS = 110
const MAX_RATE_LIMIT_RETRIES = 4

// Scryfall rejects requests carrying a generic HTTP-library User-Agent (e.g. Node's
// default) with a 400 "generic_user_agent" error. Server-side requests need an explicit
// override; browsers ignore this header (forbidden to override) and send their own, which
// Scryfall already accepts.
const SCRYFALL_HEADERS = {
  'User-Agent': 'CmdApp/1.0 (+https://github.com/)',
  Accept: 'application/json',
}

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

interface ScryfallSearchResponse {
  data: ScryfallCard[]
  has_more?: boolean
  next_page?: string
}

interface FetchCardsByNameOptions {
  onProgress?: (loaded: number, total: number) => void
  setCode?: string
}

export interface ScryfallCardIdentifier {
  name: string
  setCode?: string
}

export interface ScryfallSet {
  code: string
  name: string
  scryfall_uri: string
  search_uri?: string
  icon_svg_uri?: string
}

// Module-level cache persists for the lifetime of the page.
const cache = new Map<string, ScryfallCard | null>()
const setCache = new Map<string, ScryfallSet | null>()
const pendingCardRequests = new Map<string, Promise<ScryfallCard | null>>()
const pendingSetRequests = new Map<string, Promise<ScryfallSet | null>>()
let browserCacheHydrated = false

function normalizeCardName(name: string) {
  return name.trim().toLowerCase()
}

function normalizeSetCode(code: string) {
  return code.trim().toLowerCase()
}

function getCardCacheKey(name: string, setCode?: string) {
  const normalizedName = normalizeCardName(name)
  const normalizedSetCode = normalizeSetCode(setCode ?? '')
  return normalizedSetCode ? `${normalizedSetCode}::${normalizedName}` : normalizedName
}

function escapeScryfallQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function loadBrowserCache() {
  if (browserCacheHydrated || !import.meta.client) return

  browserCacheHydrated = true

  try {
    const storedCards = localStorage.getItem(CARD_STORAGE_KEY)
    if (storedCards) {
      const parsedCards = JSON.parse(storedCards) as Record<string, ScryfallCard | null>
      for (const [name, card] of Object.entries(parsedCards)) {
        if (card) cache.set(name, card)
      }
    }
  } catch {
    localStorage.removeItem(CARD_STORAGE_KEY)
  }

  try {
    const storedSets = localStorage.getItem(SET_STORAGE_KEY)
    if (storedSets) {
      const parsedSets = JSON.parse(storedSets) as Record<string, ScryfallSet | null>
      for (const [code, set] of Object.entries(parsedSets)) {
        setCache.set(code, set)
      }
    }
  } catch {
    localStorage.removeItem(SET_STORAGE_KEY)
  }
}

function persistBrowserCardCache() {
  if (!import.meta.client) return

  try {
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(Object.fromEntries(cache.entries())))
  } catch {
    // Ignore storage quota issues and continue with the in-memory cache.
  }
}

function persistBrowserSetCache() {
  if (!import.meta.client) return

  try {
    localStorage.setItem(SET_STORAGE_KEY, JSON.stringify(Object.fromEntries(setCache.entries())))
  } catch {
    // Ignore storage quota issues and continue with the in-memory cache.
  }
}

function setCardCache(cacheKey: string, card: ScryfallCard | null, persist = true) {
  loadBrowserCache()
  if (card === null) {
    cache.delete(cacheKey)
    if (persist) persistBrowserCardCache()
    return
  }
  cache.set(cacheKey, card)
  if (persist) persistBrowserCardCache()
}

function getCachedCard(name: string) {
  loadBrowserCache()
  return cache.get(getCardCacheKey(name))
}

function getCachedCardBySet(name: string, setCode?: string) {
  loadBrowserCache()
  return cache.get(getCardCacheKey(name, setCode))
}

function setSetCacheEntry(code: string, set: ScryfallSet | null, persist = true) {
  loadBrowserCache()
  setCache.set(normalizeSetCode(code), set)
  if (persist) persistBrowserSetCache()
}

function getCachedSet(code: string) {
  loadBrowserCache()
  return setCache.get(normalizeSetCode(code))
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Serializes every outbound Scryfall request behind a single tail promise so
// concurrent callers (e.g. several components preloading images at once) still
// only ever send one request per MIN_REQUEST_INTERVAL_MS, app-wide.
let requestQueueTail: Promise<void> = Promise.resolve()
let lastRequestStartedAt = 0

function scheduleSlot(): Promise<void> {
  const slot = requestQueueTail.then(async () => {
    const wait = Math.max(0, lastRequestStartedAt + MIN_REQUEST_INTERVAL_MS - Date.now())
    if (wait > 0) await sleep(wait)
    lastRequestStartedAt = Date.now()
  })
  // Keep the chain alive even if this slot's request later throws.
  requestQueueTail = slot.catch(() => {})
  return slot
}

function getRateLimitStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status
}

function getRetryAfterMs(error: unknown): number | null {
  const headers = (error as { response?: { headers?: Headers } } | undefined)?.response?.headers
  const retryAfterHeader = headers?.get?.('retry-after')
  if (!retryAfterHeader) return null
  const seconds = Number(retryAfterHeader)
  return Number.isFinite(seconds) ? seconds * 1000 : null
}

/**
 * Runs a Scryfall request through the shared throttle queue, retrying with
 * backoff (honoring Retry-After when present) if Scryfall responds with 429.
 */
async function scryfallFetch<T>(request: () => Promise<T>, attempt = 0): Promise<T> {
  await scheduleSlot()

  try {
    return await request()
  } catch (error) {
    if (attempt < MAX_RATE_LIMIT_RETRIES && getRateLimitStatus(error) === 429) {
      const backoffMs = getRetryAfterMs(error) ?? MIN_REQUEST_INTERVAL_MS * 2 ** (attempt + 2)
      await sleep(backoffMs)
      return scryfallFetch(request, attempt + 1)
    }
    throw error
  }
}

async function requestCardByName(name: string, setCode?: string) {
  if (setCode) {
    const normalizedSetCode = normalizeSetCode(setCode)

    try {
      const response = await scryfallFetch(() => $fetch<ScryfallCollectionResponse>(`${BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: SCRYFALL_HEADERS,
        body: {
          identifiers: [{ name, set: normalizedSetCode }],
        },
      }))

      const match = response.data.find((card) => (
        normalizeCardName(card.name) === normalizeCardName(name)
        && normalizeSetCode(card.set) === normalizedSetCode
      )) ?? null

      if (match) return match
    } catch {
      // Fall back to a set-scoped search below.
    }

    try {
      const response = await scryfallFetch(() => $fetch<ScryfallSearchResponse>(`${BASE_URL}/cards/search`, {
        headers: SCRYFALL_HEADERS,
        params: {
          q: `!"${escapeScryfallQueryValue(name)}" set:${normalizedSetCode}`,
        },
      }))

      const match = response.data.find((card) => (
        normalizeCardName(card.name) === normalizeCardName(name)
        && normalizeSetCode(card.set) === normalizedSetCode
      )) ?? null

      return match
    } catch {
      return null
    }
  }

  try {
    return await scryfallFetch(() => $fetch<ScryfallCard>(`${BASE_URL}/cards/named`, {
      headers: SCRYFALL_HEADERS,
      params: { fuzzy: name },
    }))
  } catch {
    return null
  }
}

/**
 * Fetch a card by exact or fuzzy name match.
 * Returns null when the card is not found.
 */
export async function fetchCardByName(name: string, setCode?: string): Promise<ScryfallCard | null> {
  const cacheKey = getCardCacheKey(name, setCode)
  const cachedCard = getCachedCardBySet(name, setCode)
  if (cachedCard !== undefined) return cachedCard

  const existingRequest = pendingCardRequests.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = requestCardByName(name, setCode)
    .then((data) => {
      setCardCache(cacheKey, data)
      return data
    })
    .finally(() => {
      pendingCardRequests.delete(cacheKey)
    })

  pendingCardRequests.set(cacheKey, request)
  return request
}

export async function fetchCardsByIdentifiers(
  identifiers: ScryfallCardIdentifier[],
  options: Pick<FetchCardsByNameOptions, 'onProgress'> = {},
): Promise<Map<string, ScryfallCard | null>> {
  const uniqueIdentifiers = [...new Map(
    identifiers
      .map((identifier) => ({
        name: identifier.name.trim(),
        setCode: normalizeSetCode(identifier.setCode ?? ''),
      }))
      .filter((identifier) => identifier.name)
      .map((identifier) => [getCardCacheKey(identifier.name, identifier.setCode), identifier] as const),
  ).values()]
  const results = new Map<string, ScryfallCard | null>()
  let loaded = 0

  const reportProgress = () => {
    options.onProgress?.(loaded, uniqueIdentifiers.length)
  }

  if (uniqueIdentifiers.length === 0) return results

  loadBrowserCache()

  const uncachedIdentifiers = uniqueIdentifiers.filter((identifier) => {
    const cachedCard = getCachedCardBySet(identifier.name, identifier.setCode)

    if (cachedCard !== undefined) {
      results.set(getCardCacheKey(identifier.name, identifier.setCode), cachedCard)
      loaded += 1
      return false
    }

    return true
  })

  reportProgress()

  for (const identifiersChunk of chunk(uncachedIdentifiers, COLLECTION_CHUNK_SIZE)) {
    try {
      const response = await scryfallFetch(() => $fetch<ScryfallCollectionResponse>(`${BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: SCRYFALL_HEADERS,
        body: {
          identifiers: identifiersChunk.map((identifier) => (
            identifier.setCode
              ? { name: identifier.name, set: identifier.setCode }
              : { name: identifier.name }
          )),
        },
      }))

      for (const identifier of identifiersChunk) {
        const match = response.data.find((card) => (
          normalizeCardName(card.name) === normalizeCardName(identifier.name)
          && (!identifier.setCode || normalizeSetCode(card.set) === identifier.setCode)
        )) ?? null
        const cacheKey = getCardCacheKey(identifier.name, identifier.setCode)

        if (match) {
          setCardCache(cacheKey, match, false)
          results.set(cacheKey, match)
          loaded += 1
          continue
        }

        if (pendingCardRequests.has(cacheKey)) {
          const card = await pendingCardRequests.get(cacheKey)!
          results.set(cacheKey, card)
          loaded += 1
          continue
        }

        const card = await fetchCardByName(identifier.name, identifier.setCode)
        results.set(cacheKey, card)
        loaded += 1
      }

      persistBrowserCardCache()
      reportProgress()
    } catch {
      const chunkResults = await Promise.all(identifiersChunk.map(async (identifier) => {
        const card = await fetchCardByName(identifier.name, identifier.setCode)
        loaded += 1
        reportProgress()
        return [getCardCacheKey(identifier.name, identifier.setCode), card] as const
      }))

      for (const [cacheKey, card] of chunkResults) {
        results.set(cacheKey, card)
      }
    }
  }

  for (const identifier of uniqueIdentifiers) {
    const cacheKey = getCardCacheKey(identifier.name, identifier.setCode)
    if (results.has(cacheKey)) continue
    results.set(cacheKey, getCachedCardBySet(identifier.name, identifier.setCode) ?? null)
  }

  return results
}

/**
 * Fetch many cards at once through Scryfall's collection endpoint.
 * Falls back to fuzzy single-card lookups for any unresolved chunk.
 */
export async function fetchCardsByName(
  names: string[],
  options: FetchCardsByNameOptions = {},
): Promise<Map<string, ScryfallCard | null>> {
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
  const identifierResults = await fetchCardsByIdentifiers(
    uniqueNames.map((name) => ({ name, setCode: options.setCode })),
    { onProgress: options.onProgress },
  )
  const results = new Map<string, ScryfallCard | null>()

  for (const name of uniqueNames) {
    results.set(name, identifierResults.get(getCardCacheKey(name, options.setCode)) ?? null)
  }

  return results
}

const printingCache = new Map<string, Promise<ScryfallCard[]>>()

/**
 * Fetch every available printing of one card. This is intentionally only used
 * after the user asks to choose a printing; normal card entry remains batched
 * through the collection endpoint above.
 */
export async function fetchCardPrintingsByName(name: string): Promise<ScryfallCard[]> {
  const normalizedName = normalizeCardName(name)
  if (!normalizedName) return []

  const existing = printingCache.get(normalizedName)
  if (existing) return existing

  const request = (async () => {
    const printings: ScryfallCard[] = []
    let pageUrl: string | null = `${BASE_URL}/cards/search`
    let params: Record<string, string> | undefined = {
      q: `!\"${escapeScryfallQueryValue(name)}\" unique:prints`,
      order: 'released',
      dir: 'desc',
    }

    while (pageUrl) {
      const response = await scryfallFetch(() => $fetch<ScryfallSearchResponse>(pageUrl!, {
        headers: SCRYFALL_HEADERS,
        params,
      }))
      printings.push(...response.data)
      pageUrl = response.has_more && response.next_page ? response.next_page : null
      params = undefined
    }

    return printings
  })().catch(() => [])

  printingCache.set(normalizedName, request)
  return request
}

/**
 * Fetch a Scryfall set by code.
 * Returns null when the set is not found.
 */
export async function fetchSetByCode(code: string): Promise<ScryfallSet | null> {
  const normalizedCode = normalizeSetCode(code)

  if (!normalizedCode) return null
  const cachedSet = getCachedSet(code)
  if (cachedSet !== undefined) return cachedSet

  const existingRequest = pendingSetRequests.get(normalizedCode)
  if (existingRequest) return existingRequest

  const request = scryfallFetch(() => $fetch<ScryfallSet>(`${BASE_URL}/sets/${normalizedCode}`, { headers: SCRYFALL_HEADERS }))
    .then((data) => {
      setSetCacheEntry(normalizedCode, data)
      return data
    })
    .catch(() => {
      setSetCacheEntry(normalizedCode, null)
      return null
    })
    .finally(() => {
      pendingSetRequests.delete(normalizedCode)
    })

  pendingSetRequests.set(normalizedCode, request)
  return request
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
