import { deleteVideo } from '../api.js'

const deleteModalElement = $('#confirmDeleteModal')
let deleteModal = new mdb.Modal(deleteModalElement)
let videoToDelete = null
let videoTitleToDelete = null



// Video delete
function handleVideoDelete() {
  const data = $(this).closest('.row').data()
  videoToDelete = data.id
  videoTitleToDelete = decodeURIComponent(data.title || '')

  $("#videoTitleToDelete").text(videoTitleToDelete)

  deleteModal.show()
}

function handleConfirmVideoDelete() {
  if (!videoToDelete) return

  deleteVideo(videoToDelete)
    .then(() => {
      location.reload()
    })
    .catch(err => {
      console.error('Error', err)
      alert("Request failed: " + err.message)
    })

  videoToDelete = null
  deleteModal.hide()
}


export function initDeleteVideoModalUi() {
  $(document).on('click', '.video-delete', handleVideoDelete)
  $(document).on("click", "#confirmDeleteBtn", handleConfirmVideoDelete)
}