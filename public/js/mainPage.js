import { ensureAuth } from './auth.js'
import { initAnalyticsUi } from './ui/analyticsUi.js'
import { initAuthUi } from './ui/authUi.js'
import { initConversionsUi } from './ui/conversionsUi.js'
import { initThumbnailGenerationUi } from './ui/thumbnailUi.js'
import { initVideoModalUi } from './ui/videoModalUi.js'


window.addEventListener('DOMContentLoaded', async function () {
  ensureAuth()

  initThumbnailGenerationUi()
  initAnalyticsUi()
  initConversionsUi()
  initAuthUi()
  initVideoModalUi()
})
