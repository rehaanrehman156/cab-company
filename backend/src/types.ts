export type RideStatus = "requested" | "accepted" | "arriving" | "on_trip" | "completed" | "cancelled";

export interface Ride {
  rideId: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: RideStatus;
  createdAt: string;
}

export interface DriverLocationUpdate {
  rideId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}
