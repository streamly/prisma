/**
 * UploadManager - Handles video upload functionality using Uppy with AWS S3 multipart
 */
class UploadManager {
  constructor(containerSelector, statusSelector) {
    this.containerSelector = containerSelector;
    this.statusSelector = statusSelector;
    this.uppy = null;
    this.user = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the upload manager
   */
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Wait for Clerk to initialize
      await this.waitForClerk();
      await Clerk.load();

      // Check if user is signed in
      this.user = Clerk.user;
      if (!this.user) {
        Clerk.redirectToSignIn({ redirectUrl: window.location.href });
        return;
      }

      // Initialize Uppy
      this.initializeUppy();
      
      this.isInitialized = true;
    } catch (error) {
      console.error("Error initializing upload manager:", error);
      this.showError(`Error: ${error.message || 'Failed to initialize uploader'}`);
    }
  }

  /**
   * Wait for Clerk to be available
   */
  async waitForClerk() {
    return new Promise((resolve) => {
      if (typeof Clerk !== 'undefined') {
        resolve();
      } else {
        const checkClerk = setInterval(() => {
          if (typeof Clerk !== 'undefined') {
            clearInterval(checkClerk);
            resolve();
          }
        }, 100);
      }
    });
  }

  /**
   * Initialize Uppy with all configurations
   */
  initializeUppy() {
    const userId = this.user.id;
    
    this.uppy = new Uppy.Core({
      restrictions: {
        minNumberOfFiles: 1,
        maxNumberOfFiles: 1,
        maxFileSize: 1771673011, // ~1.65GB
        minFileSize: 1000,
        allowedFileTypes: ['video/mp4']
      },
      autoProceed: false,
      meta: { user_id: userId }
    })
    .use(Uppy.Dashboard, {
      target: this.containerSelector,
      inline: true,
      height: '75vh',
      width: '100%',
      proudlyDisplayPoweredByUppy: false,
      note: 'Your video must be MP4, 1min–1.65GB. Business content only.',
      locale: {
        strings: {
          poweredBy: '',
          dropPasteFiles: 'Drag and drop a video or %{browseFiles}'
        }
      }
    })
    .use(Uppy.AwsS3Multipart, {
      limit: 5,
      createMultipartUpload: this.createMultipartUpload.bind(this),
      signPart: this.signPart.bind(this),
      completeMultipartUpload: this.completeMultipartUpload.bind(this)
    });

    this.setupEventListeners();
  }

  /**
   * Set up Uppy event listeners
   */
  setupEventListeners() {
    // Validate video metadata on file add
    this.uppy.on('file-added', (file) => {
      this.uppy.setFileMeta(file.id, { userId: this.user.id });

      const video = document.createElement('video');
      video.src = URL.createObjectURL(file.data);

      video.addEventListener('loadedmetadata', () => {
        const duration = video.duration;

        if (duration <= 59) {
          this.uppy.removeFile(file.id);
          alert("Video must be at least 1 minute long.");
        } else {
          this.uppy.setFileMeta(file.id, {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Math.round(duration)
          });
        }

        URL.revokeObjectURL(video.src);
      });
    });

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
   * Create multipart upload
   */
  async createMultipartUpload(file) {
    const fileKey = md5(Date.now() + '_' + file.name.replace(/\s+/g, '_'));
    this.uppy.setFileMeta(file.id, { fileKey });

    const token = await Clerk.session.getToken();
    const resp = await fetch('/api/upload', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        action: 'create',
        filename: fileKey, 
        contentType: file.type 
      })
    });

    if (!resp.ok) throw new Error('Failed to init multipart upload');
    return resp.json(); // { uploadId, key }
  }

  /**
   * Sign part for multipart upload
   */
  async signPart(file, { key, uploadId, partNumber }) {
    const token = await Clerk.session.getToken();
    const resp = await fetch('/api/upload', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        action: 'sign',
        key, 
        uploadId, 
        partNumber 
      })
    });

    if (!resp.ok) throw new Error('Failed to sign part');
    const { url } = await resp.json();
    return { url };
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(file, { key, uploadId, parts }) {
    const token = await Clerk.session.getToken();
    const resp = await fetch('/api/upload', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        action: 'complete',
        key, 
        uploadId, 
        parts 
      })
    });

    if (!resp.ok) throw new Error('Failed to complete upload');
    return resp.json();
  }

  /**
   * Handle upload completion
   */
  async handleUploadComplete(result) {
    if (result.successful.length) {
      const file = result.successful[0];
      const fileKey = file.meta.fileKey;
      
      try {
        const token = await Clerk.session.getToken();
        const insertResp = await fetch('/api/upload', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'insert',
            filename: fileKey,
            width: file.meta.width,
            height: file.meta.height,
            duration: file.meta.duration,
            userId: file.meta.userId
          })
        });

        if (insertResp.ok) {
          const insertResult = await insertResp.json();
          this.showStatus('Upload and processing complete! Redirecting...', 'success');
          // Redirect to dashboard with success
          setTimeout(() => {
            window.location.href = "/dev/index.html?uploaded=1";
          }, 1000);
        } else {
          console.error('Failed to insert video metadata');
          this.showError('Upload completed but failed to save metadata. Please contact support.');
        }
      } catch (error) {
        console.error('Error inserting video metadata:', error);
        this.showError('Upload completed but failed to save metadata. Please contact support.');
      }
    }
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.querySelector(this.statusSelector);
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `upload-status ${type}`;
      statusEl.style.display = 'block';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showStatus(message, 'error');
  }
}
