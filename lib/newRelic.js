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


function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value
  }

  return value.replace(/`/g, "\\'")
}


export async function runNrqlQuery(nrqlQuery) {
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
  } catch (err) {
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
export async function insertStripeAction(action, userId, customerId) {
  const flattened = flatten(action)
  const newRelicEvent = {
    ...flattened,
    uid: userId,
    cid: formatCustomerId(customerId),
    eventType: 'StripeAction',
  }

  try {
    const response = insertClient.post('/events', [newRelicEvent])

    console.info('New Relic event', newRelicEvent)
    console.info('New Relic insert response', response.data)
  } catch (error) {
    console.error('Error inserting New Relic action:', error, error?.response.data)
    throw new Error('Error inserting data')
  }
}


export async function queryAnalytics(userId, videoId = undefined) {
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

  const results = await runNrqlQuery(nrqlQuery)

  const chart = {
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

  const table = []

  for (const row of results) {
    const date = row.facet
    chart.labels.push(date)
    chart.plays.push(Number(row.plays))
    chart.watchTime.push(Number(row.watchTime))
    chart.averageWatchTime.push(Number(row.averageWatchTime))
    chart.averagePercentWatched.push(Number(row.averagePercentWatched))
    chart.uniqueViewers.push(Number(row.uniqueViewers))
    chart.averagePlaysPerVideo.push(Number(row.averagePlaysPerVideo))
    chart.averagePlaysPerViewer.push(Number(row.averagePlaysPerViewer))
    chart.conversions.push(Number(row.conversions))
    chart.conversionRate.push(Number(row.conversionRate))
    chart.countries.push(Number(row.countries))
    chart.regions.push(Number(row.regions))
    chart.cities.push(Number(row.cities))
    chart.averageCpv.push(Number(row.averageCpv))
    chart.costs.push(Number(row.costs))
    chart.adFreeStreaming.push(Number(row.adFreeStreaming))

    table.push({
      date,
      plays: Number(row.plays),
      watchTime: Number(row.watchTime),
      averageWatchTime: Number(row.averageWatchTime),
      averagePercentWatched: Number(row.averagePercentWatched),
      uniqueViewers: Number(row.uniqueViewers),
      averagePlaysPerVideo: Number(row.averagePlaysPerVideo),
      averagePlaysPerViewer: Number(row.averagePlaysPerViewer),
      conversions: Number(row.conversions),
      conversionRate: Number(row.conversionRate),
      countries: Number(row.countries),
      regions: Number(row.regions),
      cities: Number(row.cities),
      averageCpv: Number(row.averageCpv),
      costs: Number(row.costs),
      adFreeStreaming: Number(row.adFreeStreaming),
    })
  }

  return { chart, table }
}


export async function queryConversions({ videoId, phone, firstname, userId }) {
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