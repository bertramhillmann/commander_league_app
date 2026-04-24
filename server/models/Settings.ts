import mongoose, { Document, Model, Schema } from 'mongoose'

export interface ISettings extends Document {
  key: string
  points?: Record<string, Array<{ points: number; lPoints: number }>>
  achievements?: Record<string, number>
  level?: {
    xpPerGame?: Record<string, number>
    winBonusXp?: Record<string, number>
    thresholds?: number[]
  }
  createdAt: Date
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, index: true, default: 'league' },
    points: { type: Schema.Types.Mixed, default: undefined },
    achievements: { type: Schema.Types.Mixed, default: undefined },
    level: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true },
)

export const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', SettingsSchema)
