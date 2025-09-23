import { updateVideo } from '../api.js'
import { eventHub, EVENTS } from '../eventHub.js'
import { getVideo } from '../videoData.js' // ⬅️ import the central store
import { pauseVideo, playVideo } from '../videoPlayer.js'

let isVideoUpdated = false
let videoDuration = 0
let tagifyAudience, tagifyTags, tagifyChannel, tagifyType

const modalElement = document.getElementById('videoModal')
const $modal = $(modalElement)

// ---------- Helpers ----------
function disableSaveButton() {
  $('#publish').prop('disabled', true).addClass('disabled')
}

function enableSaveButton() {
  $('#publish').prop('disabled', false).removeClass('disabled')
}

function checkVideoBudget(videoDuration) {
  const cpvValue = parseFloat($('#cpv').val()) || 0
  const budgetInput = $('#budget')
  let budgetValue = parseFloat(budgetInput.val().trim()) || 0
  let parsleyMin = 0

  if (cpvValue > 0) {
    const rawMin = (cpvValue * videoDuration / 60) * 10
    const minBudget = Math.max(1, Math.ceil(rawMin))
    parsleyMin = minBudget.toFixed(2)

    if (budgetValue < minBudget) {
      budgetValue = minBudget
    }
  } else {
    budgetValue = 0
  }

  budgetInput.val(budgetValue.toFixed(2))
  budgetInput.attr('data-parsley-min', parsleyMin)
  budgetInput.parsley().validate()
}

// ---------- Tagify Init ----------
function initTagify() {
  // Audience (whitelist, single or multiple choice)
  tagifyAudience = new Tagify(document.querySelector('#audience'), {
    whitelist: ["Business", "Consumer", "Government", "NGO/Non-Profit"],
    enforceWhitelist: true,
    dropdown: {
      maxItems: 5,
      classname: 'tags-look',
      enabled: 0,
      closeOnSelect: false
    }
  })

  // Type (whitelist)
  tagifyType = new Tagify(document.querySelector('#type'), {
    whitelist: [
      "Animation", "Annual Report", "Behind-The-Scenes", "Board Meeting Highlights", "Brand",
      "Case Study", "Client Testimonial", "Company Culture", "Company Profile",
      "Corporate Finance", "Corporate Social Responsibility", "Crowdfunding / Fundraising",
      "Event", "Explainer", "Financial Report", "Internal Communication",
      "Investor Relations", "Marketing Campaign", "Onboarding", "Product", "Product Launch",
      "Promotional", "Quarterly Results", "Recruitment / Hiring", "Sales Pitch", "Social Media",
      "Strategy / Planning", "Talent Profile", "Testimonial", "Training", "Tutorial",
      "Vision & Mission", "Webinar", "Workshop"
    ],
    enforceWhitelist: true,
    dropdown: {
      maxItems: 10,
      classname: 'tags-look',
      enabled: 0,
      closeOnSelect: false
    }
  })

  // Tags (free text, lowercase)
  tagifyTags = new Tagify(document.querySelector('#tags'), {
    transformTag: tag => tag.value = tag.value.toLowerCase().trim()
  })

  // Channel (free text, multiple companies)
  tagifyChannel = new Tagify(document.querySelector('#channel'), {

  })
}

// ---------- Event Handlers ----------
function handleEditClick() {
  const videoId = $(this).closest(".video-hit").data("id")
  const data = getVideo(videoId)



  console.log('Video data', data)

  if (!data) {
    console.error("Video not found in store:", videoId)
    return
  }

  const isNewVideo = !Boolean(data.title)

  if (isNewVideo) {
    disableSaveButton()
  }

  eventHub.on(EVENTS.THUMBNAIL_UPLOADED, enableSaveButton)


  videoDuration = data.duration

  $("#videoModal .modal-video-title").text(data.title)
  $("#id").val(data.id || '')
  $("#title").val(data.title || '')
  $("#description").val(data.description || '')


  tagifyAudience.removeAllTags()
  if (Array.isArray(data.audience)) {
    tagifyAudience.addTags(data.audience)
  }

  tagifyTags.removeAllTags()
  if (Array.isArray(data.tags)) {
    tagifyTags.addTags(data.tags)
  }

  tagifyChannel.removeAllTags()
  if (Array.isArray(data.channel)) {
    tagifyChannel.addTags(data.channel)
  }

  tagifyType.removeAllTags()
  if (Array.isArray(data.type)) {
    tagifyType.addTags(data.type)
  }

  $("#cpv").val(data.cpv ?? 0)
  $("#budget").val(data.budget ?? 0)
  $("#performance").prop("checked", data.cpv >= 0.05)
  $(".performance").toggle(data.cpv >= 0.05)

  const timestamp = Date.now()
  $('#thumbnail').attr('src', `https://img.syndinet.com/${data.id}?t=${timestamp}`)

  $('#generate-thumbnail, #save-thumbnail').data('id', data.id)

  const newUrl = new URL(window.location.href)
  newUrl.searchParams.set('v', data.id)
  window.history.replaceState({}, '', newUrl)

  playVideo(data.id)
  new mdb.Modal(modalElement).show()
}

function handlePublishClick() {
  const $form = $('#vod')

  if (!$form.parsley().validate()) {
    return
  }

  const payload = {
    id: $("#id").val(),
    title: $("#title").val(),
    description: $("#description").val(),
    type: tagifyType.value.map(t => t.value),
    audience: tagifyAudience.value.map(t => t.value),
    channel: tagifyChannel.value.map(t => t.value),
    tags: tagifyTags.value.map(t => t.value),
    cpv: parseFloat($("#cpv").val()),
    budget: parseFloat($("#budget").val()),
    performance: $("#performance").is(":checked")
  }

  updateVideo(payload)
    .then(() => {
      isVideoUpdated = true
      $(".btn-close").trigger("click")
    })
    .catch(err => {
      alert("Request failed: " + err.message)
    })
}

function handleModalHidden() {
  pauseVideo()
  $('.modal.show .btn-close, .offcanvas.show .btn-close').trigger('click')
  $(document).attr("title", "SyndiNet")

  const newUrl = new URL(window.location.href)
  newUrl.searchParams.delete('v')
  window.history.pushState({}, '', newUrl)

  if (isVideoUpdated) {
    isVideoUpdated = false
    window.location.reload()
  }
}

function handleCpvBlur() {
  let cpvValue = parseFloat($('#cpv').val().trim()) || 0
  if (cpvValue < 0.05) {
    cpvValue = 0
    $('#budget').val('0.00')
  }

  $('#cpv').val(cpvValue.toFixed(2))
  $('#cpv').attr('data-parsley-min', cpvValue === 0 ? '0' : '0.05')
  $('#cpv').parsley().validate()

  checkVideoBudget(videoDuration)
}

function handleBudgetBlur() {
  checkVideoBudget(videoDuration)
}

function handlePerformanceChange(e) {
  if (!e.target.checked) {
    $('#cpv').val('0.00')
    $('#budget').val('0.00')
    $('#cpv, #budget').validate()
  }
  $(".performance").toggle(e.target.checked)
}

function handleTextTrimBlur() {
  let text = $(this).val()

  if (!text) {
    return
  }

  text = text.replace(/[\r\n]+/g, ' ')
  text = text.replace(/\s\s+/g, ' ')
  text = text.trim()
  $(this).val(text)
}

// ---------- Init ----------
export function initVideoModalUi() {
  $(document).on("click", ".edit", handleEditClick)
  $(document).on("click", "#publish", handlePublishClick)
  $("#videoModal").on("hidden.bs.modal", handleModalHidden)

  $('#cpv').on('blur', handleCpvBlur)
  $('#budget').on('blur', handleBudgetBlur)
  $(document).on("change", "#performance", handlePerformanceChange)
  $(document).on('blur', '.text-trim', handleTextTrimBlur)

  initTagify()
}