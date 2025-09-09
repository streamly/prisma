import { verifyToken } from '@clerk/backend';
import Typesense from 'typesense';
import { S3Client } from '@aws-sdk/client-s3';

// Initialize Typesense client
const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: 443,
      protocol: "https",
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_KEY,
  connectionTimeoutSeconds: 2,
});

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-west-1',
  credentials: {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET
  },
  apiVersion: 'latest',
  forcePathStyle: true,
  endpoint: process.env.AWS_ENDPOINT
});

// Common CORS headers
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
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

// Verify authentication and return user ID
export async function authenticateUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Authentication token required');
  }
  
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_API_SECRET,
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

// Get Typesense client
export function getTypesenseClient() {
  return typesenseClient;
}

// Get S3 client and bucket name
export function getS3Config() {
  return {
    client: s3Client,
    bucketName: process.env.AWS_BUCKET
  };
}

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
