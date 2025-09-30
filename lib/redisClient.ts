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