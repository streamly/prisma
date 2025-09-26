import { buffer } from "micro"
import { insertStripeAction } from '../lib/newRelic.js'
import { constructEvent, getCustomer } from '../lib/stripeClient.js'
import { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  api: {
    bodyParser: false, // Required so Stripe signature check works
  },
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let event
  try {
    const rawBody = (await buffer(req)).toString("utf8")
    const signature = req.headers["stripe-signature"] as string

    // @ts-expect-error
    event = await constructEvent(rawBody, signature)

  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // @ts-expect-error
  const customerId = event.data.object.customer
  let userId

  if (!customerId) {
    throw new Error('Missing customerId')
  }

  if (customerId) {
    const customer = await getCustomer(customerId)

    if (!customer) {
      throw new Error('Missing customer')
    }

    userId = customer.metadata.userId
  }

  await insertStripeAction(event, userId!, customerId)

  return res.json({ received: true })
}