import { fetchInactiveVideoId } from '../api.js'

let isFetchingInactiveVideo = false

export function initNavUi() {
  $('.nav-add').on('click', async function () {
    if (isFetchingInactiveVideo) {
      return
    }

    isFetchingInactiveVideo = true

    const inactiveVideoId = await fetchInactiveVideoId()

    if (inactiveVideoId) {
      alert('Please finish your existing video first. Redirecting...')
      window.location.href = `/dev/?v=${encodeURIComponent(inactiveVideoId)}`
      return
    }

    isFetchingInactiveVideo = false
    window.location.href = '/dev/upload'
  })
}