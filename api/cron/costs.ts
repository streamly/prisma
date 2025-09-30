import type { VercelRequest, VercelResponse } from "@vercel/node"
import { upsertCosts } from "../../lib/db/costs.js"
import { fetchTodayCosts, fetchYesterdayCosts } from "../../lib/newRelic.js"
import { Cost } from "../../lib/types.js"

function transformFacetsToCosts(facets: any[]): Cost[] {
  return facets.map((facet: any) => {
    const [cid, uid, date] = facet.facet

    return {
      uid: uid ?? "",
      cid: cid ?? "",
      yymmdd: new Date(date).toISOString().slice(2, 10).replace(/-/g, ""), // e.g. "250929"
      minutes: 0,
      cpv: 0,
      budget: 0,
      amount: facet.costs ?? 0,
    }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers["authorization"]

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn("Unauthorized request")
    return res.status(401).json({ success: false })
  }

  try {
    const interval = (req.query.interval as string) || "today"
    console.log(`Starting costs job for interval=${interval} at ${new Date().toISOString()}`)

    const facets =
      interval === "yesterday"
        ? await fetchYesterdayCosts()
        : await fetchTodayCosts()

    console.log('Facets', facets)
    console.log(`NRQL returned ${facets?.length || 0} facets`)

    const costs: Cost[] = transformFacetsToCosts(facets)
    console.log(`Transformed to ${costs.length} cost rows`)

    if (costs.length === 0) {
      console.log(`No data to upsert for interval=${interval}`)
      return res.status(200).json({ success: true, message: `No ${interval} data to upsert` })
    }

    await upsertCosts(costs)
    console.log(`Successfully upserted ${costs.length} costs for interval=${interval}`)

    return res.status(200).json({ success: true, upserted: costs.length, interval })
  } catch (err: any) {
    console.error("Costs handler error:", err)
    return res.status(500).json({ success: false, error: err.message })
  }
}