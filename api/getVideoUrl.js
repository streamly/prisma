import { generatePresignedUrl } from '../lib/s3Client.js';
import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod, 
  errorResponse, 
  successResponse,
  getTypesenseClient
} from '../lib/apiHelpers.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  try {
    validateMethod(req, ['GET']);
    const userId = await authenticateUser(req);
    
    const { videoId } = req.query;
    
    if (!videoId) {
      return errorResponse(res, 400, 'Missing videoId parameter');
    }
    
    try {
      // Get video data from Typesense to find the filename
      const typesenseClient = getTypesenseClient();
      const searchResult = await typesenseClient.collections('videos').documents(videoId).retrieve();
      
      if (!searchResult || !searchResult.filename) {
        return errorResponse(res, 404, 'Video not found');
      }
      
      // Check if user owns this video
      if (searchResult.uid !== userId) {
        return errorResponse(res, 403, 'Access denied');
      }
      
      // Generate presigned URL for video access (valid for 7 days)
      const presignedUrl = await generatePresignedUrl(searchResult.filename, 604800); // 7 days
      
      return successResponse(res, { 
        url: presignedUrl,
        expiresIn: 604800
      });
      
    } catch (s3Error) {
      console.error('Error generating presigned URL:', s3Error);
      return errorResponse(res, 500, `Failed to generate video URL: ${s3Error.message}`);
    }
    
  } catch (error) {
    console.error('Get video URL API error:', error);
    
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, `Internal server error: ${error.message}`);
  }
}
