import { authenticateUser, getClerkUser } from '../lib/clerkClient.js'
import { createCheckoutSession } from '../lib/stripeClient.js'


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
    let customerId = user.publicMetadata.stripeCustomerId

    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer ID found for this user" })
    }

    const session = await createCheckoutSession(customerId, APP_URL)

    return res.json({ success: true, url: session.url })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}