import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { DriverLocationUpdate, Ride } from "../types";

let io: SocketIOServer | null = null;

export function initializeSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "*"
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_ride", (rideId: string) => {
      if (rideId) {
        socket.join(`ride:${rideId}`);
      }
    });

    socket.on("leave_ride", (rideId: string) => {
      if (rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });
  });

  return io;
}

export function emitRideCreated(ride: Ride): void {
  io?.emit("ride_created", ride);
}

export function emitRideStatusChanged(ride: Ride): void {
  io?.emit("ride_status_changed", ride);
  io?.to(`ride:${ride.rideId}`).emit("ride_status_changed", ride);
}

export function emitDriverLocationUpdated(payload: DriverLocationUpdate): void {
  io?.to(`ride:${payload.rideId}`).emit("driver_location_updated", payload);
}
