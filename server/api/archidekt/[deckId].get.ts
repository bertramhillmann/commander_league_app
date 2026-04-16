import { fetchArchidektDeck } from '~/server/utils/archidekt'

export default defineEventHandler(async (event) => {
  const deckId = getRouterParam(event, 'deckId')?.trim() ?? ''
  if (!/^\d+$/.test(deckId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Archidekt deck ID' })
  }

  try {
    return await fetchArchidektDeck(deckId)
  } catch (error: any) {
    throw createError({
      statusCode: error?.response?.status ?? 502,
      statusMessage: 'Failed to load deck from Archidekt',
    })
  }
})
