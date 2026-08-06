import React, { useState } from 'react';
import './App.css';
import { bookRide } from './Services/rides';

type RideType = 'mini' | 'sedan' | 'suv';

function App() {
  const [pickup, setPickup] = useState('Current location');
  const [dropoff, setDropoff] = useState('Airport Terminal 3');
  const [rideType, setRideType] = useState<RideType>('mini');
  const [fare, setFare] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ride, setRide] = useState<{ rideId: string; pickup: string; dropoff: string; fare: number; status: string } | null>(null);

  const calculateFare = (selectedType: RideType, selectedPickup: string) => {
    const baseFare: Record<RideType, number> = { mini: 120, sedan: 170, suv: 220 };
    const locationBoost = selectedPickup.includes('Current location') ? 24 : 12;
    return baseFare[selectedType] + locationBoost;
  };

  const handleUseLocation = () => {
    if (!('geolocation' in navigator)) {
      setMessage('Geolocation is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPickup = `Current location (${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)})`;
        setPickup(nextPickup);
        setFare(calculateFare(rideType, nextPickup));
        setMessage('Pickup location detected successfully.');
      },
      (error) => {
        setMessage(`Location lookup failed: ${error.message}`);
      }
    );
  };

  const handleCheckFare = (event: React.FormEvent) => {
    event.preventDefault();
    const nextFare = calculateFare(rideType, pickup);
    setFare(nextFare);
    setMessage(`Estimated fare for ${rideType} ride: ₹${nextFare}`);
  };

  const handleBookRide = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!pickup.trim() || !dropoff.trim()) {
      setMessage('Please enter both pickup and dropoff locations.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await bookRide(pickup, dropoff);
      const bookedRide = response.data;
      setRide(bookedRide);
      setFare(bookedRide.fare);
      setMessage(`Ride booked successfully. Status: ${bookedRide.status}`);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.error || 'Unable to reach the ride service right now.';
      setMessage(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBooking = () => {
    document.getElementById('ride-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="cab-app">
      <div className="ambient-glow ambient-left" />
      <div className="ambient-glow ambient-right" />

      <header className="topbar section-shell fade-in-up">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">C</div>
          <div>
            <p className="brand-kicker">Cab Company</p>
            <h1 className="brand-title">City rides that feel first class</h1>
          </div>
        </div>
        <nav className="top-links" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#fleet">Fleet</a>
          <a href="#safety">Safety</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main className="section-shell">
        <section className="hero-grid fade-in-up delay-1">
          <article className="hero-copy">
            <p className="eyebrow">Fast pickup. Fair fares. Trusted drivers.</p>
            <h2>Book your ride across town in under 20 seconds.</h2>
            <p className="hero-text">
              From office commutes to airport trips, Cab Company matches you with verified
              drivers, smart route planning, and live trip tracking.
            </p>
            <div className="cta-row">
              <button type="button" className="btn btn-primary" onClick={scrollToBooking}>Book A Ride</button>
              <button type="button" className="btn btn-ghost" onClick={() => setMessage('Scheduling is ready for the next iteration of the product.')}>Schedule For Later</button>
            </div>
            <div className="stats-row" aria-label="Service highlights">
              <div>
                <p className="stat-number">4.9/5</p>
                <p className="stat-label">Average rider rating</p>
              </div>
              <div>
                <p className="stat-number">3 min</p>
                <p className="stat-label">Typical pickup time</p>
              </div>
              <div>
                <p className="stat-number">24/7</p>
                <p className="stat-label">Customer support</p>
              </div>
            </div>
          </article>

          <aside className="booking-card" aria-label="Ride estimator" id="ride-booking-form">
            <p className="booking-kicker">Quick Fare Estimator</p>
            <h3>Where are you heading?</h3>
            <form className="booking-form" onSubmit={handleBookRide}>
              <label htmlFor="pickup">Pickup</label>
              <input id="pickup" type="text" value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Connaught Place" />

              <button type="button" className="btn btn-ghost" onClick={handleUseLocation}>Use my location</button>

              <label htmlFor="dropoff">Drop</label>
              <input id="dropoff" type="text" value={dropoff} onChange={(event) => setDropoff(event.target.value)} placeholder="Airport Terminal 3" />

              <label htmlFor="rideType">Ride Type</label>
              <select id="rideType" value={rideType} onChange={(event) => setRideType(event.target.value as RideType)}>
                <option value="mini">Mini</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
              </select>

              <div className="button-stack">
                <button type="submit" className="btn btn-primary full-width" disabled={loading}>
                  {loading ? 'Booking...' : 'Book A Ride'}
                </button>
                <button type="button" className="btn btn-ghost full-width" onClick={handleCheckFare}>
                  Check Fare
                </button>
              </div>
            </form>

            {message && <p className="helper-text">{message}</p>}
            {fare !== null && (
              <div className="fare-summary">
                <p className="fare-label">Estimated fare</p>
                <p className="fare-value">₹{fare}</p>
              </div>
            )}
            {ride && (
              <div className="ride-summary">
                <p className="ride-title">Latest booking</p>
                <p>{ride.pickup} → {ride.dropoff}</p>
                <p>Status: {ride.status}</p>
                <p>Ride ID: {ride.rideId}</p>
              </div>
            )}
          </aside>
        </section>

        <section id="services" className="card-grid fade-in-up delay-2">
          <article className="info-card">
            <h3>City Commute</h3>
            <p>Reliable rides for daily office routes with consistent pickup windows.</p>
          </article>
          <article className="info-card">
            <h3>Airport Transfer</h3>
            <p>Flight-aware trips with luggage-friendly vehicles and professional drivers.</p>
          </article>
          <article className="info-card">
            <h3>Hourly Rental</h3>
            <p>Keep a cab on standby for meetings, shopping, or full-day city plans.</p>
          </article>
        </section>

        <section id="fleet" className="fleet-panel fade-in-up delay-3">
          <div>
            <p className="eyebrow">Fleet quality</p>
            <h3>Clean cars. Skilled drivers. Transparent pricing.</h3>
          </div>
          <div className="fleet-badges">
            <span>AC Enabled</span>
            <span>Live GPS</span>
            <span>Panic Button</span>
            <span>Cashless Ready</span>
          </div>
        </section>

        <section id="safety" className="testimonial-shell fade-in-up delay-3">
          <blockquote>
            "I booked a ride at 6:15 AM and the driver arrived in under four minutes.
            The app updates were accurate from pickup to drop."
          </blockquote>
          <p>Priya S., frequent commuter</p>
        </section>
      </main>

      <footer id="contact" className="footer section-shell fade-in-up delay-3">
        <p>Cab Company • Support: +91 90000 00000 • help@cabcompany.com</p>
      </footer>
    </div>
  );
}

export default App;
