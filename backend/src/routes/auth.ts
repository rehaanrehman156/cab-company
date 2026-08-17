import { Router } from "express";
import { getDb } from "../config/db";
import { signToken } from "../middleware/auth";
import { sendOtp, verifyOtp } from "../services/otp";

const router = Router();

// Send OTP — works for both customers and drivers
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(String(phone))) {
    return res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number" });
  }
  try {
    await sendOtp(String(phone));
    return res.json({ message: "OTP sent" });
  } catch (error) {
    console.error("OTP send error", error);
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

// Verify OTP — creates account if new user, logs in if existing
router.post("/verify-otp", async (req, res) => {
  const { phone, otp, name, role } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone and OTP are required" });
  }

  if (!verifyOtp(String(phone), String(otp))) {
    return res.status(400).json({ error: "Incorrect or expired OTP. Please try again." });
  }

  try {
    const db = getDb();
    const existing = await db.query(
      "SELECT id, name, phone, role FROM users WHERE phone = $1",
      [phone]
    );

    if (existing.rows.length) {
      // Existing user — log in
      const user = existing.rows[0];
      return res.json({
        token: signToken(user.id, user.role),
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
        isNewUser: false,
      });
    }

    // New user — create account
    if (!name) {
      return res.status(400).json({ error: "name_required", message: "Please enter your name to complete registration" });
    }

    const userRole = role === "driver" ? "driver" : "customer";
    const result = await db.query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, '', $3) RETURNING id, name, phone, role",
      [name, phone, userRole]
    );
    const user = result.rows[0];
    return res.status(201).json({
      token: signToken(user.id, user.role),
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      isNewUser: true,
    });
  } catch (error) {
    console.error("Verify OTP error", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// Driver: verify OTP + register vehicle
router.post("/driver/verify-otp", async (req, res) => {
  const { phone, otp, name, vehicleNumber, vehicleType } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: "Phone and OTP are required" });
  }

  if (!verifyOtp(String(phone), String(otp))) {
    return res.status(400).json({ error: "Incorrect or expired OTP. Please try again." });
  }

  try {
    const db = getDb();
    const existing = await db.query("SELECT id, name, phone, role FROM users WHERE phone = $1", [phone]);

    if (existing.rows.length) {
      const user = existing.rows[0];
      if (user.role !== "driver") {
        return res.status(403).json({ error: "This number is registered as a customer, not a driver." });
      }
      return res.json({
        token: signToken(user.id, user.role),
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
        isNewUser: false,
      });
    }

    if (!name || !vehicleNumber) {
      return res.status(400).json({ error: "name_required", message: "Enter your name and vehicle number to register" });
    }

    const userResult = await db.query(
      "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, '', 'driver') RETURNING id, name, phone, role",
      [name, phone]
    );
    const user = userResult.rows[0];
    await db.query(
      "INSERT INTO drivers (user_id, vehicle_number, vehicle_type) VALUES ($1, $2, $3)",
      [user.id, vehicleNumber, vehicleType || "mini"]
    );
    return res.status(201).json({
      token: signToken(user.id, user.role),
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      isNewUser: true,
    });
  } catch (error) {
    console.error("Driver verify OTP error", error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;