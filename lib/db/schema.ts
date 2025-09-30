import { bigint, doublePrecision, index, pgEnum, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core"
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
    (table) => [
        index("idx_user_ledger_user_id").on(table.userId),
    ]
)



export const cost = pgTable("costs", {
    id: uuid().defaultRandom().primaryKey(),
    uid: text("uid").notNull(),
    cid: text("cid").notNull(),
    yymmdd: varchar("yymmdd", { length: 6 }).notNull(),
    minutes: bigint("minutes", { mode: "number" }).notNull().default(0),
    cpv: doublePrecision("cpv").notNull().default(0),
    budget: doublePrecision("budget").notNull().default(0),
    amount: doublePrecision("amount").notNull().default(0)
},
    (table) => [
        unique().on(
            table.uid,
            table.cid,
            table.yymmdd,
        )
    ]
)