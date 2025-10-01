import { eq, sql } from "drizzle-orm"
import { db } from "./connection.js"
import { cost, userLedger } from "./schema.js"

export async function getLowBalanceCustomers(thresholdCents = 500) {
    return db
        .select({
            cid: userLedger.cid,
            cusId: userLedger.stripeObjectId,
            balance: sql<number>`COALESCE(SUM(
        CASE WHEN ${userLedger.type} = 'credit' THEN ${userLedger.amount} ELSE 0 END
      ),0) - COALESCE(SUM(${cost.amount}),0)`,
        })
        .from(userLedger)
        .leftJoin(cost, eq(userLedger.cid, cost.cid))
        .groupBy(userLedger.cid, userLedger.stripeObjectId)
        .having(
            sql`(COALESCE(SUM(
        CASE WHEN ${userLedger.type} = 'credit' THEN ${userLedger.amount} ELSE 0 END
      ),0) - COALESCE(SUM(${cost.amount}),0)) <= ${thresholdCents}`
        )
}