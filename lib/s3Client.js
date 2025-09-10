import { S3Client, GetObjectCommand, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET
  },
  apiVersion: 'latest',
  forcePathStyle: true,
  endpoint: process.env.AWS_ENDPOINT
});

const BUCKET_NAME = process.env.AWS_BUCKET;

// Generate presigned URL for video access with long expiration
export async function generatePresignedUrl(filename, expiresIn = 86400) { // 24 hours default
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Generate presigned URL for upload
export async function generateUploadUrl(filename, contentType, userId, expiresIn = 3600) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    ContentType: contentType,
    Metadata: {
      userId: userId
    }
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Create multipart upload
export async function createMultipartUpload(filename, contentType, userId) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: filename,
    ContentType: contentType,
    Metadata: {
      userId: userId
    }
  });

  const result = await s3Client.send(command);
  return {
    uploadId: result.UploadId,
    key: filename
  };
}

// Generate presigned URL for uploading a part
export async function generatePartUploadUrl(key, uploadId, partNumber, expiresIn = 3600) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: parseInt(partNumber, 10)
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Complete multipart upload
export async function completeMultipartUpload(key, uploadId, parts) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

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

  const result = await s3Client.send(command);
  return {
    location: result.Location,
    key: key
  };
}

// List parts for multipart upload
export async function listParts(key, uploadId) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new ListPartsCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId
  });

  const result = await s3Client.send(command);
  return (result.Parts || []).map(part => ({
    PartNumber: part.PartNumber,
    ETag: part.ETag,
    Size: part.Size
  }));
}

// Abort multipart upload
export async function abortMultipartUpload(key, uploadId) {
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId
  });

  await s3Client.send(command);
}

export { s3Client, BUCKET_NAME };
