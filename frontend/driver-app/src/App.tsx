import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

type RideStatus = 'requested' | 'accepted' | 'arriving' | 'on_trip' | 'completed' | 'cancelled';
type Ride = { rideId: string; pickup: string; dropoff: string; fare: number; status: RideStatus; createdAt: string; };
type User = { id: string; name: string; phone: string; role: string };
type AuthMode = 'login' | 'register';

const STATUS_NEXT: Partial<Record<RideStatus, RideStatus>> = { accepted: 'arriving', arriving: 'on_trip', on_trip: 'completed' };
const STATUS_LABEL: Record<RideStatus, string> = { requested: 'Waiting for driver', accepted: 'Driver assigned', arriving: 'Driver arriving', on_trip: 'Trip in progress', completed: 'Trip completed', cancelled: 'Cancelled' };
const ACTION_LABEL: Partial<Record<RideStatus, string>> = { accepted: 'I am arriving', arriving: 'Start trip', on_trip: 'Complete trip' };

async function callApi(path: string, method = 'GET', body?: object) {
  const token = localStorage.getItem('driverToken') || '';
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function DriverApp() {
  const [user, setUser]             = useState<User | null>(() => { try { return JSON.parse(localStorage.getItem('driverUser') || 'null'); } catch { return null; } });
  const [authMode, setAuthMode]     = useState<AuthMode>('login');
  const [authName, setAuthName]     = useState('');
  const [authPhone, setAuthPhone]   = useState('');
  const [authPass, setAuthPass]     = useState('');
  const [authVehicle, setAuthVehicle] = useState('');
  const [authError, setAuthError]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [pending, setPending] = useState<Ride[]>([]);
  const [active, setActive]   = useState<Ride | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPending = async () => {
    try { setPending(await callApi('/rides/pending')); } catch { /* silent */ }
  };

  useEffect(() => {
    if (!user) return;
    fetchPending();
    const t = setInterval(fetchPending, 8000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!active) return;
    const rideId = active.rideId;
    pollRef.current = setInterval(async () => {
      try {
        const rides: Ride[] = await callApi('/rides/active');
        const updated = rides.find((r) => r.rideId === rideId);
        if (updated) {
          setActive(updated);
          if (updated.status === 'completed' || updated.status === 'cancelled') { setActive(null); fetchPending(); }
        }
      } catch { /* silent */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.rideId]);

  const acceptRide = async (ride: Ride) => {
    setLoading(ride.rideId); setError(null);
    try { const r: Ride = await callApi(`/rides/status/${ride.rideId}`, 'PATCH', { status: 'accepted' }); setActive(r); setPending((p) => p.filter((x) => x.rideId !== ride.rideId)); }
    catch { setError('Failed to accept ride.'); } finally { setLoading(null); }
  };

  const advanceStatus = async () => {
    if (!active) return;
    const next = STATUS_NEXT[active.status]; if (!next) return;
    setLoading(active.rideId); setError(null);
    try { const r: Ride = await callApi(`/rides/status/${active.rideId}`, 'PATCH', { status: next }); setActive(r); if (next === 'completed') { setTimeout(() => { setActive(null); fetchPending(); }, 2000); } }
    catch { setError('Failed to update.'); } finally { setLoading(null); }
  };

  const cancelRide = async () => {
    if (!active) return;
    setLoading(active.rideId);
    try { await callApi(`/rides/status/${active.rideId}`, 'PATCH', { status: 'cancelled' }); setActive(null); fetchPending(); }
    catch { setError('Failed to cancel.'); } finally { setLoading(null); }
  };

  const handleLogout = () => {
    localStorage.removeItem('driverToken');
    localStorage.removeItem('driverUser');
    setUser(null);
  };

  const handleAuth = async () => {
    if (!authPhone || !authPass) { setAuthError('Phone and password are required.'); return; }
    if (authMode === 'register' && (!authName || !authVehicle)) { setAuthError('Name and vehicle number are required.'); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/driver/register';
      const body = authMode === 'login'
        ? { phone: authPhone, password: authPass }
        : { name: authName, phone: authPhone, password: authPass, vehicleNumber: authVehicle, vehicleType: 'mini' };
      const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || 'Something went wrong.'); return; }
      if (data.user.role !== 'driver') { setAuthError('This account is not a driver account.'); return; }
      localStorage.setItem('driverToken', data.token);
      localStorage.setItem('driverUser', JSON.stringify(data.user));
      setUser(data.user);
    } catch { setAuthError('Could not connect to server.'); }
    finally { setAuthLoading(false); }
  };

  /* auth screen */
  if (!user) {
    return (
      <div className="driver-app">
        <div className="auth-page">
          <div className="auth-logo">🚕 <span>Driver Portal</span></div>
          <h2 className="auth-heading">{authMode === 'login' ? 'Driver login' : 'Register as driver'}</h2>
          <div className="auth-tabs">
            <button className={`auth-tab${authMode === 'login' ? ' active' : ''}`} onClick={() => { setAuthMode('login'); setAuthError(null); }}>Login</button>
            <button className={`auth-tab${authMode === 'register' ? ' active' : ''}`} onClick={() => { setAuthMode('register'); setAuthError(null); }}>Register</button>
          </div>
          <div className="auth-form">
            {authMode === 'register' && (
              <>
                <input className="auth-input" type="text" placeholder="Your name" value={authName} onChange={(e) => setAuthName(e.target.value)} />
                <input className="auth-input" type="text" placeholder="Vehicle number (e.g. MH01AB1234)" value={authVehicle} onChange={(e) => setAuthVehicle(e.target.value)} />
              </>
            )}
            <input className="auth-input" type="tel" placeholder="Phone number" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} />
            <input className="auth-input" type="password" placeholder="Password" value={authPass} onChange={(e) => setAuthPass(e.target.value)} />
            {authError && <p className="auth-error">{authError}</p>}
            <button className="driver-btn primary" onClick={handleAuth} disabled={authLoading}>
              {authLoading ? 'Please wait…' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (active) {
    const nextAction = ACTION_LABEL[active.status];
    const isFinal = active.status === 'completed' || active.status === 'cancelled';
    return (
      <div className="driver-app">
        <header className="driver-bar">
          <span className="driver-logo">🚕 Driver</span>
          <span className={`status-chip ${active.status}`}>{STATUS_LABEL[active.status]}</span>
        </header>
        <div className="active-ride-page">
          <div className="active-card">
            <p className="ac-label">Active ride</p>
            <div className="ac-route">
              <div className="ac-point">🟢 <span>{active.pickup}</span></div>
              <div className="ac-line" />
              <div className="ac-point">🔴 <span>{active.dropoff}</span></div>
            </div>
            <div className="ac-meta">
              <span>Fare: <strong>₹{active.fare}</strong></span>
              <span>ID: {active.rideId.slice(0, 8)}</span>
            </div>
          </div>
          {error && <p className="driver-error">{error}</p>}
          {!isFinal && nextAction && <button className="driver-btn primary" onClick={advanceStatus} disabled={!!loading}>{loading ? 'Updating…' : nextAction}</button>}
          {active.status === 'completed' && <div className="completed-badge">✅ Trip completed!</div>}
          {!isFinal && <button className="driver-btn cancel" onClick={cancelRide} disabled={!!loading}>Cancel ride</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="driver-app">
      <header className="driver-bar">
        <span className="driver-logo">🚕 Driver Dashboard</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {user && <span style={{ fontSize: '0.8rem', color: '#8a8a9a' }}>{user.name}</span>}
          <button className="refresh-btn" onClick={fetchPending}>↻</button>
          <button className="refresh-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <div className="pending-page">
        <p className="pending-title">{pending.length === 0 ? 'No ride requests right now' : `${pending.length} ride request${pending.length > 1 ? 's' : ''} waiting`}</p>
        {error && <p className="driver-error">{error}</p>}
        <div className="ride-list">
          {pending.map((ride) => (
            <div key={ride.rideId} className="ride-request-card">
              <div className="rrc-route">
                <div className="rrc-point">🟢 {ride.pickup}</div>
                <div className="rrc-arrow">↓</div>
                <div className="rrc-point">🔴 {ride.dropoff}</div>
              </div>
              <div className="rrc-footer">
                <span className="rrc-fare">₹{ride.fare}</span>
                <button className="driver-btn primary small" onClick={() => acceptRide(ride)} disabled={loading === ride.rideId}>{loading === ride.rideId ? 'Accepting…' : 'Accept ride'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
