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

    // Reverse datasets (date ascending)
    const reverseData = (arr) => (arr ? [...arr].reverse().map(v => (isNaN(v) ? 0 : v)) : [])
    chart.labels = reverseData(chart.labels)
    chart.plays = reverseData(chart.plays)
    chart.watchTime = reverseData(chart.watchTime)
    chart.averageWatchTime = reverseData(chart.averageWatchTime)
    chart.averagePercentWatched = reverseData(chart.averagePercentWatched)
    chart.uniqueViewers = reverseData(chart.uniqueViewers)
    chart.averagePlaysPerVideo = reverseData(chart.averagePlaysPerVideo)
    chart.averagePlaysPerViewer = reverseData(chart.averagePlaysPerViewer)
    chart.conversions = reverseData(chart.conversions)
    chart.conversionRate = reverseData(chart.conversionRate)
    chart.averageCpv = reverseData(chart.averageCpv)
    chart.costs = reverseData(chart.costs)

    // ---- ApexCharts sparklines ----
    const sparkConfigs = [
      { selector: "#spark1", name: "Plays", data: chart.plays, title: chart.plays.reduce((a, b) => a + b, 0) },
      { selector: "#spark2", name: "Watch Time (minutes)", data: chart.watchTime, title: chart.watchTime.reduce((a, b) => a + b, 0).toFixed(2) },
      { selector: "#spark3", name: "Average Watch Time", data: chart.averageWatchTime, title: (chart.averageWatchTime.reduce((a, b) => a + b, 0) / (chart.averageWatchTime.length || 1)).toFixed(2) },
      { selector: "#spark4", name: "Avg. % Watched", data: chart.averagePercentWatched, title: (chart.averagePercentWatched.reduce((a, b) => a + b, 0) / (chart.averagePercentWatched.length || 1)).toFixed(2) + "%" },
      { selector: "#spark5", name: "Unique Viewers", data: chart.uniqueViewers, title: chart.uniqueViewers.reduce((a, b) => a + b, 0) },
      { selector: "#spark6", name: "Conversions", data: chart.conversions, title: chart.conversions.reduce((a, b) => a + b, 0) },
      { selector: "#spark7", name: "Conversion Rate", data: chart.conversionRate, title: (chart.conversionRate.reduce((a, b) => a + b, 0) / (chart.conversionRate.length || 1)).toFixed(2) + "%" },
      { selector: "#spark8", name: "Avg. CPV", data: chart.averageCpv, title: (chart.averageCpv.reduce((a, b) => a + b, 0) / (chart.averageCpv.length || 1)).toFixed(2) },
      { selector: "#spark9", name: "Total Costs", data: chart.costs, title: chart.costs.reduce((a, b) => a + b, 0).toFixed(2) },
    ]

    const chartsContainer = document.createElement('div')
    chartsContainer.className = 'analytics-charts'
    modalBody.appendChild(chartsContainer)

    sparkConfigs.forEach((conf) => {
      const chartDiv = document.createElement('div')
      chartDiv.id = conf.selector.replace('#', '')
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
          labels: { formatter: val => val.toFixed(2) }
        },
        tooltip: { y: { formatter: val => val.toFixed(2) } },
        colors: ['#DCE6EC'],
        title: { text: conf.title, offsetX: 30, style: { fontSize: '24px' } },
        subtitle: { text: conf.name, offsetX: 30, style: { fontSize: '14px' } }
      }
      new ApexCharts(chartDiv, spark).render()
    })

    // ---- analytics table ----
    let html = '<div class="table-responsive bg-white p-3"><table id="analytics-table" class="table table-sm table-border table-striped table-hover">'
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
        <th>Avg. CPV</th>
        <th>Costs</th>
      </tr>
    </thead><tbody>`

    table.reverse().forEach(row => {
      html += `<tr>
        <td>${row.date}</td>
        <td>${parseInt(row.plays) || 0}</td>
        <td>${Number(row.watchTime || 0).toFixed(2)}</td>
        <td>${Number(row.averageWatchTime || 0).toFixed(2)}</td>
        <td>${Number(row.averagePercentWatched || 0).toFixed(2)}%</td>
        <td>${parseInt(row.uniqueViewers) || 0}</td>
        <td>${parseInt(row.conversions) || 0}</td>
        <td>${Number(row.conversionRate || 0).toFixed(2)}%</td>
        <td>${Number(row.averageCpv || 0).toFixed(2)}</td>
        <td>${Number(row.costs || 0).toFixed(2)}</td>
      </tr>`
    })
    html += '</tbody></table></div>'

    // add export link below table
    html += `<div class="mt-3">
      <button id="export-analytics" class="btn btn-sm btn-primary" style="width: fit-content;">Download CSV</button>
    </div>`

    modalBody.insertAdjacentHTML('beforeend', html)

    $('#export-analytics').on('click', function () {
      const csv = Papa.unparse(table.map(row => ({
        date: row.date,
        plays: row.plays || 0,
        watch_time_minutes: row.watchTime || 0,
        average_watch_time_minutes: row.averageWatchTime || 0,
        average_percent_watched: row.averagePercentWatched || 0,
        unique_viewers: row.uniqueViewers || 0,
        conversions: row.conversions || 0,
        conversion_rate: row.conversionRate || 0,
        average_cpv: row.averageCpv || 0,
        costs: row.costs || 0
      })))

      const now = new Date()
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

  $(document).on('click', '.video-analytics', function () {
    const data = $(this).closest('.row').data()
    const videoId = data.id
    const title = data.title
    $modal.find('.video-title').text(`| ${decodeURIComponent(title)}`)
    showModal(videoId)
  })

  $modal.on('hidden.bs.modal', function () {
    modalBody.innerHTML = ''
    $(this).find('.video-title').text('')
  })
}