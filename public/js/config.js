// Update these values for your deployment
export const IDRIVE_ENDPOINT = 'https://j1i2.or.idrivee2-36.co';
export const BUCKET_NAME = 'videos';
export const TYPESENSE_HOST = 't1.tubie.cx';

// Get video URL using video ID
export async function getVideoUrl(videoId) {
  try {
    const response = await fetch(`/api/getVideoUrl?videoId=${videoId}`, {
      headers: {
        'Authorization': `Bearer ${await Clerk.session.getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
    const response = await fetch(`/api/getThumbnailUrl?videoId=${videoId}`, {
      headers: {
        'Authorization': `Bearer ${await Clerk.session.getToken()}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No thumbnail available
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error fetching thumbnail URL:', error);
    return null; // Return null if thumbnail fetch fails
  }
}
