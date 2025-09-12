import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/apiHelpers.js'
import { updateVideoDocument, verifyVideoOwnership } from '../lib/typesenseClient.js'

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
    const result = await updateVideoDocument(document, {
      height: updateData.height !== undefined ? parseInt(updateData.height, 10) : document.height,
      width: updateData.width !== undefined ? parseInt(updateData.width, 10) : document.width,
      size: updateData.size !== undefined ? parseInt(updateData.size, 10) : document.size,
      duration: updateData.duration !== undefined ? parseInt(updateData.duration, 10) : document.duration,
      active: updateData.active !== undefined ? updateData.active : document.active,
      title: updateData.title ?? document.title,
      description: updateData.description ?? document.description,
      category: updateData.category ?? document.category,
      company: updateData.company ?? document.company,
      tags: updateData.tags ?? document.tags,
      cpv: updateData.cpv !== undefined ? parseFloat(updateData.cpv) : document.cpv,
      budget: updateData.budget !== undefined ? parseFloat(updateData.budget) : document.budget
    })

    return successResponse(res, {
      id: updateData.id,
      document: result,
      message: 'Video details updated successfully'
    })
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update video metadata')
  }
}