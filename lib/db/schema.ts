import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
export const ledgerTypeEnum = pgEnum("ledger_type", ["credit", "debit"])


export const userLedger = pgTable(
    "user_ledger",
    {
        stripeEventId: text("stripe_event_id").primaryKey(),
        userId: uuid("user_id").notNull(),
        stripeObjectId: text("stripe_object_id").notNull(),
        stripeCustomerId: text("stripe_customer_id").notNull(),
        type: ledgerTypeEnum("type").notNull(),
        sourceType: text("source_type").notNull(),
        amount: bigint("amount", { mode: "number" }).notNull(), // store in cents
        currency: text("currency").notNull(),
        description: text("description"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => ({
        userIdx: index("idx_user_ledger_user_id").on(table.userId),
    })
)