import md5 from 'md5'
import Typesense from 'typesense'
import { formatCustomerId, formatUserId } from './utils.js'
import { MIN_CPV } from './consts.js'

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
  "people", "gated"
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


function computeMinBudget(cpv, durationSec) {
  if (!cpv || cpv <= 0) return 0
  const minutes = (Number(durationSec) || 0) / 60
  const plays = 10
  return Math.max(1, Math.ceil(cpv * minutes * plays))
}

export async function updateVideoDocument(document, updateData, isUserBillingActive) {
  try {
    const now = Math.floor(Date.now() / 1000)

    let cpv = Number.isFinite(updateData.cpv) ? Math.max(0, Number(updateData.cpv)) : 0
    let budget = Number.isFinite(updateData.budget) ? Math.max(0, Number(updateData.budget)) : 0
    let gated = Number(updateData.gated) === 1 ? 1 : 0

    const durationSec = Number(document.duration) || 0
    let minBudget = computeMinBudget(cpv, durationSec)

    if (cpv <= 0) {
      cpv = 0
      budget = 0
      gated = 0
    } else if (cpv < MIN_CPV) {
      if (gated === 1) {
        cpv = MIN_CPV
        minBudget = computeMinBudget(cpv, durationSec)
        if (budget < minBudget) budget = minBudget
      } else {
        cpv = 0
        budget = 0
        gated = 0
      }
    } else {
      if (budget < minBudget) {
        budget = minBudget
      }
    }

    let score = 0
    if (cpv >= MIN_CPV) {
      score =
        123456 +
        Math.round(cpv * 46976) * 8152256 +
        Math.round(budget * 10) * 1391
    }
    const ranking = isUserBillingActive ? score : 0

    const result = await typesenseClient
      .collections('videos')
      .documents(document.id)
      .update({
        title: updateData.title ?? document.title,
        description: updateData.description ?? document.description,
        type: Array.isArray(updateData.type) ? updateData.type : document.type,
        tags: Array.isArray(updateData.tags) ? updateData.tags : document.tags,
        creator: Array.isArray(updateData.creator) ? updateData.creator : document.creator,
        channel: Array.isArray(updateData.channel) ? updateData.channel : document.channel,
        audience: Array.isArray(updateData.audience) ? updateData.audience : document.audience,
        people: Array.isArray(updateData.people) ? updateData.people : document.people,
        ranking,
        score,
        cpv,
        budget,
        gated,
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