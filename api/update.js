import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/apiHelpers.js'
import { getTypesenseClient, verifyVideoOwnership } from '../lib/typesenseClient.js'

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

  const now = Math.floor(Date.now() / 1000)

  // Merge user-provided fields into the update
  const updateDocument = {
    id: document.id,
    uid: document.uid,
    cid: document.cid,
    height: updateData.height !== undefined ? parseInt(updateData.height, 10) : document.height,
    width: updateData.width !== undefined ? parseInt(updateData.width, 10) : document.width,
    size: updateData.size !== undefined ? parseInt(updateData.size, 10) : document.size,
    duration: updateData.duration !== undefined ? parseInt(updateData.duration, 10) : document.duration,
    created: document.created,
    videoKey: document.videoKey,
    thumbnailKey: document.thumbnailKey,
    modified: now,
    active: updateData.active !== undefined ? updateData.active : document.active,
    length: document.length,
    ranking: document.ranking,
    title: updateData.title ?? document.title,
    description: updateData.description ?? document.description,
    category: updateData.category ?? document.category,
    company: updateData.company ?? document.company,
    tags: updateData.tags ?? document.tags,
    cpv: updateData.cpv !== undefined ? parseFloat(updateData.cpv) : document.cpv,
    budget: updateData.budget !== undefined ? parseFloat(updateData.budget) : document.budget
  }

  try {
    const typesenseClient = getTypesenseClient()
    const result = await typesenseClient
      .collections('videos')
      .documents(updateData.id)
      .update(updateDocument)

    return successResponse(res, {
      id: updateData.id,
      document: result,
      message: 'Video details updated successfully'
    })
  } catch (err) {
    return errorResponse(res, 500, 'Failed to update video metadata')
  }
}