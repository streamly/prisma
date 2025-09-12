import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/apiHelpers.js'
import { deleteVideo } from '../lib/s3Client.js'
import { deleteVideoDocument, verifyVideoOwnership } from '../lib/typesenseClient.js'

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let userId

  try {
    userId = await authenticateUser(req)
  } catch (error) {
    return res.status(401).json({ error: 'Authentication error', details: error.message })
  }

  const { id } = req.body

  if (!id) {
    return errorResponse(res, 400, 'Missing required field: id')
  }

  try {
    let document
    try {
      document = await verifyVideoOwnership(id, userId)
    } catch (error) {
      console.error('Video ownership error:', error)
      return res.status(400).json({ error: 'You do not have permission to access this video' })
    }

    if (!document) {
      return res.status(404).json({ error: 'Video not found' })
    }

    try {
      await deleteVideo(document.videoKey)
    } catch (error) {
      console.error(error)

      return res.status(500).json({ success: false, error: 'Error deleting video file', details: error.message })
    }

    try {
      await deleteVideoDocument(id)
    } catch (typesenseError) {
      console.error('Failed to delete from Typesense:', typesenseError)

      return res.status(500).json({ success: false, error: 'Error deleting video metadata', details: error.message })
    }

    return successResponse(res, {
      id: id,
      message: 'Video deleted'
    })
  } catch (error) {
    return errorResponse(res, 500, 'Internal server error')
  }
}
