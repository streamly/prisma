const videoStore = new Map()

export function saveVideo(hit) {
  if (!hit || !hit.id) return
  videoStore.set(hit.id, hit)
}

export function saveVideos(hits) {
  hits.forEach(saveVideo)
}

export function getVideo(id) {
  return videoStore.get(id)
}

export function getAllVideos() {
  return Array.from(videoStore.values())
}

export function deleteVideo(id) {
  return videoStore.delete(id)
}

export function clearVideos() {
  videoStore.clear()
}