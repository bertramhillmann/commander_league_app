import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IGamePlayer {
  name: string
  commander: string
  placement: number
  points: number | null
  eliminations: number | null
  commanderCasts: number | null
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
