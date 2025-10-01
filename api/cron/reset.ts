import { VercelRequest, VercelResponse } from '@vercel/node'
import { findVideosNeedingRanking, updateVideoRanking } from "../../lib/typesenseClient.js"
import { getTodayYYMMDD } from '../../lib/utils.js'


export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers["authorization"]

    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn("Unauthorized request")
        return res.status(401).json({ success: false })
    }


    try {
        const today = getTodayYYMMDD()

        console.info(`Starting update-ranking job for ${today}`)

        // Step 1: fetch candidates
        const videos = await findVideosNeedingRanking(today)
        console.info(`Found ${videos.length} videos needing update`)

        // Step 2: update each
        const results = []
        for (const { id, score } of videos) {
            try {
                await updateVideoRanking(id, score)
                results.push({ id, score, status: "updated" })
            } catch (err: any) {
                results.push({ id, score, status: "failed", error: err.message })
            }
        }

        console.info(`Updated ${results.length} videos`)

        res.status(200).json({
            success: true,
            updated: results.length,
            results
        })
    } catch (err: any) {
        console.error("Job failed:", err)
        res.status(500).json({ success: false, error: err.message })
    }
}