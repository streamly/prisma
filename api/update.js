import {
  authenticateUser,
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse,
  validateMethod,
  verifyVideoOwnership
} from '../lib/apiHelpers.js'
import { getTypesenseClient } from '../lib/typesenseClient.js'

export default async function handler(req, res) {
  setCorsHeaders(res)
  if (handleOptions(req, res)) return

  try {
    validateMethod(req, ['POST'])
  } catch {
    return errorResponse(res, 405, 'Method not allowed')
  }

  let userId
  try {
    userId = await authenticateUser(req)
  } catch {
    return errorResponse(res, 401, 'Authentication required')
  }

  const updateData = req.body
  if (!updateData.id) {
    return errorResponse(res, 400, 'Missing required field: id')
  }

  let existingDoc
  try {
    existingDoc = await verifyVideoOwnership(updateData.id, userId)
  } catch (err) {
    if (err.name === 'NotFoundError') {
      return errorResponse(res, 404, 'Video not found')
    }
    if (err.name === 'PermissionError') {
      return errorResponse(res, 403, 'Not allowed to update this video')
    }
    return errorResponse(res, 500, 'Failed to verify video ownership')
  }

  const now = Math.floor(Date.now() / 1000)

  // Merge user-provided fields into the update
  const updateDocument = {
    id: existingDoc.id,
    uid: existingDoc.uid,
    height: updateData.height !== undefined ? parseInt(updateData.height, 10) : existingDoc.height,
    width: updateData.width !== undefined ? parseInt(updateData.width, 10) : existingDoc.width,
    size: updateData.size !== undefined ? parseInt(updateData.size, 10) : existingDoc.size,
    duration: updateData.duration !== undefined ? parseInt(updateData.duration, 10) : existingDoc.duration,
    created: existingDoc.created,
    modified: now,
    active: updateData.active !== undefined ? updateData.active : existingDoc.active,
    ranking: existingDoc.ranking,
    title: updateData.title ?? existingDoc.title,
    description: updateData.description ?? existingDoc.description,
    category: updateData.category ?? existingDoc.category,
    company: updateData.company ?? existingDoc.company,
    tags: updateData.tags ?? existingDoc.tags,
    cpv: updateData.cpv !== undefined ? parseFloat(updateData.cpv) : existingDoc.cpv,
    budget: updateData.budget !== undefined ? parseFloat(updateData.budget) : existingDoc.budget
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
    if (err.httpStatus === 404) {
      return errorResponse(res, 404, 'Video not found in index')
    }
    if (err.httpStatus === 400) {
      return errorResponse(res, 400, 'Invalid video metadata')
    }
    return errorResponse(res, 500, 'Failed to update video metadata')
  }
}