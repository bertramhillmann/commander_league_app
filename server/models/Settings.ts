import mongoose, { Document, Model, Schema } from 'mongoose'

export interface ISettings extends Document {
  key: string
  points?: Record<string, Array<{ points: number; lPoints: number }>>
  achievements?: Record<string, number>
  playerRankingSystem?: 'classic' | 'player_rating_based'
  playerRating?: {
    provisionalGames?: number
    topCommandersForAverageMmr?: number
    minimumGamesForAverageCommanderMmr?: number
    missingCommanderMmr?: number
    usePeakCommanderMmrForAverage?: boolean
    simpleMmr?: {
      enabled?: boolean
    }
    lPointMmrModifier?: {
      enabled?: boolean
    }
    commanderMMRPointModifier?: {
      enabled?: boolean
      maxModifierPercent?: number
    }
  }
  level?: {
    xpPerGame?: Record<string, number>
    winBonusXp?: Record<string, number>
    thresholds?: number[]
    pointsPerLevel?: number
  }
  standings?: {
    usePerformanceModifier?: boolean
    includeCommanderXp?: boolean
    includeAchievementPoints?: boolean
    adjustmentMode?: 'compensation' | 'freeGames' | 'penaltyGames'
    freeGamesBaselineAvg?: number
    freeGamesConsecutivePenalty?: number
    freeGamesMinimumAvg?: number
    freeGamesGraceMisses?: number
    penaltyFactor?: number
    seasonalRanking?: {
      enabled?: boolean
      leagueStartDate?: string
      leagueEndDate?: string
      seasonCount?: number
    }
  }
  shop?: {
    loosterCost?: number
    commanderSlot2Cost?: number
    commanderSlot3Cost?: number
  }
  createdAt: Date
  updatedAt: Date
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true, index: true, default: 'league' },
    points: { type: Schema.Types.Mixed, default: undefined },
    achievements: { type: Schema.Types.Mixed, default: undefined },
    playerRankingSystem: { type: String, default: undefined },
    playerRating: { type: Schema.Types.Mixed, default: undefined },
    level: { type: Schema.Types.Mixed, default: undefined },
    standings: { type: Schema.Types.Mixed, default: undefined },
    shop: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true },
)

export const Settings: Model<ISettings> =
  mongoose.models.Settings ?? mongoose.model<ISettings>('Settings', SettingsSchema)
