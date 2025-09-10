import { createClerkClient, verifyToken } from '@clerk/backend';
import { 
  generateUploadUrl, 
  createMultipartUpload, 
  generatePartUploadUrl, 
  completeMultipartUpload, 
  listParts, 
  abortMultipartUpload 
} from '../lib/s3Client.js';

// Check required environment variables
if (!process.env.AWS_REGION || !process.env.AWS_KEY || !process.env.AWS_SECRET || !process.env.AWS_BUCKET) {
    console.error('Missing required environment variables:', {
        AWS_REGION: process.env.AWS_REGION,
        AWS_KEY: process.env.AWS_KEY,
        AWS_SECRET: process.env.AWS_SECRET
    });
}

// S3 client and bucket are now handled by the shared lib

// Initialize Clerk client
const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_API_SECRET,
});

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization, X-User-Email');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Environment variables are checked by the shared S3 client

    try {
        // Authenticate the request
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication token required' });
        }

        // Verify the token with Clerk
        let userId;
        try {
            const payload = await verifyToken(token, {
                secretKey: process.env.CLERK_API_SECRET,
            });

            if (!payload || !payload.sub) {
                console.error('Token verification failed: Invalid payload');
                return res.status(401).json({ error: 'Invalid authentication token' });
            }

            userId = payload.sub;
            console.log('Token verification successful for user:', userId);
        } catch (error) {
            console.error('Token verification failed:', error.message);
            return res.status(401).json({ error: 'Invalid authentication token' });
        }

        // Handle different Uppy S3 Multipart requests
        const { query } = req;
        const { type } = query;

        switch (type) {
            case 'getUploadParameters':
                return handleGetUploadParameters(req, res, userId);
            case 'createMultipartUpload':
                return handleCreateMultipartUpload(req, res, userId);
            case 'getUploadPartURL':
                return handleGetUploadPartURL(req, res, userId);
            case 'listParts':
                return handleListParts(req, res, userId);
            case 'completeMultipartUpload':
                return handleCompleteMultipartUpload(req, res, userId);
            case 'abortMultipartUpload':
                return handleAbortMultipartUpload(req, res, userId);
            default:
                return res.status(400).json({ error: 'Invalid request type' });
        }
    } catch (error) {
        console.error('Upload API error:', error);
        return res.status(500).json({ error: 'Server error processing upload request' });
    }
}

// Generate presigned URL for single file upload (non-multipart)
async function handleGetUploadParameters(req, res, userId) {
    try {
        const { filename, contentType, key } = req.body;

        console.log('Getting upload parameters for:', { filename, contentType, key, userId });

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'Missing filename or contentType' });
        }

        const uploadKey = key || filename;
        const signedUrl = await generateUploadUrl(uploadKey, contentType, userId);

        console.log('Generated presigned URL for single upload');
        return res.status(200).json({ url: signedUrl });
    } catch (error) {
        console.error('Error generating upload parameters:', error);
        return res.status(500).json({
            error: 'Failed to generate upload parameters',
            details: error.message
        });
    }
}

// Create a new multipart upload
async function handleCreateMultipartUpload(req, res, userId) {
    try {
        console.log('Creating multipart upload for user:', userId);
        console.log('Request body:', req.body);

        const { filename, contentType, key } = req.body;

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'Missing filename or contentType' });
        }

        const uploadKey = key || filename;
        console.log('Creating upload with key:', uploadKey);

        const result = await createMultipartUpload(uploadKey, contentType, userId);
        console.log('Multipart upload created with ID:', result.uploadId);

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error creating multipart upload:', error);
        console.error('Error details:', error.message, error.code);
        return res.status(500).json({
            error: 'Failed to create multipart upload',
            details: error.message
        });
    }
}

// Generate presigned URL for uploading a part
async function handleGetUploadPartURL(req, res, userId) {
    try {
        const { uploadId, key, partNumber } = req.query;

        console.log('Getting upload part URL for:', { uploadId, key, partNumber, userId });

        if (!uploadId || !key || !partNumber) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key, partNumber: !!partNumber });
            return res.status(400).json({ error: 'Missing uploadId, key, or partNumber' });
        }

        const signedUrl = await generatePartUploadUrl(key, uploadId, partNumber);

        console.log('Successfully generated presigned URL');
        return res.status(200).json({ url: signedUrl });
    } catch (error) {
        console.error('Error generating upload part URL:', error);
        return res.status(500).json({
            error: 'Failed to generate upload URL',
            details: error.message
        });
    }
}

// Complete the multipart upload
async function handleCompleteMultipartUpload(req, res, userId) {
    try {
        const { uploadId, key, parts } = req.body;

        console.log('Completing multipart upload for:', { uploadId, key, partsCount: parts?.length, userId });

        if (!uploadId || !key || !parts || !Array.isArray(parts)) {
            console.error('Missing or invalid parameters:', {
                uploadId: !!uploadId,
                key: !!key,
                parts: !!parts,
                isArray: Array.isArray(parts),
                partsLength: parts?.length
            });
            return res.status(400).json({ error: 'Missing uploadId, key, or parts array' });
        }

        const result = await completeMultipartUpload(key, uploadId, parts);

        console.log('Multipart upload completed successfully:', {
            Location: result.location,
            Key: result.key
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error completing multipart upload:', error);
        return res.status(500).json({
            error: 'Failed to complete upload',
            details: error.message
        });
    }
}

// List parts that have been uploaded
async function handleListParts(req, res, userId) {
    try {
        const { uploadId, key } = req.query;

        console.log('Listing parts for:', { uploadId, key, userId });

        if (!uploadId || !key) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key });
            return res.status(400).json({ error: 'Missing uploadId or key' });
        }

        const parts = await listParts(key, uploadId);

        console.log('List parts result:', {
            partsCount: parts.length,
            parts: parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size }))
        });

        return res.status(200).json({ parts });
    } catch (error) {
        console.error('Error listing parts:', error);
        return res.status(500).json({
            error: 'Failed to list parts',
            details: error.message
        });
    }
}

// Abort the multipart upload
async function handleAbortMultipartUpload(req, res, userId) {
    try {
        const { uploadId, key } = req.body;

        console.log('Aborting multipart upload for:', { uploadId, key, userId });

        if (!uploadId || !key) {
            console.error('Missing required parameters:', { uploadId: !!uploadId, key: !!key });
            return res.status(400).json({ error: 'Missing uploadId or key' });
        }

        await abortMultipartUpload(key, uploadId);

        console.log('Multipart upload aborted successfully');
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error aborting multipart upload:', error);
        return res.status(500).json({
            error: 'Failed to abort upload',
            details: error.message
        });
    }
}
