// Update these values for your deployment
export const IDRIVE_ENDPOINT = 'https://j1i2.or.idrivee2-36.co';
export const BUCKET_NAME = 'videos';
export const TYPESENSE_HOST = 't1.tubie.cx';

export async function getVideoUrl(videoId) {
  // Generate presigned URL for private S3 bucket access using video ID
  try {
    const response = await fetch(`/api/getVideoUrl?videoId=${encodeURIComponent(videoId)}`, {
      headers: {
        'Authorization': `Bearer ${await Clerk.session.getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get video URL: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error getting video URL:', error);
    throw error; // Don't fallback, force proper video ID usage
  }
}
