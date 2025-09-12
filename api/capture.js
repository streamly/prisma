import Busboy from 'busboy'
import sharp from 'sharp'
import { authenticateUser } from '../lib/apiHelpers.js'
import { uploadThumbnail } from '../lib/s3Client.js'
import { verifyVideoOwnership } from '../lib/typesenseClient.js'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const MIN_COMPRESS_SIZE = 6 * 1024 // 6 KB
const TARGET_WIDTH = 300
const TARGET_HEIGHT = 169
const BUSBOY_TIMEOUT = 30000 // 30 seconds

export const config = {
  api: {
    bodyParser: false, // required for Busboy
  },
}

async function validateFile(fileBuffer, mimetype) {
  if (!['image/jpeg', 'image/jpg'].includes(mimetype)) {
    throw new Error('Only JPEG files are allowed')
  }
  if (!fileBuffer || fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum allowed size of 2 MB')
  }
  return true
}

async function resizeAndCompress(fileBuffer) {
  let quality = 100
  let outputBuffer = await sharp(fileBuffer)
    .resize({ width: TARGET_WIDTH, height: TARGET_HEIGHT, fit: 'cover' })
    .jpeg({ quality })
    .toBuffer()

  while (outputBuffer.length > MIN_COMPRESS_SIZE && quality > 10) {
    quality -= 10
    outputBuffer = await sharp(outputBuffer)
      .jpeg({ quality })
      .toBuffer()
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

  let uploadedFile = null
  let videoId = null
  let totalSize = 0
  let aborted = false

  const busboy = Busboy({ headers: req.headers })

  // Timeout in case upload hangs
  const timeout = setTimeout(() => {
    aborted = true
    return res.status(408).json({ error: 'Upload timed out' })
  }, BUSBOY_TIMEOUT)

  req.on('error', (err) => {
    aborted = true
    clearTimeout(timeout)
    console.error('Request stream error:', err)
    return res.status(500).json({ error: 'Request stream error', details: err.message })
  })

  busboy.on('file', (fieldname, file, info) => {
    if (fieldname !== 'file') {
      file.resume()
      return
    }

    const chunks = []
    const mimetype = info.mimeType

    file.on('data', (chunk) => {
      if (aborted) return

      totalSize += chunk.length
      if (totalSize > MAX_FILE_SIZE) {
        aborted = true
        file.resume() // stop reading
        clearTimeout(timeout)
        return res.status(400).json({ error: 'File exceeds 2 MB limit' })
      }

      chunks.push(chunk)
    })

    file.on('end', () => {
      if (!aborted) {
        uploadedFile = Buffer.concat(chunks)
        uploadedFile.mimetype = mimetype // store for validation
      }
    })

    file.on('error', (err) => {
      aborted = true
      clearTimeout(timeout)
      console.error('File stream error:', err)
      return res.status(500).json({ error: 'File stream error', details: err.message })
    })
  })

  busboy.on('field', (fieldname, val) => {
    if (fieldname === 'id') videoId = val
  })

  busboy.on('finish', async () => {
    clearTimeout(timeout)

    if (aborted) return
    if (!uploadedFile || !videoId) {
      return res.status(400).json({ error: 'Missing file or id field' })
    }

    try {
      await validateFile(uploadedFile, uploadedFile.mimetype)
    } catch (error) {
      return res.status(400).json({ error: error.message })
    }

    let document
    try {
      document = await verifyVideoOwnership(videoId, userId)
    } catch (error) {
      console.error('Video ownership error:', error)
      return res.status(403).json({ error: 'You do not have permission to access this video' })
    }

    if (!document) return res.status(404).json({ error: 'Video not found' })

    try {
      const finalBuffer = await resizeAndCompress(uploadedFile)
      await uploadThumbnail(document.id, finalBuffer, videoId)
    } catch (error) {
      console.error('S3 upload failed:', error)
      return res.status(500).json({ error: 'Failed to upload file', details: error.message })
    }

    return res.status(200).json({ success: true })
  })

  req.pipe(busboy)
}