import { getClerkToken } from './auth.js'


/**
 * 
 * @param {Blob} thumbnail 
 * @param {string} videoId 
 */
export async function uploadThumbnail(thumbnail, videoId) {
  const formData = new FormData()
  formData.append('file', thumbnail, `${videoId}.jpg`)
  formData.append('id', videoId)

  const token = await getClerkToken()

  try {
    const res = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })

    const result = await res.json()

    if (!res.ok || result.success === false) {
      throw new Error(result.error || 'Failed to upload thumbnail')
    }

    return result
  } catch (error) {
    console.error('Error uploading thumbnail:', error)
    throw error
  }
}


export async function fetchAnalytics(videoId = undefined) {
  const token = await getClerkToken()

  try {
    const url = new URL('/api/analytics', window.location.origin)
    if (videoId) {
      url.searchParams.append('videoId', videoId)
    }

    console.log(url.toString())

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch analytics')
    }

    return data.data
  } catch (error) {
    console.error('Error fetching analytics:', error)
    throw error
  }
}


export async function fetchConversions(videoId = undefined) {
  const token = await getClerkToken()

  try {
    const url = new URL('/api/conversions', window.location.origin)
    if (videoId) {
      url.searchParams.append('videoId', videoId)
    }

    console.log('Url', url.toString())

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch analytics')
    }

    return data.data
  } catch (error) {
    console.error('Error fetching analytics:', error)
    throw error
  }
}