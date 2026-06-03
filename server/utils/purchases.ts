import { createError } from 'h3'
import type { IPlayerPurchase } from '../models/Player'
import { fetchCardsByName } from '~/services/scryfallService'
import { normalizeCardNames } from './playerData'
import { formatPurchaseDate, type LoosterPurchaseRecord } from '~/utils/loosterPurchases'

export function parseCardListInput(cards: string[] | string | undefined) {
  if (Array.isArray(cards)) return cards
  if (typeof cards !== 'string') return []

  return cards
    .split(/[,\n\r]+/)
    .map((card) => card.trim())
    .filter(Boolean)
}

export async function validateAndCanonicalizeCards(cards: string[] | string | undefined, setCode?: string) {
  const requestedCards = normalizeCardNames(parseCardListInput(cards))
  if (requestedCards.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one card is required' })
  }

  const lookup = await fetchCardsByName(requestedCards, { setCode })
  const invalidCards = requestedCards.filter((card) => !lookup.get(card))
  if (invalidCards.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: setCode
        ? `Unknown card names for set ${setCode}: ${invalidCards.join(', ')}`
        : `Unknown card names: ${invalidCards.join(', ')}`,
    })
  }

  return normalizeCardNames(
    requestedCards.map((card) => lookup.get(card)?.name ?? card),
  )
}

export async function validateAndCanonicalizeOptionalCards(cards: string[] | string | undefined, setCode?: string) {
  const requestedCards = normalizeCardNames(parseCardListInput(cards))
  if (requestedCards.length === 0) return []

  const lookup = await fetchCardsByName(requestedCards, { setCode })
  const invalidCards = requestedCards.filter((card) => !lookup.get(card))
  if (invalidCards.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: setCode
        ? `Unknown card names for set ${setCode}: ${invalidCards.join(', ')}`
        : `Unknown card names: ${invalidCards.join(', ')}`,
    })
  }

  return normalizeCardNames(
    requestedCards.map((card) => lookup.get(card)?.name ?? card),
  )
}

export function parsePurchaseDate(value: string | Date | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value

  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Purchase date is required' })
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`)
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Purchase date is invalid' })
  }

  return parsed
}

export function normalizeEuroPrice(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Price in euro must be a valid non-negative number' })
  }

  return Math.round(parsed * 100) / 100
}

export function flattenPlayerPurchases(
  playerName: string,
  purchases: Array<(IPlayerPurchase & { _id?: { toString(): string } | string }) | null | undefined>,
): LoosterPurchaseRecord[] {
  return purchases
    .filter((purchase): purchase is IPlayerPurchase & { _id?: { toString(): string } | string } => Boolean(purchase))
    .map((purchase) => ({
      id: typeof purchase._id === 'string' ? purchase._id : purchase._id?.toString() ?? '',
      playerName,
      name: purchase.name ?? 'Looster',
      type: purchase.type ?? 'looster',
      cost: Number(purchase.cost ?? 0),
      set: purchase.set ?? '',
      set_name: purchase.set_name ?? '',
      cards: Array.isArray(purchase.cards) ? purchase.cards.filter(Boolean) : [],
      date: formatPurchaseDate(purchase.date ?? purchase.createdAt ?? null),
      priceEuro: Number(purchase.priceEuro ?? 0),
      createdAt: purchase.createdAt ? new Date(purchase.createdAt).toISOString() : undefined,
      updatedAt: purchase.updatedAt ? new Date(purchase.updatedAt).toISOString() : undefined,
    }))
}
