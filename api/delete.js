import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse,
  validateMethod
} from '../lib/apiHelpers.js'
import { deleteVideoDocument, verifyVideoOwnership } from '../lib/typesenseClient.js'
import { deleteVideo } from '../lib/s3Client.js'

export default async function handler(req, res) {
  setCorsHeaders(res)

  if (handleOptions(req, res)) {
    return
  }

  validateMethod(req, ['POST'])
  const userId = await authenticateUser(req)

  const { id } = req.body

  if (!id) {
    return errorResponse(res, 400, 'Missing required field: id')
  }

  try {
    const document = await verifyVideoOwnership(id, userId)

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
    console.error('Delete API error:', error)
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message)
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message)
    }
    return errorResponse(res, 500, 'Internal server error')
  }
}
