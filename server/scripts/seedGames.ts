/**
 * Seed script — imports games_from_spieleergebnisse.json into MongoDB.
 * Run with: npx tsx server/scripts/seedGames.ts
 */
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const MONGODB_URI =
  'mongodb+srv://bertramhillmann:D6g2fPKOAiwKcMCM@cluster0.6qhdtd4.mongodb.net/commander_app?retryWrites=true&w=majority&appName=Cluster0'

const GamePlayerSchema = new mongoose.Schema(
  {
    name: String,
    commander: String,
    placement: Number,
    points: { type: Number, default: null },
    eliminations: { type: Number, default: null },
    commanderCasts: { type: Number, default: null },
  },
  { _id: false }
)

const GameSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
    players: [GamePlayerSchema],
  },
  { timestamps: true }
)

const Game = mongoose.models.Game ?? mongoose.model('Game', GameSchema)

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  const jsonPath = resolve(process.env.GAMES_JSON_PATH ?? 'C:/Users/bertr/Downloads/games_from_spieleergebnisse.json')
  const games = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  let inserted = 0
  let skipped = 0

  for (const game of games) {
    try {
      await Game.updateOne(
        { gameId: game.gameId },
        { $setOnInsert: game },
        { upsert: true }
      )
      inserted++
    } catch (e: any) {
      console.warn(`Skipped ${game.gameId}: ${e.message}`)
      skipped++
    }
  }

  console.log(`Done — ${inserted} upserted, ${skipped} skipped`)
  await mongoose.disconnect()
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
