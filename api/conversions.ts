import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateUser } from '../lib/clerkClient.js'
import { queryConversions } from '../lib/newRelic.js'
import { errorResponse, successResponse } from '../lib/responses.js'
import { validateConversionsQuery } from '../lib/validation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  let userId

  try {
    userId = await authenticateUser(req)
  } catch (error) {
    console.error('Authentication error', error)

    return res.status(401).json({ error: 'Authentication error' })
  }


  let query

  try {
    query = validateConversionsQuery(req.query)
  } catch (error: any) {
    return errorResponse(res, 400, "Invalid query parameters", error?.details)
  }

  console.log('query', req.query)

  try {
    const data = await queryConversions({
      videoId: query.videoId,
      phone: query.phone,
      firstname: query.firstname,
      userId
    })

    return successResponse(res, { data })
  } catch (error) {
    console.error('Error quering video conversions', error)
    return res.status(500).json({ error: 'Error quering video conversions' })
  }
}