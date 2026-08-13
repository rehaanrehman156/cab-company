import { randomUUID } from "crypto";
import { getDb } from "../config/db";
import { Ride, RideStatus } from "../types";

const DEFAULT_FARE = 150;

// In-memory fallback when DATABASE_URL is not set
const inMemoryRides = new Map<string, Ride>();

function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function rowToRide(row: any): Ride {
  return {
    rideId: row.id,
    pickup: row.pickup,
    dropoff: row.dropoff,
    fare: row.fare,
    status: row.status as RideStatus,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

class RideRepository {
  async createRide(pickup: string, dropoff: string, fare: number = DEFAULT_FARE, customerId?: string): Promise<Ride> {
    if (!isDbAvailable()) {
      const rideId = randomUUID();
      const ride: Ride = { rideId, pickup, dropoff, fare, status: "requested", createdAt: new Date().toISOString() };
      inMemoryRides.set(rideId, ride);
      return ride;
    }
    const db = getDb();
    const result = await db.query(
      "INSERT INTO rides (pickup, dropoff, fare, status, customer_id) VALUES ($1, $2, $3, 'requested', $4) RETURNING *",
      [pickup, dropoff, fare, customerId || null]
    );
    return rowToRide(result.rows[0]);
  }

  async getHistory(limit = 50): Promise<Ride[]> {
    if (!isDbAvailable()) {
      return Array.from(inMemoryRides.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    }
    const db = getDb();
    const result = await db.query("SELECT * FROM rides ORDER BY created_at DESC LIMIT $1", [limit]);
    return result.rows.map(rowToRide);
  }

  async getById(rideId: string): Promise<Ride | null> {
    if (!isDbAvailable()) return inMemoryRides.get(rideId) || null;
    const db = getDb();
    const result = await db.query("SELECT * FROM rides WHERE id = $1", [rideId]);
    return result.rows.length ? rowToRide(result.rows[0]) : null;
  }

  async updateStatus(rideId: string, status: RideStatus, driverId?: string): Promise<Ride | null> {
    if (!isDbAvailable()) {
      const existing = inMemoryRides.get(rideId);
      if (!existing) return null;
      const updated = { ...existing, status };
      inMemoryRides.set(rideId, updated);
      return updated;
    }
    const db = getDb();
    if (driverId) {
      await db.query("UPDATE rides SET status = $1, driver_id = $2, updated_at = NOW() WHERE id = $3", [status, driverId, rideId]);
    } else {
      await db.query("UPDATE rides SET status = $1, updated_at = NOW() WHERE id = $2", [status, rideId]);
    }
    return this.getById(rideId);
  }

  async getByStatus(status: RideStatus): Promise<Ride[]> {
    if (!isDbAvailable()) return Array.from(inMemoryRides.values()).filter((r) => r.status === status);
    const db = getDb();
    const result = await db.query("SELECT * FROM rides WHERE status = $1 ORDER BY created_at ASC", [status]);
    return result.rows.map(rowToRide);
  }

  async getActiveRides(): Promise<Ride[]> {
    const activeStatuses: RideStatus[] = ["accepted", "arriving", "on_trip"];
    if (!isDbAvailable()) return Array.from(inMemoryRides.values()).filter((r) => activeStatuses.includes(r.status));
    const db = getDb();
    const result = await db.query("SELECT * FROM rides WHERE status = ANY($1) ORDER BY created_at ASC", [activeStatuses]);
    return result.rows.map(rowToRide);
  }
}

export const rideRepository = new RideRepository();