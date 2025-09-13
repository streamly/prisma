import Stripe from 'stripe'


const stripe = new Stripe()


export async function createCustomer(userId) {
  return stripe.customers.create({ metadata: { userId } })
}


export async function createCustomerPortalSession(customerId, returnUrl) {
  return stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
}


export async function createCheckoutSession(customerId, returnUrl) {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price: 'prod_T2O8553oN6laRy',
        quantity: 1,
      },
    ],
    payment_intent_data: {
      setup_future_usage: "off_session",
    },
    success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.headers.origin}/?error`,
  })
}