"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rideRepository = void 0;
const crypto_1 = require("crypto");
const promise_1 = __importDefault(require("mysql2/promise"));
const DEFAULT_FARE = 150;
const inMemoryRides = new Map();
class RideRepository {
    constructor() {
        this.pool = null;
        this.schemaReady = false;
    }
    hasDatabaseConfig() {
        return Boolean(process.env.DB_HOST &&
            process.env.DB_PORT &&
            process.env.DB_NAME &&
            process.env.DB_USER &&
            process.env.DB_PASSWORD);
    }
    getPool() {
        if (!this.hasDatabaseConfig()) {
            return null;
        }
        if (!this.pool) {
            this.pool = promise_1.default.createPool({
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
    async ensureSchema(pool) {
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
    rowToRide(row) {
        return {
            rideId: row.id,
            pickup: row.pickup,
            dropoff: row.dropoff,
            fare: row.fare,
            status: row.status,
            createdAt: new Date(row.created_at).toISOString()
        };
    }
    async createRide(pickup, dropoff, fare = DEFAULT_FARE) {
        const rideId = (0, crypto_1.randomUUID)();
        const pool = this.getPool();
        if (!pool) {
            const ride = {
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
        await pool.execute("INSERT INTO rides (id, pickup, dropoff, fare, status) VALUES (?, ?, ?, ?, ?)", [rideId, pickup, dropoff, fare, "requested"]);
        const [rows] = await pool.query("SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE id = ?", [rideId]);
        return this.rowToRide(rows[0]);
    }
    async getHistory(limit = 50) {
        const pool = this.getPool();
        if (!pool) {
            return Array.from(inMemoryRides.values())
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, limit);
        }
        await this.ensureSchema(pool);
        const [rows] = await pool.query("SELECT id, pickup, dropoff, fare, status, created_at FROM rides ORDER BY created_at DESC LIMIT ?", [limit]);
        return rows.map((row) => this.rowToRide(row));
    }
    async getById(rideId) {
        const pool = this.getPool();
        if (!pool) {
            return inMemoryRides.get(rideId) || null;
        }
        await this.ensureSchema(pool);
        const [rows] = await pool.query("SELECT id, pickup, dropoff, fare, status, created_at FROM rides WHERE id = ?", [rideId]);
        if (!rows.length) {
            return null;
        }
        return this.rowToRide(rows[0]);
    }
    async updateStatus(rideId, status) {
        const pool = this.getPool();
        if (!pool) {
            const existing = inMemoryRides.get(rideId);
            if (!existing) {
                return null;
            }
            const updated = {
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
}
exports.rideRepository = new RideRepository();
