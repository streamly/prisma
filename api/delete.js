import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod, 
  getS3Config,
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
    
    const { id } = req.body;
    
    if (!id) {
      return errorResponse(res, 400, 'Missing required field: id');
    }
    
    try {
      const existingDoc = await verifyVideoOwnership(id, userId);
      const filename = existingDoc.filename;
      const { client: s3Client, bucketName } = getS3Config();
      const typesenseClient = getTypesenseClient();
      
      let deletionErrors = [];
      
      // Delete from S3 storage bucket
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: filename
        });
        
        await s3Client.send(deleteCommand);
        console.log(`Successfully deleted file from S3: ${filename}`);
      } catch (s3Error) {
        console.error('Failed to delete file from S3:', s3Error);
        deletionErrors.push(`S3 deletion failed: ${s3Error.message}`);
      }
      
      // Delete from Typesense collection
      try {
        await typesenseClient.collections('videos').documents(id).delete();
        console.log(`Successfully deleted video metadata from Typesense: ${id}`);
      } catch (typesenseError) {
        console.error('Failed to delete from Typesense:', typesenseError);
        deletionErrors.push(`Typesense deletion failed: ${typesenseError.message}`);
      }
      
      if (deletionErrors.length > 0) {
        console.error('Partial deletion failure:', deletionErrors);
        return res.status(207).json({ 
          success: false, 
          error: 'Partial deletion failure',
          details: deletionErrors,
          message: 'Some components failed to delete. Please contact support.'
        });
      }
      
      return successResponse(res, { 
        id: id,
        message: 'Video deleted successfully from both storage and search index' 
      });
      
    } catch (deleteError) {
      console.error('Delete operation failed:', deleteError);
      
      if (deleteError.message === 'Video not found') {
        return errorResponse(res, 404, 'Video not found');
      }
      
      if (deleteError.message.includes('permission')) {
        return errorResponse(res, 403, deleteError.message);
      }
      
      return errorResponse(res, 500, 'Failed to delete video');
    }
    
  } catch (error) {
    console.error('Delete API error:', error);
    if (error.message === 'Method not allowed') {
      return errorResponse(res, 405, error.message);
    }
    if (error.message.includes('Authentication')) {
      return errorResponse(res, 401, error.message);
    }
    return errorResponse(res, 500, 'Internal server error');
  }
}
