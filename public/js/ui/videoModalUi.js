import { updateVideo } from '../api.js'
import { eventHub, EVENTS } from '../eventHub.js'
import { getVideo } from '../videoData.js'
import { pauseVideo, playVideo } from '../videoPlayer.js'

let isVideoUpdated = false
let videoDuration = 0
let tagifyAudience, tagifyTags, tagifyChannel, tagifyType, tagifyPeople, tagifyTopic

const modalElement = document.getElementById('videoModal')
const $modal = $(modalElement)

function formatCurrency(value, decimals = 2) {
  const num = parseFloat(value)
  if (isNaN(num)) return "0.00"
  return num.toFixed(decimals)
}

// ---------- Helpers ----------
function checkVideoBudget(videoDuration) {
  const cpvValue = Math.max(parseFloat($("#cpv").val()) || 0, 0.05)
  const budgetInput = $("#budget")
  let budgetValue = Math.max(parseFloat(budgetInput.val().trim()) || 0, 1.0)
  let parsleyMin = 1.0

  if (cpvValue > 0) {
    const rawMin = cpvValue * 10
    const minBudget = Math.max(1, Math.ceil(rawMin))
    parsleyMin = minBudget.toFixed(2)
    if (budgetValue < minBudget) {
      budgetValue = minBudget
    }
  }

  budgetInput.val(budgetValue.toFixed(2))
  budgetInput.attr("data-parsley-min", parsleyMin)
  budgetInput.parsley().validate()
}

// ---------- Tagify Init ----------
function initTagify() {
  tagifyAudience = new Tagify(document.querySelector('#audience'), {
    whitelist: ["Business", "Consumer", "Government", "NGO/Non-Profit"],
    enforceWhitelist: true,
    dropdown: { maxItems: 5, classname: 'tags-look', enabled: 0, closeOnSelect: false }
  })

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
    dropdown: { maxItems: 10, classname: 'tags-look', enabled: 0, closeOnSelect: false }
  })

  tagifyTags = new Tagify(document.querySelector('#tags'), {
    transformTag: tag => tag.value = tag.value.toLowerCase().trim()
  })

  tagifyChannel = new Tagify(document.querySelector('#channel'))
  tagifyPeople = new Tagify(document.querySelector('#people'))

  tagifyTopic = new Tagify(document.querySelector('#topic'), {
    whitelist: ['Topic 1', 'Topic 2', 'Topic 3'],
    dropdown: { maxItems: 10, classname: 'tags-look', enabled: 0, closeOnSelect: false }
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
  if (!isNewVideo) {
    $('#thumbnail-input').val(videoId).trigger('input').trigger('change')
  }

  eventHub.on(EVENTS.THUMBNAIL_UPLOADED, function () {
    $('#thumbnail-input').val(videoId).trigger('input').trigger('change')
  })

  videoDuration = data.duration
  $("#videoModal .modal-video-title").text(data.title)
  $("#id").val(data.id || '')
  $("#title").val(data.title || '')
  $("#description").val(data.description || '')

  tagifyAudience.removeAllTags()
  if (Array.isArray(data.audience)) tagifyAudience.addTags(data.audience)
  tagifyTags.removeAllTags()
  if (Array.isArray(data.tags)) tagifyTags.addTags(data.tags)
  tagifyChannel.removeAllTags()
  if (Array.isArray(data.channel)) tagifyChannel.addTags(data.channel)
  tagifyType.removeAllTags()
  if (Array.isArray(data.type)) tagifyType.addTags(data.type)
  tagifyPeople.removeAllTags()
  if (Array.isArray(data.people)) tagifyPeople.addTags(data.people)
  tagifyTopic.removeAllTags()
  if (Array.isArray(data.topic)) tagifyTopic.addTags(data.topic)

  $("#cpv").val(formatCurrency(Math.max(data.cpv ?? 0.05, 0.05)))
  $("#budget").val(formatCurrency(Math.max(data.budget ?? 1.0, 1.0)))

  const timestamp = Date.now()
  const imageUrl = `https://img.syndinet.com/${data.id}?t=${timestamp}`
  $('#thumbnail').css("background-image", `url(${imageUrl})`)
  $('#generate-thumbnail, #save-thumbnail').data('id', data.id)

  const newUrl = new URL(window.location.href)
  newUrl.searchParams.set('v', data.id)
  window.history.replaceState({}, '', newUrl)

  playVideo(data.id)
  new mdb.Modal(modalElement).show()
}

function handlePublishClick() {
  const $form = $("#vod").parsley({ errorsContainer: () => $("#publish-errors") })
  if (!$form.validate()) return

  const cpvValue = Math.max(parseFloat($("#cpv").val()) || 0, 0.05)
  const budgetValue = Math.max(parseFloat($("#budget").val()) || 0, 1.0)

  const payload = {
    id: $("#id").val(),
    title: $("#title").val(),
    description: $("#description").val(),
    type: tagifyType.value.map(t => t.value),
    audience: tagifyAudience.value.map(t => t.value),
    channel: tagifyChannel.value.map(t => t.value),
    tags: tagifyTags.value.map(t => t.value),
    people: tagifyPeople.value.map(t => t.value),
    topic: tagifyTopic.value.map(t => t.value),
    cpv: cpvValue,
    budget: budgetValue
  }

  updateVideo(payload)
    .then(() => {
      isVideoUpdated = true
      $(".btn-close").trigger("click")
    })
    .catch(err => alert("Request failed: " + err.message))
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
  let cpvValue = Math.max(parseFloat($('#cpv').val().trim()) || 0, 0.05)
  $('#cpv').val(cpvValue.toFixed(2))
  $('#cpv').attr('data-parsley-min', '0.05')
  $('#cpv').parsley().validate()
  checkVideoBudget(videoDuration)
}

function handleBudgetBlur() {
  let budgetValue = Math.max(parseFloat($('#budget').val().trim()) || 0, 1.0)
  $('#budget').val(budgetValue.toFixed(2))
  $('#budget').attr('data-parsley-min', '1')
  $('#budget').parsley().validate()
  checkVideoBudget(videoDuration)
}

function handleTextTrimBlur() {
  let text = $(this).val()
  if (!text) return
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
  $(document).on('blur', '.text-trim', handleTextTrimBlur)

  initTagify()
}