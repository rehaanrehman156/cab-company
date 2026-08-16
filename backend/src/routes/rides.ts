import { Router } from "express";
import { rideRepository } from "../data/rideRepository";
import { emitDriverLocationUpdated, emitRideCreated, emitRideStatusChanged } from "../realtime/socket";
import { RideStatus } from "../types";
import { calculateFare } from "../services/fare";

const router = Router();

const validStatuses: RideStatus[] = ["requested", "accepted", "arriving", "on_trip", "completed", "cancelled"];

// Estimate fare before booking
router.post("/estimate", (req, res) => {
  const { pickupLat, pickupLon, dropoffLat, dropoffLon, vehicleType } = req.body;
  if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
    return res.status(400).json({ error: "pickupLat, pickupLon, dropoffLat, dropoffLon are required" });
  }
  const result = calculateFare(
    Number(pickupLat), Number(pickupLon),
    Number(dropoffLat), Number(dropoffLon),
    vehicleType || "mini"
  );
  return res.json(result);
});

router.post("/book", async (req, res) => {
  const { pickup, dropoff, pickupLat, pickupLon, dropoffLat, dropoffLon, vehicleType } = req.body;

  if (!pickup || !dropoff) {
    return res.status(400).json({ error: "pickup and dropoff are required" });
  }

  let fare = 150;
  if (pickupLat && pickupLon && dropoffLat && dropoffLon) {
    const result = calculateFare(Number(pickupLat), Number(pickupLon), Number(dropoffLat), Number(dropoffLon), vehicleType || "mini");
    fare = result.fare;
  }

  const ride = await rideRepository.createRide(String(pickup), String(dropoff), fare);
  emitRideCreated(ride);
  emitRideStatusChanged(ride);
  return res.status(201).json(ride);
});

router.get("/pending", async (_req, res) => {
  const rides = await rideRepository.getByStatus("requested");
  return res.json(rides);
});

router.get("/active", async (_req, res) => {
  const rides = await rideRepository.getActiveRides();
  return res.json(rides);
});

router.get("/history", async (_req, res) => {
  const rides = await rideRepository.getHistory();
  return res.json(rides);
});

router.get("/status/:rideId", async (req, res) => {
  const { rideId } = req.params;
  const ride = await rideRepository.getById(rideId);

  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }

  return res.json({ rideId: ride.rideId, status: ride.status });
});

router.patch("/status/:rideId", async (req, res) => {
  const { rideId } = req.params;
  const status = req.body?.status as RideStatus;

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const ride = await rideRepository.updateStatus(rideId, status);
  if (!ride) {
    return res.status(404).json({ error: "Ride not found" });
  }

  emitRideStatusChanged(ride);
  return res.json(ride);
});

router.post("/:rideId/location", (req, res) => {
  const { rideId } = req.params;
  const { latitude, longitude } = req.body ?? {};

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ error: "latitude and longitude must be numbers" });
  }

  const payload = {
    rideId,
    latitude,
    longitude,
    updatedAt: new Date().toISOString()
  };

  emitDriverLocationUpdated(payload);
  return res.json({ ok: true, ...payload });
});

export default router;
