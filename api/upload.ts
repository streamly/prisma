import { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateUser } from '../lib/clerkClient.js'
import {
    abortMultipartUpload,
    completeMultipartUpload,
    createMultipartUpload,
    generatePartUploadUrl,
    generateVideoUploadUrl,
    listParts,
} from '../lib/s3Client.js'
import { findInactiveVideo } from '../lib/typesenseClient.js'

// ----- Types -----
interface MultipartPart {
    ETag: string
    PartNumber: number
    Size?: number
}

interface MultipartResult {
    location: string
    key: string
}

interface UploadRequestBody {
    id?: string
    contentType?: string
    uploadId?: string
    parts?: MultipartPart[]
}

interface UploadRequestQuery {
    type?: string
    id?: string
    partNumber?: string
    uploadId?: string
}

// ----- Main Handler -----
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, X-User-Email')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    try {
        let userId: string
        try {
            userId = await authenticateUser(req)
        } catch (error: any) {
            return res.status(401).json({ error: 'Authentication error', details: error.message })
        }

        const { type } = req.query as UploadRequestQuery

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
    } catch (error: any) {
        console.error('Upload API error:', error)
        return res.status(500).json({ error: 'Server error processing upload request' })
    }
}

// ----- Handlers -----
async function handleGetUploadParameters(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const inactive = await findInactiveVideo(userId)
        if (inactive) {
            return res.status(409).json({
                error: 'Unactivated video exists',
                code: 'UNACTIVATED_VIDEO',
                details: { videoId: inactive.id },
            })
        }

        const { contentType, id } = req.body as UploadRequestBody
        if (!id || !contentType) {
            return res.status(400).json({ error: 'Missing id or contentType' })
        }

        const signedUrl = await generateVideoUploadUrl(id, contentType, userId)
        return res.status(200).json({ url: signedUrl })
    } catch (error: any) {
        console.error('Error generating upload parameters:', error)
        return res.status(500).json({ error: 'Failed to generate upload parameters', details: error.message })
    }
}

async function handleCreateMultipartUpload(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const inactive = await findInactiveVideo(userId)
        if (inactive) {
            return res.status(409).json({
                error: 'Unactivated video exists',
                code: 'UNACTIVATED_VIDEO',
                details: { videoId: inactive.id },
            })
        }

        const { contentType, id } = req.body as UploadRequestBody
        if (!id || !contentType) {
            return res.status(400).json({ error: 'Missing id or contentType' })
        }

        const result = await createMultipartUpload(id, contentType, userId)
        return res.status(200).json(result)
    } catch (error: any) {
        console.error('Error creating multipart upload:', error)
        return res.status(500).json({ error: 'Failed to create multipart upload', details: error.message })
    }
}

async function handleGetUploadPartURL(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const { uploadId, id, partNumber } = req.query as UploadRequestQuery
        if (!id || !uploadId || !partNumber) {
            return res.status(400).json({ error: 'Missing uploadId, id, or partNumber' })
        }

        // @ts-expect-error
        const signedUrl = await generatePartUploadUrl(id, uploadId, partNumber)
        return res.status(200).json({ url: signedUrl })
    } catch (error: any) {
        console.error('Error generating upload part URL:', error)
        return res.status(500).json({ error: 'Failed to generate upload URL', details: error.message })
    }
}

async function handleCompleteMultipartUpload(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const { uploadId, id, parts } = req.body as UploadRequestBody
        if (!uploadId || !id || !parts || !Array.isArray(parts)) {
            return res.status(400).json({ error: 'Missing uploadId, id, or parts array' })
        }

        // @ts-expect-error
        const result: MultipartResult = await completeMultipartUpload(id, uploadId, parts)
        return res.status(200).json(result)
    } catch (error: any) {
        console.error('Error completing multipart upload:', error)
        return res.status(500).json({ error: 'Failed to complete upload', details: error.message })
    }
}

async function handleListParts(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const { uploadId, id } = req.query as UploadRequestQuery
        if (!uploadId || !id) {
            return res.status(400).json({ error: 'Missing uploadId or id' })
        }

        const parts = await listParts(id, uploadId)
        return res.status(200).json({ parts })
    } catch (error: any) {
        console.error('Error listing parts:', error)
        return res.status(500).json({ error: 'Failed to list parts', details: error.message })
    }
}

async function handleAbortMultipartUpload(req: VercelRequest, res: VercelResponse, userId: string) {
    try {
        const { uploadId, id } = req.body as UploadRequestBody
        if (!uploadId || !id) {
            return res.status(400).json({ error: 'Missing uploadId or id' })
        }

        await abortMultipartUpload(id, uploadId)
        return res.status(200).json({ success: true })
    } catch (error: any) {
        console.error('Error aborting multipart upload:', error)
        return res.status(500).json({ error: 'Failed to abort upload', details: error.message })
    }
}