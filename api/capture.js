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
      
      // Parse multipart form data
      const formData = await parseFormData(req);
      const { videoId, thumbnail, timestamp } = formData;
      
      if (!videoId || !thumbnail) {
        return res.status(400).json({
          success: false,
          error: 'Missing videoId or thumbnail'
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
        
        // Process image with Sharp to optimize to 5-6KB
        let buffer = thumbnail;
        if (typeof thumbnail === 'string') {
          // If base64, convert to buffer
          buffer = Buffer.from(thumbnail.split(',')[1], 'base64');
        }
        
        // Optimize image with Sharp
        const optimizedBuffer = await sharp(buffer)
          .jpeg({ 
            quality: 60,
            progressive: true,
            mozjpeg: true
          })
          .resize(240, 180, { 
            fit: 'inside',
            withoutEnlargement: true
          })
          .toBuffer();
        
        // If still too large, reduce quality further
        let finalBuffer = optimizedBuffer;
        if (optimizedBuffer.length > 6144) { // 6KB
          finalBuffer = await sharp(buffer)
            .jpeg({ 
              quality: 40,
              progressive: true,
              mozjpeg: true
            })
            .resize(200, 150, { 
              fit: 'inside',
              withoutEnlargement: true
            })
            .toBuffer();
        }
        
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
          originalSize: buffer.length,
          optimizedSize: finalBuffer.length,
          timestamp
        });
        
        return res.status(200).json({
          success: true,
          message: 'Thumbnail processed and saved successfully',
          filename,
          originalSize: buffer.length,
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

// Simple multipart form parser for thumbnail upload
async function parseFormData(req) {
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
        const boundary = req.headers['content-type'].split('boundary=')[1];
        
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
            const contentStart = part.indexOf('\r\n\r\n') + 4;
            const contentEnd = part.lastIndexOf('\r\n');
            
            if (fieldName === 'thumbnail') {
              // Extract binary data for thumbnail
              const binaryStart = buffer.indexOf('\r\n\r\n', buffer.indexOf(`name="${fieldName}"`)) + 4;
              const binaryEnd = buffer.indexOf(`\r\n--${boundary}`, binaryStart);
              formData[fieldName] = buffer.slice(binaryStart, binaryEnd);
            } else {
              // Extract text data
              formData[fieldName] = part.substring(contentStart, contentEnd);
            }
          }
        }
        
        resolve(formData);
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}
