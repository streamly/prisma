export function getVideoThumbnailUrl(videoId, withTimestamp = false) {
  let videoUrl = `https://img.syndinet.com/${videoId}`

  if (withTimestamp) {
    const timestamp = Date.now()

    videoUrl += `?t=${timestamp}`
  }

  return videoUrl
} 