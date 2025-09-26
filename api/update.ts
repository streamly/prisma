import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateUser, getClerkUser } from '../lib/clerkClient.js'
import { getCustomerBillingStatus } from '../lib/redisClient.js'
import {
  errorResponse,
  handleOptions,
  setCorsHeaders,
  successResponse
} from '../lib/responses.js'
import { updateVideoDocument, verifyVideoOwnership } from '../lib/typesenseClient.js'
import { validateUpdateVideoInput } from '../lib/validation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let userId

  try {
    userId = await authenticateUser(req)
  } catch (error: any) {
    return res.status(401).json({ error: 'Authentication error', details: error.message })
  }

  let data

  try {
    data = validateUpdateVideoInput(req.body)
  } catch (error: any) {
    console.error('Validation error', error)
    return res.status(400).json({ error: 'Invalid data', details: error.issues || undefined })
  }

  let document
  try {
    document = await verifyVideoOwnership(data.id, userId)
  } catch (error: any) {
    console.error('Video ownership error:', error)
    return res.status(400).json({ error: 'You do not have permission to access this video', details: error.message })
  }

  if (!document) {
    return res.status(404).json({ error: 'Video not found' })
  }

  try {
    const user = await getClerkUser(userId)
    const customerId = user.privateMetadata.customerId as string
    const isBillingActive = await getCustomerBillingStatus(customerId)
    const result = await updateVideoDocument(document, data, isBillingActive)

    console.log('Updated video document', result)

    return successResponse(res, {
      message: 'Video details updated successfully'
    })
  } catch (error: any) {
    console.error('Update route error:', error)
    return errorResponse(res, 500, 'Failed to update video metadata', error.message)
  }
}