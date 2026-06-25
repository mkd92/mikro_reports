import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { Search, MapPin, Link2, AlertCircle, Loader2, ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

// A customer is "frequent" if they ordered in ≥2 distinct weeks in the last 30 days
const isFrequent = (c: any) => (c.weeks_active_30d ?? 0) >= 2;

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].lat, points[0].lng], 14); return; }
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [50, 50] }
    );
  }, [points]);
  return null;
}

// Inject pulse keyframe once
const PULSE_STYLE = `
@keyframes mapPulse {
  0%   { transform: scale(1);   opacity: 0.8; }
  50%  { transform: scale(1.6); opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
.frequent-pulse::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  animation: mapPulse 1.8s ease-out infinite;
}
`;

export default function MapPage() {
  const [data, setData]         = useState<any>({ latlng: [], gmap: [], missing: [] });
  const [loading, setLoading]   = useState(true);
  const [gmapSearch, setGmapSearch]       = useState('');
  const [missingSearch, setMissingSearch] = useState('');
  const [gmapRp, setGmapRp]               = useState('');
  const [missingRp, setMissingRp]         = useState('');
  const [activeTab, setActiveTab]         = useState<'missing' | 'gmap' | 'frequent'>('missing');
  const [hoveredId, setHoveredId]         = useState<number | null>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [freqSearch, setFreqSearch]       = useState('');
  const [freqRp, setFreqRp]               = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API_BASE}/map/customers`);
        setData(r.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ESC to close fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMapFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allCustomers = [...data.latlng, ...data.gmap, ...data.missing];
  const frequentAll  = allCustomers.filter(isFrequent);

  const salesmenMissing  = [...new Set(data.missing.map((c: any) => c.salesman).filter(Boolean))].sort() as string[];
  const salesmenGmap     = [...new Set(data.gmap.map((c: any) => c.salesman).filter(Boolean))].sort() as string[];
  const salesmenFrequent = [...new Set(frequentAll.map((c: any) => c.salesman).filter(Boolean))].sort() as string[];

  const filteredGmap    = data.gmap.filter((c: any) =>
    c.name.toLowerCase().includes(gmapSearch.toLowerCase()) && (!gmapRp || c.salesman === gmapRp)
  );
  const filteredMissing = data.missing.filter((c: any) =>
    c.name.toLowerCase().includes(missingSearch.toLowerCase()) && (!missingRp || c.salesman === missingRp)
  );
  const filteredFrequent = frequentAll.filter((c: any) =>
    c.name.toLowerCase().includes(freqSearch.toLowerCase()) && (!freqRp || c.salesman === freqRp)
  );

  const MARKER_COLOR = (c: any) => {
    if (isFrequent(c)) return '#f97316'; // orange for frequent
    return c.party_group_id === 2 ? '#3b82f6' : '#10b981';
  };
  const GROUP_LABEL = (groupId: number) => groupId === 2 ? 'Corporate' : 'Mikro';

  const frequentOnMap = data.latlng.filter(isFrequent);

  const renderMap = (fullscreen = false) => (
    <div style={{
      borderRadius: fullscreen ? 0 : 16,
      overflow: 'hidden',
      border: fullscreen ? 'none' : '1px solid #e2e8f0',
      boxShadow: fullscreen ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
      height: fullscreen ? '100%' : 440,
      position: 'relative',
    }}>
      {data.latlng.length === 0 ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', gap: '0.5rem', color: '#94a3b8' }}>
          <MapPin size={36} strokeWidth={1.2} />
          <div style={{ fontWeight: 600, color: '#64748b' }}>No customers with lat/lng yet</div>
          <div style={{ fontSize: '0.78rem' }}>Ask your sales team to update the {data.gmap.length} customers with GMap links</div>
        </div>
      ) : (
        <MapContainer
          center={[13.0827, 80.2707]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={data.latlng} />

          {data.latlng.map((c: any) => {
            const freq    = isFrequent(c);
            const hovered = hoveredId === c.id;
            const baseR   = freq ? 8 : 7;
            return (
              <React.Fragment key={c.id}>
                {/* Pulse ring for frequent buyers */}
                {freq && (
                  <CircleMarker
                    center={[c.lat, c.lng]}
                    radius={hovered ? 15 : 12}
                    pathOptions={{
                      fillColor: '#f97316',
                      color: '#f97316',
                      weight: 0,
                      fillOpacity: hovered ? 0.15 : 0.1,
                      opacity: 0,
                    }}
                    interactive={false}
                  />
                )}
                <CircleMarker
                  center={[c.lat, c.lng]}
                  radius={hovered ? baseR + 4 : baseR}
                  pathOptions={{
                    fillColor: MARKER_COLOR(c),
                    color: freq ? '#fff7ed' : 'white',
                    weight: freq ? 2.5 : 2,
                    fillOpacity: 0.92,
                    opacity: 1,
                  }}
                  eventHandlers={{
                    mouseover: () => setHoveredId(c.id),
                    mouseout:  () => setHoveredId(null),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 190, fontFamily: 'inherit' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', flex: 1 }}>{c.name}</div>
                        {freq && (
                          <span style={{ background: '#fff7ed', color: '#ea580c', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 3 }}>
                            🔥 Frequent
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ background: MARKER_COLOR(c) + '22', color: MARKER_COLOR(c), fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999 }}>
                          {GROUP_LABEL(c.party_group_id)}
                        </span>
                        {c.salesman && <span style={{ fontSize: 10, color: '#64748b' }}>{c.salesman}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
                        <div>📦 {c.order_count} orders total</div>
                        {freq && <div>🔥 {c.orders_last_30d} orders · {c.weeks_active_30d} weeks (last 30d)</div>}
                        <div>🗓 Last order: {fmt(c.last_order)}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</div>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      )}

      {/* Legend overlay */}
      {data.latlng.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          background: 'rgba(255,255,255,0.95)', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '0.5rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}>
          {[
            ['#10b981', 'Mikro'],
            ['#3b82f6', 'Corporate'],
            ['#f97316', '🔥 Frequent buyer'],
          ].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 11, fontWeight: 600, color: '#475569' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color as string, flexShrink: 0 }} />
              {label}
            </div>
          ))}
          {frequentOnMap.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 2, paddingTop: 4, fontSize: 10, color: '#94a3b8' }}>
              {frequentOnMap.length} frequent buyer{frequentOnMap.length !== 1 ? 's' : ''} on map
            </div>
          )}
        </div>
      )}

      {/* Maximize / minimize button */}
      <button
        onClick={() => setMapFullscreen(f => !f)}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Expand map'}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 1001,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 8,
          width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', color: '#475569',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.color = '#1e293b'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.color = '#475569'; }}
      >
        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: '0.75rem', color: '#64748b' }}>
      <Loader2 size={22} className="spin" color="#3b82f6" />
      <span>Loading customer locations…</span>
    </div>
  );

  return (
    <>
      <style>{PULSE_STYLE}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── Stats bar ── */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { icon: <MapPin size={15} color="#10b981" />,      bg: '#ecfdf5', border: '#6ee7b7', label: 'On Map',        value: data.latlng.length,  sub: 'lat/lng coordinates' },
            { icon: <Link2 size={15} color="#3b82f6" />,       bg: '#eff6ff', border: '#93c5fd', label: 'Has GMap Link', value: data.gmap.length,    sub: 'needs coordinates' },
            { icon: <AlertCircle size={15} color="#f59e0b" />, bg: '#fffbeb', border: '#fcd34d', label: 'No Location',   value: data.missing.length, sub: 'needs update' },
            { icon: <span style={{ fontSize: 15 }}>🔥</span>,  bg: '#fff7ed', border: '#fed7aa', label: 'Frequent Buyers', value: frequentAll.length, sub: 'weekly regulars' },
          ].map((s, i) => (
            <div key={i} style={{
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
              padding: '0.7rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 140px',
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Map (normal) ── */}
        {renderMap(false)}

        {/* ── Lists ── */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
            {([
              { key: 'missing',  label: 'Missing Location', count: data.missing.length,    color: '#f59e0b' },
              { key: 'gmap',     label: 'Has GMap Link',    count: data.gmap.length,        color: '#3b82f6' },
              { key: 'frequent', label: '🔥 Frequent',      count: frequentAll.length,      color: '#f97316' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1, padding: '0.85rem 1rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: activeTab === t.key ? 'white' : '#f8fafc',
                  borderBottom: activeTab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontSize: '0.82rem', fontWeight: activeTab === t.key ? 700 : 500,
                  color: activeTab === t.key ? '#1e293b' : '#64748b',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
                <span style={{
                  background: activeTab === t.key ? t.color + '18' : '#f1f5f9',
                  color: activeTab === t.key ? t.color : '#94a3b8',
                  fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search / filter bar */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.65rem', alignItems: 'center', background: '#fafafa' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search customer…"
                value={activeTab === 'gmap' ? gmapSearch : activeTab === 'frequent' ? freqSearch : missingSearch}
                onChange={e => {
                  if (activeTab === 'gmap') setGmapSearch(e.target.value);
                  else if (activeTab === 'frequent') setFreqSearch(e.target.value);
                  else setMissingSearch(e.target.value);
                }}
                style={{
                  width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem', border: '1px solid #e2e8f0',
                  borderRadius: 8, fontSize: '0.78rem', background: 'white', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
            {/* Salesman filter */}
            {(() => {
              const smList = activeTab === 'gmap' ? salesmenGmap : activeTab === 'frequent' ? salesmenFrequent : salesmenMissing;
              const rpVal  = activeTab === 'gmap' ? gmapRp : activeTab === 'frequent' ? freqRp : missingRp;
              const setRp  = activeTab === 'gmap' ? setGmapRp : activeTab === 'frequent' ? setFreqRp : setMissingRp;
              return smList.length > 0 ? (
                <select
                  value={rpVal}
                  onChange={e => setRp(e.target.value)}
                  style={{ padding: '0.4rem 0.65rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.78rem', background: 'white', fontFamily: 'inherit', color: '#1e293b' }}
                >
                  <option value="">All Salesmen</option>
                  {smList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : null;
            })()}
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {activeTab === 'gmap' ? filteredGmap.length : activeTab === 'frequent' ? filteredFrequent.length : filteredMissing.length} shown
            </span>
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {activeTab === 'gmap' && (
              filteredGmap.length === 0 ? <EmptyState text="No customers found" /> :
              filteredGmap.map((c: any, i: number) => (
                <ListRow key={c.id} index={i} customer={c} rightSlot={
                  <a href={c.geo_location} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 7, fontSize: '0.72rem', fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <ExternalLink size={11} /> Open
                  </a>
                } groupColor="#3b82f6" />
              ))
            )}

            {activeTab === 'missing' && (
              filteredMissing.length === 0 ? <EmptyState text="No customers found" /> :
              filteredMissing.map((c: any, i: number) => (
                <ListRow key={c.id} index={i} customer={c} rightSlot={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 7, fontSize: '0.7rem', fontWeight: 600, background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a', flexShrink: 0 }}>
                    No location
                  </div>
                } groupColor="#f59e0b" />
              ))
            )}

            {activeTab === 'frequent' && (
              filteredFrequent.length === 0
                ? <EmptyState text="No frequent buyers found" emoji="🔥" note="A frequent buyer orders in 2+ different weeks in the last 30 days" />
                : filteredFrequent.map((c: any, i: number) => (
                  <ListRow key={`${c.id}-${c.geo_location}`} index={i} customer={c}
                    showFreqBadge
                    rightSlot={
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span style={{ background: '#fff7ed', color: '#ea580c', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999, border: '1px solid #fed7aa' }}>
                            🔥 {c.orders_last_30d} orders/30d
                          </span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{c.weeks_active_30d} weeks active</span>
                      </div>
                    }
                    groupColor={c.party_group_id === 2 ? '#3b82f6' : '#10b981'}
                    locationBadge={c.geo_location ? (c.geo_location.includes('maps') ? 'GMap' : 'On Map') : 'No Loc'}
                  />
                ))
            )}
          </div>
        </div>
      </div>

      {/* ── Fullscreen map overlay ── */}
      {mapFullscreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* Header bar */}
          <div style={{
            background: 'white', padding: '0.7rem 1.2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <MapPin size={18} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Customer Map</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{data.latlng.length} on map · {frequentOnMap.length} frequent</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Press Esc to exit</span>
              <button onClick={() => setMapFullscreen(false)} style={{
                background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569',
              }}>
                <X size={15} />
              </button>
            </div>
          </div>
          {/* Full map */}
          <div style={{ flex: 1, position: 'relative' }}>
            {renderMap(true)}
          </div>
        </div>
      )}
    </>
  );
}

// ── Shared list row ────────────────────────────────────────────────────────────
function ListRow({
  index, customer: c, rightSlot, groupColor, showFreqBadge, locationBadge,
}: {
  index: number;
  customer: any;
  rightSlot: React.ReactNode;
  groupColor: string;
  showFreqBadge?: boolean;
  locationBadge?: string;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.6rem 1rem', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ width: 24, fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>{index + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          {showFreqBadge && isFrequent(c) && (
            <span style={{ fontSize: 11, flexShrink: 0 }} title="Orders in multiple weeks">🔥</span>
          )}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: groupColor + '18', color: groupColor, padding: '0px 5px', borderRadius: 4, fontWeight: 600 }}>{c.group_name}</span>
          {c.salesman && <span>{c.salesman}</span>}
          {c.last_order && <><span>·</span><span>Last {fmt(c.last_order)}</span></>}
          {locationBadge && (
            <span style={{
              background: locationBadge === 'On Map' ? '#ecfdf5' : locationBadge === 'GMap' ? '#eff6ff' : '#fef9c3',
              color:      locationBadge === 'On Map' ? '#059669'  : locationBadge === 'GMap' ? '#3b82f6'  : '#92400e',
              padding: '0px 5px', borderRadius: 4, fontWeight: 600,
            }}>{locationBadge}</span>
          )}
        </div>
      </div>
      {rightSlot}
    </div>
  );
}

function EmptyState({ text, emoji = '🔍', note }: { text: string; emoji?: string; note?: string }) {
  return (
    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{emoji}</div>
      <div style={{ fontWeight: 600, color: '#64748b', marginBottom: note ? 4 : 0 }}>{text}</div>
      {note && <div style={{ fontSize: '0.72rem', maxWidth: 260, margin: '0 auto' }}>{note}</div>}
    </div>
  );
}
