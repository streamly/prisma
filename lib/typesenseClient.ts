import Typesense from "typesense"
import { SearchResponse } from 'typesense/lib/Typesense/Documents.js'
import { MIN_CPV } from "./consts.js"
import { formatCustomerId, formatUserId } from "./utils.js"

/*
Videos Collection Schema
------------------------
  uid: string
  size: int32
  height: int32
  width: int32
  duration: int32
  length: string
  title: string
  description: string
  tags: string[]
  ranking: int32
  channel: string[]
  audience: string[]
  category: string[]
  industry: string[]
  language: string[]
  cpv: float
  budget: float
  plan: int32
  created: int32
  modified: int32
  active: int32
  trusted: int32
  billing: int32
  score: int32
  hash: int32[]
  trial: int32
  visibility: int64
  bid: int32[]
  company: string
  creator: string[]
  format: string
  type: string[]
  cid: string
  people: string[]
  gated: int32
  contact: int32
  topic: string[]
*/


// ----------------------
// Types
// ----------------------
export interface VideoDocument {
  id: string
  uid: string
  size?: number
  height?: number
  width?: number
  duration?: number
  length?: string
  title?: string
  description?: string
  tags?: string[]
  ranking?: number
  channel?: string[]
  audience?: string[]
  category?: string[]
  industry?: string[]
  language?: string[]
  cpv?: number
  budget?: number
  plan?: number
  created?: number
  modified?: number
  active?: number
  trusted?: number
  billing?: number
  score?: number
  cid?: string
  hash?: number[]
  trial?: number
  visibility?: number
  bid?: number[]
  company?: string
  creator?: string[]
  type?: string[]
  people?: string[]
  format?: string
  gated?: number
  thumbnailKey?: string
  topic?: string[]
}

export interface UpdateVideoData {
  title?: string
  description?: string
  type?: string[]
  tags?: string[]
  creator?: string[]
  channel?: string[]
  audience?: string[]
  people?: string[]
  topic?: string[]
  cpv?: number
  budget?: number
  gated?: number
}

// ----------------------
// Client
// ----------------------
const scopedKeyIncludedFields: (keyof VideoDocument)[] = [
  "id",
  "uid",
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
  "type",
  "budget",
  "created",
  "modified",
  "active",
  "company",
  "creator",
  "people",
  "gated",
  "topic"
]

const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST as string,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_KEY as string,
  connectionTimeoutSeconds: 2,
})

// ----------------------
// Keys
// ----------------------
export async function generateScopedSearchKey(userId: string): Promise<string> {
  const scopedApiKey = typesenseClient.keys().generateScopedSearchKey(
    process.env.TYPESENSE_SEARCH_KEY as string,
    {
      filter_by: `uid:${userId}`,
      include_fields: scopedKeyIncludedFields.join(","),
      expires_at: Math.floor(Date.now() / 1000) + 604800, // 1 week
    }
  )

  return scopedApiKey
}

// ----------------------
// Ownership
// ----------------------
export async function verifyVideoOwnership(
  videoId: string,
  userId: string
): Promise<VideoDocument | undefined> {
  try {
    const document = (await typesenseClient
      .collections<VideoDocument>("videos")
      .documents(videoId)
      .retrieve()) as VideoDocument

    if (document.uid !== formatUserId(userId)) {
      throw new Error("You do not have permission to access this video")
    }

    return document
  } catch (error: any) {
    if (error.httpStatus === 404) {
      return undefined
    }

    throw error
  }
}

// ----------------------
// Delete
// ----------------------
export async function deleteVideoDocument(id: string): Promise<void> {
  try {
    await typesenseClient.collections("videos").documents(id).delete()
    console.log(`Successfully deleted video metadata from Typesense: ${id}`)
  } catch (err) {
    console.error("Failed to delete from Typesense:", err)
    throw err
  }
}

// ----------------------
// Helpers
// ----------------------
function getNow(): number {
  return Math.floor(Date.now() / 1000)
}

function computeMinBudget(cpv: number, durationSec: number): number {
  if (!cpv || cpv <= 0) return 0
  const minutes = (Number(durationSec) || 0) / 60
  const plays = 10
  return Math.max(1, Math.ceil(cpv * minutes * plays))
}

export function computeScoreAndRanking(
  cpv: number,
  budget: number,
  durationSec: number,
  isUserBillingActive: boolean,
  gated: number
): { cpv: number; budget: number; score: number; ranking: number; gated: number } {
  if (!cpv || cpv <= 0) {
    return { cpv: 0, budget: 0, score: 0, ranking: 0, gated: 0 }
  }

  if (cpv < MIN_CPV) {
    if (gated === 1) {
      cpv = MIN_CPV
      const minBudget = computeMinBudget(cpv, durationSec)
      if (budget < minBudget) budget = minBudget
    } else {
      return { cpv: 0, budget: 0, score: 0, ranking: 0, gated: 0 }
    }
  } else {
    const minBudget = computeMinBudget(cpv, durationSec)
    if (budget < minBudget) budget = minBudget
  }

  const score =
    123456 +
    Math.round(cpv * 46976) * 8152256 +
    Math.round(budget * 10) * 1391

  const ranking = isUserBillingActive ? score : 0

  return { cpv, budget, score, ranking, gated }
}

// ----------------------
// Update video doc
// ----------------------
export async function updateVideoModifiedDate(
  document: VideoDocument
): Promise<VideoDocument> {
  const now = getNow()
  const result = (await typesenseClient
    .collections<VideoDocument>("videos")
    .documents(document.id)
    .update({
      modified: now,
    })) as VideoDocument

  return result
}

export async function updateVideoDocument(
  document: VideoDocument,
  updateData: UpdateVideoData,
  isUserBillingActive: boolean
): Promise<VideoDocument> {
  const now = getNow()

  let cpv = Number.isFinite(updateData.cpv) ? Math.max(0, Number(updateData.cpv)) : 0
  let budget = Number.isFinite(updateData.budget) ? Math.max(0, Number(updateData.budget)) : 0
  let gated = Number(updateData.gated) === 1 ? 1 : 0
  const durationSec = Number(document.duration) || 0

  const { cpv: newCpv, budget: newBudget, score, ranking } =
    computeScoreAndRanking(cpv, budget, durationSec, isUserBillingActive, gated)

  const result = (await typesenseClient
    .collections<VideoDocument>("videos")
    .documents(document.id)
    .update({
      title: updateData.title ?? document.title,
      description: updateData.description ?? document.description,
      type: updateData.type ?? document.type,
      tags: updateData.tags ?? document.tags,
      creator: updateData.creator ?? document.creator,
      channel: updateData.channel ?? document.channel,
      audience: updateData.audience ?? document.audience,
      people: updateData.people ?? document.people,
      topic: updateData.topic ?? document.topic,
      ranking,
      score,
      cpv: newCpv,
      budget: newBudget,
      gated,
      modified: now,
      active: 1,
      format: "Video on Demand",
    })) as VideoDocument

  return result
}

// ----------------------
// Create
// ----------------------
export async function createVideoDocument(data: {
  id: string
  width?: number
  height?: number
  duration?: number
  size?: number
  userId: string
  customerId?: string
}): Promise<VideoDocument> {
  const now = getNow()

  console.log("Using data to create video document", data)

  return (await typesenseClient
    .collections<VideoDocument>("videos")
    .documents()
    .create({
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
      length: "",
      ranking: 0,
    })) as VideoDocument
}

// ----------------------
// Thumbnail
// ----------------------
export async function updateVideoThumbnail(
  videoId: string,
  newThumbnailKey: string
): Promise<VideoDocument> {
  const updatedDocument = (await typesenseClient
    .collections<VideoDocument>("videos")
    .documents(videoId)
    .update({
      thumbnailKey: newThumbnailKey,
      modified: getNow(),
    })) as VideoDocument

  console.log(`Updated thumbnailKey for video ${videoId} to ${newThumbnailKey}`)

  return updatedDocument
}

// ----------------------
// Find inactive video
// ----------------------
export async function findInactiveVideo(
  userId: string
): Promise<VideoDocument | undefined> {
  const uid = formatUserId(userId)

  try {
    const searchParams = {
      q: "*",
      query_by: "title",
      filter_by: `uid:${uid} && active:=0`,
      sort_by: "created:asc",
      per_page: 1,
    }

    const result: SearchResponse<VideoDocument> = await typesenseClient
      .collections<VideoDocument>("videos")
      .documents()
      .search(searchParams)

    if (result?.hits?.length === 0) {
      return undefined
    }

    // @ts-expect-error
    return result.hits[0].document
  } catch (error) {
    console.error("Error finding inactive videos:", error)
    throw error
  }
}


/**
 * Apply business rules and batch update videos in Typesense
 */
export async function applyVideoUpdateRules(
  results: any[],
  billingStatus: Record<string, string>
): Promise<number> {
  const nowTs = Math.floor(Date.now() / 1000)
  const todayYMD = new Date().toISOString().slice(0, 10)

  const updates: { id: string;[k: string]: any }[] = []

  for (const r of results) {
    const vid = r.vid
    const ranking = parseInt(r.ranking ?? 0, 10)
    const score = parseInt(r.score ?? 0, 10)
    const visibility = parseInt(r.visibility ?? 0, 10)
    const costs = parseFloat(r.costs ?? 0)
    const cpv = parseFloat(r.cpv ?? 0)
    const budget = parseFloat(r.budget ?? 0)
    const billing = parseInt(billingStatus[vid] ?? 0, 10)

    const visDateYMD = visibility
      ? new Date(visibility * 1000).toISOString().slice(0, 10)
      : null

    if (ranking > 0 && billing === 0) {
      updates.push({ id: vid, ranking: 0, visibility: nowTs })
    } else if (ranking === 0 && billing === 1) {
      updates.push({ id: vid, ranking: score, visibility: nowTs })
    } else if (ranking > 0 && costs >= budget) {
      updates.push({ id: vid, ranking: 0, visibility: nowTs })
    } else if (
      billing === 1 &&
      ranking === 0 &&
      cpv > 0 &&
      budget > 0 &&
      visDateYMD !== todayYMD
    ) {
      updates.push({ id: vid, ranking: score, visibility: nowTs })
    }
  }

  if (updates.length > 0) {
    await typesenseClient
      .collections("videos")
      .documents()
      .import(updates, { action: "update" })
  }

  return updates.length
}


export async function findVideosNeedingRanking(todayYYMMDD: string) {
  const searchResults = await typesenseClient
    .collections<VideoDocument>("videos")
    .documents()
    .search({
      q: "*",
      query_by: "title",
      filter_by: `score:>0 && ranking:=0 && visibility:!=${todayYYMMDD}`,
      per_page: 100,
      include_fields: "id,score"
    })

  return searchResults.hits?.map((hit: any) => hit.document) || []
}

export async function updateVideoRanking(id: string, score: number) {
  return typesenseClient.collections("videos").documents(id).update({
    ranking: score
  })
}