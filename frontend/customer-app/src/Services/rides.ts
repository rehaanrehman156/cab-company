import api from "./api";

export const bookRide = (
  pickup: string, dropoff: string,
  pickupLat?: string, pickupLon?: string,
  dropoffLat?: string, dropoffLon?: string,
  vehicleType?: string
) =>
  api.post("/rides/book", { pickup, dropoff, pickupLat, pickupLon, dropoffLat, dropoffLon, vehicleType });

export const getRideHistory = () =>
  api.get("/rides/history");

export const getRideStatus = (rideId: string) =>
  api.get(`/rides/status/${rideId}`);

export const updateRideStatus = (rideId: string, status: string) =>
  api.patch(`/rides/status/${rideId}`, { status });
