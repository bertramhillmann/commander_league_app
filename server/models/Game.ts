import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IGamePlayer {
  name: string
  commander: string
  placement: number
  points: number | null
  eliminations: number | null
  commanderCasts: number | null
  decklist: {
    deckId: string
    name: string
    owner: string
    url: string
    cards: {
      name: string
      quantity: number
      categories: string[]
    }[]
  } | null
}

export interface IGame extends Document {
  gameId: string
  date: Date
  players: IGamePlayer[]
}

const GamePlayerSchema = new Schema<IGamePlayer>(
  {
    name: { type: String, required: true },
    commander: { type: String, required: true },
    placement: { type: Number, required: true, min: 1 },
    points: { type: Number, default: null },
    eliminations: { type: Number, default: null },
    commanderCasts: { type: Number, default: null },
    decklist: {
      type: {
        deckId: { type: String, required: true },
        name: { type: String, required: true },
        owner: { type: String, default: '' },
        url: { type: String, required: true },
        cards: {
          type: [{
            name: { type: String, required: true },
            quantity: { type: Number, required: true },
            categories: { type: [String], default: [] },
          }],
          default: [],
        },
      },
      default: null,
    },
  },
  { _id: false }
)

const GameSchema = new Schema<IGame>(
  {
    gameId: { type: String, required: true, unique: true },
    date: { type: Date, required: true, default: Date.now },
    players: { type: [GamePlayerSchema], required: true },
  },
  { timestamps: true }
)

export const Game: Model<IGame> =
  mongoose.models.Game ?? mongoose.model<IGame>('Game', GameSchema)
