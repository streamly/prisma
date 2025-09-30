
import { sql } from 'drizzle-orm'
import { db } from './connection.js'
import { cost } from './schema.js'
import { Cost } from '../types.js'


export async function upsertCosts(costsData: Cost[]) {
    try {
        await db
            .insert(cost)
            .values(costsData)
            .onConflictDoUpdate({
                target: [cost.uid, cost.cid, cost.yymmdd],
                set: {
                    minutes: sql`excluded.minutes`,
                    cpv: sql`excluded.cpv`,
                    budget: sql`excluded.budget`,
                    amount: sql`excluded.amount`,
                },
            })

        return { success: true, upserted: costsData.length }
    } catch (err: any) {
        console.error("Upsert error:", err)
        throw new Error(`Failed to upsert costs: ${err.message}`)
    }
}