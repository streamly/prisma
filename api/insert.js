import md5 from 'md5'
import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/apiHelpers.js'
import { getTypesenseClient } from '../lib/typesenseClient.js'

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

    const { filename, width, height, duration, size, id, videoKey } = req.body

    if (Object.values({ filename, width, height, duration, size, id, videoKey }).some(value => value === undefined || value === null)) {
      return errorResponse(res, 400, 'Missing required fields: filename, width, height, duration, size, id, videoKey')
    }
    const now = Math.floor(Date.now() / 1000)

    const document = {
      id,
      uid: md5(userId),
      cid: 0,
      title: id,
      height: parseInt(height),
      width: parseInt(width),
      size: parseInt(size),
      duration: parseInt(duration),
      videoKey,
      thumbnailKey: null,
      created: now,
      modified: now,
      active: 0,
      length: '',
      ranking: 0
    }

    try {
      const typesenseClient = getTypesenseClient()
      const result = await typesenseClient.collections('videos').documents().create(document)

      console.log('Video metadata inserted successfully:', result)

      return successResponse(res, {
        id: document.id,
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