import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

type RideStatus = 'requested' | 'accepted' | 'arriving' | 'on_trip' | 'completed' | 'cancelled';
type Ride = { rideId: string; pickup: string; dropoff: string; fare: number; status: RideStatus; createdAt: string; };

const STATUS_NEXT: Partial<Record<RideStatus, RideStatus>> = { accepted: 'arriving', arriving: 'on_trip', on_trip: 'completed' };
const STATUS_LABEL: Record<RideStatus, string> = { requested: 'Waiting for driver', accepted: 'Driver assigned', arriving: 'Driver arriving', on_trip: 'Trip in progress', completed: 'Trip completed', cancelled: 'Cancelled' };
const ACTION_LABEL: Partial<Record<RideStatus, string>> = { accepted: 'I am arriving', arriving: 'Start trip', on_trip: 'Complete trip' };

async function callApi(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function DriverApp() {
  const [pending, setPending] = useState<Ride[]>([]);
  const [active, setActive]   = useState<Ride | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPending = async () => {
    try { setPending(await callApi('/rides/pending')); } catch { /* silent */ }
  };

  useEffect(() => {
    fetchPending();
    const t = setInterval(fetchPending, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!active) return;
    pollRef.current = setInterval(async () => {
      try {
        const rides: Ride[] = await callApi('/rides/active');
        const updated = rides.find((r) => r.rideId === active.rideId);
        if (updated) {
          setActive(updated);
          if (updated.status === 'completed' || updated.status === 'cancelled') { setActive(null); fetchPending(); }
        }
      } catch { /* silent */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
        <button className="refresh-btn" onClick={fetchPending}>↻ Refresh</button>
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
