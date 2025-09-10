import { generateVideoPresignedUrl } from '../lib/s3Client.js';
import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod
} from '../lib/apiHelpers.js';
import { getTypesenseClient } from '../lib/typesenseClient.js';

export default async function handler(req, res) {
  try {
    setCorsHeaders(res);
    
    if (handleOptions(req, res)) return;
    
    try {
      validateMethod(req, ['POST']);
      
      const userId = await authenticateUser(req);
      
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({
          success: false,
          error: 'Missing videoId parameter'
        });
      }
      
      try {
        const typesenseClient = getTypesenseClient();
        console.log('Generating presigned URL for video:', videoId);
        
        // Generate presigned URL with ownership check (valid for 7 days)
        const presignedUrl = await generateVideoPresignedUrl(videoId, userId, typesenseClient, 604800);
        
        console.log('Presigned URL generated successfully');
        
        return res.status(200).json({
          success: true,
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
        
        if (dbError.httpStatus === 404 || dbError.message.includes('not found')) {
          return res.status(404).json({
            success: false,
            error: 'Video not found in database'
          });
        }
        
        if (dbError.message.includes('Access denied')) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
        
        return res.status(500).json({
          success: false,
          error: `Service error: ${dbError.message}`,
          details: {
            message: dbError.message,
            stack: dbError.stack
          }
        });
      }
      
    } catch (authError) {
      console.error('Authentication/validation error:', authError);
      
      if (authError.message === 'Method not allowed') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
      }
      

      
      return res.status(400).json({
        success: false,
        error: `Validation error: ${authError.message}`,
        details: {
          message: authError.message,
          stack: authError.stack
        }
      });
    }
    
  } catch (criticalError) {
    console.error('Critical handler error:', criticalError);
    
    // Ensure we always return JSON, even for critical errors
    try {
      return res.status(500).json({
        success: false,
        error: `Critical server error: ${criticalError.message}`,
        details: {
          message: criticalError.message,
          stack: criticalError.stack,
          name: criticalError.name
        }
      });
    } catch (responseError) {
      // Last resort - if even JSON response fails
      console.error('Failed to send JSON response:', responseError);
      res.status(500).end('Internal Server Error');
    }
  }
}
