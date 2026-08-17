import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<void> {
  const db = getDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(128) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      role VARCHAR(16) NOT NULL DEFAULT 'customer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      vehicle_number VARCHAR(32) NOT NULL,
      vehicle_type VARCHAR(16) NOT NULL DEFAULT 'mini',
      is_available BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES users(id),
      driver_id UUID REFERENCES users(id),
      pickup VARCHAR(255) NOT NULL,
      dropoff VARCHAR(255) NOT NULL,
      fare INT NOT NULL DEFAULT 150,
      status VARCHAR(32) NOT NULL DEFAULT 'requested',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
