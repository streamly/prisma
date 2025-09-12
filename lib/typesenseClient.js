import md5 from 'md5'
import Typesense from 'typesense'

/**
 * Typesense Document Schema: "videos"
 *
 * Represents a video entry in the SyndiNet platform.
 *
 * Fields:
 *   id             (string)   - Unique identifier for the video (required)
 *   uid            (string)   - User ID of the uploader
 *   cid            (string)   - Company or channel ID
 *   height         (int)      - Video height in pixels
 *   width          (int)      - Video width in pixels
 *   size           (int)      - Video file size in bytes
 *   duration       (int)      - Video duration in seconds
 *   created        (int)      - Unix timestamp of when video was created
 *   videoKey       (string)   - Storage key for video file (e.g., S3 key)
 *   thumbnailKey   (string)   - Storage key for thumbnail image
 *   modified       (int)      - Unix timestamp of last modification
 *   active         (bool)     - Whether the video is currently active/published
 *   length         (int)      - Video length in seconds (optional, duplicate of duration)
 *   ranking        (float)    - Video ranking score for sorting/search
 *   title          (string)   - Video title
 *   description    (string)   - Video description
 *   category       (string)   - Video category/type
 *   company        (string[]) - List of associated companies
 *   tags           (string[]) - List of keywords/tags
 *   cpv            (float)    - Cost-per-view for performance campaigns
 *   budget         (float)    - Daily budget for performance campaigns
 *
 * Notes:
 * - Fields like `thumbnailKey` and `videoKey` should match the storage system keys (e.g., S3)
 * - Only fields included in a partial update will be changed; all others remain unchanged
 * - `id` is required for all updates and inserts
 */

const scopedKeyIncludedFields = [
  "id",
  "uid",
  "cid",
  "height",
  "width",
  "size",
  "duration",
  "created",
  "videoKey",
  "thumbnailKey",
  "modified",
  "active",
  "length",
  "ranking",
  "title",
  "description",
  "category",
  "company",
  "tags",
  "cpv",
  "budget"
]

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_KEY,
  connectionTimeoutSeconds: 2,
})

export function getTypesenseClient() {
  return typesenseClient
}


export async function generateScopedSearchKey(userId) {
  const scopedApiKey = await typesenseClient.keys().generateScopedSearchKey(
    process.env.TYPESENSE_SEARCH_KEY,
    {
      filter_by: `uid:${userId}`,
      include_fields: scopedKeyIncludedFields.join(','),
      expires_at: Math.floor(Date.now() / 1000) + 604800, // 1 week
    }
  )

  return scopedApiKey
}


// Verify video ownership
export async function verifyVideoOwnership(videoId, userId) {
  try {
    const document = await typesenseClient.collections('videos').documents(videoId).retrieve()

    if (document.uid !== md5(userId)) {
      throw new Error('You do not have permission to access this video')
    }

    return document
  } catch (error) {
    if (error.httpStatus === 404) {
      return undefined
    }

    throw error
  }
}


export async function deleteVideoDocument(id) {
  try {
    await typesenseClient.collections('videos').documents(id).delete()
    console.log(`Successfully deleted video metadata from Typesense: ${id}`)
  } catch (typesenseError) {
    console.error('Failed to delete from Typesense:', typesenseError)

    return res.status(500).json({ success: false, error: 'Error deleting video metadata', details: error.message })
  }
}


function getNow() {
  return Math.floor(Date.now() / 1000)
}


export async function updateVideoDocument(document, updateData) {
  try {
    const now = getNow()

    const updateDocument = {
      height: updateData.height !== undefined ? parseInt(updateData.height, 10) : document.height,
      width: updateData.width !== undefined ? parseInt(updateData.width, 10) : document.width,
      size: updateData.size !== undefined ? parseInt(updateData.size, 10) : document.size,
      duration: updateData.duration !== undefined ? parseInt(updateData.duration, 10) : document.duration,
      modified: now,
      active: updateData.active !== undefined ? updateData.active : document.active,
      title: updateData.title ?? document.title,
      description: updateData.description ?? document.description,
      category: updateData.category ?? document.category,
      company: updateData.company ?? document.company,
      tags: updateData.tags ?? document.tags,
      cpv: updateData.cpv !== undefined ? parseFloat(updateData.cpv) : document.cpv,
      budget: updateData.budget !== undefined ? parseFloat(updateData.budget) : document.budget,
      thumbnailKey: updateData.thumbnailKey ?? document.thumbnailKey,
      videoKey: updateData.videoKey ?? document.videoKey
    }

    const result = await typesenseClient.collections('videos').documents(document.id).update(updateDocument)

    console.log(`Updated video document: ${videoId}`)
    return result
  } catch (error) {
    console.error(`Failed to update video document ${videoId}:`, error)
    throw error
  }
}


export async function updateVideoThumbnail(videoId, newThumbnailKey) {
  try {
    const updatedDocument = await typesenseClient
      .collections('videos')
      .documents(videoId)
      .update({
        thumbnailKey: newThumbnailKey,
        modified: getNow()
      })

    console.log(`Updated thumbnailKey for video ${videoId} to ${newThumbnailKey}`)

    return updatedDocument
  } catch (error) {
    console.error(`Failed to update thumbnailKey for video ${videoId}:`, error)
    throw error
  }
}

