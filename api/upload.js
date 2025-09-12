import md5 from 'md5'
import { authenticateUser } from '../lib/apiHelpers.js'
import {
    abortMultipartUpload,
    completeMultipartUpload,
    createMultipartUpload,
    generatePartUploadUrl,
    generateVideoUploadUrl,
    listParts
} from '../lib/s3Client.js'

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, X-User-Email')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        let userId
        try {
            userId = md5(authenticateUser(req))
        } catch (error) {
            return res.status(401).json({ error: error.message })
        }

        const { type } = req.query

        switch (type) {
            case 'getUploadParameters':
                return handleGetUploadParameters(req, res, userId)
            case 'createMultipartUpload':
                return handleCreateMultipartUpload(req, res, userId)
            case 'getUploadPartURL':
                return handleGetUploadPartURL(req, res, userId)
            case 'listParts':
                return handleListParts(req, res, userId)
            case 'completeMultipartUpload':
                return handleCompleteMultipartUpload(req, res, userId)
            case 'abortMultipartUpload':
                return handleAbortMultipartUpload(req, res, userId)
            default:
                return res.status(400).json({ error: 'Invalid request type' })
        }
    } catch (error) {
        console.error('Upload API error:', error)
        return res.status(500).json({ error: 'Server error processing upload request' })
    }
}

async function handleGetUploadParameters(req, res, userId) {
    try {
        const { contentType, key } = req.body

        if (!key || !contentType) {
            return res.status(400).json({ error: 'Missing key or contentType' })
        }

        const signedUrl = await generateVideoUploadUrl(key, contentType, userId)

        console.log('Generated presigned URL for single upload')
        return res.status(200).json({ url: signedUrl })
    } catch (error) {
        console.error('Error generating upload parameters:', error)
        return res.status(500).json({
            error: 'Failed to generate upload parameters',
            details: error.message
        })
    }
}

// Create a new multipart upload
async function handleCreateMultipartUpload(req, res, userId) {
    try {
        const { contentType, key } = req.body

        if (!key || !contentType) {
            return res.status(400).json({ error: 'Missing key or contentType' })
        }

        const result = await createMultipartUpload(key, contentType, userId)
        console.log('Multipart upload created with ID:', result.uploadId)

        return res.status(200).json(result)
    } catch (error) {
        console.error('Error creating multipart upload:', error)
        console.error('Error details:', error.message, error.code)
        return res.status(500).json({
            error: 'Failed to create multipart upload',
            details: error.message
        })
    }
}


async function handleGetUploadPartURL(req, res, userId) {
    try {
        const { uploadId, key, partNumber } = req.query

        if (!key || !partNumber) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key, partNumber: !!partNumber })
            return res.status(400).json({ error: 'Missing uploadId, key, or partNumber' })
        }

        const signedUrl = await generatePartUploadUrl(key, uploadId, partNumber)

        return res.status(200).json({ url: signedUrl })
    } catch (error) {
        console.error('Error generating upload part URL:', error)
        return res.status(500).json({
            error: 'Failed to generate upload URL',
            details: error.message
        })
    }
}

// Complete the multipart upload
async function handleCompleteMultipartUpload(req, res, userId) {
    try {
        const { uploadId, key, parts } = req.body

        console.log('Completing multipart upload for:', { uploadId, key, partsCount: parts?.length, userId })

        if (!uploadId || !key || !parts || !Array.isArray(parts)) {
            console.error('Missing or invalid parameters:', {
                uploadId: !!uploadId,
                key: !!key,
                parts: !!parts,
                isArray: Array.isArray(parts),
                partsLength: parts?.length
            })
            return res.status(400).json({ error: 'Missing uploadId, key, or parts array' })
        }

        const result = await completeMultipartUpload(key, uploadId, parts)

        console.log('Multipart upload completed successfully:', {
            Location: result.location,
            Key: result.key
        })

        return res.status(200).json(result)
    } catch (error) {
        console.error('Error completing multipart upload:', error)
        return res.status(500).json({
            error: 'Failed to complete upload',
            details: error.message
        })
    }
}

// List parts that have been uploaded
async function handleListParts(req, res, userId) {
    try {
        const { uploadId, key } = req.query

        console.log('Listing parts for:', { uploadId, key, userId })

        if (!uploadId || !key) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key })
            return res.status(400).json({ error: 'Missing uploadId or key' })
        }

        const parts = await listParts(key, uploadId)

        console.log('List parts result:', {
            partsCount: parts.length,
            parts: parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size }))
        })

        return res.status(200).json({ parts })
    } catch (error) {
        console.error('Error listing parts:', error)
        return res.status(500).json({
            error: 'Failed to list parts',
            details: error.message
        })
    }
}

// Abort the multipart upload
async function handleAbortMultipartUpload(req, res, userId) {
    try {
        const { uploadId, key } = req.body

        console.log('Aborting multipart upload for:', { uploadId, key, userId })

        if (!uploadId || !key) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key })
            return res.status(400).json({ error: 'Missing uploadId or key' })
        }

        await abortMultipartUpload(key, uploadId)

        console.log('Multipart upload aborted successfully')
        return res.status(200).json({ success: true })
    } catch (error) {
        console.error('Error aborting multipart upload:', error)
        return res.status(500).json({
            error: 'Failed to abort upload',
            details: error.message
        })
    }
}