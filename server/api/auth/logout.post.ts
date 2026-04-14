import { clearPlayerSessionCookie } from '~/server/utils/playerAuth'

export default defineEventHandler((event) => {
  clearPlayerSessionCookie(event)
  return { ok: true }
})
