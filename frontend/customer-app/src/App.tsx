// NEW UI — complete rewrite
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { bookRide, getRideStatus, updateRideStatus } from './Services/rides';
import { formatLocationLabel } from './Utils/location';
import { getRideStatusLabel } from './Utils/rideProgress';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

/* ─── types ─────────────────────────────────────────────────────────────── */
type RideType = 'mini' | 'sedan' | 'suv';
type Screen   = 'auth' | 'home' | 'booking' | 'tracking' | 'privacy';
type AuthMode = 'login' | 'register';
type AuthStep = 'form' | 'otp';

type User = { id: string; name: string; phone: string; role: string };

type PlaceSuggestion = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
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
  onChange: (v: string) => void;
  onSelect: (l: string, lat: string, lon: string) => void;
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
                  onMouseDown={() => { onSelect(label, s.lat, s.lon); onClear(); }}>
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
  const [authStep, setAuthStep]     = useState<AuthStep>('form');
  const [authName, setAuthName]     = useState('');
  const [authPhone, setAuthPhone]   = useState('');
  const [authPass, setAuthPass]     = useState('');
  const [authOtp, setAuthOtp]       = useState('');
  const [authError, setAuthError]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [pickup, setPickup]         = useState('');
  const [pickupRaw, setPickupRaw]   = useState('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: string; lon: string } | null>(null);
  const [dropoff, setDropoff]       = useState('');
  const [dropoffRaw, setDropoffRaw] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: string; lon: string } | null>(null);
  const [rideType, setRideType]     = useState<RideType>('mini');
  const [loading, setLoading]       = useState(false);
  const [locating, setLocating]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fare, setFare]             = useState<number | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [ride, setRide] = useState<{
    rideId: string; pickup: string; dropoff: string; fare: number; status: string;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pickupAC  = usePlaceAutocomplete(pickupRaw);
  const dropoffAC = usePlaceAutocomplete(dropoffRaw);

  // Fetch real fare from backend when both coords are available
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return;
    setFareLoading(true);
    fetch(`${API_BASE}/rides/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupLat: pickupCoords.lat, pickupLon: pickupCoords.lon,
        dropoffLat: dropoffCoords.lat, dropoffLon: dropoffCoords.lon,
        vehicleType: rideType,
      }),
    })
      .then((r) => r.json())
      .then((data) => { if (data.fare) setFare(data.fare); })
      .catch(() => {})
      .finally(() => setFareLoading(false));
  }, [pickupCoords, dropoffCoords, rideType]);

  const handleUseLocation = () => {
    if (!('geolocation' in navigator)) { setError('Geolocation not available.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        const fallback = formatLocationLabel(lat, lon);
        setPickup(fallback); setPickupRaw(fallback);
        setPickupCoords({ lat: String(lat), lon: String(lon) });
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
      const res = await bookRide(pickup, dropoff, pickupCoords?.lat, pickupCoords?.lon, dropoffCoords?.lat, dropoffCoords?.lon, rideType);
      const booked = res.data;
      setRide(booked);
      setFare(booked.fare);
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
    setRide(null); setPickup(''); setPickupRaw(''); setPickupCoords(null);
    setDropoff(''); setDropoffRaw(''); setDropoffCoords(null);
    setFare(null); setError(null);
    setScreen('home');
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    setScreen('auth');
  };

  const handleAuth = async () => {
    if (authStep === 'otp') {
      // Verify OTP and complete registration
      if (!authOtp) { setAuthError('Enter the OTP sent to your phone.'); return; }
      setAuthLoading(true); setAuthError(null);
      try {
        const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: authName, phone: authPhone, password: authPass, otp: authOtp }) });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Registration failed.'); return; }
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setScreen('home');
      } catch { setAuthError('Could not connect to server.'); }
      finally { setAuthLoading(false); }
      return;
    }

    if (!authPhone || !authPass) { setAuthError('Phone and password are required.'); return; }
    if (authMode === 'register' && !authName) { setAuthError('Name is required.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      if (authMode === 'register') {
        // Send OTP first
        const res = await fetch(`${API_BASE}/auth/send-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone }) });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Failed to send OTP.'); return; }
        setAuthStep('otp');
      } else {
        const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: authPhone, password: authPass }) });
        const data = await res.json();
        if (!res.ok) { setAuthError(data.error || 'Login failed.'); return; }
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
        setScreen('home');
      }
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
              onChange={(v) => { setPickupRaw(v); setPickup(''); setPickupCoords(null); }}
              onSelect={(l, lat, lon) => { setPickup(l); setPickupRaw(l); setPickupCoords({ lat, lon }); pickupAC.clear(); }}
              suggestions={pickupAC.suggestions} onClear={pickupAC.clear}
            />
            <div className="loc-sep" />
            <LocationInput
              id="dropoff" raw={dropoffRaw} value={dropoff} icon="red"
              placeholder="Drop-off location"
              onChange={(v) => { setDropoffRaw(v); setDropoff(''); setDropoffCoords(null); }}
              onSelect={(l, lat, lon) => { setDropoff(l); setDropoffRaw(l); setDropoffCoords({ lat, lon }); dropoffAC.clear(); }}
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
              </button>
            ))}
          </div>

          {error && <p className="error-bar">{error}</p>}

          <div className="confirm-bar">
            <div className="confirm-fare">
              <span className="cf-label">Estimated fare</span>
              <span className="cf-value">{fareLoading ? '...' : fare ? `₹${fare}` : '--'}</span>
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
          <h2 className="auth-heading">{authStep === 'otp' ? 'Verify your number' : authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>

          {authStep !== 'otp' && (
            <div className="auth-tabs">
              <button className={`auth-tab${authMode === 'login' ? ' active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError(null); }}>Login</button>
              <button className={`auth-tab${authMode === 'register' ? ' active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError(null); }}>Sign up</button>
            </div>
          )}

          <div className="auth-form">
            {authStep === 'otp' ? (
              <>
                <p style={{ fontSize: '0.88rem', color: '#8a8a9a', textAlign: 'center' }}>OTP sent to +91 {authPhone}</p>
                <input className="auth-input" type="number" placeholder="Enter 6-digit OTP" value={authOtp}
                  onChange={(e) => setAuthOtp(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void handleAuth(); } }} />
                <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>{authLoading ? 'Verifying…' : 'Verify OTP'}</button>
                <button style={{ background: 'none', color: '#8a8a9a', fontSize: '0.85rem' }} onClick={() => { setAuthStep('form'); setAuthOtp(''); setAuthError(null); }}>Change number</button>
              </>
            ) : (
              <>
                {authMode === 'register' && (
                  <input className="auth-input" type="text" placeholder="Your full name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                )}
                <input className="auth-input" type="tel" placeholder="Phone number (10 digits)" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} />
                <input className="auth-input" type="password" placeholder="Password" value={authPass} onChange={(e) => setAuthPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { void handleAuth(); } }} />
                <button className="btn-primary" onClick={handleAuth} disabled={authLoading}>
                  {authLoading ? 'Please wait…' : authMode === 'login' ? 'Login' : 'Send OTP'}
                </button>
              </>
            )}
            {authError && <p className="auth-error">{authError}</p>}
            <button style={{ background: 'none', color: '#8a8a9a', fontSize: '0.8rem', marginTop: '0.5rem' }} onClick={() => setScreen('privacy')}>Privacy Policy</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── privacy policy screen ──────────────────────────────────────────────── */
  if (screen === 'privacy') {
    return (
      <div className="app">
        <header className="app-bar">
          <button className="back-btn" onClick={() => setScreen(user ? 'home' : 'auth')}>←</button>
          <span className="app-bar-title">Privacy Policy</span>
          <span />
        </header>
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, lineHeight: 1.7, color: '#c0c0cc', fontSize: '0.9rem' }}>
          <h2 style={{ color: '#f0f0f4', marginBottom: '1rem' }}>Privacy Policy</h2>
          <p><strong style={{ color: '#f0f0f4' }}>Last updated: August 2026</strong></p><br />
          <p>CabCo ("we", "us", "our") operates the CabCo cab booking service. This policy explains how we collect, use and protect your information.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>Information We Collect</h3>
          <p>We collect your name, phone number, and trip details (pickup and drop-off locations) when you register and book rides.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>How We Use Your Information</h3>
          <p>We use your information to provide cab booking services, match you with drivers, and improve our service.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>Location Data</h3>
          <p>We access your device location only when you use "Use my location" to set your pickup point. We do not track your location in the background.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>Data Sharing</h3>
          <p>We share your name and phone with your assigned driver to enable the trip. We do not sell your data to third parties.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>Data Retention</h3>
          <p>We retain your account and trip history for 2 years. You may request deletion by contacting support.</p><br />
          <h3 style={{ color: '#f0f0f4' }}>Contact</h3>
          <p>For questions, contact us at support@cabco.in</p>
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

