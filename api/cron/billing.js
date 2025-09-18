import { setCustomerBillingStatus } from '../../lib/redisClient.js'
import { getCustomers, isCustomerBillingActive } from '../../lib/stripeClient.js'


export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ success: false })
  }

  try {
    let startingAfter = undefined
    let processed = 0

    while (true) {
      const customers = await getCustomers({ limit: 100, startingAfter })

      if (customers.length === 0) {
        break
      }

      // Build HMSET batch
      const updates = {}

      for (const customer of customers) {
        let isBillingActive = await isCustomerBillingActive(customer.id)
        updates[customer.id] = isBillingActive ? "1" : "0"
      }

      await setCustomerBillingStatus(updates)

      processed += customers.length
      startingAfter = customers[customers.length - 1].id
    }

    console.log(`Updated billing for ${processed} customers`)
    return res.status(200).json({ message: `Updated billing for ${processed} customers`, success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message, success: false })
  }
}
