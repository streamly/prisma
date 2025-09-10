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
    
    const { filename, width, height, duration, userId: uploadUserId } = req.body;
    
    // Validate required fields
    if (!filename || !width || !height || !duration) {
      return errorResponse(res, 400, 'Missing required fields: filename, width, height, duration');
    }
    
    // Use filename as ID (without extension)
    const id = req.body.id || filename.replace(/\.[^/.]+$/, "");
    
    // Prepare document for Typesense
    const document = {
      id,
      uid: userId,
      filename,
      title: filename.replace(/\.[^/.]+$/, ""), // Remove file extension for default title
      description: '',
      duration: parseInt(duration),
      width: parseInt(width),
      height: parseInt(height),
      file_size: 0, // Will be updated later if needed
      content_type: 'video/mp4',
      thumbnail: '',
      created: Math.floor(Date.now() / 1000), // Use 'created' field name for search filters
      active: 1,
      ranking: Math.floor(Date.now() / 1000) // Add ranking field for default sorting
    };
    
    try {
      const typesenseClient = getTypesenseClient();
      const result = await typesenseClient.collections('videos').documents().create(document);
      
      console.log('Video metadata inserted successfully:', result);
      
      return successResponse(res, { 
        id: document.id,
        message: 'Video metadata inserted successfully' 
      });
      
    } catch (typesenseError) {
      console.error('Typesense insertion failed:', typesenseError);
      console.error('Typesense error details:', {
        message: typesenseError.message,
        httpStatus: typesenseError.httpStatus,
        code: typesenseError.code,
        stack: typesenseError.stack
      });
      
      if (typesenseError.message && typesenseError.message.includes('already exists')) {
        return errorResponse(res, 409, 'Video with this ID already exists');
      }
      
      return errorResponse(res, 500, `Failed to insert video metadata into search index: ${typesenseError.message}`);
    }
    
  } catch (error) {
    console.error('Insert API error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, `Internal server error: ${error.message}`);
  }
}
