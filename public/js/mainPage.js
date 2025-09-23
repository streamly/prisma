import { ensureAuth } from './auth.js'
import { initSearch } from './search.js'
import { initAnalyticsUi } from './ui/analyticsUi.js'
import { initAuthUi } from './ui/authUi.js'
import { initBillingUi } from './ui/billingUi.js'
import { initConversionsUi } from './ui/conversionsUi.js'
import { initDeleteVideoModalUi } from './ui/deleteVideoModal.js'
import { initNavUi } from './ui/navUi.js'
import { initThumbnailGenerationUi } from './ui/thumbnailUi.js'
import { initVideoModalUi } from './ui/videoModalUi.js'


window.addEventListener('DOMContentLoaded', async function () {
  ensureAuth()

  initThumbnailGenerationUi()
  initAnalyticsUi()
  initConversionsUi()
  initAuthUi()
  initVideoModalUi()
  initBillingUi()
  initDeleteVideoModalUi()
  initNavUi()

  initSearch()
})
