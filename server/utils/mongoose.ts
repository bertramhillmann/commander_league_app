import mongoose from 'mongoose'

let isConnected = false

export async function connectToDatabase(): Promise<void> {
  if (isConnected) return

  const config = useRuntimeConfig()
  const uri = config.mongodbUri

  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables')
  }

  await mongoose.connect(uri)
  isConnected = true
  console.log('[MongoDB] Connected successfully')
}
