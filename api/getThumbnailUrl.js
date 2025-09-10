import { generateThumbnailPresignedUrl } from '../lib/s3Client.js';
import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod, 
  errorResponse, 
  successResponse
} from '../lib/apiHelpers.js';
import { getTypesenseClient } from '../lib/typesenseClient.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  try {
    validateMethod(req, ['POST']);
    const userId = await authenticateUser(req);
    
    const { videoId } = req.body;
    
    if (!videoId) {
      return errorResponse(res, 400, 'Missing videoId parameter');
    }
    
    try {
      const typesenseClient = getTypesenseClient();
      
      // Generate presigned URL for thumbnail with ownership check (valid for 7 days)
      const presignedUrl = await generateThumbnailPresignedUrl(videoId, userId, typesenseClient, 604800);
      
      return successResponse(res, { 
        url: presignedUrl,
        expiresIn: 604800
      });
      
    } catch (s3Error) {
      console.error('Error generating thumbnail presigned URL:', s3Error);
      return errorResponse(res, 500, `Failed to generate thumbnail URL: ${s3Error.message}`);
    }
    
  } catch (error) {
    console.error('Get thumbnail URL API error:', error);
    
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, `Internal server error: ${error.message}`);
  }
}
