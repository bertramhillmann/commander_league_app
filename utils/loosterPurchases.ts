export interface LoosterPurchaseDocument {
  name?: string
  type?: string
  cost?: number
  set?: string
  set_name?: string
  cards?: string[]
  cardPrintings?: LoosterCardPrinting[]
  date?: string
  priceEuro?: number
  createdAt?: string
  updatedAt?: string
}

export interface LoosterCardPrinting {
  name: string
  scryfallUrl: string
  setCode: string
}

export interface LoosterPurchaseRecord extends Required<Pick<LoosterPurchaseDocument, 'name' | 'type' | 'cost' | 'set' | 'set_name' | 'cards' | 'date' | 'priceEuro'>> {
  id: string
  playerName: string
  createdAt?: string
  updatedAt?: string
}

export function formatPurchaseDate(value: string | Date | null | undefined) {
  if (!value) return ''

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
