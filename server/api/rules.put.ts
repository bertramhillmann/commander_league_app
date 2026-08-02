import { connectToDatabase } from '../utils/mongoose'
import { Rules } from '../models/Rules'
import { getPlayerSession, isAdminUser } from '../utils/playerAuth'

type RuleSection = { title?: string; body?: string }

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const session = getPlayerSession(event)
  if (!session || !isAdminUser(config.admins, session.user)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{ rules?: { title?: string; subtitle?: string; sections?: RuleSection[] } }>(event)
  const rules = body.rules
  const title = rules?.title?.trim()
  const subtitle = sanitizeRichText(rules?.subtitle ?? '')
  const sections = (rules?.sections ?? []).map((section) => ({
    title: section.title?.trim() ?? '',
    body: sanitizeRichText(section.body ?? ''),
  }))

  if (!title || !subtitle || sections.some((section) => !section.title)) {
    throw createError({ statusCode: 400, statusMessage: 'Every rule heading is required.' })
  }

  await connectToDatabase()
  const updated = await Rules.findOneAndUpdate(
    { key: 'league' },
    { $set: { key: 'league', title, subtitle, sections } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean()

  return {
    ok: true,
    rules: {
      title: updated.title,
      subtitle: updated.subtitle,
      sections: updated.sections.map((section) => ({ title: section.title, body: section.body })),
    },
  }
})

function sanitizeRichText(value: string) {
  const withoutDangerousBlocks = value
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  const allowedTagsOnly = withoutDangerousBlocks
    .replace(/<(?!\/?(?:p|br|strong|b|em|i|h3|ul|ol|li)\b)[^>]*>/gi, '')

  return allowedTagsOnly
    .replace(/<(p|br|strong|b|em|i|h3|ul|ol|li)(?:\s[^>]*)?>/gi, '<$1>')
    .trim()
}
