import { createClient } from "redis"

const REDIS_URL = process.env.REDIS_URL!
const redis = createClient({ url: REDIS_URL })
let isConnected = false

async function connectClient() {
  if (!isConnected) {
    await redis.connect()
    isConnected = true
  }
}

export async function setCustomersBillingStatus(updates: Record<string, string>) {
  await connectClient()

  await redis.hSet("billing_status", updates)
}

export async function getCustomerBillingStatus(customerId: string) {
  await connectClient()

  const value = await redis.hGet("billing_status", customerId)

  return value === "1"
}

export async function getAllBillingStatuses() {
  await connectClient()

  return redis.hGetAll("billing_status")
}

export async function saveConversions(results: Array<any>) {
  await connectClient()

  if (!results || results.length === 0) {
    console.log("No conversions to save")
    return 0
  }

  const pipeline = redis.multi()
  const userSet = new Set<string>()

  for (const row of results) {
    try {
      const uid = row.uid || "unknown"
      const guid = row.guid
      const values = row.values || []

      if (!guid) {
        console.warn("Skipping conversion without guid:", row)
        continue
      }

      userSet.add(uid)
      const redisKey = `conversions:${uid}`

      pipeline.hSet(redisKey, guid, JSON.stringify(values))
    } catch (err) {
      console.error("Error building Redis command:", err)
    }
  }

  try {
    const execResults = await pipeline.exec()

    // @ts-expect-error
    const failed = execResults?.filter((r) => r && r[0] !== null)
    if (failed && failed.length > 0) {
      console.error("Some Redis commands failed:", failed)
      throw new Error(`${failed.length} Redis commands failed`)
    }

    console.log(`Successfully saved ${userSet.size} user conversions`)
    return userSet.size
  } catch (err: any) {
    console.error("Redis pipeline failed:", err)
    throw new Error(`Redis pipeline error: ${err.message}`)
  }
}