import { verifyToken } from '@clerk/backend'
import { VercelRequest, VercelResponse } from '@vercel/node'
import { serialize } from 'cookie'
import { getClerkUser, setUserPublicMetadata } from '../lib/clerkClient.js'
import { createCustomer, updateCustomerEmail } from '../lib/stripeClient.js'
import { generateScopedSearchKey } from '../lib/typesenseClient.js'
import { formatCustomerId, formatUserId } from '../lib/utils.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Authentication token required' })

    const payload = await verifyToken(token, { secretKey: process.env.CLERK_API_SECRET })
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = payload.sub
    const formatedUserId = formatUserId(userId)
    const user = await getClerkUser(userId)
    const userEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress
    let userCustomerId = user.publicMetadata.stripeCustomerId as string

    if (userCustomerId) {
      const customer = await createCustomer(userId, userEmail)
      userCustomerId = customer.id

      await setUserPublicMetadata(userId, {
        stripeCustomerId: userCustomerId,
        customerEmail: userEmail,
        cid: formatCustomerId(userCustomerId)
      })
    }

    if (userEmail && userEmail !== user.publicMetadata.customerEmail) {
      try {
        await updateCustomerEmail(user.publicMetadata.stripeCustomerId as string, userEmail)
      } catch (error) {
        console.error('Error updating customer email')
      }
    }

    const scopedApiKey = await generateScopedSearchKey(formatedUserId)

    if (!scopedApiKey) {
      return res.status(500).json({
        error: 'Failed to generate scoped Typesense key'
      })
    }

    const cookieOptions = {
      httpOnly: false,       // readable by JS
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/'
    }

    const cookies = [
      serialize('uid', formatedUserId, cookieOptions),
      serialize('apiKey', scopedApiKey, cookieOptions),
    ]

    if (userCustomerId) {
      cookies.push(serialize('user_cus', formatCustomerId(userCustomerId), cookieOptions))
    }

    res.setHeader('Set-Cookie', cookies)

    return res.status(200).json({
      authenticated: true,
      message: 'Authentication successful'
    })
  } catch (err) {
    console.error('Auth error:', err)
    return res.status(500).json({ error: 'Authentication failed', details: (err as Error).message })
  }
}