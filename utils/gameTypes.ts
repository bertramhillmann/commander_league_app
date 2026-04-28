export interface GameDecklistCard {
  name: string
  quantity: number
  categories: string[]
}

export interface GameDecklist {
  deckId: string
  name: string
  owner: string
  url: string
  cards: GameDecklistCard[]
}

export interface GameDocumentPlayer {
  name: string
  commander: string
  placement: number
  points: number | null
  eliminations: number | null
  commanderCasts: number | null
  decklist: GameDecklist | null
}

export interface GameDocument {
  gameId: string
  date: string | Date
  hidden?: boolean
  players: GameDocumentPlayer[]
}

export interface EditableGamePlayer {
  name: string
  commander: string
  placement: number
  eliminations: number | null
  commanderCasts: number | null
}
