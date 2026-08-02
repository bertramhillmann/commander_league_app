import { connectToDatabase } from '../utils/mongoose'
import { Rules } from '../models/Rules'

export default defineEventHandler(async () => {
  await connectToDatabase()
  const rules = await Rules.findOne({ key: 'league' }).lean()

  return { rules: rules ? serializeRules(rules) : null }
})

function serializeRules(rules: { title: string; subtitle: string; sections: Array<{ title: string; body: string }> }) {
  return {
    title: rules.title,
    subtitle: rules.subtitle,
    sections: rules.sections.map((section) => ({ title: section.title, body: section.body })),
  }
}
