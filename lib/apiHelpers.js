import { verifyToken } from '@clerk/backend';
import { getTypesenseClient } from './typesenseClient.js';

// Set CORS headers
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Handle OPTIONS preflight request
export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(200).end();
  }
  return false;
}

// Authenticate user using Clerk
export async function authenticateUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required');
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_API_SECRET
    });
    
    if (!payload || !payload.sub) {
      throw new Error('Invalid authentication token');
    }
    
    return payload.sub;
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}

// Validate request method
export function validateMethod(req, allowedMethods) {
  if (!allowedMethods.includes(req.method)) {
    throw new Error('Method not allowed');
  }
}

// Re-export Typesense client getter for backward compatibility
export { getTypesenseClient } from './typesenseClient.js';

// Re-export S3 config getter for backward compatibility
export { getS3Config } from './s3Client.js';

// Standard error response
export function errorResponse(res, statusCode, message, details = null) {
  const response = { success: false, error: message };
  if (details) response.details = details;
  return res.status(statusCode).json(response);
}

// Standard success response
export function successResponse(res, data = {}) {
  return res.status(200).json({ success: true, ...data });
}

// Verify video ownership
export async function verifyVideoOwnership(videoId, userId) {
  try {
    const typesenseClient = getTypesenseClient();
    const document = await typesenseClient.collections('videos').documents(videoId).retrieve();
    
    if (document.uid !== userId) {
      throw new Error('You do not have permission to access this video');
    }
    
    return document;
  } catch (error) {
    if (error.httpStatus === 404) {
      throw new Error('Video not found');
    }
    throw error;
  }
}
