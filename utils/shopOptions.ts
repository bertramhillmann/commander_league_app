import {
  buildLeagueSeasonRanges,
  DEFAULT_COMMANDER_SLOT_2_COST,
  DEFAULT_COMMANDER_SLOT_3_COST,
  hasActiveSeasonalRanking,
  type LeagueSettingsDocument,
} from '~/utils/leagueSettings'

export type ShopItemCategory = 'booster' | 'upgrade'

export interface ShopItem {
  id: string
  name: string
  description: string
  cost: number
  category: ShopItemCategory
  purchaseType: 'looster' | 'commander_slot_2' | 'commander_slot_3'
  requiredStartedSeasons: number
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'looster',
    name: 'Looster',
    description: 'A sealed Magic booster from the multiverse. Open it to discover new cards and grow the league card pool.',
    cost: 0,
    category: 'booster',
    purchaseType: 'looster',
    requiredStartedSeasons: 1,
  },
  {
    id: 'commander_slot_2',
    name: 'Second Game Changer / Combo Slot',
    description: 'Unlock a second slot for every commander you own. Available from the start of Season 2.',
    cost: 5,
    category: 'upgrade',
    purchaseType: 'commander_slot_2',
    requiredStartedSeasons: 2,
  },
  {
    id: 'commander_slot_3',
    name: 'Third Game Changer / Combo Slot',
    description: 'Unlock a third slot for every commander you own. Available from the start of Season 4.',
    cost: 10,
    category: 'upgrade',
    purchaseType: 'commander_slot_3',
    requiredStartedSeasons: 4,
  },
]

export function getStartedSeasonCount(settings?: LeagueSettingsDocument | null, now = Date.now()) {
  const seasonalRanking = settings?.standings?.seasonalRanking
  if (!hasActiveSeasonalRanking(seasonalRanking)) return 1

  return Math.max(
    1,
    buildLeagueSeasonRanges(seasonalRanking).filter((season) => season.startMs <= now).length,
  )
}

export function getShopItems(settings?: LeagueSettingsDocument | null, loosterCost = 0) {
  return SHOP_ITEMS.map((item) => ({
    ...item,
    cost:
      item.purchaseType === 'looster'
        ? loosterCost
        : item.purchaseType === 'commander_slot_2'
          ? Number(settings?.shop?.commanderSlot2Cost ?? DEFAULT_COMMANDER_SLOT_2_COST)
          : Number(settings?.shop?.commanderSlot3Cost ?? DEFAULT_COMMANDER_SLOT_3_COST),
  }))
}

export function getShopItemByType(
  purchaseType: ShopItem['purchaseType'],
  settings?: LeagueSettingsDocument | null,
  loosterCost = 0,
) {
  return getShopItems(settings, loosterCost).find((item) => item.purchaseType === purchaseType) ?? null
}
