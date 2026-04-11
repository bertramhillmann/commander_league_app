import { connectToDatabase } from '../utils/mongoose'
import { Game } from '../models/Game'

export default defineEventHandler(async () => {
  await connectToDatabase()
  const games = await Game.find({}).sort({ date: -1 }).lean()
  return games
})
