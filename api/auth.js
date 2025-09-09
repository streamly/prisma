import { createClerkClient, verifyToken } from '@clerk/backend';
import { serialize } from 'cookie';
import { getTypesenseClient } from '../lib/apiHelpers.js';

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
      
      // Generate scoped Typesense key for this user
      let scopedApiKey = null;
      try {
        const typesenseClient = getTypesenseClient();
        scopedApiKey = await typesenseClient.keys().generateScopedSearchKey(
          process.env.TYPESENSE_SEARCH_ONLY_KEY,
          {
            filter_by: `uid:${userId} && active:1`,
            include_fields: "id,uid,title,description,duration,file_size,thumbnail,created_at,active",
            expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
          }
        );
      } catch (typesenseError) {
        console.error('Failed to generate scoped Typesense key:', typesenseError);
        // Continue without the key - videos won't load but auth will still work
      }
      
      // Set cookies for authentication
      const cookieOptions = {
        httpOnly: false, // Allow JavaScript access for apikey
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      };
      
      const httpOnlyCookieOptions = {
        ...cookieOptions,
        httpOnly: true // Keep sensitive data httpOnly
      };
      
      // Set cookies with user information
      const cookies = [
        serialize('user_id', userId, httpOnlyCookieOptions),
        serialize('user_name', fullName || '', httpOnlyCookieOptions),
        serialize('user_email', email || '', httpOnlyCookieOptions),
        serialize('auth_token', token, httpOnlyCookieOptions)
      ];
      
      // Add scoped API key if generated successfully
      if (scopedApiKey) {
        cookies.push(serialize('apikey', scopedApiKey, cookieOptions));
      }
      
      res.setHeader('Set-Cookie', cookies);
      
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