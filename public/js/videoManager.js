import { getVideoUrl, getThumbnailUrl } from './apiUtils.js';

// Video management functionality
export class VideoManager {
  constructor(typesenseManager, notificationManager, modalManager) {
    this.typesenseManager = typesenseManager;
    this.notificationManager = notificationManager;
    this.modalManager = modalManager;
    this.currentVideoData = null;
    this.searchResults = null;
  }

  // Load and display videos
  async loadVideos() {
    try {
      await this.typesenseManager.initializeClient();
      const videos = await this.typesenseManager.searchVideos();
      this.searchResults = { hits: videos }; // Store for modal access
      this.displayVideos(videos);
    } catch (error) {
      console.error('Error loading videos:', error);
      
      // Check if it's an authentication error (expired API key)
      if (error.message && error.message.includes('401') && error.message.includes('x-typesense-api-key')) {
        console.log('Typesense API key expired, signing out user...');
        await Clerk.signOut({ redirectUrl: '/dev/auth/' });
        return;
      }
      
      this.notificationManager.showNotification('Failed to load videos', 'error');
    }
  }

  // Display videos in the grid
  displayVideos(videos) {
    const videoGrid = document.getElementById('videoGrid');
    const noVideos = document.getElementById('noVideos');
    
    if (!videos || videos.length === 0) {
      noVideos.style.display = 'block';
      return;
    }

    noVideos.style.display = 'none';
    videoGrid.innerHTML = '';

    videos.forEach(async (video) => {
      const videoCard = await this.createVideoCard(video);
      videoGrid.appendChild(videoCard);
    });
  }

  // Refresh current view after updates
  refreshCurrentView() {
    this.loadVideos();
  }

  // Create a video card element
  async createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = video.document.id;

    // Get thumbnail URL if available
    let thumbnailSrc = null;
    try {
      if (video.document.thumbnail) {
        thumbnailSrc = await getThumbnailUrl(video.document.id);
      }
    } catch (error) {
      console.error('Error loading thumbnail:', error);
    }
    const title = video.document.title || 'Untitled Video';
    const duration = video.document.duration || 'Unknown';
    const fileSize = video.document.file_size ? this.formatFileSize(video.document.file_size) : 'Unknown size';

    card.innerHTML = `
      <div class="video-thumbnail" onclick="videoManager.editVideo('${video.document.id}')" style="cursor: pointer;">
        ${thumbnailSrc ? `<img src="${thumbnailSrc}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">` : 'No thumbnail'}
      </div>
      <div class="video-info">
        <div class="video-title">
          <span onclick="videoManager.editVideo('${video.document.id}')" style="cursor: pointer;">${title}</span>
          <div class="video-actions">
            <button class="dropdown-btn" onclick="videoManager.toggleDropdown('${video.document.id}')">⋮</button>
            <div class="dropdown-menu" id="dropdown-${video.document.id}">
              <button class="dropdown-item" onclick="videoManager.editVideo('${video.document.id}')">Edit</button>
              <button class="dropdown-item danger" onclick="videoManager.deleteVideo('${video.document.id}')">Delete</button>
            </div>
          </div>
        </div>
        <div class="video-meta">Duration: ${duration}</div>
        <div class="video-meta">Size: ${fileSize}</div>
      </div>
    `;

    return card;
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Toggle dropdown menu
  toggleDropdown(videoId) {
    const dropdown = document.getElementById(`dropdown-${videoId}`);
    const isVisible = dropdown.classList.contains('show');
    
    // Close all dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
    
    // Toggle current dropdown
    if (!isVisible) {
      dropdown.classList.add('show');
    }
  }

  // Edit video
  editVideo(videoId) {
    this.modalManager.openVideoModal(videoId);
  }

  // Delete video
  async deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await Clerk.session.getToken()}`
        },
        body: JSON.stringify({ id: videoId })
      });

      const result = await response.json();

      if (result.success) {
        this.notificationManager.showNotification('Video deleted successfully', 'success');
        
        // Video deletion successful
        const videoCard = document.querySelector(`[data-video-id="${videoId}"]`);
        if (videoCard) {
          videoCard.remove();
        }
        
        // Check if no videos left
        const remainingVideos = document.querySelectorAll('.video-card');
        if (remainingVideos.length === 0) {
          document.getElementById('noVideos').style.display = 'block';
        }
      } else {
        throw new Error(result.error || 'Failed to delete video');
      }
    } catch (error) {
      console.error('Failed to delete video:', error);
      this.notificationManager.showNotification('Failed to load videos', 'error');
    }
  }
}

