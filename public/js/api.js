import { getClerkToken } from './auth.js'

class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

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

  const headers = {
    'Authorization': `Bearer ${token}`,
  }
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok || data.success === false) {
    throw new ApiError(
      data.error || `Request to ${path} failed`,
      { status: res.status, code: data.code, details: data.details }
    )
  }

  return data.data ?? data
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

export function fetchAnalytics(videoId) {
  return apiFetch('/api/analytics', { params: { videoId } })
}

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
  return apiFetch('/api/delete', { method: 'POST', body: { id: videoId } })
}

export async function fetchInactiveVideoId() {
  return (await apiFetch('/api/inactive', { method: 'GET' })).videoId
}