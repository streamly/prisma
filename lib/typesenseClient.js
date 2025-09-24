import md5 from 'md5'
import Typesense from 'typesense'
import { formatCustomerId, formatUserId } from './utils.js'

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
    [cid] => string
    [hash] => int32[]
    [trial] => int32
    [visibility] => int64
    [bid] => int32[]
    [company] => string
    [creator] => string[]
    [type] => string[]
    [people] => string[]
)
 */

const scopedKeyIncludedFields = [
  "id", "uid", "height", "width", "size", "duration", "length", "title", "description",
  "tags", "ranking", "channel", "audience", "category", "industry", "language", "cpv",
  "type", "budget", "created", "modified", "active", "company", "creator",
  "people"
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


export async function updateVideoModifiedDate(document) {
  try {
    const now = getNow()
    const result = await typesenseClient
      .collections('videos')
      .documents(document.id)
      .update({
        modified: now,
      })

    return result
  } catch (error) {
    console.error('Error updating video modified date:', error)
    throw error
  }
}

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  const parsed = Number(value)

  return isNaN(parsed) ? fallback : parsed
}

function parseArray(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback
  }

  return value
}


export async function updateVideoDocument(document, updateData, isUserBillingActive) {
  try {
    const now = getNow()
    const cpv = parseNumber(updateData.cpv, document.cpv || 0)
    const budget = parseNumber(updateData.budget, document.budget || 0)

    let score = 0

    if (cpv >= 0.05) {
      score = 123456 + (Math.round(cpv * 46976) * 8152256) + (Math.round(budget * 10) * 1391)
    }

    const ranking = isUserBillingActive ? score : 0

    console.log('Video document update data', updateData)

    const result = await typesenseClient
      .collections('videos')
      .documents(document.id)
      .update({
        title: updateData.title ?? document.title,
        description: updateData.description ?? document.description,
        type: parseArray(updateData.type, document.type),
        tags: parseArray(updateData.tags, document.tags),
        creator: parseArray(updateData.creator, document.creator),
        channel: parseArray(updateData.channel, document.channel),
        audience: parseArray(updateData.audience, document.audience),
        people: parseArray(updateData.people, document.people),
        ranking,
        score,
        cpv,
        budget,
        modified: now,
        active: 1,
        format: "VOD"
      })

    return result
  } catch (error) {
    console.error('Error updating video document:', error)

    throw error
  }
}


export async function createVideoDocument(data) {
  const now = getNow()

  console.log('Using data to create video document', data)

  return await typesenseClient.collections('videos').documents().create({
    id: data.id,
    width: data.width,
    height: data.height,
    duration: data.duration,
    size: data.size,
    uid: formatUserId(data.userId),
    cid: data.customerId ? formatCustomerId(data.customerId) : undefined,
    created: now,
    modified: now,
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


export async function findInactiveVideo(userId) {
  const uid = formatUserId(userId)

  try {
    const searchParams = {
      q: '*',
      query_by: 'title',
      filter_by: `uid:${uid} && active:=0`,
      sort_by: 'created:asc',
      per_page: 1
    }

    const result = await typesenseClient
      .collections('videos')
      .documents()
      .search(searchParams)

    if (result.hits.length === 0) {
      return undefined
    }

    return result.hits[0].document
  } catch (error) {
    console.error('Error finding inactive videos:', error)
    throw error
  }
}