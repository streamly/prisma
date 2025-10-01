import { VercelRequest, VercelResponse } from "@vercel/node"
import { fetchConversions } from '../../lib/newRelic.js'
import { getAllBillingStatuses, saveConversions } from "../../lib/redisClient.js"


export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("Starting conversions cron")

  try {
    const billingStatuses = await getAllBillingStatuses()
    console.log("Fetched billing statuses:", Object.keys(billingStatuses).length)

    const results = await fetchConversions()
    console.log(`Fetched ${results.length} conversion facets`)


    const inserted = await saveConversions(results)
    console.log(`Saved conversions for ${inserted} users into Redis`)

    return res.status(200).json({ success: true, inserted })
  } catch (err: any) {
    console.error("Conversions cron failed:", err.message)
    return res.status(500).json({ error: err.message })
  }
}