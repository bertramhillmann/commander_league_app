import { connectToDatabase } from '../utils/mongoose'
import { Settings } from '../models/Settings'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'
import type { LeagueSettingsDocument } from '~/utils/leagueSettings'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)

  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ settings?: LeagueSettingsDocument | null }>(event)
  const nextSettings = body?.settings ?? null

  await connectToDatabase()

  if (!nextSettings || isEmptySettings(nextSettings)) {
    await Settings.deleteOne({ key: 'league' })
    return { ok: true, settings: null }
  }

  const updated = await Settings.findOneAndUpdate(
    { key: 'league' },
    {
      $set: {
        key: 'league',
        points: nextSettings.points ?? undefined,
        achievements: nextSettings.achievements ?? undefined,
        level: nextSettings.level ?? undefined,
        standings: nextSettings.standings ?? undefined,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean()

  return {
    ok: true,
    settings: updated
      ? {
          points: updated.points ?? undefined,
          achievements: updated.achievements ?? undefined,
          level: updated.level ?? undefined,
          standings: updated.standings ?? undefined,
        }
      : null,
  }
})

function isEmptySettings(settings: LeagueSettingsDocument) {
  return Object.keys(settings.points ?? {}).length === 0
    && Object.keys(settings.achievements ?? {}).length === 0
    && Object.keys(settings.level?.xpPerGame ?? {}).length === 0
    && Object.keys(settings.level?.winBonusXp ?? {}).length === 0
    && (settings.level?.thresholds?.length ?? 0) === 0
    && settings.standings?.usePerformanceModifier === undefined
}
