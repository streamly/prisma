// conversionsUi.js
import { fetchConversions } from '../api.js'
import { hideLoader, showLoader } from './loaderUi.js'

const modalElement = document.getElementById('conversions-modal')
if (!modalElement) {
  console.warn('conversions-modal element not found on page')
}
const modal = modalElement ? new mdb.Modal(modalElement) : null
const $modal = $(modalElement)

let conversionsData = []
let selectedUser = null

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Build initial modal layout so inputs exist and loader can show on top
function buildModalSkeleton() {
  return `
    <div class="row h-100">
      <div class="col-4 border-end">
        <input id="contact-search" class="form-control mb-2" placeholder="Search contacts..." />
        <div id="contact-list" class="list-group"></div>
      </div>
      <div class="col-8">
        <input id="message-filter" class="form-control mb-2" placeholder="Search messages..." />
        <div id="results" class="overflow-auto" style="max-height:70vh;"></div>
      </div>
    </div>
  `
}

export async function renderData(videoId) {
  if (!modalElement) return

  const $modalBody = $modal.find('.modal-body')
  const modalBody = $modalBody[0]
  if (!modalBody) {
    console.error('Modal body not found')
    return
  }

  // Put base skeleton first (loader will overlay it)
  modalBody.innerHTML = buildModalSkeleton()

  // show loader (assumes showLoader accepts (container, options) and will render indicator)
  showLoader(modalBody, { text: 'Loading conversions...' })

  try {
    conversionsData = await fetchConversions(videoId)
    selectedUser = null

    console.log('Data', conversionsData)

    hideLoader(modalBody)

    // initial render
    renderContacts()
    renderMessages(conversionsData)

    // Scoped / delegated handlers on the modal element (prevent duplicate bindings)
    $modal.off('input', '#contact-search').on('input', '#contact-search', function () {
      const q = $(this).val().toLowerCase()
      renderContacts(q)
    })

    $modal.off('input', '#message-filter').on('input', '#message-filter', function () {
      const q = $(this).val().toLowerCase()
      const filteredData = selectedUser
        ? conversionsData.filter(d => `${(d.firstname||'').trim()} ${(d.lastname||'').trim()}` === selectedUser)
        : conversionsData
      renderMessages(filteredData.filter(m =>
        Object.values(m).some(v => String(v || '').toLowerCase().includes(q))
      ))
    })

    // Click on contact (delegated)
    $modal.off('click', '#contact-list .rfx-user').on('click', '#contact-list .rfx-user', function () {
      $modal.find('.rfx-user').removeClass('active')
      $(this).addClass('active')
      selectedUser = $(this).data('name')
      $modal.find('#message-filter').val('')
      const userMessages = conversionsData.filter(d => `${(d.firstname||'').trim()} ${(d.lastname||'').trim()}` === selectedUser)
      renderMessages(userMessages)
    })

    // Export CSV (delegated)
    $modal.off('click', '#export-conversions').on('click', '#export-conversions', function () {
      const csv = Papa.unparse(conversionsData)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const now = new Date().toISOString().split('T')[0]
      link.download = `conversions-${now}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })

  } catch (err) {
    hideLoader(modalBody)
    console.error('Failed to fetch conversions', err)
    modalBody.innerHTML = `<div class="text-danger">Failed to load conversions. Try again later.</div>`
  }
}

function renderContacts(filter = '') {
  const q = String(filter || '').toLowerCase().trim()

  // filter by any field when filter present
  const filtered = conversionsData.filter(d => {
    if (!q) return true
    return Object.values(d).some(v => String(v || '').toLowerCase().includes(q))
  })

  // sort by date desc (best-effort)
  const sorted = filtered.slice().sort((a, b) => {
    const ta = Date.parse(a.date) || 0
    const tb = Date.parse(b.date) || 0
    return tb - ta
  })

  // unique by "Firstname Lastname" keeping first occurrence (most recent due to sort)
  const seen = new Set()
  const unique = []
  for (const u of sorted) {
    const name = `${(u.firstname||'').trim()} ${(u.lastname||'').trim()}`.trim()
    if (!name) continue
    if (!seen.has(name)) {
      seen.add(name)
      unique.push({ name, u })
    }
  }

  const html = unique.map(({ name }) => {
    const activeClass = selectedUser === name ? ' active' : ''
    return `<div class="rfx-user list-group-item${activeClass}" data-name="${escapeHtml(name)}">
              <i class="bx bx-user-circle me-2"></i>${escapeHtml(name)}
            </div>`
  }).join('')

  $modal.find('#contact-list').html(html || '<div class="text-muted p-2">No contacts</div>')
}

function renderMessages(messages = []) {
  // messages: array of objects
  const q = ($modal.find('#message-filter').val() || '').toLowerCase().trim()
  const filtered = messages.filter(m => {
    if (!q) return true
    return Object.values(m).some(v => String(v || '').toLowerCase().includes(q))
  })

  // when a user is selected, show oldest-first (conversation view); otherwise newest-first
  const sorted = selectedUser
    ? filtered.slice().sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0))
    : filtered.slice().sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))

  const html = sorted.map(item => {
    const roleText = item.role ? `, ${escapeHtml(item.role)}, ` : ''
    const mobileText = item.mobile ? ` or <a href="tel:${escapeHtml(item.mobile)}">${escapeHtml(item.mobile)}</a> (mobile)` : ''
    const title = escapeHtml(item.title || '')
    const channel = escapeHtml(item.channel || '')
    return `
      <div class="rfx-bubble py-3 px-4 mb-2 bg-light rounded">
        On ${escapeHtml(item.timestamp || '')}, ${escapeHtml(item.firstname || '')} ${escapeHtml(item.lastname || '')}${roleText}at ${escapeHtml(item.organization || '')} expressed interest
        in your video entitled "<strong>${title} (${channel})</strong>". You can connect by phone at
        <a href="tel:${escapeHtml(item.phone || '')}">${escapeHtml(item.phone || '')}</a>${mobileText},
        or by email at <a href="mailto:${escapeHtml(item.email || '')}?subject=${title}">${escapeHtml(item.email || '')}</a>.
      </div>`
  }).join('')

  $modal.find('#results').html(html || '<p class="text-muted">No results found.</p>')
}

function showModal(videoId) {
  if (!modal) return
  modal.show()
  renderData(videoId)
}

export function initConversionsUi() {
  // wire up buttons on page
  $(document).on("click", ".conversions", function () {
    showModal()
  })

  // video-level conversions buttons inside rows
  $(document).on('click', '.video-conversions', function () {
    const data = $(this).closest('.row').data()
    const videoId = data?.id
    const title = data?.title
    $modal.find('.video-title').text(title ? `| ${decodeURIComponent(title)}` : '')
    showModal(videoId)
  })

  // clear title and content on modal close
  $modal.on('hidden.bs.modal', function () {
    $(this).find('.video-title').text('')
    $(this).find('.modal-body').empty()
    conversionsData = []
    selectedUser = null
  })
}