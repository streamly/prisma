import { VercelRequest, VercelResponse } from '@vercel/node'
import { getLowBalanceCustomers } from "../../lib/db/billing.js"
import { createTopUpInvoice } from "../../lib/stripeClient.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers["authorization"]

    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn("Unauthorized request")
        return res.status(401).json({ success: false })
    }

    console.log("Billing cron started")

    try {
        const rows = await getLowBalanceCustomers()
        console.log(`Fetched ${rows.length} customers with low balance`)

        let billedCount = 0

        for (const row of rows) {
            const { cid, cusId, balance } = row
            console.log(`Processing customer cid=${cid}, cusId=${cusId}, balance=${balance}`)

            if (!cusId) {
                console.warn(`Skipping cid=${cid} (no Stripe cusId found)`)
                continue
            }

            try {
                const invoice = await createTopUpInvoice(cusId)
                console.log(`Created invoice ${invoice.id} for cid=${cid}, cusId=${cusId}, balance=${balance}`)
                billedCount++
            } catch (err: any) {
                console.error(`Failed billing cid=${cid}, cusId=${cusId}: ${err.message}`)
            }
        }

        console.log(`Billing cron finished. Successfully billed ${billedCount} customers`)

        return res.json({ success: true, billed: billedCount })
    } catch (err: any) {
        console.error("Billing cron failed with error:", err.message)
        return res.status(500).json({ error: err.message })
    }
}