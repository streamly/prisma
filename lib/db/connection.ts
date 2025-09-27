import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { connectionString } from 'pg/lib/defaults'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL

})
export const db = drizzle({ client: pool })