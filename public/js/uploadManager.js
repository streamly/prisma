/**
 * UploadManager - Handles video upload functionality using Uppy
 */
class UploadManager {
  constructor() {
    this.uppy = null;
    this.user = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the upload manager
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Wait for Clerk to initialize
      await Clerk.load();

      // Check if user is signed in
      this.user = Clerk.user;
      if (!this.user) {
        alert("Please sign in first!");
        window.location.href = '/dev/index.html';
        return;
      }

      // Wait for Uppy modules to load
      await this.waitForUppyModules();
      
      // Initialize Uppy
      this.initializeUppy();
      
      this.isInitialized = true;
    } catch (error) {
      console.error("Error initializing upload page:", error);
      this.showError(`Error: ${error.message || 'Failed to initialize uploader'}`);
    }
  }

  /**
   * Wait for Uppy modules to be available
   */
  async waitForUppyModules() {
    while (!window.UppyModules) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Initialize Uppy with all configurations
   */
  initializeUppy() {
    const { Uppy, Dashboard, AwsS3 } = window.UppyModules;
    const userId = this.user.id;
    
    this.uppy = new Uppy({
      autoProceed: false,
      restrictions: {
        allowedFileTypes: ['video/*'],
        maxNumberOfFiles: 1
      },
      meta: { user_id: userId }
    });

    this.uppy.use(Dashboard, {
      inline: true,
      target: '#uppy-container',
      note: 'Upload your video file.'
    });

    this.uppy.use(AwsS3, {
      shouldUseMultipart: (file) => file.size > 100 * 1024 * 1024,
      getChunkSize: (file) => 10 * 1024 * 1024, // 10MB chunks
      getUploadParameters: this.getUploadParameters.bind(this),
      createMultipartUpload: this.createMultipartUpload.bind(this),
      listParts: this.listParts.bind(this),
      signPart: this.signPart.bind(this),
      completeMultipartUpload: this.completeMultipartUpload.bind(this),
      abortMultipartUpload: this.abortMultipartUpload.bind(this)
    });

    this.setupEventListeners();
  }

  /**
   * Set up Uppy event listeners
   */
  setupEventListeners() {
    // Show upload progress
    this.uppy.on('upload-progress', (file, progress) => {
      const percent = Math.floor(progress.bytesUploaded / progress.bytesTotal * 100);
      this.showStatus(`Uploading: ${percent}% complete`, 'info');
    });

    // Handle upload completion
    this.uppy.on('complete', this.handleUploadComplete.bind(this));
    
    // Handle upload errors
    this.uppy.on('error', (error) => {
      console.error('Upload error:', error);
      this.showError(`Error: ${error.message || 'Upload failed'}`);
    });
  }

  /**
   * Get upload parameters for single file upload
   */
  async getUploadParameters(file) {
    const token = await Clerk.session.getToken();
    const response = await fetch('/api/upload?type=getUploadParameters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        key: file.name
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get upload parameters: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return {
      method: 'PUT',
      url: data.url,
      fields: {},
      headers: {
        'Content-Type': file.type
      }
    };
  }

  /**
   * Create multipart upload
   */
  async createMultipartUpload(file) {
    const token = await Clerk.session.getToken();
    const response = await fetch('/api/upload?type=createMultipartUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        key: file.name
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create multipart upload: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return {
      uploadId: data.uploadId,
      key: data.key
    };
  }

  /**
   * List parts for multipart upload
   */
  async listParts(file, { uploadId, key }) {
    const token = await Clerk.session.getToken();
    const response = await fetch(`/api/upload?type=listParts&uploadId=${uploadId}&key=${encodeURIComponent(key)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      }
    });
    const data = await response.json();
    return data.parts || [];
  }

  /**
   * Sign part for multipart upload
   */
  async signPart(file, { uploadId, key, partNumber }) {
    const token = await Clerk.session.getToken();
    const response = await fetch(`/api/upload?type=getUploadPartURL&uploadId=${uploadId}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to get upload URL: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return {
      url: data.url
    };
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(file, { uploadId, key, parts }) {
    const token = await Clerk.session.getToken();
    const response = await fetch('/api/upload?type=completeMultipartUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      },
      body: JSON.stringify({
        uploadId,
        key,
        parts
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to complete upload: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    return {
      location: data.location
    };
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(file, { uploadId, key }) {
    const token = await Clerk.session.getToken();
    await fetch('/api/upload?type=abortMultipartUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-User-Email': this.user.emailAddress
      },
      body: JSON.stringify({
        uploadId,
        key
      })
    });
  }

  /**
   * Handle upload completion
   */
  async handleUploadComplete(result) {
    console.log('Upload complete! Successful:', result.successful, 'Failed:', result.failed);
    
    if (result.failed && result.failed.length > 0) {
      // There were failed uploads - show error and don't redirect
      const firstError = result.failed[0].error;
      this.showError(`Upload failed: ${firstError?.message || 'Unknown error'}`);
      console.error('Upload failed:', result.failed);
    } else if (result.successful && result.successful.length > 0) {
      // All uploads successful - insert metadata to Typesense
      this.showStatus('Upload complete! Processing video metadata...', 'success');
      
      const uploadedFile = result.successful[0];
      const file = uploadedFile.data;
      
      // Prepare metadata for Typesense (only essential fields)
      const videoMetadata = {
        id: this.generateVideoId(),
        filename: file.name,
        file_size: file.size,
        content_type: file.type,
        duration: 0 // Will be updated later when video is processed
      };
      
      try {
        // Insert video metadata to Typesense
        const response = await fetch('/api/insert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await Clerk.session.getToken()}`
          },
          body: JSON.stringify(videoMetadata)
        });
        
        const result = await response.json();
        
        if (result.success) {
          this.showStatus('Upload and processing complete! Redirecting...', 'success');
          // Redirect to video details page
          setTimeout(() => {
            window.location.href = `/dev/?v=${videoMetadata.id}`;
          }, 1000);
        } else {
          throw new Error(result.error || 'Failed to process video metadata');
        }
      } catch (error) {
        console.error('Failed to insert video metadata:', error);
        this.showError('Upload successful but failed to process metadata. Please try again.');
        
        // Still redirect to dashboard after a delay
        setTimeout(() => {
          window.location.href = '/dev/';
        }, 3000);
      }
    } else {
      // No files processed
      this.showError('No files were uploaded.');
    }
  }

  /**
   * Generate a unique video ID
   */
  generateVideoId() {
    return 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('upload-status');
    statusEl.textContent = message;
    statusEl.className = `upload-status ${type}`;
    statusEl.style.display = 'block';
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showStatus(message, 'error');
  }
}

// Initialize upload manager when DOM is loaded
window.addEventListener('load', () => {
  const uploadManager = new UploadManager();
  uploadManager.initialize();
});