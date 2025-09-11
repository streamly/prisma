import { createClerkClient, verifyToken } from '@clerk/backend';
import { serialize } from 'cookie';
import { getTypesenseClient } from '../lib/typesenseClient.js';
import md5 from 'md5';


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
    uidHash
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_API_SECRET,
      });

      if (!payload || !payload.sub) {
        console.error('Token verification failed: Invalid payload');
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      userId = payload.sub;
      uidHash = md5(userId)

      // Generate scoped Typesense key for this user
      let scopedApiKey = null;
      try {
        console.log('Attempting to generate scoped Typesense key for user:', userId);

        if (!process.env.TYPESENSE_SEARCH_KEY) {
          throw new Error('TYPESENSE_SEARCH_KEY environment variable not set');
        }

        const typesenseClient = getTypesenseClient();

        const keyParams = {
          filter_by: `uid:${uidHash}`,
          include_fields: "id,uid,height,width,size,duration,created,modified,active",
          expires_at: Math.floor(Date.now() / 1000) + 604800, // 1 week expiry
        };

        console.log('Key generation parameters:', keyParams);
        console.log('Base key preview:', process.env.TYPESENSE_SEARCH_KEY.substring(0, 10) + '...');

        scopedApiKey = await typesenseClient.keys().generateScopedSearchKey(
          process.env.TYPESENSE_SEARCH_KEY,
          keyParams
        );

        console.log('Scoped API key generated successfully:', !!scopedApiKey);
        console.log('Scoped key length:', scopedApiKey ? scopedApiKey.length : 0);
        console.log('Scoped key preview:', scopedApiKey ? scopedApiKey.substring(0, 20) + '...' : 'none');
      } catch (typesenseError) {
        console.error('Failed to generate scoped Typesense key:', typesenseError);
        console.error('Error details:', {
          message: typesenseError.message,
          stack: typesenseError.stack,
          name: typesenseError.name,
          httpStatus: typesenseError.httpStatus
        });

        return res.status(500).json({
          error: 'Failed to generate scoped Typesense key'
        });
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
        httpOnly: true
      };

      const cookies = [
        serialize('apiKey', scopedApiKey, cookieOptions),
        serialize('uid', uidHash, cookieOptions),
        serialize('auth_token', token, httpOnlyCookieOptions)
      ];

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