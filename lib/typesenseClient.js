import md5 from 'md5'
import Typesense from 'typesense'

/**
 * Typesense Document Schema: "videos"
    [id] => string
    [uid] => string
    [size] => int32
    [height] => int32
    [width] => int32
    [duration] => int32
    [length] => string
    [title] => string
    [description] => string
    [tags] => string[]
    [ranking] => int32
    [channel] => string[]
    [audience] => string[]
    [category] => string[]
    [industry] => string[]
    [language] => string[]
    [cpv] => float
    [budget] => float
    [plan] => int32
    [created] => int32
    [modified] => int32
    [active] => int32
    [trusted] => int32
    [billing] => int32
    [score] => int32
    [cid] => int32
    [hash] => int32[]
    [trial] => int32
    [visibility] => int64
    [bid] => int32[]
    [company] => string
    [creator] => string[]
)
 */

const scopedKeyIncludedFields = [
  "id",
  "uid",
  "cid",
  "height",
  "width",
  "size",
  "duration",
  "length",
  "title",
  "description",
  "tags",
  "ranking",
  "channel",
  "audience",
  "category",
  "industry",
  "language",
  "cpv",
  "budget",
  "created",
  "modified",
  "active",
  "company",
  "creator"
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

    return result
  } catch (error) {
    throw error
  }
}


export async function createVideoDocument(document) {
  const now = getNow()

  return await typesenseClient.collections('videos').documents().create({
    ...document,
    created: now,
    modified: now,
    cid: 0,
    active: 0,
    length: '',
    ranking: 0
  })
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

