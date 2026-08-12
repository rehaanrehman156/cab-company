import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { bookRide, getRideStatus, updateRideStatus } from './Services/rides';
import { formatLocationLabel } from './Utils/location';
import { getRideProgressSteps, getRideStatusLabel } from './Utils/rideProgress';

type RideType = 'mini' | 'sedan' | 'suv';

type PlaceSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

function usePlaceAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data: PlaceSuggestion[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const clear = useCallback(() => setSuggestions([]), []);
  return { suggestions, clear };
}

function App() {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupRaw, setPickupRaw] = useState('');
  const [dropoffRaw, setDropoffRaw] = useState('');
  const [rideType, setRideType] = useState<RideType>('mini');
  const [fare, setFare] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ride, setRide] = useState<{ rideId: string; pickup: string; dropoff: string; fare: number; status: string } | null>(null);
  const [rideProgress, setRideProgress] = useState<string[]>([]);

  const pickupAC = usePlaceAutocomplete(pickupRaw);
  const dropoffAC = usePlaceAutocomplete(dropoffRaw);

  const calculateFare = (selectedType: RideType, selectedPickup: string) => {
    const baseFare: Record<RideType, number> = { mini: 120, sedan: 170, suv: 220 };
    const locationBoost = selectedPickup.includes('Current location') ? 24 : 12;
    return baseFare[selectedType] + locationBoost;
  };

  useEffect(() => {
    if (!ride) {
      const nextFare = calculateFare(rideType, pickup);
      setFare(nextFare);
    }
  }, [rideType, pickup, ride]);

  const handleUseLocation = () => {
    if (!('geolocation' in navigator)) {
      setMessage('Geolocation is not available in this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const nextPickup = formatLocationLabel(latitude, longitude);
        setPickup(nextPickup);
        setPickupRaw(nextPickup);
        pickupAC.clear();
        setMessage('Resolving your current area and place...');

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          const resolvedLabel = formatLocationLabel(latitude, longitude, data);
          setPickup(resolvedLabel);
          setPickupRaw(resolvedLabel);
          setMessage('Pickup location detected successfully.');
        } catch (error) {
          console.warn('Reverse geocoding failed, using coordinates instead.', error);
          setMessage('Pickup location detected successfully.');
        }
      },
      (error) => {
        let description = 'Unable to access your location right now.';
        if (error.code === 1) description = 'Location access was denied. Please allow location access or type your pickup manually.';
        else if (error.code === 2) description = 'Location information is unavailable. Please try again or type your pickup manually.';
        else if (error.code === 3) description = 'Location lookup timed out. Please try again or type your pickup manually.';
        setMessage(description);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleCheckFare = (event: React.FormEvent) => {
    event.preventDefault();
    const nextFare = calculateFare(rideType, pickup);
    setFare(nextFare);
    setMessage(`Estimated fare for ${rideType} ride: ₹${nextFare}`);
  };

  const refreshRideStatus = async (rideId: string) => {
    try {
      const response = await getRideStatus(rideId);
      const currentStatus = response.data?.status || 'requested';
      setRide((currentRide) => currentRide ? { ...currentRide, status: currentStatus } : currentRide);
      setRideProgress(getRideProgressSteps(currentStatus));
    } catch (error) {
      console.warn('Unable to refresh ride status', error);
    }
  };

  const handleBookRide = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!pickup.trim() || !dropoff.trim()) {
      setMessage('Please select a pickup and drop-off from the suggestions.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await bookRide(pickup, dropoff);
      const bookedRide = response.data;
      setRide(bookedRide);
      setFare(bookedRide.fare);
      setRideProgress(['Ride requested']);
      setMessage(`Ride booked successfully. Status: ${bookedRide.status}`);
      await refreshRideStatus(bookedRide.rideId);
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
            <div className="fare-summary">
              <p className="fare-label">Trip route</p>
              <p className="fare-value" style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
                {pickup || 'Pickup location'} → {dropoff || 'Drop-off location'}
              </p>
            </div>
            <form className="booking-form" onSubmit={handleBookRide}>
              <label htmlFor="pickup">Pickup</label>
              <div className="autocomplete-wrap">
                <input
                  id="pickup"
                  type="text"
                  value={pickupRaw}
                  onChange={(e) => { setPickupRaw(e.target.value); setPickup(''); }}
                  placeholder="e.g. Connaught Place, Delhi"
                  autoComplete="off"
                />
                {pickupAC.suggestions.length > 0 && (
                  <ul className="autocomplete-list">
                    {pickupAC.suggestions.map((s) => (
                      <li
                        key={s.place_id}
                        className="autocomplete-item"
                        onMouseDown={() => {
                          const label = s.display_name.split(',').slice(0, 3).join(',').trim();
                          setPickup(label);
                          setPickupRaw(label);
                          pickupAC.clear();
                        }}
                      >
                        {s.display_name.split(',').slice(0, 3).join(',').trim()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button type="button" className="btn btn-ghost" onClick={handleUseLocation}>Use my location</button>

              <label htmlFor="dropoff">Drop</label>
              <div className="autocomplete-wrap">
                <input
                  id="dropoff"
                  type="text"
                  value={dropoffRaw}
                  onChange={(e) => { setDropoffRaw(e.target.value); setDropoff(''); }}
                  placeholder="e.g. Indira Gandhi International Airport"
                  autoComplete="off"
                />
                {dropoffAC.suggestions.length > 0 && (
                  <ul className="autocomplete-list">
                    {dropoffAC.suggestions.map((s) => (
                      <li
                        key={s.place_id}
                        className="autocomplete-item"
                        onMouseDown={() => {
                          const label = s.display_name.split(',').slice(0, 3).join(',').trim();
                          setDropoff(label);
                          setDropoffRaw(label);
                          dropoffAC.clear();
                        }}
                      >
                        {s.display_name.split(',').slice(0, 3).join(',').trim()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

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
                <p>Status: {getRideStatusLabel(ride.status as any)}</p>
                <p>Ride ID: {ride.rideId}</p>
                <div className="button-stack">
                  <button type="button" className="btn btn-ghost full-width" onClick={() => void updateRideStatus(ride.rideId, 'accepted').then(() => refreshRideStatus(ride.rideId))}>
                    Accept ride
                  </button>
                  <button type="button" className="btn btn-ghost full-width" onClick={() => void updateRideStatus(ride.rideId, 'arriving').then(() => refreshRideStatus(ride.rideId))}>
                    Driver arriving
                  </button>
                  <button type="button" className="btn btn-ghost full-width" onClick={() => void updateRideStatus(ride.rideId, 'on_trip').then(() => refreshRideStatus(ride.rideId))}>
                    Start trip
                  </button>
                </div>
                <ul>
                  {rideProgress.map((step) => <li key={step}>{step}</li>)}
                </ul>
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
