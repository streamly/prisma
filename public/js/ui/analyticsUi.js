import { fetchAnalytics } from '../api.js'
import { hideLoader, showLoader } from './loaderUi.js'

const modalElement = document.getElementById('analytics-modal')
const modal = new mdb.Modal(modalElement)
const $modal = $(modalElement)
const modalBody = $modal.find('.modal-body')[0]


export async function renderData(videoId = undefined) {
  showLoader(modalBody, { text: 'Loading analytics...' })


  try {
    // Fetch analytics
    const { chart, table } = await fetchAnalytics(videoId)

    console.log('Analytics data', chart, table)

    hideLoader(modalBody)

    // ---- ApexCharts sparklines ----
    const sparkConfigs = [
      { selector: "#spark1", name: "Plays", data: chart.plays, title: chart.plays.reduce((a, b) => a + b, 0) },
      { selector: "#spark2", name: "Watch Time (minutes)", data: chart.watchTime, title: chart.watchTime.reduce((a, b) => a + b, 0).toFixed(2) },
      { selector: "#spark3", name: "Average Watch Time", data: chart.averageWatchTime, title: (chart.averageWatchTime.reduce((a, b) => a + b, 0) / chart.averageWatchTime.length).toFixed(2) },
      { selector: "#spark4", name: "Avg. % Watched", data: chart.averagePercentWatched, title: (chart.averagePercentWatched.reduce((a, b) => a + b, 0) / chart.averagePercentWatched.length).toFixed(2) + "%" },
      { selector: "#spark5", name: "Unique Viewers", data: chart.uniqueViewers, title: chart.uniqueViewers.reduce((a, b) => a + b, 0) },
      { selector: "#spark6", name: "Conversions", data: chart.conversions, title: chart.conversions.reduce((a, b) => a + b, 0) },
      { selector: "#spark7", name: "Conversion Rate", data: chart.conversionRate, title: (chart.conversionRate.reduce((a, b) => a + b, 0) / chart.conversionRate.length).toFixed(2) + "%" },
      { selector: "#spark8", name: "Markets", data: chart.cities, title: chart.cities.reduce((a, b) => a + b, 0) },
      { selector: "#spark9", name: "Ad-Free Streaming (minutes)", data: chart.adFreeStreaming, title: chart.adFreeStreaming.reduce((a, b) => a + b, 0).toFixed(2) },
    ]

    // Create container for charts
    const chartsContainer = document.createElement('div')
    chartsContainer.className = 'analytics-charts'
    modalBody.appendChild(chartsContainer)

    sparkConfigs.forEach((conf, i) => {
      const chartDiv = document.createElement('div')
      chartDiv.id = conf.selector.replace('#', '') // remove #
      chartDiv.style.marginBottom = '20px'
      chartsContainer.appendChild(chartDiv)

      const spark = {
        chart: {
          id: conf.selector.replace('#', ''),
          type: 'area',
          height: 140,
          sparkline: { enabled: true }
        },
        stroke: { curve: 'straight' },
        fill: { opacity: 1 },
        theme: { mode: '', palette: 'palette1' },
        series: [{ name: conf.name, data: conf.data }],
        labels: chart.labels,
        yaxis: {
          min: 0,
          max: function (max) { return max <= 1 ? 25 : max * 1.2 },
          labels: {
            formatter: val => val.toFixed(2)
          }
        },
        tooltip: {
          y: {
            formatter: val => val.toFixed(2)
          }
        },
        colors: ['#DCE6EC'],
        title: { text: conf.title, offsetX: 30, style: { fontSize: '24px', cssClass: 'apexcharts-yaxis-title' } },
        subtitle: { text: conf.name, offsetX: 30, style: { fontSize: '14px', cssClass: 'apexcharts-yaxis-title' } }
      }
      new ApexCharts(chartDiv, spark).render()
    })


    // ---- analytics table ----
    let html = '<div class="table-responsive"><table id="analytics-table" class="table table-sm table-border table-striped table-hover">'
    html += `<thead>
      <tr>
        <th>Date</th>
        <th>Plays</th>
        <th>Watch Time</th>
        <th>Average</th>
        <th>Watched</th>
        <th>Viewers</th>
        <th>Conversions</th>
        <th title='Conversion Rate (CR)'>C/R</th>
        <th>Markets</th>
        <th>Ad-Free</th>
      </tr>
    </thead><tbody>`

    table.forEach(row => {
      html += `<tr>
        <td>${row.date}</td>
        <td>${parseInt(row.plays)}</td>
        <td>${Number(row.watchTime).toFixed(2)}</td>
        <td>${Number(row.averageWatchTime).toFixed(2)}</td>
        <td>${Number(row.averagePercentWatched).toFixed(2)}%</td>
        <td>${parseInt(row.uniqueViewers)}</td>
        <td>${parseInt(row.conversions)}</td>
        <td>${Number(row.conversionRate).toFixed(2)}%</td>
        <td>${Number(row.cities)}</td>
        <td>${Number(row.adFreeStreaming).toFixed(2)}</td>
      </tr>`
    })
    html += '</tbody></table></div>'
    modalBody.insertAdjacentHTML('beforeend', html)

    $('#export-analytics').on('click', function () {
      const csv = Papa.unparse(table.map(row => ({
        date: row.date,
        plays: row.plays,
        watch_time_minutes: row.watchTime,
        average_watch_time_minutes: row.averageWatchTime,
        average_percent_watched: row.averagePercentWatched,
        unique_viewers: row.uniqueViewers,
        conversions: row.conversions,
        conversion_rate: row.conversionRate,
        average_plays_per_video: row.averagePlaysPerVideo,
        average_plays_per_viewer: row.averagePlaysPerViewer,
        markets: row.cities,
        ad_free_streaming_minutes: row.adFreeStreaming
      })))

      const now = new Date()

      // Format: YYYY-MM-DD_HH-MM-SS
      const timestamp = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0]

      const fileName = `analytics_${timestamp}.csv`

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })

  } catch (error) {
    console.error('Failed to fetch analytics:', error)
    modalBody.innerHTML = '<div class="text-danger">Failed to load analytics. Please try again.</div>'
  }
}


function showModal(videoId) {
  modal.show()
  renderData(videoId)
}


export function initAnalyticsUi() {
  $(document).on("click", ".analytics", function () {
    showModal()
  })

  // Video analytics button
  $(document).on('click', '.video-analytics', function () {
    const data = $(this).closest('.row').data()
    const videoId = data.id
    const title = data.title
    $modal.find('.video-title').text(`| ${decodeURIComponent(title)}`)
    showModal(videoId)
  })

  // Clear title on modal close
  $modal.on('hidden.bs.modal', function () {
    console.log('Modal hidden event')
    modalBody.innerHTML = ''
    $(this).find('.video-title').text('')
  })
}