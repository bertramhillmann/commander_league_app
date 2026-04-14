import { fetchCardByName, getCardImageUrl, type ScryfallCard } from '~/services/scryfallService'

type ImageSize = keyof NonNullable<ScryfallCard['image_uris']>

type ImageCacheRecord = Partial<Record<ImageSize, string>>

const pendingCards = new Map<string, Promise<ScryfallCard | null>>()

function normalizeCommanderName(name: string) {
  return name.trim().toLowerCase()
}

async function getOrFetchCard(name: string) {
  const key = normalizeCommanderName(name)
  const existing = pendingCards.get(key)
  if (existing) return existing

  const request = fetchCardByName(name).finally(() => {
    pendingCards.delete(key)
  })

  pendingCards.set(key, request)
  return request
}

export function useImageCache() {
  const imageCache = useState<Record<string, ImageCacheRecord>>('image-cache:urls', () => ({}))

  function getCachedCommanderImage(name: string, size: ImageSize = 'art_crop') {
    const key = normalizeCommanderName(name)
    return imageCache.value[key]?.[size] ?? null
  }

  async function getCommanderImage(name: string, size: ImageSize = 'art_crop') {
    const cached = getCachedCommanderImage(name, size)
    if (cached) return cached

    const card = await getOrFetchCard(name)
    if (!card) return null

    const nextRecord: ImageCacheRecord = { ...(imageCache.value[normalizeCommanderName(name)] ?? {}) }
    const sizes: ImageSize[] = ['small', 'normal', 'large', 'png', 'art_crop', 'border_crop']

    for (const currentSize of sizes) {
      const url = getCardImageUrl(card, currentSize)
      if (url) nextRecord[currentSize] = url
    }

    imageCache.value = {
      ...imageCache.value,
      [normalizeCommanderName(name)]: nextRecord,
    }

    return nextRecord[size] ?? null
  }

  async function preloadCommanderImages(names: string[], sizes: ImageSize[] = ['art_crop']) {
    const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))]
    await Promise.all(uniqueNames.map(async (name) => {
      await Promise.all(sizes.map((size) => getCommanderImage(name, size)))
    }))
  }

  return {
    imageCache,
    getCommanderImage,
    preloadCommanderImages,
    getCachedCommanderImage,
  }
}
