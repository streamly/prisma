import { getVideoUrl } from './config.js';

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
  constructVideoUrl(filename) {
    return getVideoUrl(filename);
  }

  // Open video modal
  openVideoModal(videoId) {
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
      this.currentVideoData = {
        id: videoId,
        title: videoData.document.title || 'Untitled Video',
        description: videoData.document.description || '',
        filename: videoData.document.filename,
        thumbnail: videoData.document.thumbnail || '',
        url: this.constructVideoUrl(videoData.document.filename)
      };
    } else {
      // Fallback to basic data from DOM
      this.currentVideoData = {
        id: videoId,
        title: videoCard.querySelector('.video-title span').textContent,
        description: '',
        filename: videoId + '.mp4', // Placeholder
        thumbnail: '',
        url: this.constructVideoUrl(videoId + '.mp4')
      };
    }

    // Populate modal
    document.getElementById('videoTitle').value = this.currentVideoData.title;
    document.getElementById('videoDescription').value = this.currentVideoData.description;
    
    // Set video source (construct URL from filename)
    const videoElement = document.getElementById('videoElement');
    const videoSource = videoElement.querySelector('source');
    // Use the actual video URL from the video data, or construct it properly
    // This should be set from the backend API response with the correct iDrive e2 URL
    videoSource.src = this.currentVideoData.url || `${this.currentVideoData.filename}`;
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

  // Generate thumbnail from video
  generateThumbnail() {
    const videoElement = document.getElementById('videoElement');
    if (videoElement.videoWidth === 0) {
      this.notificationManager.showNotification('Please wait for video to load', 'info');
      return;
    }

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw current frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and display
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const thumbnailPreview = document.getElementById('thumbnailPreview');
      thumbnailPreview.innerHTML = `<img src="${url}" alt="Generated thumbnail">`;
      
      // Store thumbnail data for upload
      this.currentVideoData.thumbnailBlob = blob;
      this.notificationManager.showNotification('Thumbnail generated successfully', 'success');
    }, 'image/jpeg', 0.8);
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

