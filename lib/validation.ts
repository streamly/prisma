import { z } from 'zod'
import { MIN_CPV } from './consts.js'

const defaultString = z.string().trim().min(1).max(256)
const stringArray = z.array(defaultString).max(100)


const newVideoInputSchema = z.object({
  id: defaultString,
  width: z.int().positive().min(100).max(10000),
  height: z.int().positive().min(100).max(10000),
  duration: z.int().positive(),
  size: z.int()
})


const updateVideoInputSchema = z.object({
  id: defaultString,
  title: defaultString,
  description: z.string().trim().min(1).max(1000),
  type: stringArray,
  tags: stringArray,
  channel: stringArray,
  audience: stringArray,
  people: stringArray,
  topic: stringArray,
  cpv: z.number().min(MIN_CPV),
  budget: z.number().nonnegative(),
  performance: z.literal(true).default(true),
  gated: z.literal(1).default(1)
})


const conversionsQuerySchema = z.object({
  videoId: defaultString,
  phone: defaultString.optional(),
  firstname: defaultString.optional()
})

export function validateNewVideoInput(data: object) {
  return newVideoInputSchema.parse(data)
}


export function validateUpdateVideoInput(data: object) {
  return updateVideoInputSchema.parse(data)
}


export function validateConversionsQuery(data: object) {
  return conversionsQuerySchema.parse(data)
}