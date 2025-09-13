import {
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/apiHelpers.js'
import { updateVideoDocument, verifyVideoOwnership } from '../lib/typesenseClient.js'
import { authenticateUser } from '../lib/clerkClient.js'

export default async function handler(req, res) {
  setCorsHeaders(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let userId

  try {
    userId = await authenticateUser(req)
  } catch (error) {
    return res.status(401).json({ error: 'Authentication error', details: error.message })
  }

  const updateData = req.body
  if (!updateData.id) {
    return errorResponse(res, 400, 'Missing required field: id')
  }

  let document
  try {
    document = await verifyVideoOwnership(updateData.id, userId)
  } catch (error) {
    console.error('Video ownership error:', error)
    return res.status(400).json({ error: 'You do not have permission to access this video', details: error.message })
  }

  if (!document) {
    return res.status(404).json({ error: 'Video not found' })
  }

  try {
    const result = await updateVideoDocument(document, updateData)

    return successResponse(res, {
      id: updateData.id,
      document: result,
      message: 'Video details updated successfully'
    })
  } catch (error) {
    console.error('Update route error:', error)
    return errorResponse(res, 500, 'Failed to update video metadata', error.message)
  }
}