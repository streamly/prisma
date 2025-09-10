/**
 * Simple search functionality using TypesenseManager directly
 */

import { TypesenseManager } from './typesenseClient.js';

class SearchManager {
  constructor() {
    this.typesenseManager = null;
    this.currentQuery = '';
    this.currentDurationFilter = '';
    this.currentDateFilter = '';
  }

  async initialize() {
    try {
      // Wait for Clerk to load
      await Clerk.load();
      
      // Use existing TypesenseManager which handles API keys automatically
      this.typesenseManager = new TypesenseManager();
      await this.typesenseManager.initializeClient();

      // Setup search box
      this.setupSearchBox();
      
      // Setup filters
      this.setupFilters();
      
      // Load initial videos
      await this.loadVideos();
      
    } catch (error) {
      console.error('Failed to initialize search:', error);
    }
  }

  setupFilters() {
    // Duration filter
    const durationFilter = document.getElementById('duration-filter');
    if (durationFilter) {
      durationFilter.innerHTML = `
        <div class="mb-2">
          <input type="radio" name="duration" value="" id="duration-any" checked>
          <label for="duration-any" class="form-label ms-1">Any</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="duration" value="0-240" id="duration-short">
          <label for="duration-short" class="form-label ms-1">Under 4 minutes</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="duration" value="240-1200" id="duration-medium">
          <label for="duration-medium" class="form-label ms-1">4 - 20 minutes</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="duration" value="1200-" id="duration-long">
          <label for="duration-long" class="form-label ms-1">Over 20 minutes</label>
        </div>
      `;

      // Add event listeners for duration filter
      durationFilter.addEventListener('change', (e) => {
        if (e.target.name === 'duration') {
          this.currentDurationFilter = e.target.value;
          this.performSearch(this.currentQuery);
        }
      });
    }

    // Date filter
    const createdFilter = document.getElementById('created-filter');
    if (createdFilter) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
      const yesterday = today - 86400;
      const startOfWeek = today - (now.getDay() * 86400);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

      createdFilter.innerHTML = `
        <div class="mb-2">
          <input type="radio" name="created" value="" id="created-any" checked>
          <label for="created-any" class="form-label ms-1">All</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="created" value="${today}" id="created-today">
          <label for="created-today" class="form-label ms-1">Today</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="created" value="${yesterday}-${today}" id="created-yesterday">
          <label for="created-yesterday" class="form-label ms-1">Yesterday</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="created" value="${startOfWeek}" id="created-week">
          <label for="created-week" class="form-label ms-1">This Week</label>
        </div>
        <div class="mb-2">
          <input type="radio" name="created" value="${startOfMonth}" id="created-month">
          <label for="created-month" class="form-label ms-1">This Month</label>
        </div>
      `;

      // Add event listeners for date filter
      createdFilter.addEventListener('change', (e) => {
        if (e.target.name === 'created') {
          this.currentDateFilter = e.target.value;
          this.performSearch(this.currentQuery);
        }
      });
    }
  }

  setupSearchBox() {
    const searchBox = document.getElementById('searchbox');
    if (searchBox) {
      searchBox.innerHTML = `
        <div class="input-group">
          <input type="text" class="form-control" placeholder="Search videos..." id="searchInput">
          <button class="btn btn-outline-secondary" type="button" id="searchButton">
            <i class="bx bx-search"></i>
          </button>
        </div>
      `;

      const searchInput = document.getElementById('searchInput');
      const searchButton = document.getElementById('searchButton');

      // Search on button click
      searchButton.addEventListener('click', () => {
        this.performSearch(searchInput.value);
      });

      // Search on Enter key
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(searchInput.value);
        }
      });

      // Search on input change (debounced)
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.performSearch(e.target.value);
        }, 300);
      });
    }
  }

  async performSearch(query = '') {
    try {
      this.currentQuery = query;
      
      // Build filter string for Typesense
      let filterBy = [];
      
      // Duration filter
      if (this.currentDurationFilter) {
        if (this.currentDurationFilter.includes('-')) {
          const [min, max] = this.currentDurationFilter.split('-');
          if (min && max) {
            filterBy.push(`duration:>=${min} && duration:<=${max}`);
          } else if (min) {
            filterBy.push(`duration:>=${min}`);
          } else if (max) {
            filterBy.push(`duration:<=${max}`);
          }
        }
      }
      
      // Date filter
      if (this.currentDateFilter) {
        if (this.currentDateFilter.includes('-')) {
          const [min, max] = this.currentDateFilter.split('-');
          filterBy.push(`created:>=${min} && created:<=${max}`);
        } else {
          filterBy.push(`created:>=${this.currentDateFilter}`);
        }
      }
      
      const results = await this.typesenseManager.searchVideos(query, filterBy.join(' && '));
      this.displayResults(results);
    } catch (error) {
      console.error('Search error:', error);
      this.displayResults([]);
    }
  }

  async loadVideos() {
    await this.performSearch('');
  }

  displayResults(results) {
    const hitsContainer = document.getElementById('hits');
    if (!hitsContainer) return;

    if (!results || results.length === 0) {
      hitsContainer.innerHTML = `
        <div class="text-center py-5">
          <i class="bx bx-search-alt-2" style="font-size: 3rem; color: #ddd;"></i>
          <h4>No videos found</h4>
          <p>Try different search terms</p>
        </div>
      `;
      return;
    }

    const videosHtml = results.map(hit => {
      const video = hit.document;
      const duration = this.formatDuration(video.duration);
      
      return `
        <div class="row border-0 bg-transparent mb-3 edit" 
             data-id="${video.id}" 
             data-title="${encodeURIComponent(video.title || '')}" 
             data-description="${encodeURIComponent(video.description || '')}" 
             data-duration="${video.duration || 0}" 
             type="button" 
             id="${video.id}">
          <!-- Thumbnail (col-2) -->
          <div class="col-2 text-end">
            <div class="edit pointer thumbnail-container bg-dark" alt="${video.title}" title="${video.title}">
              ${video.thumbnail ? 
                `<div class="img-fluid border bg-dark thumbnail-background"
                     style="background-image:url('/api/getThumbnailUrl?videoId=${video.id}');
                            height:69px; width:123px;
                            background-repeat:no-repeat;
                            background-size:cover;">
                 </div>` :
                `<div class="img-fluid border bg-secondary d-flex align-items-center justify-content-center text-white"
                     style="height:69px; width:123px; font-size:10px;">
                   No Thumbnail
                 </div>`
              }
              <div class="duration">${duration}</div>
            </div>
          </div>

          <!-- Title + Description (col) -->
          <div class="col">
            <h6 class="edit title-clamp m-0" title="${video.title}">${video.title || 'Untitled'}</h6>
            <div class="edit pointer text-muted small text-truncate"> 
              ${video.description || ''}
            </div>
          </div>
          
          <div class="col-1">
            <div class="dropdown">
              <a class="btn btn-link bg-transparent p-0 m-0" href="#" title="More" data-mdb-toggle="dropdown" aria-expanded="false">
                <i class="bx bx-dots-vertical-rounded bx-sm mx-4"></i>
              </a>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a type="button" class="dropdown-item edit">Edit</a></li>
                <li><a type="button" class="dropdown-item analytics">Analytics</a></li>    
                <li><a type="button" class="dropdown-item conversions">Conversions</a></li> 
                <li><a type="button" class="dropdown-item billing">Billing</a></li> 
                <li><a type="button" class="dropdown-item trash">Trash</a></li>              
              </ul>
            </div>  
          </div>
        </div>
      `;
    }).join('');

    hitsContainer.innerHTML = videosHtml;
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const formattedMins = mins < 10 ? "0" + mins : mins;
    const formattedSecs = secs < 10 ? "0" + secs : secs;
    
    if (hrs > 0) {
      return `${hrs}:${formattedMins}:${formattedSecs}`;
    } else {
      return `${formattedMins}:${formattedSecs}`;
    }
  }
}

// Global function to open video modal
window.openVideoModal = async (videoId) => {
  if (window.modalManager) {
    await window.modalManager.openVideoModal(videoId);
  }
};

// Initialize search when DOM is loaded
window.addEventListener('load', async () => {
  // Wait for Clerk to be ready first
  await Clerk.load();
  
  // Only initialize search if user is signed in
  if (Clerk.session) {
    const searchManager = new SearchManager();
    await searchManager.initialize();
    
    // Make it globally accessible
    window.searchManager = searchManager;
  }
});

export { SearchManager };
