import { uploadThumbnail } from '../api.js'
import { eventHub, EVENTS } from '../eventHub.js'
import { getVideoThumbnailUrl } from '../utils.js'
import { onFirstVideoFrame } from '../videoPlayer.js'

function updateVideoHitThumbnailImageUrl(videoId) {
  const imageUrl = getVideoThumbnailUrl(videoId, true)

  $(`.video-hit[data-id="${videoId}"] .thumbnail-background`)
    .css("background-image", `url("${imageUrl}")`)
}

export function initThumbnailGenerationUi() {
  var canvas = document.getElementById("thumbnail-canvas")

  $("#videoModal").on("show.bs.modal", function () {
    $('#generate-thumbnail').prop('disabled', true).addClass('disabled')
  })

  onFirstVideoFrame(() => {
    console.log('Frame callback trigger')
    $('#generate-thumbnail').prop('disabled', false).removeClass('disabled')
  })

  $(document).on('click', '#generate-thumbnail', async function () {
    console.log("Generate thumbnail clicked")

    const videoId = $(this).data("id")
    const video = document.querySelectorAll("video")[0]

    // Set canvas size
    canvas.width = 300
    canvas.height = 169

    // Draw video frame on canvas
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)

    const generatedThumbnailUrl = canvas.toDataURL("image/jpeg", 0.9)

    // Convert to blob
    const generatedThumbnailBlob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    )

    // Update UI
    $('#thumbnail').css({ "background-image": `url("${generatedThumbnailUrl}")` })

    // Upload immediately
    const formData = new FormData()
    formData.append('file', generatedThumbnailBlob, `${videoId}.jpg`)
    formData.append('id', videoId)

    try {
      const response = await uploadThumbnail(generatedThumbnailBlob, videoId)

      if (response.success) {
        const imageUrl = getVideoThumbnailUrl(videoId, true)

        $('#thumbnail').css("background-image", `url("${imageUrl})"`)

        updateVideoHitThumbnailImageUrl(videoId)

        eventHub.emit(EVENTS.THUMBNAIL_UPLOADED)
      } else {
        alert('Saving failed: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error saving thumbnail', error)
      alert('Error saving thumbnail: ' + error.message)
    }
  })
}