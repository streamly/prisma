import Stripe from 'stripe'
import { formatUserId } from './utils.js'


const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_SIGNING_SECRET
const stripe = new Stripe(STRIPE_SECRET_KEY)


export async function createCustomer(userId, email = undefined) {
  return stripe.customers.create({ email, metadata: { userId: formatUserId(userId) } })
}


export async function createCustomerPortalSession(customer, returnUrl) {
  return stripe.billingPortal.sessions.create({ customer, return_url: returnUrl })
}


export async function createCheckoutSession(customer, returnUrl) {
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


export async function constructEvent(rawBody, signature) {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    STRIPE_WEBHOOK_SECRET
  )
}


export async function getCustomer(customer) {
  return stripe.customers.retrieve(customer)
}


export async function getCustomers({ limit, startingAfter }) {
  return stripe.customers.list({
    limit,
    starting_after: startingAfter
  })
    .then(res => res.data)
}


export async function isCustomerWithCardPaymentMethod(customer) {
  const paymentMethods = await stripe.paymentMethods.list({
    customer,
    type: "card",
    limit: 1
  })

  return paymentMethods.data.length > 0
}


export async function isCustomerLastInvoicePaid(customer) {
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


export async function isCustomerBillingActive(customer) {
  const [hasCard, invoicePaid] = await Promise.all([
    isCustomerWithCardPaymentMethod(customer),
    isCustomerLastInvoicePaid(customer)
  ])

  return hasCard && invoicePaid
}


export async function updateCustomerEmail(customer, newEmail) {
  return stripe.customers.update(customer, {
    email: newEmail
  })
}