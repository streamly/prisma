import { createClerkClient, verifyToken } from '@clerk/backend';
import { serialize } from 'cookie';

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_API_SECRET,
});

// Middleware to verify Clerk authentication token and set cookies
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
    // Get user data from request body
    const { fullName, email } = req.body;
    
    let userId;
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_API_SECRET,
      });
      
      if (!payload || !payload.sub) {
        console.error('Token verification failed: Invalid payload');
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
      
      userId = payload.sub;
      
      
      // Set cookies for authentication
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      };
      
      // Set cookies with user information
      res.setHeader('Set-Cookie', [
        serialize('user_id', userId, cookieOptions),
        serialize('user_name', fullName || '', cookieOptions),
        serialize('user_email', email || '', cookieOptions),
        serialize('auth_token', token, cookieOptions)
      ]);
      
      return res.status(200).json({ 
        authenticated: true, 
        userId: userId,
        message: 'Authentication successful'
      });
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication service error' });
  }

}