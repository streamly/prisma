import { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchVideoStats } from '../../lib/newRelic.js'
import { getAllBillingStatuses } from '../../lib/redisClient.js'
import { applyVideoUpdateRules } from '../../lib/typesenseClient.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        console.info("Starting NRQL job")

        // 1. Load billing status
        const billingStatus = await getAllBillingStatuses()
        console.info(
            `Loaded billing_status from Redis: ${Object.keys(billingStatus).length} entries`
        )

        // 2. Fetch video stats from New Relic
        const results = await fetchVideoStats()
        console.info(`Retrieved ${results.length} NRQL results from New Relic`)

        // 3. Apply update rules in Typesense
        const updated = await applyVideoUpdateRules(results, billingStatus)
        console.info(`Applied update rules → ${updated} videos updated in Typesense`)

        // 4. Done
        console.info("Job finished successfully")

        res.status(200).json({
            status: "ok",
            updated,
            total: results.length,
        })
    } catch (error: any) {
        console.error("Job failed:", error)
        res.status(500).json({
            error: "Cron failed",
            details: error.message,
        })
    }
}