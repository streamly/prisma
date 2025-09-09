import { createClerkClient, verifyToken } from '@clerk/backend';
import { serialize } from 'cookie';
import { getTypesenseClient } from '../lib/apiHelpers.js';

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_API_SECRET,
});

// Middleware to verify Clerk authentication token and set cookies
export default async function handler(req, res) {
  console.log('Auth endpoint called with method:', req.method);
  console.log('Request headers:', req.headers);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }
    
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
        console.log('Attempting to generate scoped Typesense key for user:', userId);
        console.log('TYPESENSE_SEARCH_ONLY_KEY exists:', !!process.env.TYPESENSE_SEARCH_ONLY_KEY);
        
        const typesenseClient = getTypesenseClient();
        const keyParams = {
          filter_by: `uid:${userId} && active:1`,
          include_fields: "id,uid,title,description,duration,file_size,thumbnail,created_at,active",
          expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        };
        
        console.log('Key generation parameters:', keyParams);
        
        scopedApiKey = await typesenseClient.keys().generateScopedSearchKey(
          process.env.TYPESENSE_SEARCH_ONLY_KEY,
          keyParams
        );
        
        console.log('Scoped API key generated successfully:', !!scopedApiKey);
      } catch (typesenseError) {
        console.error('Failed to generate scoped Typesense key:', typesenseError);
        console.error('Error details:', {
          message: typesenseError.message,
          stack: typesenseError.stack,
          name: typesenseError.name
        });
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
        message: 'Authentication successful',
        scopedKeyGenerated: !!scopedApiKey,
        typesenseError: scopedApiKey ? null : 'Typesense key generation failed - check environment variables'
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