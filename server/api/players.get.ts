import { parsePlayerLogins } from '~/server/utils/playerAuth'

export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  return Object.values(parsePlayerLogins(config.playerLogins))
    .map((entry) => entry.username)
    .sort((a, b) => a.localeCompare(b))
})
