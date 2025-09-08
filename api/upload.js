import { createClerkClient, verifyToken } from '@clerk/backend';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Check required environment variables
if (!process.env.AWS_REGION || !process.env.AWS_KEY || !process.env.AWS_SECRET || !process.env.AWS_BUCKET) {
    console.error('Missing required environment variables:', {
        AWS_REGION: process.env.AWS_REGION,
        AWS_KEY: process.env.AWS_KEY,
        AWS_SECRET: process.env.AWS_SECRET,
        AWS_BUCKET: process.env.AWS_BUCKET
    });
}

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-west-1',
    credentials: {
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET
    },
    forcePathStyle: true,
    endpoint: process.env.AWS_ENDPOINT // For S3-compatible storage
});

// Bucket name from environment variables
const BUCKET_NAME = process.env.AWS_BUCKET;

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

    // Check if required environment variables are set
    if (!BUCKET_NAME) {
        console.error('AWS_BUCKET environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error: Missing S3 bucket name' });
    }

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

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: uploadKey,
            ContentType: contentType,
            Metadata: {
                userId: userId
            }
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

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

        // Use the key provided by Uppy or generate one
        const uploadKey = key || filename;

        console.log('Creating upload with key:', uploadKey, 'bucket:', BUCKET_NAME);

        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: uploadKey,
            ContentType: contentType,
            Metadata: {
                userId: userId
            }
        });

        const { UploadId } = await s3Client.send(command);

        console.log('Multipart upload created with ID:', UploadId);

        return res.status(200).json({
            uploadId: UploadId,
            key: uploadKey
        });
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

        const command = new UploadPartCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: parseInt(partNumber, 10)
        });

        console.log('Generating presigned URL with command:', {
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: parseInt(partNumber, 10)
        });

        // Generate a presigned URL that expires in 1 hour
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        console.log('Successfully generated presigned URL');
        return res.status(200).json({ url: signedUrl });
    } catch (error) {
        console.error('Error generating upload part URL:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            requestId: error.$metadata?.requestId
        });
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

        console.log('Parts to complete:', parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })));

        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(part => ({
                    ETag: part.ETag,
                    PartNumber: part.PartNumber
                }))
            }
        });

        console.log('Completing multipart upload with command:', {
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartsCount: parts.length
        });

        const result = await s3Client.send(command);

        console.log('Multipart upload completed successfully:', {
            Location: result.Location,
            ETag: result.ETag,
            Key: key
        });

        return res.status(200).json({
            location: result.Location,
            key: key
        });
    } catch (error) {
        console.error('Error completing multipart upload:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            requestId: error.$metadata?.requestId
        });
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

        const command = new ListPartsCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });

        console.log('Listing parts with command:', {
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });

        const result = await s3Client.send(command);

        console.log('List parts result:', {
            partsCount: result.Parts?.length || 0,
            parts: result.Parts?.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size }))
        });

        // Format the response to match what Uppy expects
        const parts = (result.Parts || []).map(part => ({
            PartNumber: part.PartNumber,
            ETag: part.ETag,
            Size: part.Size
        }));

        return res.status(200).json({ parts });
    } catch (error) {
        console.error('Error listing parts:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            requestId: error.$metadata?.requestId
        });
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

        const command = new AbortMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });

        console.log('Aborting multipart upload with command:', {
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId
        });

        await s3Client.send(command);

        console.log('Multipart upload aborted successfully');
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error aborting multipart upload:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            requestId: error.$metadata?.requestId
        });
        return res.status(500).json({
            error: 'Failed to abort upload',
            details: error.message
        });
    }
}
