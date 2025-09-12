import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, ListPartsCommand, PutObjectCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET
  },
  apiVersion: 'latest',
  forcePathStyle: true,
  endpoint: process.env.AWS_ENDPOINT
})

const VIDEO_BUCKET = process.env.AWS_BUCKET
const IMAGE_BUCKET = process.env.AWS_IMAGE_BUCKET

if (!VIDEO_BUCKET) {
  throw new Error('AWS_BUCKET environment variable is not set')
}


// Generate presigned URL for upload
export async function generateVideoUploadUrl(filename, contentType, userId, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: filename,
    ContentType: contentType,
    Metadata: {
      userId: userId
    }
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// Create multipart upload
export async function createMultipartUpload(filename, contentType, userId) {
  if (!VIDEO_BUCKET) {
    throw new Error('AWS_VIDEO_BUCKET environment variable is not set')
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: filename,
    ContentType: contentType,
    Metadata: {
      userId: userId
    }
  })

  const result = await s3Client.send(command)
  return {
    uploadId: result.UploadId,
    key: filename
  }
}

// Generate presigned URL for uploading a part
export async function generatePartUploadUrl(key, uploadId, partNumber, expiresIn = 3600) {
  const command = new UploadPartCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: parseInt(partNumber, 10)
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// Complete multipart upload
export async function completeMultipartUpload(key, uploadId, parts) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map(part => ({
        ETag: part.ETag,
        PartNumber: part.PartNumber
      }))
    }
  })

  const result = await s3Client.send(command)
  return {
    location: result.Location,
    key: key
  }
}

// List parts for multipart upload
export async function listParts(key, uploadId) {
  const command = new ListPartsCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId
  })

  const result = await s3Client.send(command)
  return (result.Parts || []).map(part => ({
    PartNumber: part.PartNumber,
    ETag: part.ETag,
    Size: part.Size
  }))
}

// Abort multipart upload
export async function abortMultipartUpload(key, uploadId) {
  const command = new AbortMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId
  })

  await s3Client.send(command)
}

export async function uploadToS3(key, buffer, contentType, metadata = {}) {
  try {
    const command = new PutObjectCommand({
      Bucket: VIDEO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata
    })

    const result = await s3Client.send(command)

    return {
      success: true,
      location: `${process.env.AWS_ENDPOINT}/${VIDEO_BUCKET}/${key}`,
      etag: result.ETag,
      key: key
    }
  } catch (error) {
    console.error('Error uploading to S3:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

export { VIDEO_BUCKET as BUCKET_NAME, s3Client }


export async function deleteVideo(videoKey) {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: videoKey
  })

  await s3Client.send(deleteCommand)
}