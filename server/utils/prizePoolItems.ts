import type { PrizePoolItemRecord } from '~/utils/prizePoolItems'

export function serializePrizePoolItem(item: any): PrizePoolItemRecord {
  const itemDate = item.date ?? item.createdAt
  return {
    id: String(item._id),
    playerName: String(item.playerName ?? ''),
    description: String(item.description ?? ''),
    priceEuro: Number(item.priceEuro ?? 0),
    date: itemDate instanceof Date ? itemDate.toISOString().slice(0, 10) : String(itemDate ?? '').slice(0, 10),
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt ?? ''),
  }
}
