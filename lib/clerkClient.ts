import { Clerk } from '@clerk/clerk-sdk-node'
import { verifyToken } from '@clerk/backend'
import { VercelRequest } from '@vercel/node'

const clerkClient = Clerk({
  secretKey: process.env.CLERK_API_SECRET
})


export async function getClerkUser(userId: string) {
  if (!userId) {
    throw new Error('Missing Clerk user id')
  }

  return clerkClient.users.getUser(userId)
}

export async function authenticateUser(req: VercelRequest) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required')
  }

  const token = authHeader.substring(7)

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_API_SECRET
    })

    if (!payload || !payload.sub) {
      throw new Error('Invalid authentication token')
    }

    return payload.sub
  } catch (error) {
    throw new Error('Invalid authentication token')
  }
}


export async function setUserPrivateMetadata(userId: string, metadata: Record<string, unknown>) {
  return clerkClient.users.updateUserMetadata(userId, { privateMetadata: metadata })
}

export async function setUserPublicMetadata(userId: string, metadata: Record<string, unknown>) {
  return clerkClient.users.updateUserMetadata(userId, { publicMetadata: metadata })
}