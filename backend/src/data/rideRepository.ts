import { randomUUID } from "crypto";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import { Ride, RideStatus } from "../types";

type RideRow = RowDataPacket & {
  id: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: RideStatus;
  created_at: Date;
};

const DEFAULT_FARE = 150;
const inMemoryRides = new Map<string, Ride>();

class RideRepository {
  private pool: Pool | null = null;
  private schemaReady = false;

  private hasDatabaseConfig(): boolean {
    return Boolean(
      process.env.DB_HOST &&
      process.env.DB_PORT &&
      process.env.DB_NAME &&
      process.env.DB_USER &&
      process.env.DB_PASSWORD
    );
  }

  private getPool(): Pool | null {
    if (!this.hasDatabaseConfig()) {
      return null;
    }

    if (!this.pool) {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectionLimit: 10
      });
    }

    return this.pool;
  }

  private async ensureSchema(pool: Pool): Promise<void> {
    if (this.schemaReady) {
      return;
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS rides (
        id VARCHAR(64) PRIMARY KEY,
        pickup VARCHAR(255) NOT NULL,
        dropoff VARCHAR(255) NOT NULL,
        fare INT NOT NULL,
        status VARCHAR(32) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    this.schemaReady = true;
  }

  private rowToRide(row: RideRow): Ride {
    return {
      rideId: row.id,
      pickup: row.pickup,
      dropoff: row.dropoff,
      fare: row.fare,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  async createRide(pickup: string, dropoff: string, fare: number = DEFAULT_FARE): Promise<Ride> {
    const rideId = randomUUID();
    const pool = this.getPool();

    if (!pool) {
      const ride: Ride = {
        rideId,
        pickup,
        dropoff,
        fare,
        status: "requested",
        createdAt: new Date().toISOString()
      };
      inMemoryRides.set(rideId, ride);
      return ride;
    }

    await this.ensureSchema(pool);
    await pool.execute(
      "INSERT INTO rides (id, pickup, dropoff, fare, status) VALUES (?, ?, ?, ?, ?)",
      [rideId, pickup, dropoff, fare, "requested"]
    );

    const [rows] = await pool.query<RideRow[]>("SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE id = ?", [rideId]);
    return this.rowToRide(rows[0]);
  }

  async getHistory(limit: number = 50): Promise<Ride[]> {
    const pool = this.getPool();

    if (!pool) {
      return Array.from(inMemoryRides.values())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    }

    await this.ensureSchema(pool);
    const [rows] = await pool.query<RideRow[]>(
      "SELECT id, pickup, dropoff, fare, status, created_at FROM rides ORDER BY created_at DESC LIMIT ?",
      [limit]
    );

    return rows.map((row) => this.rowToRide(row));
  }

  async getById(rideId: string): Promise<Ride | null> {
    const pool = this.getPool();

    if (!pool) {
      return inMemoryRides.get(rideId) || null;
    }

    await this.ensureSchema(pool);
    const [rows] = await pool.query<RideRow[]>(
      "SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE id = ?",
      [rideId]
    );

    if (!rows.length) {
      return null;
    }

    return this.rowToRide(rows[0]);
  }

  async updateStatus(rideId: string, status: RideStatus): Promise<Ride | null> {
    const pool = this.getPool();

    if (!pool) {
      const existing = inMemoryRides.get(rideId);
      if (!existing) {
        return null;
      }
      const updated: Ride = {
        ...existing,
        status
      };
      inMemoryRides.set(rideId, updated);
      return updated;
    }

    await this.ensureSchema(pool);
    await pool.execute("UPDATE rides SET status = ? WHERE id = ?", [status, rideId]);
    return this.getById(rideId);
  }

  async getByStatus(status: RideStatus): Promise<Ride[]> {
    const pool = this.getPool();

    if (!pool) {
      return Array.from(inMemoryRides.values()).filter((r) => r.status === status);
    }

    await this.ensureSchema(pool);
    const [rows] = await pool.query<RideRow[]>(
      "SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE status = ? ORDER BY created_at ASC",
      [status]
    );
    return rows.map((row) => this.rowToRide(row));
  }

  async getActiveRides(): Promise<Ride[]> {
    const activeStatuses: RideStatus[] = ["accepted", "arriving", "on_trip"];
    const pool = this.getPool();

    if (!pool) {
      return Array.from(inMemoryRides.values()).filter((r) => activeStatuses.includes(r.status));
    }

    await this.ensureSchema(pool);
    const placeholders = activeStatuses.map(() => "?").join(", ");
    const [rows] = await pool.query<RideRow[]>(
      `SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE status IN (${placeholders}) ORDER BY created_at ASC`,
      activeStatuses
    );
    return rows.map((row) => this.rowToRide(row));
  }
}

export const rideRepository = new RideRepository();
