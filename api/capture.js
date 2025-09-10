import { 
  setCorsHeaders, 
  handleOptions, 
  authenticateUser, 
  validateMethod
} from '../lib/apiHelpers.js';
import { getTypesenseClient } from '../lib/typesenseClient.js';
import { uploadToS3 } from '../lib/s3Client.js';
import sharp from 'sharp';

export default async function handler(req, res) {
  try {
    setCorsHeaders(res);
    
    if (handleOptions(req, res)) return;
    
    try {
      validateMethod(req, ['POST']);
      const userId = await authenticateUser(req);
      
      // Parse request data (blob or form data)
      const { videoId, thumbnailBuffer, timestamp } = await parseRequestData(req);
      
      if (!videoId || !thumbnailBuffer) {
        return res.status(400).json({
          success: false,
          error: 'Missing videoId or thumbnail data'
        });
      }
      
      try {
        // Verify video ownership
        const typesenseClient = getTypesenseClient();
        const videoDoc = await typesenseClient.collections('videos').documents(videoId).retrieve();
        
        if (!videoDoc || videoDoc.uid !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
        
        // Compress image with Sharp to 10KB max
        let finalBuffer = await compressImageTo10KB(thumbnailBuffer);
        
        // Save as videoId.jpg
        const filename = `${videoId}.jpg`;
        const uploadResult = await uploadToS3(filename, finalBuffer, 'image/jpeg');
        
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload thumbnail');
        }
        
        // Update video document in Typesense
        const updateData = { thumbnail: filename };
        if (timestamp !== undefined) {
          updateData.thumbnail_timestamp = parseFloat(timestamp);
        }
        
        await typesenseClient.collections('videos').documents(videoId).update(updateData);
        
        console.log('Thumbnail processed and uploaded:', {
          videoId,
          filename,
          originalSize: thumbnailBuffer.length,
          optimizedSize: finalBuffer.length,
          timestamp
        });
        
        return res.status(200).json({
          success: true,
          message: 'Thumbnail processed and saved successfully',
          filename,
          originalSize: thumbnailBuffer.length,
          optimizedSize: finalBuffer.length
        });
        
      } catch (processingError) {
        console.error('Thumbnail processing error:', processingError);
        return res.status(500).json({
          success: false,
          error: `Processing failed: ${processingError.message}`
        });
      }
      
    } catch (authError) {
      console.error('Authentication error:', authError);
      
      if (authError.message === 'Method not allowed') {
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
  } catch (criticalError) {
    console.error('Critical capture error:', criticalError);
    
    try {
      return res.status(500).json({
        success: false,
        error: `Server error: ${criticalError.message}`
      });
    } catch (responseError) {
      console.error('Failed to send error response:', responseError);
      res.status(500).end('Internal Server Error');
    }
  }
}

// Parse request data - handles both blob and form data
async function parseRequestData(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      
      // Prevent memory issues with large uploads
      if (totalLength > 1024 * 1024) { // 1MB limit
        reject(new Error('Upload too large'));
      }
    });
    
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        
        // Handle multipart form data
        if (contentType.includes('multipart/form-data')) {
          const boundary = contentType.split('boundary=')[1];
          if (!boundary) {
            reject(new Error('Invalid multipart data'));
            return;
          }
          
          const parts = buffer.toString('binary').split(`--${boundary}`);
          const formData = {};
          
          for (const part of parts) {
            if (part.includes('Content-Disposition')) {
              const nameMatch = part.match(/name="([^"]+)"/);
              if (!nameMatch) continue;
              
              const fieldName = nameMatch[1];
              
              if (fieldName === 'thumbnail') {
                // Extract binary data for thumbnail
                const binaryStart = buffer.indexOf('\r\n\r\n', buffer.indexOf(`name="${fieldName}"`)) + 4;
                const binaryEnd = buffer.indexOf(`\r\n--${boundary}`, binaryStart);
                formData.thumbnailBuffer = buffer.slice(binaryStart, binaryEnd);
              } else {
                // Extract text data
                const contentStart = part.indexOf('\r\n\r\n') + 4;
                const contentEnd = part.lastIndexOf('\r\n');
                formData[fieldName] = part.substring(contentStart, contentEnd);
              }
            }
          }
          
          resolve(formData);
        } 
        // Handle raw blob data with query parameters
        else {
          const url = new URL(req.url, `http://${req.headers.host}`);
          resolve({
            videoId: url.searchParams.get('videoId'),
            timestamp: url.searchParams.get('timestamp'),
            thumbnailBuffer: buffer
          });
        }
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}

// Compress image to 10KB maximum using Sharp
async function compressImageTo10KB(buffer) {
  const maxSize = 10240; // 10KB
  let quality = 80;
  let width = 240;
  let height = 180;
  
  // Try different compression settings until under 10KB
  while (quality > 10) {
    try {
      const compressed = await sharp(buffer)
        .jpeg({ 
          quality,
          progressive: true,
          mozjpeg: true
        })
        .resize(width, height, { 
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();
      
      if (compressed.length <= maxSize) {
        return compressed;
      }
      
      // Reduce quality and dimensions
      quality -= 10;
      if (quality <= 40) {
        width = Math.max(160, width - 20);
        height = Math.max(120, height - 15);
      }
    } catch (error) {
      console.error('Sharp compression error:', error);
      throw new Error('Image compression failed');
    }
  }
  
  // Final attempt with minimum settings
  return await sharp(buffer)
    .jpeg({ quality: 10, progressive: true })
    .resize(160, 120, { fit: 'inside' })
    .toBuffer();
}
