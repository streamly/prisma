import axios from 'axios'
import { flatten } from 'flat'
import { formatCustomerId, formatUserId } from './utils.js'


const NEWRELIC_ACCOUNT_ID = process.env.NEWRELIC_ACCOUNT_ID
const NEWRELIC_INSERT_KEY = process.env.NEWRELIC_INSERT_KEY
const NEWRELIC_API_KEY = process.env.NEWRELIC_API_KEY


const insertClient = axios.create({
  baseURL: `https://insights-collector.newrelic.com/v1/accounts/${NEWRELIC_ACCOUNT_ID}`,
  headers: {
    "Content-Type": "application/json",
    "Api-Key": NEWRELIC_INSERT_KEY,
  }
})


const queryClient = axios.create({
  baseURL: "https://api.newrelic.com/graphql",
  headers: {
    "Content-Type": "application/json",
    "API-Key": NEWRELIC_API_KEY
  }
})


function sanitizeString(value: any) {
  if (typeof value !== 'string') {
    return value
  }

  return value.replace(/`/g, "\\'")
}


export async function runNrqlQuery(nrqlQuery: string) {
  try {
    const query = {
      query: `
        {
          actor {
            account(id: ${NEWRELIC_ACCOUNT_ID}) {
              nrql(query: """${nrqlQuery}""") {
                results
              }
            }
          }
        }
      `,
    }

    const response = await queryClient.post('', query)

    return response.data.data.actor.account.nrql.results
  } catch (err: any) {
    console.error('Error executing NRQL query', err?.response?.data || err)
    throw new Error('NRQL query failed')
  }
}


/**
 * 
 * @param {object} action 
 * @param {string} userId 
 * @param {string} customerId 
 */
export async function insertStripeAction(action: object, userId: string, customerId: string) {
  const flattened = flatten(action) as object
  const newRelicEvent = {
    ...flattened,
    uid: userId,
    cid: formatCustomerId(customerId),
    eventType: 'StripeAction',
  }

  try {
    const response = await insertClient.post('/events', [newRelicEvent])

    console.info('New Relic event', newRelicEvent)
    console.info('New Relic insert response', response.data)
  } catch (error: any) {
    console.error('Error inserting New Relic action:', error, error?.response.data)
    throw new Error('Error inserting data')
  }
}

type RawAnalyticsRow = {
  facet: string
  plays: number | string | null
  watchTime: number | string | null
  averageWatchTime: number | string | null
  averagePercentWatched: number | string | null
  uniqueViewers: number | string | null
  averagePlaysPerVideo: number | string | null
  averagePlaysPerViewer: number | string | null
  conversions: number | string | null
  conversionRate: number | string | null
  countries: number | string | null
  regions: number | string | null
  cities: number | string | null
  averageCpv: number | string | null
  costs: number | string | null
  adFreeStreaming?: number | string | null
}

type AnalyticsChart = {
  labels: string[]
  plays: number[]
  watchTime: number[]
  averageWatchTime: number[]
  averagePercentWatched: number[]
  uniqueViewers: number[]
  averagePlaysPerVideo: number[]
  averagePlaysPerViewer: number[]
  conversions: number[]
  conversionRate: number[]
  countries: number[]
  regions: number[]
  cities: number[]
  averageCpv: number[]
  costs: number[]
  adFreeStreaming: number[]
}

type AnalyticsTableRow = {
  date: string
  plays: number
  watchTime: number
  averageWatchTime: number
  averagePercentWatched: number
  uniqueViewers: number
  averagePlaysPerVideo: number
  averagePlaysPerViewer: number
  conversions: number
  conversionRate: number
  countries: number
  regions: number
  cities: number
  averageCpv: number
  costs: number
  adFreeStreaming: number
}

export async function queryAnalytics(
  userId: string,
  videoId?: string
): Promise<{ chart: AnalyticsChart; table: AnalyticsTableRow[] }> {
  let filters = `WHERE aid='${formatUserId(userId)}'`

  if (videoId) {
    filters += `AND vid='${sanitizeString(videoId)}'`
  }

  const nrqlQuery = `
    FROM MobileVideo, PageAction, RokuVideo, playAction
    SELECT
      latest(timestamp) AS timestamp,
      uniqueCount(guid) AS plays,
      sum(playtimeSinceLastEvent/60000) AS watchTime,
      sum(playtimeSinceLastEvent/60000) / uniqueCount(guid) AS averageWatchTime,
      sum(playtimeSinceLastEvent/contentDuration) / uniqueCount(guid) * 100 AS averagePercentWatched,
      uniqueCount(viewerId) AS uniqueViewers,
      uniqueCount(guid) / uniqueCount(vid) AS averagePlaysPerVideo,
      uniqueCount(guid) / uniqueCount(viewerId) AS averagePlaysPerViewer,
      filter(count(email), WHERE email IS NOT NULL) AS conversions,
      (filter(count(email), WHERE email IS NOT NULL) / uniqueCount(guid)) * 100 AS conversionRate,
      uniqueCount(countryCode) AS countries,
      uniqueCount(regionCode) AS regions,
      uniqueCount(city) AS cities,
      filter(average(((score - 123456) / 8152256) / 46976), WHERE ranking > 0) AS averageCpv,
      filter(sum(playtimeSinceLastEvent/60000), WHERE ranking > 0) AS costs
    FACET dateOf(timestamp) AS date
    SINCE 90 days ago
    ${filters}
    LIMIT MAX
  `

  const results: RawAnalyticsRow[] = await runNrqlQuery(nrqlQuery)

  const chart: AnalyticsChart = {
    labels: [],
    plays: [],
    watchTime: [],
    averageWatchTime: [],
    averagePercentWatched: [],
    uniqueViewers: [],
    averagePlaysPerVideo: [],
    averagePlaysPerViewer: [],
    conversions: [],
    conversionRate: [],
    countries: [],
    regions: [],
    cities: [],
    averageCpv: [],
    costs: [],
    adFreeStreaming: [],
  }

  const table: AnalyticsTableRow[] = []

  for (const row of results) {
    const date = row.facet
    const num = (v: unknown) => Number(v) || 0

    chart.labels.push(date)
    chart.plays.push(num(row.plays))
    chart.watchTime.push(num(row.watchTime))
    chart.averageWatchTime.push(num(row.averageWatchTime))
    chart.averagePercentWatched.push(num(row.averagePercentWatched))
    chart.uniqueViewers.push(num(row.uniqueViewers))
    chart.averagePlaysPerVideo.push(num(row.averagePlaysPerVideo))
    chart.averagePlaysPerViewer.push(num(row.averagePlaysPerViewer))
    chart.conversions.push(num(row.conversions))
    chart.conversionRate.push(num(row.conversionRate))
    chart.countries.push(num(row.countries))
    chart.regions.push(num(row.regions))
    chart.cities.push(num(row.cities))
    chart.averageCpv.push(num(row.averageCpv))
    chart.costs.push(num(row.costs))
    chart.adFreeStreaming.push(num(row.adFreeStreaming))

    table.push({
      date,
      plays: num(row.plays),
      watchTime: num(row.watchTime),
      averageWatchTime: num(row.averageWatchTime),
      averagePercentWatched: num(row.averagePercentWatched),
      uniqueViewers: num(row.uniqueViewers),
      averagePlaysPerVideo: num(row.averagePlaysPerVideo),
      averagePlaysPerViewer: num(row.averagePlaysPerViewer),
      conversions: num(row.conversions),
      conversionRate: num(row.conversionRate),
      countries: num(row.countries),
      regions: num(row.regions),
      cities: num(row.cities),
      averageCpv: num(row.averageCpv),
      costs: num(row.costs),
      adFreeStreaming: num(row.adFreeStreaming),
    })
  }

  return { chart, table }
}


export async function queryConversions({ videoId, phone, firstname, userId }: { videoId: string, phone?: string, firstname?: string, userId: string }) {
  let filters = `WHERE actionName = 'CONTACT' AND referrerUrl LIKE '%bizilla.tv%' AND aid='${formatUserId(userId)}'`

  if (videoId) {
    filters += ` AND vid='${sanitizeString(videoId)}'`
  }
  if (phone) {
    filters += ` AND phone LIKE '%${sanitizeString(phone)}%'`
  }
  if (firstname) {
    filters += ` AND firstname LIKE '%${sanitizeString(firstname)}%'`
  }

  const nrqlQuery = `
      FROM PageAction
      SELECT 
        guid,
        timestamp,
        firstname,
        lastname,
        organization,
        phone,
        email,
        message,
        channel,
        vid,
        title
      ${filters}
      SINCE 90 days ago 
      LIMIT MAX
    `

  console.log('query', nrqlQuery)

  return runNrqlQuery(nrqlQuery)
}