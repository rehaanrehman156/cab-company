"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
exports.emitRideCreated = emitRideCreated;
exports.emitRideStatusChanged = emitRideStatusChanged;
exports.emitDriverLocationUpdated = emitDriverLocationUpdated;
const socket_io_1 = require("socket.io");
let io = null;
function initializeSocketServer(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGIN || "*"
        }
    });
    io.on("connection", (socket) => {
        socket.on("join_ride", (rideId) => {
            if (rideId) {
                socket.join(`ride:${rideId}`);
            }
        });
        socket.on("leave_ride", (rideId) => {
            if (rideId) {
                socket.leave(`ride:${rideId}`);
            }
        });
    });
    return io;
}
function emitRideCreated(ride) {
    io?.emit("ride_created", ride);
}
function emitRideStatusChanged(ride) {
    io?.emit("ride_status_changed", ride);
    io?.to(`ride:${ride.rideId}`).emit("ride_status_changed", ride);
}
function emitDriverLocationUpdated(payload) {
    io?.to(`ride:${payload.rideId}`).emit("driver_location_updated", payload);
}
