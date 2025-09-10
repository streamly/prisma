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
    validateMethod(req, ['POST']);
    const userId = await authenticateUser(req);
    
    const { videoId } = req.body;
    
    if (!videoId) {
      return errorResponse(res, 400, 'Missing videoId parameter');
    }
    
    try {
      // Get video data from Typesense to find the filename
      const typesenseClient = getTypesenseClient();
      console.log('Attempting to retrieve video:', videoId);
      
      const searchResult = await typesenseClient.collections('videos').documents(videoId).retrieve();
      console.log('Typesense result:', searchResult);
      
      if (!searchResult || !searchResult.filename) {
        console.error('Video not found or missing filename:', { searchResult });
        return errorResponse(res, 404, 'Video not found or missing filename');
      }
      
      // Check if user owns this video
      if (searchResult.uid !== userId) {
        console.error('Access denied - user mismatch:', { videoOwner: searchResult.uid, requestingUser: userId });
        return errorResponse(res, 403, 'Access denied');
      }
      
      console.log('Generating presigned URL for filename:', searchResult.filename);
      
      // Generate presigned URL for video access (valid for 7 days)
      const presignedUrl = await generatePresignedUrl(searchResult.filename, 604800); // 7 days
      
      console.log('Presigned URL generated successfully');
      
      return successResponse(res, { 
        url: presignedUrl,
        expiresIn: 604800
      });
      
    } catch (dbError) {
      console.error('Database/S3 error:', {
        message: dbError.message,
        httpStatus: dbError.httpStatus,
        code: dbError.code,
        stack: dbError.stack
      });
      
      if (dbError.httpStatus === 404) {
        return errorResponse(res, 404, 'Video not found in database');
      }
      
      return errorResponse(res, 500, `Service error: ${dbError.message}`);
    }
    
  } catch (error) {
    console.error('Get video URL API error:', error);
    
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    
    // Send detailed error for development debugging
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`,
      details: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
}
