import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateUser } from '../lib/clerkClient.js'
import { queryConversions } from '../lib/newRelic.js'
import { successResponse } from '../lib/responses.js'
import { findInactiveVideo } from '../lib/typesenseClient.js'

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

  try {
    const inactive = await findInactiveVideo(userId)

    return successResponse(res, { videoId: inactive?.id })
  } catch (error) {
    console.error('Error', error)
    return res.status(500).json({ error: 'Error' })
  }
}