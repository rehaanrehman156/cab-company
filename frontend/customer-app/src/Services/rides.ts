import api from "./api";

export const bookRide = (pickup: string, dropoff: string) =>
  api.post("/rides/book", { pickup, dropoff });

export const getRideHistory = () =>
  api.get("/rides/history");

export const getRideStatus = (rideId: string) =>
  api.get(`/rides/status/${rideId}`);
