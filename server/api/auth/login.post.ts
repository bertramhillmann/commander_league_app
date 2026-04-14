import {
  clearPlayerSessionCookie,
  createPlayerSession,
  resolvePlayerUsername,
  setPlayerSessionCookie,
  validatePlayerLogin,
} from '~/server/utils/playerAuth'

export default defineEventHandler(async (event) => {
  const { username = '', password = '' } = await readBody<{ username?: string; password?: string }>(event)
  const normalizedUsername = username.trim()

  if (!normalizedUsername || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Username and password are required' })
  }

  const config = useRuntimeConfig(event)
  const valid = validatePlayerLogin(config.playerLogins, normalizedUsername, password)

  if (!valid) {
    clearPlayerSessionCookie(event)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }

  const canonicalUsername = resolvePlayerUsername(config.playerLogins, normalizedUsername)
  const session = createPlayerSession(canonicalUsername)
  setPlayerSessionCookie(event, session.token, session.maxAge)

  return { ok: true, user: canonicalUsername }
})
