import type { VercelRequest, VercelResponse } from "@vercel/node"
import { setCustomersBillingStatus } from "../../lib/redisClient.js"
import { getCustomers, isCustomerBillingActive } from "../../lib/stripeClient.js"

// Stripe customer type (simplified; replace with stripe.Customer if using stripe typings)
interface Customer {
  id: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  const authHeader = req.headers["authorization"]

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false })
  }

  try {
    let startingAfter: string | undefined = undefined
    let processed = 0

    while (true) {
      const customers: Customer[] = await getCustomers({
        limit: 100,
        startingAfter
      })

      if (customers.length === 0) {
        break
      }

      // Build HMSET batch
      const updates: Record<string, "0" | "1"> = {}

      for (const customer of customers) {
        const isBillingActive = await isCustomerBillingActive(customer.id)
        updates[customer.id] = isBillingActive ? "1" : "0"
      }

      await setCustomersBillingStatus(updates)

      processed += customers.length
      startingAfter = customers[customers.length - 1].id
    }

    console.log(`Updated billing for ${processed} customers`)
    return res
      .status(200)
      .json({ message: `Updated billing for ${processed} customers`, success: true })
  } catch (err: any) {
    console.error(err)
    return res.status(500).json({ error: err.message, success: false })
  }
}