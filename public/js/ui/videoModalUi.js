import { pauseVideo, playVideo } from '../videoPlayer.js'

let isVideoUpdated = false

export function initVideoModalUi() {
  // edit
  $(document).on("click", ".edit", function () {
    const data = $(this).closest('.row').data()
    $("#videoModal .modal-video-title").text(decodeURIComponent(data.title))

    $("#id").val(decodeURIComponent(data.id || ''))
    $("#title").val(decodeURIComponent(data.title || ''))
    $("#description").val(decodeURIComponent(data.description || ''))

    // Single-select audience
    let audienceVal = Array.isArray(data.audience) ? decodeURIComponent(data.audience[0]) : decodeURIComponent(data.audience || '')
    $("#audience").val(audienceVal.trim())

    // Category (multi-select)
    let categoryVal = Array.isArray(data.category) ? data.category.map(v => decodeURIComponent(v)) : decodeURIComponent(data.category || '').split(';').map(v => v.trim()).filter(v => v)
    $("#category").val(categoryVal)

    // Company (single input)
    $("#company").val(decodeURIComponent(data.company || ''))

    // Tags
    $("#tags").val(decodeURIComponent(data.tags || ''))

    $("#cpv").val(data.cpv !== undefined ? decodeURIComponent(data.cpv) : 0)
    $("#budget").val(data.budget !== undefined ? decodeURIComponent(data.budget) : 0)
    $("#performance").prop("checked", data.cpv >= 0.05)
    $(".performance").toggle(data.cpv >= 0.05)

    const timestamp = new Date().getTime()
    $('#thumbnail').attr('src', `https://img.syndinet.com/${data.id}?t=${timestamp}`)

    const videoId = data.id

    $('#generate-thumbnail, #save-thumbnail').data('id', videoId)

    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('v', videoId)
    window.history.replaceState({}, '', newUrl)

    playVideo(videoId)

    console.log('Opened modal for', videoId)
    const modal = new mdb.Modal(document.getElementById("videoModal"))
    modal.show()
  })

  // performance
  $(document).on("click", "#performance", function () {
    $(".performance").toggle()
  })

  // update video
  $('#vod').parsley()
  $(document).on("click", "#publish", async function () {
    const parseArray = (val) => {
      if (!val) return []
      if (Array.isArray(val)) return val.filter(Boolean)
      return val.toString().split(',').map(v => v.trim()).filter(Boolean)
    }

    // Collect values
    const payload = {
      id: $("#id").val(),
      title: $("#title").val(),
      description: $("#description").val(),
      category: parseArray($('#category').val()),
      audience: parseArray($('audience').val()),
      company: $("#company").val(),
      tags: $("#tags").val().split(','),
      cpv: parseFloat($("#cpv").val()),
      budget: parseFloat($("#budget").val()),
      performance: $("#performance").is(":checked") ? 1 : 0
    }

    try {
      console.log('Update payload', payload)
      const result = await apiRequest('/api/update', 'POST', payload)

      isVideoUpdated = true
      // search.helper.setQuery(search.helper.state.query).search()

      $(".btn-close").trigger("click")
    } catch (err) {
      alert("Request failed: " + err.message)
    }
  })

  $("#videoModal").on("hidden.bs.modal", function () {
    pauseVideo()
    $('.modal.show .btn-close, .offcanvas.show .btn-close').trigger('click')
    $(document).attr("title", "SyndiNet")

    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('v')
    window.history.pushState({}, '', newUrl)

    const uploaded = $(this).data('uploaded')


    if (isVideoUpdated) {
      isVideoUpdated = false

      window.location.reload()

      // #TODO Doesn't work for some reason 
      // if (search && search.refresh) {
      //   search.refresh()
      // } else if (search && search.helper) {
      //   search.helper.search()
      // }
    }
  })
}