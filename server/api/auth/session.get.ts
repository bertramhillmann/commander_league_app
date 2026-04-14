import { getPlayerSession } from '~/server/utils/playerAuth'

export default defineEventHandler((event) => {
  const session = getPlayerSession(event)
  return {
    authenticated: !!session,
    user: session?.user ?? null,
  }
})
