/**
 * API Utilities - Handles video and thumbnail URL requests
 */

// Wait for Clerk to be fully loaded and authenticated
async function ensureClerkReady() {
  if (!window.Clerk) {
    throw new Error('Clerk is not loaded');
  }
  
  // Wait for Clerk to load if not already loaded
  await Clerk.load();
  
  // Check if user is authenticated
  if (!Clerk.session) {
    throw new Error('No active session - user not authenticated');
  }
  
  const token = await Clerk.session.getToken();
  if (!token) {
    throw new Error('Failed to get authentication token');
  }
  
  return token;
}

// Get video URL using video ID
export async function getVideoUrl(videoId) {
  try {
    const token = await ensureClerkReady();
    
    const response = await fetch('/api/getVideoUrl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ videoId })
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      const responseText = await response.text();
      
      try {
        const errorData = JSON.parse(responseText);
        console.error('Server error details:', errorData);
        errorMessage += ` - ${errorData.error || 'Unknown error'}`;
      } catch (jsonError) {
        // Server returned HTML error page instead of JSON
        console.error('Server returned non-JSON error:', responseText);
        errorMessage += ` - Server error (non-JSON response)`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error fetching video URL:', error);
    throw error;
  }
}

// Get thumbnail URL using video ID
export async function getThumbnailUrl(videoId) {
  try {
    const token = await ensureClerkReady();
    
    const response = await fetch('/api/getThumbnailUrl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ videoId })
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No thumbnail available
      }
      const errorData = await response.json();
      console.error('Thumbnail server error details:', errorData);
      throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error fetching thumbnail URL:', error);
    return null; // Return null if thumbnail fetch fails
  }
}
