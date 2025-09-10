/**
 * Search functionality using InstantSearch.js and Typesense
 */

class SearchManager {
  constructor() {
    this.search = null;
    this.typesenseClient = null;
    this.currentPage = 0;
    this.isLoading = false;
    this.hasMore = true;
  }

  async initialize() {
    try {
      // Wait for Clerk to load
      await Clerk.load();
      
      // Use existing TypesenseManager which handles API keys automatically
      this.typesenseManager = new TypesenseManager();
      this.typesenseClient = await this.typesenseManager.initializeClient();

      // Initialize InstantSearch
      this.search = instantsearch({
        indexName: 'videos',
        searchClient: {
          search: (requests) => this.performSearch(requests)
        }
      });

      // Add widgets
      this.addWidgets();
      
      // Start search
      this.search.start();
      
      // Setup infinite scroll
      this.setupInfiniteScroll();
      
    } catch (error) {
      console.error('Failed to initialize search:', error);
    }
  }

  async performSearch(requests) {
    const request = requests[0];
    const { query, params } = request;
    
    try {
      const searchParams = {
        q: query || '*',
        query_by: 'title,description,filename',
        filter_by: 'active:1',
        sort_by: 'created_at:desc',
        per_page: params.hitsPerPage || 12,
        page: (params.page || 0) + 1
      };

      const response = await this.typesenseManager.searchVideos(query || '');

      return {
        results: [{
          hits: response.map(hit => ({
            objectID: hit.document.id,
            ...hit.document
          })),
          nbHits: response.length,
          page: params.page || 0,
          nbPages: Math.ceil(response.length / (params.hitsPerPage || 12)),
          hitsPerPage: params.hitsPerPage || 12,
          processingTimeMS: 0
        }]
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        results: [{
          hits: [],
          nbHits: 0,
          page: 0,
          nbPages: 0,
          hitsPerPage: 12,
          processingTimeMS: 0
        }]
      };
    }
  }

  addWidgets() {
    // Search box
    this.search.addWidgets([
      instantsearch.widgets.searchBox({
        container: '#searchbox',
        placeholder: 'Search videos...',
        showReset: false,
        showSubmit: false,
        cssClasses: {
          input: 'form-control'
        }
      })
    ]);

    // Stats
    this.search.addWidgets([
      instantsearch.widgets.stats({
        container: '#stats',
        templates: {
          text: `
            {{#hasNoResults}}No results{{/hasNoResults}}
            {{#hasOneResult}}1 result{{/hasOneResult}}
            {{#hasManyResults}}{{#helpers.formatNumber}}{{nbHits}}{{/helpers.formatNumber}} results{{/hasManyResults}}
            found in {{processingTimeMS}}ms
          `
        }
      })
    ]);

    // Hits
    this.search.addWidgets([
      instantsearch.widgets.hits({
        container: '#hits',
        templates: {
          item: this.getHitTemplate(),
          empty: `
            <div class="text-center py-5">
              <i class="bx bx-search-alt-2" style="font-size: 3rem; color: #ddd;"></i>
              <h4>No videos found</h4>
              <p>Try different search terms</p>
            </div>
          `
        },
        cssClasses: {
          list: 'row g-4',
          item: 'col-lg-3 col-md-4 col-sm-6'
        }
      })
    ]);
  }

  getHitTemplate() {
    return `
      <div class="modern-video-card" data-video-id="{{id}}">
        <div class="modern-video-thumbnail" onclick="openVideoModal('{{id}}')">
          {{#thumbnail}}
            <img src="/api/getThumbnailUrl?videoId={{id}}" alt="{{title}}" loading="lazy">
          {{/thumbnail}}
          {{^thumbnail}}
            <div class="d-flex align-items-center justify-content-center h-100 bg-dark text-white">
              <i class="bx bx-play-circle" style="font-size: 3rem;"></i>
            </div>
          {{/thumbnail}}
        </div>
        <div class="modern-video-info">
          <div class="modern-video-title" onclick="openVideoModal('{{id}}')">
            {{#helpers.highlight}}{ "attribute": "title" }{{/helpers.highlight}}
          </div>
          {{#description}}
            <div class="modern-video-description">
              {{#helpers.highlight}}{ "attribute": "description" }{{/helpers.highlight}}
            </div>
          {{/description}}
          <div class="modern-video-meta">
            {{#duration}}Duration: {{duration}}s{{/duration}}
          </div>
          <div class="modern-video-meta">
            {{#file_size}}Size: {{file_size}} bytes{{/file_size}}
          </div>
          <div class="modern-video-meta">
            {{#created_at}}Uploaded: {{created_at}}{{/created_at}}
          </div>
        </div>
      </div>
    `;
  }

  setupInfiniteScroll() {
    let isLoading = false;
    
    window.addEventListener('scroll', async () => {
      if (isLoading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      
      if (scrollTop + clientHeight >= scrollHeight - 1000) {
        isLoading = true;
        
        // Show loading spinner
        document.getElementById('loading').style.display = 'block';
        
        // Load more results by triggering search with higher page
        const helper = this.search.helper;
        if (helper) {
          helper.nextPage().search();
        }
        
        setTimeout(() => {
          document.getElementById('loading').style.display = 'none';
          isLoading = false;
        }, 1000);
      }
    });
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
