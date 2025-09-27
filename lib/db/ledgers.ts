import { db } from "./connection.js"
import { userLedger } from "../db/schema.js"

export async function insertLedgerEntry(entry: typeof userLedger.$inferInsert) {
  try {
    await db
      .insert(userLedger)
      .values(entry)
      .onConflictDoNothing({ target: userLedger.stripeEventId })

    return true
  } catch (err) {
    console.error("DB insert error:", err)
    throw new Error("Database insert failed")
  }
}