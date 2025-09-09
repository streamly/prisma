// Typesense client management
class TypesenseManager {
  constructor() {
    this.client = null;
    this.config = {
      TYPESENSE_HOST: 't1.tubie.cx'
    };
  }

  // Get cookie value
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Initialize Typesense client
  async initializeClient() {
    try {
      let apiKey = this.getCookie('apikey');
      
      if (!apiKey) {
        console.log('No scoped API key found, requesting new one...');
        await this.requestNewApiKey();
        apiKey = this.getCookie('apikey');
        
        if (!apiKey) {
          throw new Error('Failed to obtain API key');
        }
      }

      if (typeof Typesense === 'undefined') {
        throw new Error('Typesense library not loaded');
      }

      if (!apiKey) {
        throw new Error('API key is required');
      }

      const config = window.APP_CONFIG.getTypesenseConfig();
      this.client = new Typesense.Client({
        ...config,
        apiKey: apiKey
      });

      console.log('Typesense client initialized successfully');
      return this.client;
    } catch (error) {
      console.error('Error initializing Typesense client:', error);
      throw error;
    }
  }

  // Request new API key from auth endpoint
  async requestNewApiKey() {
    try {
      const token = await Clerk.session?.getToken();
      if (!token) {
        console.log('No session token, signing out user...');
        await Clerk.signOut({ redirectUrl: '/dev/' });
        return;
      }

      console.log('Making request to /api/auth...');
      const authResponse = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Auth response status:', authResponse.status);
      console.log('Auth response ok:', authResponse.ok);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.log('Auth response error:', errorText);
        console.log('Failed to get scoped API key, signing out user...');
        await Clerk.signOut({ redirectUrl: '/dev/' });
        return;
      }
      
      const authData = await authResponse.json();
      console.log('Auth response data:', authData);
      console.log('Scoped key generated:', authData.scopedKeyGenerated);
      console.log('Environment variables:', authData.envVars);
      
      if (authData.typesenseError) {
        console.error('Typesense error:', authData.typesenseError);
      }

      // Check if apikey cookie was set
      const apiKey = this.getCookie('apikey');
      if (!apiKey) {
        console.log('Scoped API key not set in cookie, signing out user...');
        await Clerk.signOut({ redirectUrl: '/dev/' });
        return;
      }
    } catch (error) {
      console.error('Error requesting scoped API key:', error);
      await Clerk.signOut({ redirectUrl: '/dev/' });
      throw error;
    }
  }

  // Search videos
  async searchVideos() {
    if (!this.client) {
      throw new Error('Typesense client not initialized');
    }

    const searchResults = await this.client
      .collections('videos')
      .documents()
      .search({
        q: '*',
        query_by: 'title,description',
        per_page: 50
      });

    return searchResults.hits || [];
  }

  // Get client instance
  getClient() {
    return this.client;
  }
}

// Export for use in other modules
window.TypesenseManager = TypesenseManager;
