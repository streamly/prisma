import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod, 
 
  errorResponse, 
  successResponse,
  verifyVideoOwnership
} from '../lib/apiHelpers.js';
import { getTypesenseClient } from '../lib/typesenseClient.js';

export default async function handler(req, res) {
  setCorsHeaders(res);
  
  if (handleOptions(req, res)) return;
  
  try {
    validateMethod(req, ['POST']);
    const userId = await authenticateUser(req);
    
    const updateData = req.body;
    
    if (!updateData.id) {
      return errorResponse(res, 400, 'Missing required field: id');
    }
    
    try {
      const existingDoc = await verifyVideoOwnership(updateData.id, userId);
      
      const updateDocument = {
        id: updateData.id,
        uid: existingDoc.uid,
        filename: existingDoc.filename,
        title: updateData.title || existingDoc.title,
        description: updateData.description !== undefined ? updateData.description : existingDoc.description,
        duration: updateData.duration !== undefined ? updateData.duration : existingDoc.duration,
        file_size: existingDoc.file_size,
        content_type: existingDoc.content_type,
        thumbnail: updateData.thumbnail !== undefined ? updateData.thumbnail : existingDoc.thumbnail,
        created_at: existingDoc.created_at,
        active: updateData.active !== undefined ? updateData.active : existingDoc.active,
        updated_at: Math.floor(Date.now() / 1000)
      };
      
      const typesenseClient = getTypesenseClient();
      const result = await typesenseClient.collections('videos').documents(updateData.id).update(updateDocument);
      
      console.log('Video metadata updated successfully:', result);
      
      return successResponse(res, { 
        id: updateData.id,
        message: 'Video details updated successfully' 
      });
      
    } catch (typesenseError) {
      console.error('Typesense update failed:', typesenseError);
      
      if (typesenseError.httpStatus === 404 || typesenseError.message === 'Video not found') {
        return errorResponse(res, 404, 'Video not found');
      }
      
      if (typesenseError.message.includes('permission')) {
        return errorResponse(res, 403, typesenseError.message);
      }
      
      return errorResponse(res, 500, 'Failed to update video metadata in search index');
    }
    
  } catch (error) {
    console.error('Update API error:', error);
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, 'Internal server error');
  }
}
