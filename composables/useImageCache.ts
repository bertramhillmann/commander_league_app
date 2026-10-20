import { fetchCardsByIdentifiers, getCardImageUrl, type ScryfallCard } from '~/services/scryfallService'

type ImageSize = keyof NonNullable<ScryfallCard['image_uris']>

type ImageCacheRecord = Partial<Record<ImageSize, string>>

const ALL_IMAGE_SIZES: ImageSize[] = ['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']

// Components ask for their own few commanders (every game card, list row, ...).
// Requests made within one short window are merged into a single collection
// request instead of one Scryfall round trip per component.
const BATCH_WINDOW_MS = 16

let pendingBatch: {
  names: Set<string>
  promise: Promise<Map<string, ScryfallCard | null>>
} | null = null

function normalizeCommanderName(name: string) {
  return name.trim().toLowerCase()
}

function requestCardsBatched(names: string[]) {
  if (!pendingBatch) {
    const batchNames = new Set<string>()
    const promise = new Promise<Map<string, ScryfallCard | null>>((resolve) => {
      setTimeout(() => {
        pendingBatch = null
        fetchCardsByIdentifiers([...batchNames].map((name) => ({ name })))
          .then(resolve)
          .catch(() => resolve(new Map()))
      }, BATCH_WINDOW_MS)
    })
    pendingBatch = { names: batchNames, promise }
  }

  for (const name of names) pendingBatch.names.add(name)
  return pendingBatch.promise
}

export function useImageCache() {
  const imageCache = useState<Record<string, ImageCacheRecord>>('image-cache:urls', () => ({}))

  function getCachedCommanderImage(name: string, size: ImageSize = 'art_crop') {
    const key = normalizeCommanderName(name)
    return imageCache.value[key]?.[size] ?? null
  }

  function storeCardImages(name: string, card: ScryfallCard) {
    const key = normalizeCommanderName(name)
    const record: ImageCacheRecord = { ...imageCache.value[key] }
    for (const size of ALL_IMAGE_SIZES) {
      const url = getCardImageUrl(card, size)
      if (url) record[size] = url
    }
    // Per-key update: only components reading this commander re-render.
    imageCache.value[key] = record
  }

  async function getCommanderImage(name: string, size: ImageSize = 'art_crop') {
    const cached = getCachedCommanderImage(name, size)
    if (cached) return cached

    const card = (await requestCardsBatched([name.trim()])).get(normalizeCommanderName(name))
    if (!card) return null

    storeCardImages(name, card)
    return getCachedCommanderImage(name, size)
  }

  async function preloadCommanderImages(names: string[], sizes: ImageSize[] = ['art_crop']) {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]

    const namesToFetch = uniqueNames.filter((name) => {
      const key = normalizeCommanderName(name)
      return sizes.some((size) => !imageCache.value[key]?.[size])
    })

    if (namesToFetch.length === 0) return

    const cardsByKey = await requestCardsBatched(namesToFetch)

    for (const name of namesToFetch) {
      const card = cardsByKey.get(normalizeCommanderName(name))
      if (card) storeCardImages(name, card)
    }
  }

  return {
    imageCache,
    getCommanderImage,
    preloadCommanderImages,
    getCachedCommanderImage,
  }
}
