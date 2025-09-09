import { NotificationManager } from './notificationManager.js';
import { TypesenseManager } from './typesenseClient.js';
import { VideoManager } from './videoManager.js';
import { ModalManager } from './modalManager.js';

// Main application initialization
class App {
  constructor() {
    this.typesenseManager = new TypesenseManager();
    this.notificationManager = new NotificationManager();
    this.videoManager = new VideoManager(this.typesenseManager, this.notificationManager);
    this.modalManager = new ModalManager(this.notificationManager);
  }

  async initialize() {
    try {
      // Wait for Clerk to initialize
      await Clerk.load();

      const session = Clerk.session;
      const greetingEl = document.getElementById('greeting');
      const signInBtn = document.getElementById('signInBtn');
      const uploadBtn = document.getElementById('uploadBtn');
      const signOutBtn = document.getElementById('signOutBtn');
      const videosContainer = document.getElementById('videosContainer');

      if (session) {
        // User is signed in
        const user = Clerk.user;
        greetingEl.innerHTML = `<strong>Hello, ${user.fullName}!</strong><br>You can now upload videos.`;
        signInBtn.style.display = 'none';
        uploadBtn.style.display = 'inline-block';
        signOutBtn.style.display = 'inline-block';
        videosContainer.style.display = 'block';
        
        // Load videos
        await this.videoManager.loadVideos();
      } else {
        // Not signed in
        greetingEl.textContent = "Please sign in to access your account.";
        signInBtn.style.display = 'inline-block';
        uploadBtn.style.display = 'none';
        signOutBtn.style.display = 'none';
        videosContainer.style.display = 'none';
      }

      this.setupEventListeners(session);
      this.setupGlobalEventListeners();

      // Check for video ID in URL on page load
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      if (videoId && session) {
        // Wait a bit for videos to load, then open modal
        setTimeout(() => {
          this.modalManager.openVideoModal(videoId);
        }, 1000);
      }

    } catch (error) {
      console.error('Dashboard initialization error:', error);
      document.getElementById('greeting').textContent = 'Error loading dashboard. Please try again later.';
    }
  }

  setupEventListeners(session) {
    const signInBtn = document.getElementById('signInBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    // Sign In button
    signInBtn.addEventListener('click', async () => {
      try {
        await Clerk.redirectToSignIn({
          redirectUrl: '/dev/auth/'
        });
      } catch (err) {
        console.error("Failed to redirect to sign-in:", err);
        this.notificationManager.showNotification("Error starting sign-in process", "error");
      }
    });

    // Go to upload page
    uploadBtn.addEventListener('click', () => {
      if (!session) {
        this.notificationManager.showNotification("Please sign in first!", "error");
        return;
      }
      window.location.href = '/dev/upload/index.html';
    });

    // Sign out
    signOutBtn.addEventListener('click', async () => {
      if (session) {
        try {
          await Clerk.signOut({ redirectUrl: '/dev/' });
          this.notificationManager.showNotification("You have been signed out", "success");
        } catch (err) {
          console.error("Sign out error:", err);
          this.notificationManager.showNotification("Error signing out", "error");
        }
      } else {
        this.notificationManager.showNotification("You are not signed in", "info");
      }
    });
  }

  setupGlobalEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.video-actions')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          menu.classList.remove('show');
        });
      }
    });

    // Close modal when clicking outside
    window.onclick = (event) => {
      const modal = document.getElementById('videoModal');
      if (event.target === modal) {
        this.modalManager.closeVideoModal();
      }
    };

    // Set up modal event listeners
    this.modalManager.setupEventListeners();
    
    // Set up modal button event listeners
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const publishVideoBtn = document.getElementById('publishVideoBtn');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const thumbnailInput = document.getElementById('thumbnailInput');
    
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', () => {
            this.modalManager.closeVideoModal();
        });
    }
    
    if (publishVideoBtn) {
        publishVideoBtn.addEventListener('click', () => {
            this.modalManager.publishVideo();
        });
    }
    
    if (thumbnailPreview) {
        thumbnailPreview.addEventListener('click', () => {
            this.modalManager.generateThumbnail();
        });
    }
    
    if (thumbnailInput) {
        thumbnailInput.addEventListener('change', (event) => {
            this.modalManager.handleThumbnailUpload(event);
        });
    }
  }
}

// Initialize app when DOM is loaded
window.addEventListener('load', () => {
  const app = new App();
  app.initialize();
});
