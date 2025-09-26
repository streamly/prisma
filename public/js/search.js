import { saveVideo } from './videoData.js'

export const hitStore = new Map()
let search

function renderHit(hit) {
  saveVideo(hit)

  const $tpl = $($('#hit-template').html())
  $tpl.attr('data-id', hit.id)

  $tpl.find('.thumbnail-background').css('background-image', `url('https://img.syndinet.com/${hit.id}')`)
  $tpl.find('.duration').text(formatDuration(hit.duration))
  $tpl.find('.title-clamp').text(decodeHTMLEntities(hit.title || ""))
  $tpl.find('.channel').text(Array.isArray(hit.channel) ? hit.channel.join(", ") : "")
  $tpl.find('.modified').text(formatDate(hit.modified))
  $tpl.find('.id').text(`ID: ${hit.id}`)

  return $tpl.prop('outerHTML')
}

export async function initSearch() {
  const apiKey = (await window.cookieStore.get('apiKey'))?.value
  if (!apiKey) {
    console.error('Typesense API key is missing')
    return
  }

  const { today, yesterday, startOfWeek, startOfMonth } = getDateRanges()

  const typesenseAdapter = new TypesenseInstantSearchAdapter({
    server: { apiKey, nodes: [{ host: "t1.tubie.cx", port: 443, protocol: "https" }] },
    additionalSearchParameters: {
      query_by: "title,company,channel,description,tags",
      sort_by: "modified:desc"
    },
  })

  search = instantsearch({
    indexName: "videos",
    searchClient: typesenseAdapter.searchClient,
    routing: false,
    searchFunction(helper) {
      if (helper.state.page === 0) window.scrollTo({ top: 0, behavior: 'auto' })
      helper.search()
    },
  })

  search.addWidgets([
    instantsearch.widgets.searchBox({
      container: "#searchbox",
      placeholder: "Search",
      autofocus: true,
      showReset: true,
      showSubmit: true,
    }),
    instantsearch.widgets.refinementList({
      container: '#channel-filter',
      attribute: 'channel',
      searchable: true,
      searchablePlaceholder: 'Search companies',
      limit: 30,
    }),
    instantsearch.widgets.numericMenu({
      container: '#duration-filter',
      attribute: 'duration',
      items: [
        { label: 'Any' },
        { label: 'Under 4 minutes', start: 1, end: 239 },
        { label: '4 - 20 minutes', start: 240, end: 1199 },
        { label: 'Over 20 minutes', start: 1200 },
      ],
    }),
    instantsearch.widgets.numericMenu({
      container: '#created-filter',
      attribute: 'created',
      items: [
        { label: 'All', start: 0 },
        { label: 'Today', start: today },
        { label: 'Yesterday', start: yesterday, end: today },
        { label: 'This Week', start: startOfWeek },
        { label: 'This Month', start: startOfMonth },
      ],
    }),
    instantsearch.widgets.refinementList({
      container: '#format-filter',
      attribute: 'format',
      limit: 3,
      templates: {
        item(data) {
          return `<label><input type="checkbox" ${data.isRefined ? 'checked' : ''} /> ${decodeHTMLEntities(data.label)} (${data.count})</label>`
        }
      }
    }),
    instantsearch.widgets.refinementList({
      container: '#type-filter',
      attribute: 'type',
      limit: 10,
      templates: {
        item(data) {
          return `<label><input type="checkbox" ${data.isRefined ? 'checked' : ''} /> ${decodeHTMLEntities(data.label)} (${data.count})</label>`
        }
      }
    }),
    instantsearch.widgets.currentRefinements({
      container: '#refinements',
      transformItems(items) {
        $("#clear").toggle(items.length > 0)
        return items
      }
    }),
    instantsearch.widgets.infiniteHits({
      container: "#hits",
      transformItems: (items) =>
        items.map((item, index) => ({ ...item, resultPosition: index + 1 })),
      templates: { item: renderHit },
    }),
  ])

  search.start()

  initUrlParamLoader()
  initReloadButton()
  initInfiniteScrollObserver()
}

function getDateRanges() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  return {
    today,
    yesterday: today - 86400,
    startOfWeek: today - now.getDay() * 86400,
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000,
  }
}

function initUrlParamLoader() {
  const urlParams = new URLSearchParams(window.location.search)
  const v = urlParams.get('v')
  if (!v) return

  search.helper.setQuery("").setQueryParameter("filters", `id:${v}`).search()
  setTimeout(() => $(".edit").first().trigger("click"), 1000)
}

function initReloadButton() {
  $(document).on("click", "#reload", () => search.helper.setQuery("").search())
}

function initInfiniteScrollObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        const btn = entry.target
        if (!btn.disabled && btn.offsetParent !== null) btn.click()
      }
    })
  }, { threshold: [0.5] })

  function watchLoadMoreButton() {
    const btn = document.querySelector(".ais-InfiniteHits-loadMore")
    if (btn) observer.observe(btn)
    else setTimeout(watchLoadMoreButton, 300)
  }
  watchLoadMoreButton()
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00"
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
  return hrs > 0 ? `${hrs}:${mins}:${secs}` : `${mins}:${secs}`
}

function formatDate(timestamp) {
  if (!timestamp) return "undefined"
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function decodeHTMLEntities(text) {
  const txt = document.createElement("textarea")
  txt.innerHTML = text
  return txt.value
}