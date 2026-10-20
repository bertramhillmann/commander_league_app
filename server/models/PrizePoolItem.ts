import mongoose, { Schema, type Document, type Model } from 'mongoose'

export interface IPrizePoolItem extends Document {
  playerName: string
  description: string
  priceEuro: number
  date: Date
  sourceKey?: string
  createdAt: Date
  updatedAt: Date
}

const PrizePoolItemSchema = new Schema<IPrizePoolItem>(
  {
    playerName: { type: String, required: true, index: true },
    description: { type: String, required: true, trim: true },
    priceEuro: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now, index: true },
    sourceKey: { type: String, sparse: true, unique: true },
  },
  { timestamps: true },
)

export const PrizePoolItem: Model<IPrizePoolItem> =
  mongoose.models.PrizePoolItem ?? mongoose.model<IPrizePoolItem>('PrizePoolItem', PrizePoolItemSchema)
