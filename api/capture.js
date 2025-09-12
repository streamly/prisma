import Busboy from 'busboy'
import sharp from 'sharp'
import FileType from 'file-type'
import { authenticateUser } from '../lib/apiHelpers.js'
import { uploadThumbnail } from '../lib/s3Client.js'
import { verifyVideoOwnership } from '../lib/typesenseClient.js'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const MIN_COMPRESS_SIZE = 6 * 1024 // 6 KB
const TARGET_WIDTH = 300
const TARGET_HEIGHT = 169

export const config = {
  api: {
    bodyParser: false,
  },
}

async function validateFile(fileBuffer, mimeType) {
  const allowedTypes = ['image/jpeg', 'image/jpg']

  if (!allowedTypes.includes(mimeType)) {
    throw new Error('Only JPEG files are allowed')
  }

  if (!fileBuffer || fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum allowed size of 2 MB')
  }

  return true
}

async function resizeAndCompress(fileBuffer) {
  let outputBuffer = await sharp(fileBuffer)
    .resize({ width: TARGET_WIDTH, height: TARGET_HEIGHT, fit: 'cover' })
    .jpeg({ quality: 100 })
    .toBuffer()

  if (outputBuffer.length > MIN_COMPRESS_SIZE) {
    let quality = 80
    while (outputBuffer.length > MIN_COMPRESS_SIZE && quality > 10) {
      outputBuffer = await sharp(fileBuffer)
        .resize({ width: TARGET_WIDTH, height: TARGET_HEIGHT, fit: 'cover' })
        .jpeg({ quality })
        .toBuffer()
      quality -= 10
    }
  }

  return outputBuffer
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let userId
  try {
    userId = await authenticateUser(req)
  } catch (error) {
    return res.status(401).json({ error: 'Authentication error', details: error.message })
  }

  const busboy = Busboy({ headers: req.headers })
  let uploadedFile = null
  let uploadedMimeType = null
  let videoId = null
  let totalSize = 0
  let aborted = false

  busboy.on('file', (fieldname, file, info) => {
    if (fieldname !== 'file') {
      file.resume()
      return
    }

    const { mimeType } = info
    uploadedMimeType = mimeType

    const chunks = []
    file.on('data', (chunk) => {
      if (aborted) return

      totalSize += chunk.length
      if (totalSize > MAX_FILE_SIZE) {
        aborted = true
        file.pause()
        return
      }

      chunks.push(chunk)
    })

    file.on('end', () => {
      if (!aborted) {
        uploadedFile = Buffer.concat(chunks)
      }
    })
  })

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'id') {
      videoId = val
    }
  })

  busboy.on('finish', async () => {
    try {
      if (aborted) {
        return res.status(400).json({ error: 'File exceeds 2 MB limit' })
      }

      if (!uploadedFile || !videoId) {
        return res.status(400).json({ error: 'Missing file or id field' })
      }

      // Verify MIME type from buffer for extra safety
      const type = await FileType.fromBuffer(uploadedFile)
      const mimeTypeToCheck = type?.mime || uploadedMimeType

      try {
        await validateFile(uploadedFile, mimeTypeToCheck)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }

      // Verify ownership
      let document
      try {
        document = await verifyVideoOwnership(videoId, userId)
      } catch (error) {
        console.error('Video ownership error:', error)
        return res.status(403).json({ error: 'You do not have permission to access this video' })
      }

      if (!document) {
        return res.status(404).json({ error: 'Video not found' })
      }

      // Resize, compress, and upload
      try {
        const finalBuffer = await resizeAndCompress(uploadedFile)
        await uploadThumbnail(document.id, finalBuffer, videoId) // ensure S3 overwrites
      } catch (error) {
        console.error('S3 upload failed:', error)
        return res.status(500).json({ error: 'Failed to upload file', details: error.message })
      }

      return res.status(200).json({ success: true })
    } catch (finishError) {
      console.error('Unexpected error in Busboy finish:', finishError)
      return res.status(500).json({ error: 'Internal server error', details: finishError.message })
    }
  })

  req.pipe(busboy)
}