import { connectToDatabase } from '../utils/mongoose'

export default defineEventHandler(async () => {
  await connectToDatabase()
  return { status: 'ok', db: 'connected' }
})
