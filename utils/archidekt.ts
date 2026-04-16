export function extractArchidektDeckId(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!/archidekt\.com$/i.test(parsed.hostname)) return null

    const segments = parsed.pathname.split('/').filter(Boolean)
    const deckIndex = segments.findIndex((segment) => segment.toLowerCase() === 'decks')
    if (deckIndex === -1) return null

    const candidate = segments[deckIndex + 1]
    if (!candidate || !/^\d+$/.test(candidate)) return null

    return candidate
  } catch {
    return null
  }
}
