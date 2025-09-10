/**
 * Search functionality using InstantSearch.js and Typesense
 */

import { TYPESENSE_HOST } from './config.js';
import { TypesenseManager } from './typesenseClient.js';

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
      // Use the TypesenseManager's search method directly
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
        placeholder: 'Search',
        autofocus: true,
        showReset: true,
        showSubmit: true
      })
    ]);


    // Duration filter
    this.search.addWidgets([
      instantsearch.widgets.numericMenu({
        container: '#duration-filter',
        attribute: 'duration',
        items: [
          { label: 'Any' },
          { label: 'Under 4 minutes', start: 1, end: 239 },
          { label: '4 - 20 minutes', start: 240, end: 1199 },
          { label: 'Over 20 minutes', start: 1200 },
        ]
      })
    ]);

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const yesterday = today - 86400;
    const startOfWeek = today - (now.getDay() * 86400);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;

    this.search.addWidgets([
      instantsearch.widgets.numericMenu({
        container: '#created-filter',
        attribute: 'created',
        items: [
          { label: 'All', start: 0 },
          { label: 'Today', start: today },
          { label: 'Yesterday', start: yesterday, end: today },
          { label: 'This Week', start: startOfWeek },
          { label: 'This Month', start: startOfMonth },
        ]
      })
    ]);

    // Current refinements
    this.search.addWidgets([
      instantsearch.widgets.currentRefinements({
        container: '#refinements'
      })
    ]);

    // Hits with infinite scroll
    this.search.addWidgets([
      instantsearch.widgets.infiniteHits({
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
          list: '',
          item: ''
        }
      })
    ]);
  }

  getHitTemplate() {
    return `
      <div class="row border-0 bg-transparent mb-3 edit" data-id="{{id}}" data-title="{{title}}" data-description="{{description}}" data-duration="{{duration}}" data-channel="{{channel}}" type="button" id="{{id}}">
        <!-- Thumbnail (col-2) -->
        <div class="col-2 text-end">
          <div class="edit pointer thumbnail-container bg-dark" alt="{{title}}" title="{{title}}">
            <div class="img-fluid border bg-dark thumbnail-background"
                 style="background-image:url('/api/getThumbnailUrl?videoId={{id}}');
                        height:69px; width:123px;
                        background-repeat:no-repeat;
                        background-size:cover;">
            </div>
            <div class="duration">{{#duration}}{{duration}}s{{/duration}}</div>
          </div>
        </div>

        <!-- Title + Channel (col) -->
        <div class="col">
          <h6 class="edit title-clamp m-0" title="{{title}}">{{#helpers.highlight}}{ "attribute": "title" }{{/helpers.highlight}}</h6>
          <div class="edit pointer text-muted small text-truncate"> 
            {{#channel}}{{channel}}{{/channel}}
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
