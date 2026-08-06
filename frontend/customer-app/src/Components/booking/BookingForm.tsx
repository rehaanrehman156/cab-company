import { useState } from "react";
import { TextField, Button } from "@mui/material";

export default function BookingForm({ onBook }: { onBook: (pickup: string, dropoff: string) => void }) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  return (
    <div>
      <TextField fullWidth label="Pickup" value={pickup} onChange={(e) => setPickup(e.target.value)} />
      <TextField fullWidth label="Dropoff" value={dropoff} onChange={(e) => setDropoff(e.target.value)} />
      <Button variant="contained" onClick={() => onBook(pickup, dropoff)}>Book Ride</Button>
    </div>
  );
}
