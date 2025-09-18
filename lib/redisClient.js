import { createClient } from 'redis'


const REDIS_URL = process.env.REDIS_URL

const redis = createClient({ url: REDIS_URL })
let isConnected = false

async function connectClient() {
  if (!isConnected) {
    await redis.connect()
    isConnected = true
  }
}

export async function setCustomerBillingStatus(updates) {
  await connectClient()

  await redis.hSet('billing_status', updates)
}