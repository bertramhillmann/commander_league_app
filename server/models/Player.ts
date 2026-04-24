import type { CommanderTitleId } from '~/utils/titles'
import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IPlayerPurchase {
  name: string
  type: string
  cost: number
  set: string
  cards: string[]
  createdAt?: Date
  updatedAt?: Date
}

export interface IPlayerCommanderDeck {
  commanderName: string
  commanderNameKey: string
  archidektUrl?: string
  archidektDeckId?: string
  selectedTitle?: CommanderTitleId
  createdAt?: Date
  updatedAt?: Date
}

export interface IPlayer extends Document {
  name: string
  nameKey: string
  cardpool: string[]
  purchases: IPlayerPurchase[]
  commanderDecks: IPlayerCommanderDeck[]
  createdAt: Date
  updatedAt: Date
}

const PlayerPurchaseSchema = new Schema<IPlayerPurchase>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    cost: { type: Number, required: true, default: 0 },
    set: { type: String, required: true, default: '' },
    cards: { type: [String], default: [] },
  },
  { _id: true, timestamps: true }
)

const PlayerCommanderDeckSchema = new Schema<IPlayerCommanderDeck>(
  {
    commanderName: { type: String, required: true },
    commanderNameKey: { type: String, required: true, index: true },
    archidektUrl: { type: String, default: '' },
    archidektDeckId: { type: String, default: '' },
    selectedTitle: { type: String, default: '' },
  },
  { _id: false, timestamps: true }
)

const PlayerSchema = new Schema<IPlayer>(
  {
    name: { type: String, required: true, unique: true, index: true },
    nameKey: { type: String, required: true, unique: true, index: true },
    cardpool: { type: [String], default: [] },
    purchases: { type: [PlayerPurchaseSchema], default: [] },
    commanderDecks: { type: [PlayerCommanderDeckSchema], default: [] },
  },
  { timestamps: true }
)

export const Player: Model<IPlayer> =
  mongoose.models.Player ?? mongoose.model<IPlayer>('Player', PlayerSchema)
