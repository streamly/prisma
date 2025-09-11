import { verifyToken } from '@clerk/backend'
import { serialize } from 'cookie'
import md5 from 'md5'
import { getTypesenseClient } from '../lib/typesenseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Authentication token required' })

    const payload = await verifyToken(token, { secretKey: process.env.CLERK_API_SECRET })
    if (!payload?.sub) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userId = payload.sub
    const uidHash = md5(userId)
    const typesenseClient = getTypesenseClient()
    const scopedApiKey = await typesenseClient.keys().generateScopedSearchKey(
      process.env.TYPESENSE_SEARCH_KEY,
      {
        filter_by: `uid:${uidHash}`,
        include_fields: "id,uid,height,width,size,duration,created,modified,active,title,description,company,channel,tags",
        expires_at: Math.floor(Date.now() / 1000) + 604800, // 1 week
      }
    )

    if (!scopedApiKey) {
      return res.status(500).json({
        error: 'Failed to generate scoped Typesense key'
      })
    }

    const cookieOptions = {
      httpOnly: false,       // readable by JS
      secure: true,          // production only
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: '/'
    }

    res.setHeader('Set-Cookie', [
      serialize('uid', uidHash, cookieOptions),
      serialize('apiKey', scopedApiKey, cookieOptions)
    ])

    return res.status(200).json({
      authenticated: true,
      message: 'Authentication successful'
    })

  } catch (err) {
    console.error('Auth error:', err)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}