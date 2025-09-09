// Video management functionality
class VideoManager {
  constructor(typesenseManager) {
    this.typesenseManager = typesenseManager;
    this.currentVideoData = null;
  }

  // Load and display videos
  async loadVideos() {
    try {
      await this.typesenseManager.initializeClient();
      const videos = await this.typesenseManager.searchVideos();
      this.displayVideos(videos);
    } catch (error) {
      console.error('Error loading videos:', error);
      document.getElementById('noVideos').style.display = 'block';
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

    videos.forEach(video => {
      const videoCard = this.createVideoCard(video);
      videoGrid.appendChild(videoCard);
    });
  }

  // Create a video card element
  createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.dataset.videoId = video.document.id;

    const thumbnailUrl = video.document.thumbnail || '';
    const title = video.document.title || 'Untitled Video';
    const duration = video.document.duration || 'Unknown';
    const fileSize = video.document.file_size ? this.formatFileSize(video.document.file_size) : 'Unknown size';

    card.innerHTML = `
      <div class="video-thumbnail">
        ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;">` : 'No thumbnail'}
      </div>
      <div class="video-info">
        <div class="video-title">
          <span>${title}</span>
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
    window.modalManager.openVideoModal(videoId);
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
        window.notificationManager.showNotification('Video deleted successfully', 'success');
        
        // Remove video card from DOM
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
      window.notificationManager.showNotification('Failed to delete video', 'error');
    }
  }
}

// Export for use in other modules
window.VideoManager = VideoManager;
