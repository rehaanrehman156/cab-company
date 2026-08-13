import { Router } from "express";
import bcrypt from "bcryptjs";
import { getDb } from "../config/db";
import { signToken } from "../middleware/auth";

const router = Router();

// Customer register
router.post("/register", async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: "name, phone and password are required" });
  }
  try {
    const db = getDb();
    const exists = await db.query("SELECT id FROM users WHERE phone = $1", [phone]);
    if (exists.rows.length) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'customer') RETURNING id, name, phone, role",
      [name, phone, hash]
    );
    const user = result.rows[0];
    return res.status(201).json({ token: signToken(user.id, user.role), user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (error) {
    console.error("Register error", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// Customer + driver login
router.post("/login", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: "phone and password are required" });
  }
  try {
    const db = getDb();
    const result = await db.query(
      "SELECT id, name, phone, role, password_hash FROM users WHERE phone = $1",
      [phone]
    );
    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid phone or password" });
    }
    return res.json({ token: signToken(user.id, user.role), user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (error) {
    console.error("Login error", error);
    return res.status(500).json({ error: "Login failed" });
  }
});

// Driver register
router.post("/driver/register", async (req, res) => {
  const { name, phone, password, vehicleNumber, vehicleType } = req.body;
  if (!name || !phone || !password || !vehicleNumber) {
    return res.status(400).json({ error: "name, phone, password and vehicleNumber are required" });
  }
  try {
    const db = getDb();
    const exists = await db.query("SELECT id FROM users WHERE phone = $1", [phone]);
    if (exists.rows.length) {
      return res.status(409).json({ error: "Phone number already registered" });
    }
    const hash = await bcrypt.hash(password, 10);
    const userResult = await db.query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'driver') RETURNING id, name, phone, role",
      [name, phone, hash]
    );
    const user = userResult.rows[0];
    await db.query(
      "INSERT INTO drivers (user_id, vehicle_number, vehicle_type) VALUES ($1, $2, $3)",
      [user.id, vehicleNumber, vehicleType || "mini"]
    );
    return res.status(201).json({ token: signToken(user.id, user.role), user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (error) {
    console.error("Driver register error", error);
    return res.status(500).json({ error: "Registration failed" });
  }
});

export default router;
