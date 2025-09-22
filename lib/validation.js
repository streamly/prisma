import { z } from 'zod'

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
  description: z.string().trim().min(1).max(100000),
  type: stringArray,
  tags: stringArray,
  channel: stringArray,
  audience: stringArray,
  cpv: z.number().nonnegative(),
  budget: z.number().nonnegative(),
  performance: z.boolean()
})


export function validateNewVideoInput(data) {
  return newVideoInputSchema.parse(data)
}


export function validateUpdateVideoInput(data) {
  return updateVideoInputSchema.parse(data)
}