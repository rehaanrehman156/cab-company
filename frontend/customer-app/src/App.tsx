// NEW UI — complete rewrite
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { bookRide, getRideStatus, updateRideStatus } from './Services/rides';
import { formatLocationLabel } from './Utils/location';
import { getRideStatusLabel } from './Utils/rideProgress';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/* ─── types ─────────────────────────────────────────────────────────────── */
type RideType = 'mini' | 'sedan' | 'suv';
type Screen   = 'auth' | 'home' | 'booking' | 'tracking';
type AuthMode = 'login' | 'register';

type User = { id: string; name: string; phone: string; role: string };

type PlaceSuggestion = {
  place_id: number;
  display_name: string;
};

const RIDE_OPTIONS: { type: RideType; label: string; icon: string; seats: string; eta: string; base: number }[] = [
  { type: 'mini',  label: 'Mini',  icon: '🚗', seats: '4', eta: '3 min', base: 120 },
  { type: 'sedan', label: 'Sedan', icon: '🚙', seats: '4', eta: '5 min', base: 170 },
  { type: 'suv',   label: 'SUV',   icon: '🚐', seats: '6', eta: '7 min', base: 220 },
];

const STEPS = ['requested', 'accepted', 'arriving', 'on_trip', 'completed'] as const;
const STEP_LABELS: Record<string, string> = {
  requested: 'Ride requested',
  accepted:  'Driver assigned',
  arriving:  'Driver arriving',
  on_trip:   'Trip in progress',
  completed: 'Trip completed',
};

/* ─── autocomplete hook ──────────────────────────────────────────────────── */
function usePlaceAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (query.trim().length < 3) { setSuggestions([]); return; }
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data: PlaceSuggestion[] = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); }
    }, 400);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [query]);
  const clear = useCallback(() => setSuggestions([]), []);
  return { suggestions, clear };
}

/* ─── location input component ──────────────────────────────────────────── */
function LocationInput({ id, raw, value, icon, placeholder, onChange, onSelect, suggestions, onClear }: {
  id: string; raw: string; value: string; icon: string; placeholder: string;
  onChange: (v: string) => void; onSelect: (l: string) => void;
  suggestions: PlaceSuggestion[]; onClear: () => void;
}) {
  return (
    <div className="loc-row">
      <span className={`loc-dot ${icon}`} />
      <div className="loc-field">
        <input
          id={id} type="text" value={raw} autoComplete="off"
          placeholder={placeholder} className="loc-input"
          onChange={(e) => onChange(e.target.value)}
        />
        {value && <span className="loc-confirmed">✓</span>}
        {suggestions.length > 0 && (
          <ul className="sug-list">
            {suggestions.map((s) => {
              const label = s.display_name.split(',').slice(0, 3).join(', ');
              return (
                <li key={s.place_id} className="sug-item"
                  onMouseDown={() => { onSelect(label); onClear(); }}>
                  📍 {label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── main app ───────────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen]         = useState<Screen>(() => localStorage.getItem('authToken') ? 'home' : 'auth');
  const [user, setUser]             = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } });
  const [authMode, setAuthMode]     = useState<AuthMode>('login');
  const [authName, setAuthName]     = useState('');
  const [authPhone, setAuthPhone]   = useState('');
  const [authPass, setAuthPass]     = useState('');
  const [authError, setAuthError]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [pickup, setPickup]         = useState('');
  const [pickupRaw, setPickupRaw]   = useState('');
  const [dropoff, setDropoff]       = useState('');
  const [dropoffRaw, setDropoffRaw] = useState('');
  const [rideType, setRideType]     = useState<RideType>('mini');
  const [loading, setLoading]       = useState(false);
  const [locating, setLocating]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [ride, setRide] = useState<{
    rideId: string; pickup: string; dropoff: string; fare: number; status: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickupAC  = usePlaceAutocomplete(pickupRaw);
  const dropoffAC = usePlaceAutocomplete(dropoffRaw);

  const selected = RIDE_OPTIONS.find((o) => o.type === rideType)!;
  const fare = selected.base + 12;

  const handleUseLocation = () => {
    if (!('geolocation' in navigator)) { setError('Geolocation not available.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const fallback = formatLocationLabel(lat, lon);
        setPickup(fallback); setPickupRaw(fallback);
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          const label = formatLocationLabel(lat, lon, data);
          setPickup(label); setPickupRaw(label);
        } catch { /* use fallback */ }
        setLocating(false);
      },
      () => { setError('Could not get location. Type it manually.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const refreshStatus = async (rideId: string) => {
    try {
      const res    = await getRideStatus(rideId);
      const status = res.data?.status || 'requested';
      setRide((r) => r ? { ...r, status } : r);
      if (status === 'completed' || status === 'cancelled') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch { /* silent */ }
  };

  const startPolling = (rideId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { void refreshStatus(rideId); }, 5000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleBook = async () => {
    if (!pickup || !dropoff) { setError('Please select both pickup and drop-off.'); return; }
    setLoading(true); setError(null);
    try {
      const res    = await bookRide(pickup, dropoff);
      const booked = res.data;
      setRide(booked);
      setScreen('tracking');
      startPolling(booked.rideId);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Booking failed. Is the backend running?');
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!ride) return;
    await updateRideStatus(ride.rideId, 'cancelled');
    setRide((r) => r ? { ...r, status: 'cancelled' } : r);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const resetAll = () => {
    setRide(null); setPickup(''); setPickupRaw('');
    setDropoff(''); setDropoffRaw(''); setError(null);
    setScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setScreen('auth');
  };

  const handleAuth = async () => {
    if (!authPhone || !authPass) { setAuthError('Phone and password are required.'); return; }
    if (authMode === 'register' && !authName) { setAuthError('Name is required.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body = authMode === 'login'
        ? { phone: authPhone, password: authPass }
        : { name: authName, phone: authPhone, password: authPass };
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Something went wrong.'); return; }
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setScreen('home');
    } catch { setAuthError('Could not connect to server.'); }
    finally { setAuthLoading(false); }
  };

  /* ── tracking screen ──────────────────────────────────────────────────── */
  if (screen === 'tracking' && ride) {
    const currentIdx = STEPS.indexOf(ride.status as any);
    const isFinal    = ride.status === 'completed' || ride.status === 'cancelled';
    return (
      <div className="app">
        <header className="app-bar">
          <button className="back-btn" onClick={resetAll}>←</button>
          <span className="app-bar-title">Your ride</span>
          <span />
        </header>
        <div className="tracking-page">
          <div className="map-mock">
            <span className="map-car-icon">🚗</span>
            <p className="map-status-label">
              {isFinal
                ? ride.status === 'completed' ? '✅ Trip complete' : '❌ Cancelled'
                : getRideStatusLabel(ride.status as any)}
            </p>
          </div>
          <div className="bottom-sheet">
            <div className="bs-handle" />
            <div className="bs-top">
              <div>
                <p className="bs-status">{getRideStatusLabel(ride.status as any)}</p>
                <p className="bs-route">{ride.pickup} → {ride.dropoff}</p>
              </div>
              <span className="bs-fare">₹{ride.fare}</span>
            </div>
            <ol className="timeline">
              {STEPS.map((step, i) => {
                const done   = i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <li key={step} className={`tl-step${done ? ' done' : ''}${active ? ' active' : ''}`}>
                    <span className="tl-dot" />
                    <span className="tl-text">{STEP_LABELS[step]}</span>
                    {active && <span className="tl-now">Now</span>}
                  </li>
                );
              })}
            </ol>
            {!isFinal && (
              <button className="btn-cancel" onClick={handleCancel}>Cancel ride</button>
            )}
            {isFinal && (
              <button className="btn-primary" onClick={resetAll}>Book another ride</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── booking screen ───────────────────────────────────────────────────── */
  if (screen === 'booking') {
    return (
      <div className="app">
        <header className="app-bar">
          <button className="back-btn" onClick={() => setScreen('home')}>←</button>
          <span className="app-bar-title">Book a ride</span>
          <span />
        </header>
        <div className="booking-page">
          <div className="loc-card">
            <LocationInput
              id="pickup" raw={pickupRaw} value={pickup} icon="green"
              placeholder="Pickup location"
              onChange={(v) => { setPickupRaw(v); setPickup(''); }}
              onSelect={(l) => { setPickup(l); setPickupRaw(l); pickupAC.clear(); }}
              suggestions={pickupAC.suggestions} onClear={pickupAC.clear}
            />
            <div className="loc-sep" />
            <LocationInput
              id="dropoff" raw={dropoffRaw} value={dropoff} icon="red"
              placeholder="Drop-off location"
              onChange={(v) => { setDropoffRaw(v); setDropoff(''); }}
              onSelect={(l) => { setDropoff(l); setDropoffRaw(l); dropoffAC.clear(); }}
              suggestions={dropoffAC.suggestions} onClear={dropoffAC.clear}
            />
          </div>

          <button className="use-loc-btn" onClick={handleUseLocation} disabled={locating}>
            {locating ? '📡 Detecting location…' : '📍 Use my current location'}
          </button>

          <p className="section-title">Choose ride type</p>
          <div className="ride-types">
            {RIDE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                className={`ride-card${rideType === opt.type ? ' selected' : ''}`}
                onClick={() => setRideType(opt.type)}
              >
                <span className="rc-icon">{opt.icon}</span>
                <span className="rc-name">{opt.label}</span>
                <span className="rc-seats">{opt.seats} seats</span>
                <span className="rc-eta">{opt.eta}</span>
                <span className="rc-fare">₹{opt.base + 12}</span>
              </button>
            ))}
          </div>

          {error && <p className="error-bar">{error}</p>}

          <div className="confirm-bar">
            <div className="confirm-fare">
              <span className="cf-label">Estimated</span>
              <span className="cf-value">₹{fare}</span>
            </div>
            <button
              className="btn-primary"
              onClick={handleBook}
              disabled={loading || !pickup || !dropoff}
            >
              {loading ? 'Booking…' : 'Confirm ride'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── auth screen ───────────────────────────────────────────────────────── */
  if (screen === 'auth') {
    return (
      <div className="app">
        <div className="auth-page">
          <div className="auth-logo">🚕 <span>CabCo</span></div>
          <h2 className="auth-heading">{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>

          <div className="auth-tabs">
            <button className={`auth-tab${authMode === 'login' ? ' active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError(null); }}>Login</button>
            <button className={`auth-tab${authMode === 'register' ? ' active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError(null); }}>Sign up</button>
          </div>

          <div className="auth-form">
            {authMode === 'register' && (
              <input className="auth-input" type="text" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
            )}
            <input className="auth-input" type="tel" placeholder="Phone number (e.g. 9876543210)" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} />
            <input className="auth-input" type="password" placeholder="Password" value={authPass} onChange={(e) => setAuthPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { void handleAuth(); } }} />
            {authError && <p className="auth-error">{authError}</p>}
            <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
              {authLoading ? 'Please wait…' : authMode === 'login' ? 'Login' : 'Create account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── home screen ──────────────────────────────────────────────────────── */
  return (
    <div className="app home">
      <header className="home-bar">
        <div className="home-logo">
          <span className="logo-icon">🚕</span>
          <span className="logo-text">CabCo</span>
        </div>
        <div className="home-nav">
          {user && <span className="home-user">Hi, {user.name.split(' ')[0]}</span>}
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="hero">
        <p className="hero-tag">Fast · Safe · Affordable</p>
        <h1 className="hero-heading">Your ride,<br />on demand.</h1>
        <p className="hero-sub">Book a cab in seconds. Track it live. Arrive on time.</p>

        <button className="where-to-btn" onClick={() => setScreen('booking')}>
          <span className="wt-pin">📍</span>
          <span className="wt-text">Where do you want to go?</span>
          <span className="wt-arrow">›</span>
        </button>

        <div className="hero-stats">
          <div className="stat"><span className="sv">4.9★</span><span className="sk">Rating</span></div>
          <div className="stat-sep" />
          <div className="stat"><span className="sv">3 min</span><span className="sk">Avg pickup</span></div>
          <div className="stat-sep" />
          <div className="stat"><span className="sv">24/7</span><span className="sk">Support</span></div>
        </div>
      </section>

      <section id="services" className="services-section">
        <p className="section-title">What are you looking for?</p>
        <div className="services-grid">
          {[
            { icon: '🚗', name: 'City Ride',     desc: 'Affordable daily rides' },
            { icon: '✈️', name: 'Airport',        desc: 'Flight-aware transfers' },
            { icon: '🕐', name: 'Hourly Rental', desc: 'Keep a cab on standby' },
            { icon: '🌙', name: 'Night Rides',   desc: 'Safe late-night travel' },
          ].map((s) => (
            <button key={s.name} className="svc-card" onClick={() => setScreen('booking')}>
              <span className="svc-icon">{s.icon}</span>
              <span className="svc-name">{s.name}</span>
              <span className="svc-desc">{s.desc}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

