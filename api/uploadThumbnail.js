import { uploadToS3 } from '../lib/s3Client.js';
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
    
    const { videoId, thumbnailData, timestamp } = req.body;
    
    if (!videoId || !thumbnailData) {
      return errorResponse(res, 400, 'Missing videoId or thumbnailData');
    }
    
    // Validate thumbnail data is base64 image
    if (!thumbnailData.startsWith('data:image/')) {
      return errorResponse(res, 400, 'Invalid thumbnail data format');
    }
    
    try {
      // Get video data from Typesense to verify ownership
      const typesenseClient = getTypesenseClient();
      const videoDoc = await typesenseClient.collections('videos').documents(videoId).retrieve();
      
      if (!videoDoc) {
        return errorResponse(res, 404, 'Video not found');
      }
      
      // Check if user owns this video
      if (videoDoc.uid !== userId) {
        return errorResponse(res, 403, 'Access denied - you can only edit your own videos');
      }
      
      // Convert base64 to buffer
      const base64Data = thumbnailData.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Validate file size (10KB limit)
      if (buffer.length > 10240) {
        return errorResponse(res, 400, 'Thumbnail too large. Maximum size is 10KB');
      }
      
      // Generate thumbnail filename
      const thumbnailFilename = `thumbnails/${videoId}_${Date.now()}.jpg`;
      
      // Upload thumbnail to S3
      const uploadResult = await uploadToS3(thumbnailFilename, buffer, 'image/jpeg');
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload thumbnail');
      }
      
      // Update video document in Typesense with thumbnail filename
      const updateData = {
        thumbnail: thumbnailFilename
      };
      
      if (timestamp !== undefined) {
        updateData.thumbnail_timestamp = timestamp;
      }
      
      await typesenseClient.collections('videos').documents(videoId).update(updateData);
      
      console.log('Thumbnail uploaded and video updated:', {
        videoId,
        thumbnailFilename,
        size: buffer.length,
        timestamp
      });
      
      return successResponse(res, {
        message: 'Thumbnail uploaded successfully',
        thumbnailFilename,
        size: buffer.length
      });
      
    } catch (s3Error) {
      console.error('Error uploading thumbnail:', s3Error);
      return errorResponse(res, 500, `Failed to upload thumbnail: ${s3Error.message}`);
    }
    
  } catch (error) {
    console.error('Upload thumbnail API error:', error);
    
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, `Internal server error: ${error.message}`);
  }
}
