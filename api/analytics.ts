import { authenticateUser } from '../lib/clerkClient.js'
import { queryAnalytics } from '../lib/newRelic.js'
import { successResponse } from '../lib/responses.js'
import type { VercelRequest, VercelResponse} from '@vercel/node'

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

  const videoId = req.query.videoId
  try {
    // @ts-ignore
    const data = await queryAnalytics(userId, videoId)

    return successResponse(res, { data })
  } catch (error) {
    console.error('Error quering video analytics', error)
    return res.status(500).json({ error: 'Error quering video analytics' })
  }
}