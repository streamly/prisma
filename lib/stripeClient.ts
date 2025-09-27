import Stripe from 'stripe'
import { formatUserId } from './utils.js'


const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID!
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SIGNING_SECRET!
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" })


export async function createCustomer(userId: string, email?: string) {
  // @ts-expect-error
  return stripe.customers.create({ email, metadata: { userId, email } })
}

export async function createCustomerPortalSession(customer: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({ customer, return_url: returnUrl })
}

export async function createCheckoutSession(customer: string, returnUrl: string) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer,
    line_items: [
      {
        price: STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
    },
    success_url: `${returnUrl}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}/?error`,
  })
}


export async function constructEvent(rawBody: Buffer, signature: string) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET
  )
}


export async function getCustomer(customerId: string) {
  const customer = await stripe.customers.retrieve(customerId)

  if (customer.deleted) {
    return null
  }

  return customer
}


export async function getCustomers({ limit, startingAfter }: { limit: number, startingAfter?: string }) {
  return stripe.customers.list({
    limit,
    starting_after: startingAfter
  })
    .then(res => res.data)
}


export async function isCustomerWithCardPaymentMethod(customer: string) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer,
    type: "card",
    limit: 1
  })

  return paymentMethods.data.length > 0
}


export async function isCustomerLastInvoicePaid(customer: string) {
  const invoices = await stripe.invoices.list({
    customer,
    limit: 1
  })
  const lastInvoice = invoices.data[0]

  if (!lastInvoice) {
    return false
  }

  return lastInvoice.status === "paid"
}


export async function isCustomerBillingActive(customer: string) {
  const [hasCard, invoicePaid] = await Promise.all([
    isCustomerWithCardPaymentMethod(customer),
    isCustomerLastInvoicePaid(customer)
  ])

  return hasCard && invoicePaid
}


export async function updateCustomerEmail(customer: string, newEmail: string) {
  return stripe.customers.update(customer, {
    email: newEmail
  })
}
