import { useState } from "react";
import BookingForm from "../Components/booking/BookingForm";

export default function Booking() {
  const [fare, setFare] = useState<number | null>(null);

  const handleBook = (pickup: string, dropoff: string) => {
    console.log("Booking:", pickup, dropoff);
    setFare(Math.floor(Math.random() * 200) + 50); // placeholder fare
  };

  return (
    <div>
      <h2>Book a Ride</h2>
      <BookingForm onBook={handleBook} />
      {fare && <p>Estimated Fare: ₹{fare}</p>}
    </div>
  );
}
