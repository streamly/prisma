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

    // Thumbnail upload input
    const thumbnailUpload = document.getElementById('thumbnailUpload');
    if (thumbnailUpload) {
      thumbnailUpload.onchange = (event) => this.handleThumbnailUpload(event);
    }

    // Publish button
    const publishBtn = document.getElementById('publishBtn');
    if (publishBtn) {
      publishBtn.onclick = () => this.publishVideo();
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

  // Generate thumbnail from video at current timestamp
  async generateThumbnail() {
    const videoElement = document.getElementById('videoElement');
    if (videoElement.videoWidth === 0) {
      this.notificationManager.showNotification('Please wait for video to load', 'info');
      return;
    }

    try {
      // Create canvas to capture frame
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (limit to reasonable dimensions for compression)
      const maxWidth = 320;
      const maxHeight = 240;
      const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
      
      let canvasWidth = Math.min(videoElement.videoWidth, maxWidth);
      let canvasHeight = Math.min(videoElement.videoHeight, maxHeight);
      
      if (canvasWidth / canvasHeight > aspectRatio) {
        canvasWidth = canvasHeight * aspectRatio;
      } else {
        canvasHeight = canvasWidth / aspectRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Draw current frame
      ctx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
      
      // Convert to compressed blob
      const blob = await this.compressThumbnail(canvas);
      
      if (blob.size > 10240) { // 10KB limit
        this.notificationManager.showNotification('Thumbnail too large. Try a different frame.', 'error');
        return;
      }
      
      // Display preview
      const url = URL.createObjectURL(blob);
      const thumbnailPreview = document.getElementById('thumbnailPreview');
      thumbnailPreview.innerHTML = `
        <img src="${url}" alt="Generated thumbnail">
        <div class="thumbnail-info">Size: ${(blob.size / 1024).toFixed(1)}KB</div>
      `;
      
      // Store thumbnail data for upload
      this.currentVideoData.thumbnailBlob = blob;
      this.currentVideoData.thumbnailTimestamp = videoElement.currentTime;
      
      this.notificationManager.showNotification('Thumbnail generated successfully', 'success');
      
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      this.notificationManager.showNotification('Failed to generate thumbnail', 'error');
    }
  }

  // Compress thumbnail to ensure it's under 10KB
  async compressThumbnail(canvas) {
    return new Promise((resolve) => {
      let quality = 0.8;
      
      const tryCompress = () => {
        canvas.toBlob((blob) => {
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

  // Handle thumbnail file upload
  handleThumbnailUpload(event) {
    const file = event.target.files[0];
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

  // Upload thumbnail to backend
  async uploadThumbnail() {
    if (!this.currentVideoData || !this.currentVideoData.thumbnailBlob) {
      this.notificationManager.showNotification('Please generate a thumbnail first', 'error');
      return;
    }

    try {
      // Convert blob to base64
      const base64Data = await this.blobToBase64(this.currentVideoData.thumbnailBlob);
      
      const response = await fetch('/api/uploadThumbnail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await Clerk.session.getToken()}`
        },
        body: JSON.stringify({
          videoId: this.currentVideoData.id,
          thumbnailData: base64Data,
          timestamp: this.currentVideoData.thumbnailTimestamp
        })
      });

      const result = await response.json();

      if (result.success) {
        this.notificationManager.showNotification('Thumbnail uploaded successfully', 'success');
        // Update current video data with thumbnail filename
        this.currentVideoData.thumbnail = result.thumbnailFilename;
      } else {
        throw new Error(result.error || 'Failed to upload thumbnail');
      }
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      this.notificationManager.showNotification(`Failed to upload thumbnail: ${error.message}`, 'error');
    }
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

  // Publish video (update details)
  async publishVideo() {
    if (!this.currentVideoData) return;

    const title = document.getElementById('videoTitle').value.trim();
    const description = document.getElementById('videoDescription').value.trim();

    if (!title) {
      this.notificationManager.showNotification('Please enter a title', 'error');
      return;
    }

    try {
      // Upload thumbnail if one was generated
      if (this.currentVideoData.thumbnailBlob && !this.currentVideoData.thumbnail) {
        await this.uploadThumbnail();
      }

      const updateData = {
        id: this.currentVideoData.id,
        title: title,
        description: description
      };

      // If thumbnail was generated/uploaded, include it
      if (this.currentVideoData.thumbnailBlob) {
        // In a real implementation, you'd upload the thumbnail to storage first
        // For now, we'll just include a placeholder
        updateData.thumbnail = 'thumbnail-url-placeholder';
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
        this.notificationManager.showNotification('Video details updated successfully', 'success');
        this.closeVideoModal();
        
        // Update the video card in the grid
        const videoCard = document.querySelector(`[data-video-id="${this.currentVideoData.id}"]`);
        if (videoCard) {
          const titleElement = videoCard.querySelector('.video-title span');
          titleElement.textContent = title;
        }
      } else {
        throw new Error(result.error || 'Failed to update video');
      }
    } catch (error) {
      console.error('Failed to update video:', error);
      this.notificationManager.showNotification('Failed to update video details', 'error');
    }
  }
}

