/**
 * UploadManager - Handles video upload functionality using Uppy 4.x
 */
class UploadManager {
    constructor() {
        this.uppy = null;
        this.user = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            await Clerk.load();
            this.user = Clerk.user;

            if (!this.user) {
                alert("Please sign in first!");
                window.location.href = '/dev/index.html';
                return;
            }

            await this.waitForUppyModules();
            this.initializeUppy();

            this.isInitialized = true;
        } catch (error) {
            console.error("Error initializing upload page:", error);
            this.showError(`Error: ${error.message || 'Failed to initialize uploader'}`);
        }
    }

    async waitForUppyModules() {
        while (!window.UppyModules) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    initializeUppy() {
        const { Uppy, Dashboard, AwsS3 } = window.UppyModules;
        const userId = this.user.id;

        this.uppy = new Uppy({
            autoProceed: false,
            restrictions: {
                allowedFileTypes: ['video/mp4', 'video/mpeg', 'video/mpeg-4'],
                maxNumberOfFiles: 1,
                maxFileSize: 1771673011 // ~1.65GB
            },
            meta: { user_id: userId },
            onBeforeFileAdded: async (currentFile, files) => {
                // Validate video before accepting
                const isValid = await this.validateVideoFile(currentFile);
                if (!isValid) {
                    alert("Video must be at least 1 minute long and 16:9 aspect ratio.");
                    return false; // reject file
                }
                return true;
            }
        })
            .use(Dashboard, {
                inline: true,
                target: '#uppy-container',
                note: 'Your video must be MP4, 16:9, minimum 1 min, maximum 1.65GB. Business content only.'
            })
            .use(AwsS3, {
                shouldUseMultipart: (file) => file.size > 100 * 1024 * 1024,
                getChunkSize: (file) => 25 * 1024 * 1024, // 25MB chunks = fewer parts
                getUploadParameters: this.getUploadParameters.bind(this),
                createMultipartUpload: this.createMultipartUpload.bind(this),
                listParts: this.listParts.bind(this),
                signPart: this.signPart.bind(this),
                completeMultipartUpload: this.completeMultipartUpload.bind(this),
                abortMultipartUpload: this.abortMultipartUpload.bind(this)
            });

        this.setupEventListeners();
    }

    async validateVideoFile(file) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = URL.createObjectURL(file.data);

            video.onloadedmetadata = () => {
                const duration = video.duration;
                const ratio = video.videoWidth / video.videoHeight;

                URL.revokeObjectURL(video.src);

                // must be at least 60s and approx 16:9
                if (duration >= 60 && Math.abs(ratio - 16 / 9) < 0.05) {
                    // Store metadata
                    this.uppy.setFileMeta(file.id, {
                        width: video.videoWidth,
                        height: video.videoHeight,
                        duration: Math.round(duration),
                        uid: this.user.id
                    });
                    resolve(true);
                } else {
                    resolve(false);
                }
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                resolve(false);
            };
        });
    }

    setupEventListeners() {
        this.uppy.on('upload-progress', (file) => {
            const percent = file.progress?.percentage || 0;
            this.showStatus(`Uploading: ${percent}% complete`, 'info');
        });

        this.uppy.on('complete', this.handleUploadComplete.bind(this));

        this.uppy.on('error', (error) => {
            console.error('Upload error:', error);
            this.showError(`Error: ${error.message || 'Upload failed'}`);
        });
    }

    async getUploadParameters(file) {
        const token = await Clerk.session.getToken();
        const response = await fetch('/api/upload?type=getUploadParameters', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
                key: file.name
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to get upload parameters`);
        }

        const data = await response.json();
        return {
            method: 'PUT',
            url: data.url,
            headers: {
                'Content-Type': file.type
            }
        };
    }

    async createMultipartUpload(file) {
        const token = await Clerk.session.getToken();
        const response = await fetch('/api/upload?type=createMultipartUpload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                filename: file.name,
                contentType: file.type,
                key: file.name
            })
        });

        const data = await response.json();
        return { uploadId: data.uploadId, key: data.key };
    }

    async listParts(file, { uploadId, key }) {
        const token = await Clerk.session.getToken();
        const response = await fetch(`/api/upload?type=listParts&uploadId=${uploadId}&key=${encodeURIComponent(key)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        return data.parts || [];
    }

    async signPart(file, { uploadId, key, partNumber }) {
        const token = await Clerk.session.getToken();
        const response = await fetch(`/api/upload?type=getUploadPartURL&uploadId=${uploadId}&key=${encodeURIComponent(key)}&partNumber=${partNumber}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        return { url: data.url };
    }

    async completeMultipartUpload(file, { uploadId, key, parts }) {
        const token = await Clerk.session.getToken();
        const response = await fetch('/api/upload?type=completeMultipartUpload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uploadId, key, parts })
        });

        const data = await response.json();
        return { location: data.location };
    }

    async abortMultipartUpload(file, { uploadId, key }) {
        const token = await Clerk.session.getToken();
        await fetch('/api/upload?type=abortMultipartUpload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uploadId, key })
        });
    }

    async handleUploadComplete(result) {
        console.log('Upload complete!', result);

        if (result.failed?.length > 0) {
            const firstError = result.failed[0].error;
            this.showError(`Upload failed: ${firstError?.message || 'Unknown error'}`);
            return;
        }

        if (!result.successful?.length) {
            this.showError('No files uploaded.');
            return;
        }

        const uploadedFile = result.successful[0];
        const file = uploadedFile.data;

        // Prefer using a stable/upload key as filename (S3 key).
        // If you created a key in meta (e.g. file.meta.fileKey), use that; otherwise use file.name
        const filename = file.meta?.fileKey || file.name;

        const width = file.meta?.width || 0;
        const height = file.meta?.height || 0;
        const duration = file.meta?.duration || 0;

        // If your server expects `filename` to be unique id, consider sending `id` too:
        const videoId = this.generateVideoId();

        const payload = {
            // send the filename used in S3 (must match server expectation)
            filename,
            width,
            height,
            duration,
            // Optional: allow server to use provided id rather than deriving it from filename
            id: videoId
        };

        try {
            const token = await Clerk.session.getToken();
            const resp = await fetch('/api/insert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const json = await resp.json();

            if (!resp.ok) {
                console.error('Insert failed', json);
                const msg = json?.error || json?.message || resp.statusText;
                this.showError(`Failed to save metadata: ${msg}`);
                return;
            }

            // server returns { success: true, id }
            if (json.success) {
                this.showStatus('Upload and metadata saved! Redirecting...', 'success');
                setTimeout(() => {
                    // prefer redirect to the id returned by server (if present)
                    const idToOpen = json.id || videoId || filename.replace(/\.[^/.]+$/, '');
                    window.location.href = `/dev/?v=${encodeURIComponent(idToOpen)}`;
                }, 900);
            } else {
                console.error('Insert API responded but success=false', json);
                this.showError('Metadata save failed. Check server logs.');
            }
        } catch (err) {
            console.error('Network / unexpected error inserting metadata:', err);
            this.showError('Upload succeeded but saving metadata failed. Please try again later.');
        }
    }

    generateVideoId() {
        return 'vid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `upload-status ${type}`;
            statusEl.style.display = 'block';
        }
    }

    showError(message) {
        this.showStatus(message, 'error');
    }
}

// Initialize
window.addEventListener('load', () => {
    const uploadManager = new UploadManager();
    uploadManager.initialize();
});