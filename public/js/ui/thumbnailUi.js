import { uploadThumbnail } from '../api.js'
import { onFirstVideoFrame } from '../videoPlayer.js'

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

    const videoid = $(this).data("id")
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
    $('#thumbnail').attr('src', generatedThumbnailUrl).show()
    $('#image-' + videoid).css({ "background-image": `url(${generatedThumbnailUrl})` })

    // Upload immediately
    const formData = new FormData()
    formData.append('file', generatedThumbnailBlob, `${videoid}.jpg`)
    formData.append('id', videoid)

    try {
      const response = await uploadThumbnail(generatedThumbnailBlob, videoid)

      if (response.success) {
        isVideoUpdated = true

        const timestamp = new Date().getTime()
        const imgUrl = `https://img.syndinet.com/${videoid}?t=${timestamp}`

        $('#thumbnail').attr('src', imgUrl)
        $(`#image-${videoid}`).css("background-image", `url(${imgUrl})`)
        $(`.play[data-id="${videoid}"] .thumbnail-background`).css("background-image", `url(${imgUrl})`)

      } else {
        alert('Saving failed: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error saving thumbnail', error)
      alert('Error saving thumbnail: ' + error.message)
    }
  })
}