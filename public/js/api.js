import { getClerkToken } from './auth.js'

/**
 * Generic API fetch wrapper
 */
async function apiFetch(path, { method = 'GET', params = {}, body } = {}) {
  const token = await getClerkToken()

  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value)
    }
  })

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(body instanceof FormData
          ? {} // FormData sets its own headers
          : { 'Content-Type': 'application/json' }),
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Request to ${path} failed`)
    }
    return data.data ?? data
  } catch (error) {
    console.error(`Error calling ${path}:`, error)
    throw error
  }
}

/**
 * Upload a video thumbnail
 */
export async function uploadThumbnail(thumbnail, videoId) {
  const formData = new FormData()
  formData.append('file', thumbnail, `${videoId}.jpg`)
  formData.append('id', videoId)

  return apiFetch('/api/capture', { method: 'POST', body: formData })
}

/**
 * Fetch analytics for one or all videos
 */
export function fetchAnalytics(videoId) {
  return apiFetch('/api/analytics', { params: { videoId } })
}

/**
 * Fetch conversions for one or all videos
 */
export function fetchConversions(videoId) {
  return apiFetch('/api/conversions', { params: { videoId } })
}

export function fetchCheckoutUrl() {
  return apiFetch('/api/checkout', { method: 'POST' })
}

export function fetchCustomerPortalUrl() {
  return apiFetch('/api/payments', { method: 'POST' })
}

export function updateVideo(payload) {
  return apiFetch('/api/update', { method: 'POST', body: payload })
}

export function deleteVideo(videoId) {
  return apiFetch('/api/delete', { method: 'POST', body: { id: videoId }})
}