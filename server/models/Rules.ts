import mongoose, { Document, Model, Schema } from 'mongoose'

export interface IRuleSection {
  title: string
  body: string
}

export interface IRules extends Document {
  key: string
  title: string
  subtitle: string
  sections: IRuleSection[]
  createdAt: Date
  updatedAt: Date
}

const RuleSectionSchema = new Schema<IRuleSection>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
  },
  { _id: false },
)

const RulesSchema = new Schema<IRules>(
  {
    key: { type: String, required: true, unique: true, index: true, default: 'league' },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    sections: { type: [RuleSectionSchema], default: [] },
  },
  { timestamps: true },
)

export const Rules: Model<IRules> =
  mongoose.models.Rules ?? mongoose.model<IRules>('Rules', RulesSchema)
