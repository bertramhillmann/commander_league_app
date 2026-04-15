import { getPlayerSession, isAdminUser } from '~/server/utils/playerAuth'

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  return {
    authenticated: !!session,
    user: session?.user ?? null,
    isAdmin: session ? isAdminUser(config.admins, session.user) : false,
  }
})
