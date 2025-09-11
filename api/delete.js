import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import {
  authenticateUser,
  errorResponse,
  getS3Config,
  handleOptions,
  setCorsHeaders,
  successResponse,
  validateMethod,
  verifyVideoOwnership
} from '../lib/apiHelpers.js'
import { getTypesenseClient } from '../lib/typesenseClient.js'

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
    await verifyVideoOwnership(id, userId)
    const { client: s3Client, bucketName } = getS3Config()
    const typesenseClient = getTypesenseClient()

    let deletionErrors = []

    // Delete from S3 storage bucket
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: id
      })

      await s3Client.send(deleteCommand)
    } catch (error) {
      console.error(error)

      return res.status(500).json({ success: false, error: 'Error deleting video file', details: error.message })
    }

    // Delete from Typesense collection
    try {
      await typesenseClient.collections('videos').documents(id).delete()
      console.log(`Successfully deleted video metadata from Typesense: ${id}`)
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
