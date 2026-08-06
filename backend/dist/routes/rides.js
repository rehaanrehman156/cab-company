"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rideRepository_1 = require("../data/rideRepository");
const socket_1 = require("../realtime/socket");
const router = (0, express_1.Router)();
const validStatuses = ["requested", "accepted", "arriving", "on_trip", "completed", "cancelled"];
router.post("/book", async (req, res) => {
    const { pickup, dropoff } = req.body;
    if (!pickup || !dropoff) {
        return res.status(400).json({ error: "pickup and dropoff are required" });
    }
    const ride = await rideRepository_1.rideRepository.createRide(String(pickup), String(dropoff));
    (0, socket_1.emitRideCreated)(ride);
    (0, socket_1.emitRideStatusChanged)(ride);
    return res.status(201).json(ride);
});
router.get("/history", async (_req, res) => {
    const rides = await rideRepository_1.rideRepository.getHistory();
    return res.json(rides);
});
router.get("/status/:rideId", async (req, res) => {
    const { rideId } = req.params;
    const ride = await rideRepository_1.rideRepository.getById(rideId);
    if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
    }
    return res.json({ rideId: ride.rideId, status: ride.status });
});
router.patch("/status/:rideId", async (req, res) => {
    const { rideId } = req.params;
    const status = req.body?.status;
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
    }
    const ride = await rideRepository_1.rideRepository.updateStatus(rideId, status);
    if (!ride) {
        return res.status(404).json({ error: "Ride not found" });
    }
    (0, socket_1.emitRideStatusChanged)(ride);
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
    (0, socket_1.emitDriverLocationUpdated)(payload);
    return res.json({ ok: true, ...payload });
});
exports.default = router;
