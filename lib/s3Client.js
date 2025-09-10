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

// Get S3 client and bucket name
export function getS3Config() {
  return {
    client: s3Client,
    bucketName: BUCKET_NAME
  };
}

// Generate presigned URL for video access with long expiration
export async function generatePresignedUrl(filename, expiresIn = 604800) { // 7 days default
  if (!BUCKET_NAME) {
    throw new Error('AWS_BUCKET environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: filename
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

// Generate presigned URL for video by video ID (with ownership check)
export async function generateVideoPresignedUrl(videoId, userId, typesenseClient, expiresIn = 604800) {
  try {
    // Get video data from Typesense to find the filename
    const searchResult = await typesenseClient.collections('videos').documents(videoId).retrieve();
    
    if (!searchResult || !searchResult.filename) {
      throw new Error('Video not found or missing filename');
    }
    
    // Check if user owns this video
    if (searchResult.uid !== userId) {
      throw new Error('Access denied - you do not own this video');
    }
    
    // Generate presigned URL for video access
    return await generatePresignedUrl(searchResult.filename, expiresIn);
  } catch (error) {
    throw error;
  }
}

// Generate presigned URL for thumbnail by video ID (with ownership check)
export async function generateThumbnailPresignedUrl(videoId, userId, typesenseClient, expiresIn = 604800) {
  try {
    // Get video data from Typesense to find the thumbnail filename
    const searchResult = await typesenseClient.collections('videos').documents(videoId).retrieve();
    
    if (!searchResult || !searchResult.thumbnail) {
      throw new Error('Thumbnail not found');
    }
    
    // Check if user owns this video
    if (searchResult.uid !== userId) {
      throw new Error('Access denied - you do not own this video');
    }
    
    // Generate presigned URL for thumbnail access
    return await generatePresignedUrl(searchResult.thumbnail, expiresIn);
  } catch (error) {
    throw error;
  }
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

// Upload file directly to S3
export async function uploadToS3(key, buffer, contentType, metadata = {}) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata
    });

    const result = await s3Client.send(command);
    
    return {
      success: true,
      location: `https://${BUCKET_NAME}.${AWS_ENDPOINT}/${key}`,
      etag: result.ETag,
      key: key
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export { s3Client, BUCKET_NAME, generatePresignedUrl, generateVideoPresignedUrl, generateThumbnailPresignedUrl, createMultipartUpload, getUploadPartUrl, completeMultipartUpload, abortMultipartUpload, listParts, uploadToS3 };
