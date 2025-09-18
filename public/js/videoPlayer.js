const callbacks = []
let frameReady = false

const player = videojs('player', {
  autoplay: false,
  muted: false,
  controls: true,
})

player.on('timeupdate', () => {
  if (!frameReady && player.currentTime() > 0) {
    frameReady = true
    // Call all registered callbacks
    callbacks.forEach(cb => cb())
  }
})

export function onFirstVideoFrame(callback) {
  callbacks.push(callback)
}

export function playVideo(videoId) {
  frameReady = false
  player.src({
    src: `https://cdn.tubie.cx/${videoId}/playlist.m3u8`,
    type: 'application/x-mpegURL',
  })
}

export function pauseVideo() {
  player.pause()
}