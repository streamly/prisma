import { getVideoUrl } from './apiUtils.js';

// Modal management functionality
export class ModalManager {
  constructor(notificationManager) {
    this.currentVideoData = null;
    this.notificationManager = notificationManager;
    this.videoManager = null; // Will be set by App
  }

  // Set video manager reference (called by App after construction)
  setVideoManager(videoManager) {
    this.videoManager = videoManager;
  }

  // Setup event listeners for modal functionality
  setupEventListeners() {
    // Modal close button
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
      closeBtn.onclick = () => this.closeVideoModal();
    }

    // Click outside modal to close (removed duplicate from app.js)

    // Generate thumbnail button
    const generateThumbnailBtn = document.getElementById('generateThumbnail');
    if (generateThumbnailBtn) {
      generateThumbnailBtn.onclick = () => this.generateThumbnail();
    }


    // Save button (renamed from publish)
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.onclick = () => this.saveVideo();
    }
  }

  // Construct video URL for iDrive e2 storage
  async constructVideoUrl(videoId) {
    return await getVideoUrl(videoId);
  }

  // Open video modal
  async openVideoModal(videoId) {
    // Find video data from the loaded videos
    const videoCard = document.querySelector(`[data-video-id="${videoId}"]`);
    if (!videoCard) {
      this.notificationManager.showNotification('Video not found', 'error');
      return;
    }

    // Get video data from the search results stored in videoManager
    let videoData = null;
    if (this.videoManager && this.videoManager.searchResults && this.videoManager.searchResults.hits) {
      videoData = this.videoManager.searchResults.hits.find(hit => hit.document.id === videoId);
    }

    if (videoData) {
      // Get presigned URL for video access using video ID
      let videoUrl = videoData.document.video_url;
      if (!videoUrl) {
        try {
          videoUrl = await getVideoUrl(videoData.document.id);
        } catch (error) {
          console.error('Failed to get video URL:', error);
          videoUrl = await this.constructVideoUrl(videoData.document.id);
        }
      }

      this.currentVideoData = {
        id: videoId,
        title: videoData.document.title || 'Untitled Video',
        description: videoData.document.description || '',
        filename: videoData.document.filename,
        thumbnail: videoData.document.thumbnail || '',
        url: videoUrl
      };
    } else {
      // Fallback to basic data from DOM - use video ID directly
      let videoUrl;
      try {
        videoUrl = await getVideoUrl(videoId);
      } catch (error) {
        console.error('Failed to get video URL:', error);
        videoUrl = await this.constructVideoUrl(videoId);
      }

      this.currentVideoData = {
        id: videoId,
        title: videoCard.querySelector('.video-title span').textContent,
        description: '',
        filename: '', // Will be retrieved from database
        thumbnail: '',
        url: videoUrl
      };
    }

    // Populate modal
    document.getElementById('videoTitle').value = this.currentVideoData.title;
    document.getElementById('videoDescription').value = this.currentVideoData.description;
    
    // Set video source with presigned URL
    const videoElement = document.getElementById('videoElement');
    const videoSource = videoElement.querySelector('source');
    videoSource.src = this.currentVideoData.url;
    videoElement.load();

    // Reset thumbnail preview
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    if (this.currentVideoData.thumbnail) {
      thumbnailPreview.innerHTML = `<img src="${this.currentVideoData.thumbnail}" alt="Thumbnail">`;
    } else {
      thumbnailPreview.innerHTML = '<span>Click to generate thumbnail</span>';
    }

    // Show modal
    document.getElementById('videoModal').style.display = 'block';
  }

  // Close video modal
  closeVideoModal() {
    document.getElementById('videoModal').style.display = 'none';
    const videoElement = document.getElementById('videoElement');
    videoElement.pause();
    this.currentVideoData = null;
  }

  // Generate thumbnail from current video frame
  async generateThumbnail() {
    const videoElement = document.getElementById('videoElement');
    if (!videoElement) {
      this.notificationManager.showNotification('Video element not found', 'error');
      return;
    }

    // Wait for video to be loaded
    if (videoElement.readyState < 2) {
      this.notificationManager.showNotification('Video not ready. Please wait for it to load.', 'error');
      return;
    }

    try {
      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Get video dimensions
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      if (!videoWidth || !videoHeight) {
        this.notificationManager.showNotification('Unable to get video dimensions', 'error');
        return;
      }
      
      // Calculate optimal dimensions to keep under 10KB
      const maxWidth = 240;  // Smaller for better compression
      const maxHeight = 180;
      const aspectRatio = videoWidth / videoHeight;
      
      let canvasWidth, canvasHeight;
      if (aspectRatio > maxWidth / maxHeight) {
        canvasWidth = maxWidth;
        canvasHeight = maxWidth / aspectRatio;
      } else {
        canvasHeight = maxHeight;
        canvasWidth = maxHeight * aspectRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Draw current video frame to canvas
      ctx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
      
      // Convert to blob with compression
      const blob = await this.compressCanvasToBlob(canvas);
      
      if (blob.size > 10240) { // 10KB limit
        this.notificationManager.showNotification('Thumbnail too large. Try pausing at a simpler frame.', 'error');
        return;
      }
      
      // Display preview immediately from canvas
      const url = URL.createObjectURL(blob);
      const thumbnailPreview = document.getElementById('thumbnailPreview');
      thumbnailPreview.innerHTML = `
        <img src="${url}" alt="Generated thumbnail">
        <div class="thumbnail-info">Size: ${(blob.size / 1024).toFixed(1)}KB</div>
      `;
      
      // Store thumbnail data
      this.currentVideoData.thumbnailBlob = blob;
      this.currentVideoData.thumbnailTimestamp = videoElement.currentTime;
      
      this.notificationManager.showNotification('Thumbnail generated successfully', 'success');
      
      // Send to backend for processing (optional - for saving to S3)
      await this.uploadThumbnailToCapture(blob);
      
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      this.notificationManager.showNotification('Failed to generate thumbnail', 'error');
    }
  }

  // Compress canvas to blob with optimal quality for 10KB limit
  async compressCanvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      let quality = 0.7; // Start with lower quality for smaller files
      
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }
          
          if (blob.size <= 10240 || quality <= 0.1) {
            resolve(blob);
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      
      tryCompress();
    });
  }
  
  // Upload thumbnail blob to /api/capture endpoint
  async uploadThumbnailToCapture(blob) {
    if (!this.currentVideoData || !this.currentVideoData.id) {
      this.notificationManager.showNotification('No video data available', 'error');
      return;
    }

    try {
      // Build query parameters for blob upload
      const params = new URLSearchParams({
        videoId: this.currentVideoData.id
      });
      
      if (this.currentVideoData.thumbnailTimestamp !== undefined) {
        params.append('timestamp', this.currentVideoData.thumbnailTimestamp.toString());
      }

      // Send raw blob data directly
      const response = await fetch(`/api/capture?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await Clerk.session.getToken()}`,
          'Content-Type': 'application/octet-stream'
        },
        body: blob
      });

      const result = await response.json();

      if (result.success) {
        console.log('Thumbnail uploaded and compressed:', result);
        this.currentVideoData.thumbnail = result.filename;
        
        // Show compression info
        if (result.originalSize && result.optimizedSize) {
          const compressionRatio = ((result.originalSize - result.optimizedSize) / result.originalSize * 100).toFixed(1);
          console.log(`Thumbnail compressed: ${(result.originalSize/1024).toFixed(1)}KB → ${(result.optimizedSize/1024).toFixed(1)}KB (${compressionRatio}% reduction)`);
        }
      } else {
        console.error('Thumbnail upload failed:', result.error);
        this.notificationManager.showNotification('Failed to save thumbnail to S3', 'error');
      }
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      this.notificationManager.showNotification('Failed to upload thumbnail', 'error');
    }
  }

  // Handle custom thumbnail file upload
  handleCustomThumbnail(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.notificationManager.showNotification('Please select an image file', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const thumbnailPreview = document.getElementById('thumbnailPreview');
      thumbnailPreview.innerHTML = `<img src="${e.target.result}" alt="Custom thumbnail">`;
      this.currentVideoData.thumbnailBlob = file;
      this.notificationManager.showNotification('Thumbnail uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
  }


  // Convert blob to base64
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Save video metadata (unified save function)
  async saveVideo() {
    if (!this.currentVideoData || !this.currentVideoData.id) {
      this.notificationManager.showNotification('No video data available', 'error');
      return;
    }

    const title = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDescription').value.trim();

    if (!title) {
      this.notificationManager.showNotification('Please enter a title', 'error');
      return;
    }

    try {
      // Thumbnail is already uploaded via uploadThumbnailToCapture during generation
      // No need to upload again here

      const updateData = {
        id: this.currentVideoData.id,
        title: title,
        description: description
      };

      // Include thumbnail if available
      if (this.currentVideoData.thumbnail) {
        updateData.thumbnail = this.currentVideoData.thumbnail;
      }

      const response = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await Clerk.session.getToken()}`
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        this.notificationManager.showNotification('Video saved successfully', 'success');
        this.closeVideoModal();
        
        // Update the video card in the grid immediately
        const videoCard = document.querySelector(`[data-video-id="${this.currentVideoData.id}"]`);
        if (videoCard) {
          const titleElement = videoCard.querySelector('.video-title span');
          if (titleElement) {
            titleElement.textContent = title;
          }
          
          // Update description if visible
          const descElement = videoCard.querySelector('.video-description');
          if (descElement) {
            descElement.textContent = description;
          }
          
          // Update thumbnail if changed
          if (this.currentVideoData.thumbnail) {
            const thumbnailImg = videoCard.querySelector('.video-thumbnail img');
            if (thumbnailImg) {
              // Force reload thumbnail with cache busting
              const thumbnailUrl = `/api/getThumbnailUrl?videoId=${this.currentVideoData.id}&t=${Date.now()}`;
              thumbnailImg.src = thumbnailUrl;
            }
          }
        }
        
        // Update current video data
        this.currentVideoData.title = title;
        this.currentVideoData.description = description;
      } else {
        throw new Error(result.error || 'Failed to save video');
      }
    } catch (error) {
      console.error('Failed to save video:', error);
      this.notificationManager.showNotification('Failed to save video', 'error');
    }
  }
}

