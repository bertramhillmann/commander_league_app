export interface ShopItem {
  id: string
  name: string
  description: string
  cost: number
  category: 'cosmetic' | 'boost' | 'consumable'
}

export const shopItems: ShopItem[] = [
  {
    id: 'card_sleeve_gold',
    name: 'Gold Card Sleeve',
    description: 'Fancy gold card sleeves for your commander',
    cost: 200,
    category: 'cosmetic',
  },
  {
    id: 'xp_boost',
    name: 'XP Boost',
    description: 'Double XP for your next 3 games',
    cost: 150,
    category: 'boost',
  },
  {
    id: 'reroll',
    name: 'Commander Reroll',
    description: 'Reroll your commander assignment once',
    cost: 100,
    category: 'consumable',
  },
]

export function getItemsByCategory(category: ShopItem['category']): ShopItem[] {
  return shopItems.filter((item) => item.category === category)
}

export function canAfford(balance: number, item: ShopItem): boolean {
  return balance >= item.cost
}
