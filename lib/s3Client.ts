import { AbortMultipartUploadCommand, CompletedPart, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, ListPartsCommand, ListPartsCommandOutput, PutObjectCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_KEY!,
    secretAccessKey: process.env.AWS_SECRET!
  },
  apiVersion: 'latest',
  forcePathStyle: true,
  endpoint: process.env.AWS_ENDPOINT!
})

const VIDEO_BUCKET = process.env.AWS_BUCKET!
const IMAGE_BUCKET = process.env.AWS_IMAGE_BUCKET!

if (!VIDEO_BUCKET) {
  throw new Error('AWS_BUCKET environment variable is not set')
}


// ---------- Single upload ----------

export async function generateVideoUploadUrl(
  filename: string,
  contentType: string,
  userId: string,
  expiresIn = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: filename,
    ContentType: contentType,
    Metadata: { userId }
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

// ---------- Multipart upload ----------

export async function createMultipartUpload(
  filename: string,
  contentType: string,
  userId: string
): Promise<{ uploadId: string; key: string }> {
  const command = new CreateMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: filename,
    ContentType: contentType,
    Metadata: { userId }
  })

  const result = await s3Client.send(command)

  if (!result.UploadId) {
    throw new Error('Multipart upload creation failed: no UploadId returned')
  }

  return { uploadId: result.UploadId, key: filename }
}

export async function generatePartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  const command = new UploadPartCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber
  })

  return getSignedUrl(s3Client, command, { expiresIn })
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<{ location?: string; key: string }> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts }
  })

  const result = await s3Client.send(command)
  return { location: result.Location, key }
}

export async function listParts(
  key: string,
  uploadId: string
): Promise<CompletedPart[]> {
  const command = new ListPartsCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId
  })

  const result: ListPartsCommandOutput = await s3Client.send(command)

  return (result.Parts || []).map((part) => ({
    PartNumber: part.PartNumber!,
    ETag: part.ETag!,
  }))
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    UploadId: uploadId
  })
  await s3Client.send(command)
}

// ---------- Thumbnails ----------

export async function uploadThumbnail(
  videoId: string,
  buffer: Buffer
): Promise<boolean> {
  try {
    const command = new PutObjectCommand({
      Bucket: IMAGE_BUCKET,
      Key: videoId,
      Body: buffer,
      ContentType: 'image/jpeg',
    })

    await s3Client.send(command)
    return true
  } catch (error) {
    console.error('Error uploading to S3:', error)
    throw error
  }
}

export async function deleteThumbnail(videoId: string): Promise<void> {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: IMAGE_BUCKET,
    Key: videoId,
  })
  await s3Client.send(deleteCommand)
}

export async function deleteVideo(videoKey: string): Promise<void> {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: videoKey,
  })
  await s3Client.send(deleteCommand)
}