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
  people: stringArray.optional(),
  cpv: z.number().nonnegative(),
  budget: z.number().nonnegative(),
  performance: z.boolean(),
  gated: z.union([z.literal(0), z.literal(1)]).default(0) // 👈 add gated
})
  .superRefine((data, ctx) => {
    if (data.gated === 1 && data.cpv < MIN_CPV) {
      ctx.addIssue({
        code: "custom",
        path: ["cpv"],
        message: `CPV must be at least ${MIN_CPV} if Gated is enabled`,
      })
    }

    if (!data.performance) {
      if (data.cpv !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["cpv"],
          message: "CPV must be 0 if performance marketing is disabled",
        })
      }
      if (data.budget !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["budget"],
          message: "Budget must be 0 if performance marketing is disabled",
        })
      }
      if (data.gated !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["gated"],
          message: "Gated must be 0 if performance marketing is disabled",
        })
      }
    }
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