const BASE_URL = 'https://api.scryfall.com'
const COLLECTION_CHUNK_SIZE = 75
const CARD_STORAGE_KEY = 'scryfall-card-cache:v3'
const LEGACY_CARD_STORAGE_KEYS = ['scryfall-card-cache:v2']
const SET_STORAGE_KEY = 'scryfall-set-cache:v2'
const LEGACY_SET_STORAGE_KEYS = ['scryfall-set-cache:v1']

// Persisted caches are written in one batch shortly after the last change instead
// of re-serializing the whole cache after every fetched card.
const PERSIST_DELAY_MS = 1500
// Keeps localStorage well below its ~5 MB quota; the oldest entries are dropped first.
const MAX_PERSISTED_CARDS = 3000
// Cards Scryfall definitively reported as unknown are not asked for again for a while.
const NOT_FOUND_TTL_MS = 12 * 60 * 60 * 1000

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

/** Persisted marker for a card Scryfall reported as not found. */
interface NotFoundEntry {
  notFoundAt: number
}

type CardCacheEntry = ScryfallCard | NotFoundEntry

/** The outcome of a lookup: `definitive` is false for network / rate-limit failures. */
interface CardLookup {
  card: ScryfallCard | null
  definitive: boolean
}

// Module-level cache persists for the lifetime of the page.
const cache = new Map<string, CardCacheEntry>()
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

/**
 * Keeps only the fields this app reads. Full Scryfall objects (prices, legalities,
 * related URIs, ...) are several KB each and quickly filled the localStorage quota,
 * after which nothing new could be cached at all.
 */
function toCachedCard(card: ScryfallCard): ScryfallCard {
  return {
    id: card.id,
    name: card.name,
    cmc: card.cmc,
    mana_cost: card.mana_cost,
    image_uris: card.image_uris,
    card_faces: card.card_faces?.map((face) => ({ name: face.name, image_uris: face.image_uris })),
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    colors: card.colors,
    color_identity: card.color_identity,
    set: card.set,
    set_name: card.set_name,
    rarity: card.rarity,
    scryfall_uri: card.scryfall_uri,
  }
}

function toCachedSet(set: ScryfallSet): ScryfallSet {
  return {
    code: set.code,
    name: set.name,
    scryfall_uri: set.scryfall_uri,
    search_uri: set.search_uri,
    icon_svg_uri: set.icon_svg_uri,
  }
}

function isNotFoundEntry(entry: CardCacheEntry | undefined): entry is NotFoundEntry {
  return Boolean(entry && 'notFoundAt' in entry)
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable (private mode, blocked site data).
  }
}

function loadBrowserCache() {
  if (browserCacheHydrated || !import.meta.client) return

  browserCacheHydrated = true
  let migrated = false

  try {
    const storedCards = readStorage(CARD_STORAGE_KEY)
    if (storedCards) {
      const parsedCards = JSON.parse(storedCards) as Record<string, CardCacheEntry>
      for (const [key, entry] of Object.entries(parsedCards)) {
        if (entry) cache.set(key, entry)
      }
    } else {
      // One-time migration: keep previously cached cards, slimmed down.
      for (const legacyKey of LEGACY_CARD_STORAGE_KEYS) {
        const legacyCards = readStorage(legacyKey)
        if (!legacyCards) continue
        const parsedCards = JSON.parse(legacyCards) as Record<string, ScryfallCard | null>
        for (const [key, card] of Object.entries(parsedCards)) {
          if (card) cache.set(key, toCachedCard(card))
        }
        migrated = true
      }
    }
  } catch {
    cache.clear()
    removeStorage(CARD_STORAGE_KEY)
  }
  for (const legacyKey of LEGACY_CARD_STORAGE_KEYS) removeStorage(legacyKey)

  try {
    const storedSets = readStorage(SET_STORAGE_KEY)
    if (storedSets) {
      const parsedSets = JSON.parse(storedSets) as Record<string, ScryfallSet | null>
      for (const [code, set] of Object.entries(parsedSets)) {
        setCache.set(code, set)
      }
    } else {
      for (const legacyKey of LEGACY_SET_STORAGE_KEYS) {
        const legacySets = readStorage(legacyKey)
        if (!legacySets) continue
        // Legacy entries cached `null` after any failure (including network errors),
        // so only real sets are carried over.
        const parsedSets = JSON.parse(legacySets) as Record<string, ScryfallSet | null>
        for (const [code, set] of Object.entries(parsedSets)) {
          if (set) setCache.set(code, toCachedSet(set))
        }
        migrated = true
      }
    }
  } catch {
    setCache.clear()
    removeStorage(SET_STORAGE_KEY)
  }
  for (const legacyKey of LEGACY_SET_STORAGE_KEYS) removeStorage(legacyKey)

  if (migrated) schedulePersist()
}

let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistListenerRegistered = false

function schedulePersist() {
  if (!import.meta.client) return

  if (!persistListenerRegistered) {
    persistListenerRegistered = true
    // Don't lose a pending batch when the tab is closed or hidden.
    window.addEventListener('pagehide', flushPersist)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPersist()
    })
  }

  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(flushPersist, PERSIST_DELAY_MS)
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persistCardCache()
  persistSetCache()
}

function persistCardCache() {
  const now = Date.now()
  // Map order is insertion order, so the newest entries are kept.
  const entries = [...cache.entries()]
    .filter(([, entry]) => !isNotFoundEntry(entry) || now - entry.notFoundAt < NOT_FOUND_TTL_MS)
    .slice(-MAX_PERSISTED_CARDS)

  try {
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Quota exceeded: keep the newer half and try once more.
    try {
      localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(-Math.floor(entries.length / 2)))))
    } catch {
      // Continue with the in-memory cache only.
    }
  }
}

function persistSetCache() {
  try {
    localStorage.setItem(SET_STORAGE_KEY, JSON.stringify(Object.fromEntries(setCache.entries())))
  } catch {
    // Ignore storage quota issues and continue with the in-memory cache.
  }
}

function setCardCache(cacheKey: string, lookup: CardLookup) {
  loadBrowserCache()
  // Re-inserting moves the entry to the end, so eviction drops the least recently fetched.
  cache.delete(cacheKey)
  if (lookup.card) {
    cache.set(cacheKey, toCachedCard(lookup.card))
  } else if (lookup.definitive) {
    cache.set(cacheKey, { notFoundAt: Date.now() })
  } else {
    // Transient failure (network, rate limit): retry on the next request.
    return
  }
  schedulePersist()
}

/**
 * `undefined` = unknown (needs a request), `null` = known to not exist.
 */
function getCachedCardBySet(name: string, setCode?: string): ScryfallCard | null | undefined {
  loadBrowserCache()
  const key = getCardCacheKey(name, setCode)
  const entry = cache.get(key)
  if (!entry) return undefined
  if (isNotFoundEntry(entry)) {
    if (Date.now() - entry.notFoundAt < NOT_FOUND_TTL_MS) return null
    cache.delete(key)
    return undefined
  }
  return entry
}

function setSetCacheEntry(code: string, set: ScryfallSet | null) {
  loadBrowserCache()
  setCache.set(normalizeSetCode(code), set ? toCachedSet(set) : null)
  schedulePersist()
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

function getResponseStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status
}

function isNotFoundError(error: unknown) {
  return getResponseStatus(error) === 404
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
    if (attempt < MAX_RATE_LIMIT_RETRIES && getResponseStatus(error) === 429) {
      const backoffMs = getRetryAfterMs(error) ?? MIN_REQUEST_INTERVAL_MS * 2 ** (attempt + 2)
      await sleep(backoffMs)
      return scryfallFetch(request, attempt + 1)
    }
    throw error
  }
}

/**
 * Whether a collection result is the requested card. Double-faced cards are
 * returned as "Front // Back", but are usually requested by their front face.
 */
function matchesRequestedName(card: ScryfallCard, name: string) {
  const requested = normalizeCardName(name)
  const cardName = normalizeCardName(card.name)
  return cardName === requested
    || cardName.startsWith(`${requested} // `)
    || Boolean(card.card_faces?.some((face) => normalizeCardName(face.name) === requested))
}

async function requestCardByName(name: string, setCode?: string): Promise<CardLookup> {
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

      if (match) return { card: match, definitive: true }
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

      return { card: match, definitive: true }
    } catch (error) {
      return { card: null, definitive: isNotFoundError(error) }
    }
  }

  try {
    const card = await scryfallFetch(() => $fetch<ScryfallCard>(`${BASE_URL}/cards/named`, {
      headers: SCRYFALL_HEADERS,
      params: { fuzzy: name },
    }))
    return { card, definitive: true }
  } catch (error) {
    return { card: null, definitive: isNotFoundError(error) }
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
    .then((lookup) => {
      setCardCache(cacheKey, lookup)
      return lookup.card ? getCachedCardBySet(name, setCode) ?? null : null
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

      const unmatched: ScryfallCardIdentifier[] = []
      for (const identifier of identifiersChunk) {
        const match = response.data.find((card) => (
          matchesRequestedName(card, identifier.name)
          && (!identifier.setCode || normalizeSetCode(card.set) === identifier.setCode)
        )) ?? null
        const cacheKey = getCardCacheKey(identifier.name, identifier.setCode)

        if (match) {
          setCardCache(cacheKey, { card: match, definitive: true })
          results.set(cacheKey, getCachedCardBySet(identifier.name, identifier.setCode) ?? null)
          loaded += 1
          continue
        }

        unmatched.push(identifier)
      }

      // Names the collection endpoint could not resolve exactly get a fuzzy lookup
      // (still throttled through the shared queue).
      const fallbackResults = await Promise.all(unmatched.map(async (identifier) => {
        const card = await fetchCardByName(identifier.name, identifier.setCode)
        loaded += 1
        return [getCardCacheKey(identifier.name, identifier.setCode), card] as const
      }))
      for (const [cacheKey, card] of fallbackResults) results.set(cacheKey, card)

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
      printings.push(...response.data.map(toCachedCard))
      pageUrl = response.has_more && response.next_page ? response.next_page : null
      params = undefined
    }

    return printings
  })().catch(() => {
    // Allow a retry after a failed (e.g. offline) request.
    printingCache.delete(normalizedName)
    return []
  })

  printingCache.set(normalizedName, request)
  return request
}

let allSetsRequest: Promise<Map<string, ScryfallSet> | null> | null = null

/**
 * The complete set list in one request (~70 KB gzipped). Views like the dashboard
 * look up dozens of set codes at once; one list request replaces that many
 * throttled single-set requests. Kept in memory; only used codes are persisted.
 */
function loadAllSets() {
  allSetsRequest ??= scryfallFetch(() => $fetch<{ data: ScryfallSet[] }>(`${BASE_URL}/sets`, { headers: SCRYFALL_HEADERS }))
    .then((response) => new Map(response.data.map((set) => [normalizeSetCode(set.code), toCachedSet(set)])))
    .catch(() => {
      allSetsRequest = null
      return null
    })
  return allSetsRequest
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

  const request = loadAllSets()
    .then((allSets) => {
      if (!allSets) return fetchSingleSet(normalizedCode)
      const set = allSets.get(normalizedCode) ?? null
      setSetCacheEntry(normalizedCode, set)
      return set
    })
    .finally(() => {
      pendingSetRequests.delete(normalizedCode)
    })

  pendingSetRequests.set(normalizedCode, request)
  return request
}

function fetchSingleSet(normalizedCode: string): Promise<ScryfallSet | null> {
  return scryfallFetch(() => $fetch<ScryfallSet>(`${BASE_URL}/sets/${normalizedCode}`, { headers: SCRYFALL_HEADERS }))
    .then((data) => {
      setSetCacheEntry(normalizedCode, data)
      return data
    })
    .catch((error) => {
      // Only remember a missing set when Scryfall says so; network errors retry later.
      if (isNotFoundError(error)) setSetCacheEntry(normalizedCode, null)
      return null
    })
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
