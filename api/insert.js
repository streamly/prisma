import {
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/responses.js'
import { createVideoDocument } from '../lib/typesenseClient.js'
import { authenticateUser, getClerkUser } from '../lib/clerkClient.js'
import { validateNewVideoInput } from '../lib/validation.js'

export default async function handler(req, res) {
  setCorsHeaders(res)
  if (handleOptions(req, res)) return

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    let userId

    try {
      userId = await authenticateUser(req)
    } catch (error) {
      return res.status(401).json({ error: 'Authentication error', details: error.message })
    }

    let data

    try {
      data = validateNewVideoInput(req.body)
    } catch (error) {
      console.error('Validation error', error)
      return res.status(400).json({ error: 'Invalid data', details: error.issues || undefined })
    }

    const { filename, width, height, duration, size, id } = valida

    if (Object.values({ filename, width, height, duration, size, id }).some(value => value === undefined || value === null)) {
      return errorResponse(res, 400, 'Missing required fields: filename, width, height, duration, size, id')
    }

    const user = await getClerkUser(userId)
    const customerId = user.privateMetadata.customerId

    try {
      const document = await createVideoDocument(
        {
          id,
          customerId,
          userId,
          height: parseInt(height),
          width: parseInt(width),
          size: parseInt(size),
          duration: parseInt(duration),
        }
      )

      return successResponse(res, {
        message: 'Video metadata inserted successfully'
      })

    } catch (typesenseError) {
      console.error('Typesense insertion failed:', typesenseError)

      if (typesenseError.message && typesenseError.message.includes('already exists')) {
        return errorResponse(res, 409, 'Video with this ID already exists')
      }

      return errorResponse(res, 500, `Failed to insert video metadata: ${typesenseError.message}`)
    }

  } catch (error) {
    console.error('Insert API error:', error)
    return errorResponse(res, 500, `Internal server error: ${error.message}`)
  }
}