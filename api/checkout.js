import { getClerkUser, setUserPrivateMetadata } from '../lib/clerkClient.js'
import { createCheckoutSession, createCustomer, createCustomerPortalSession } from '../lib/stripeClient.js'


const APP_URL = process.env.APP_URL


export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" })
    }

    let userId

    try {
      userId = await authenticateUser(req)
    } catch (error) {
      return res.status(401).json({ error: 'Authentication error', details: error.message })
    }

    const user = await getClerkUser(userId)
    let customerId = user.privateMetadata.customerId

    if (!customerId) {
      const customer = createCustomer(userId)

      await setUserPrivateMetadata(userId, { customerId: customer.id })

      customerId = customer.id
    }

    const session = await createCheckoutSession(customerId, APP_URL)

    return res.json({ url: session.url })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}