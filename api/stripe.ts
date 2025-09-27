import { VercelRequest, VercelResponse } from "@vercel/node"
import { buffer } from "micro"
import { userLedger } from '../lib/db/schema.js'
import { insertStripeAction } from "../lib/newRelic.js"
import { constructEvent, getCustomer } from "../lib/stripeClient.js"
import { insertLedgerEntry } from '../lib/db/ledgers.js'

export const config = {
  api: {
    bodyParser: false, // Required so Stripe signature check works
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  let event
  try {
    const rawBody = (await buffer(req)).toString("utf8")
    const signature = req.headers["stripe-signature"] as string

    if (!signature) {
      return res.status(400).json({ error: "Missing Stripe signature" })
    }

    // @ts-expect-error stripe types mismatch with raw body
    event = await constructEvent(rawBody, signature)
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  // @ts-expect-error - event object is loosely typed
  const customerId = event?.data?.object?.customer
  if (!customerId) {
    return res.status(400).json({ error: "Missing customerId in event payload" })
  }

  let userId: string
  try {
    const customer = await getCustomer(customerId)

    if (!customer) {
      return res.status(404).json({ error: "Customer not found in Stripe" })
    }

    userId = customer.metadata?.userId

    if (!userId) {
      return res.status(400).json({ error: "Missing userId in customer metadata" })
    }
  } catch (err: any) {
    console.error("Error fetching customer from Stripe:", err.message)
    return res.status(500).json({ error: "Failed to fetch customer details" })
  }

  try {
    await insertStripeAction(event, userId, customerId)
  } catch (err: any) {
    console.error("Error inserting Stripe action:", err.message)
    return res.status(500).json({ error: "Failed to record Stripe event" })
  }

  let ledgerEntry: typeof userLedger.$inferInsert | null = null

  console.log('Received event', event.type)

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object
      ledgerEntry = {
        stripeEventId: event.id,
        stripeObjectId: pi.id,
        stripeCustomerId: customerId,
        userId: userId,
        type: "credit",
        sourceType: "payment",
        amount: pi.amount_received,
        currency: pi.currency,
        description: "Payment succeeded",
      }
      break
    }
    case "charge.refunded": {
      const ch = event.data.object
      ledgerEntry = {
        stripeEventId: event.id,
        stripeObjectId: ch.id,
        stripeCustomerId: customerId,
        userId: userId,
        type: "debit",
        sourceType: "refund",
        amount: ch.amount_refunded,
        currency: ch.currency,
        description: "Charge refunded",
      }
      break
    }
    case "charge.dispute.created": {
      const dp = event.data.object
      ledgerEntry = {
        stripeEventId: event.id,
        stripeObjectId: dp.id,
        stripeCustomerId: customerId,
        userId: userId,
        type: "debit",
        sourceType: "chargeback",
        amount: dp.amount,
        currency: dp.currency,
        description: "Dispute opened",
      }
      break
    }
    default:
      break
  }

  if (ledgerEntry) {
    try {
      await insertLedgerEntry(ledgerEntry)
    } catch (err) {
      console.error("DB insert error:", err)
      return res.status(500).json({ error: "Database insert failed" })
    }
  }
  return res.status(200).json({ success: true, received: true })
}