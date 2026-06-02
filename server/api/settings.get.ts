import { connectToDatabase } from '../utils/mongoose'
import { Settings } from '../models/Settings'

export default defineEventHandler(async () => {
  await connectToDatabase()

  const doc = await Settings.findOne({ key: 'league' }).lean()

  return {
    settings: doc
        ? {
            points: doc.points ?? undefined,
            achievements: doc.achievements ?? undefined,
            playerRankingSystem: doc.playerRankingSystem ?? undefined,
            playerRating: doc.playerRating ?? undefined,
            level: doc.level ?? undefined,
            standings: doc.standings ?? undefined,
            shop: doc.shop ?? undefined,
          }
      : null,
  }
})
