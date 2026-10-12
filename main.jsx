import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createClient } from '@supabase/supabase-js';
import { MapPinned, Navigation, Search, AlertTriangle, CarFront, Construction, ShieldAlert, LocateFixed, X, Radio } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const IRAQ_CENTER = [33.2, 43.7];
const REPORTS = [
  { value: 'traffic', label: 'ازدحام', icon: CarFront, color: '#f5b942' },
  { value: 'accident', label: 'حادث', icon: AlertTriangle, color: '#ff6262' },
  { value: 'hazard', label: 'خطر بالطريق', icon: ShieldAlert, color: '#bb91ff' },
  { value: 'closure', label: 'طريق مغلق', icon: X, color: '#ff6262' },
  { value: 'works', label: 'أعمال صيانة', icon: Construction, color: '#69b8ff' },
];
const reportInfo = value => REPORTS.find(r => r.value === value) || REPORTS[0];

function ReportClick({ enabled, onChoose }) {
  useMapEvents({ click(e) { if (enabled) onChoose([e.latlng.lat, e.latlng.lng]); } });
  return null;
}
function Recenter({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 15, { duration: 0.8 }); }, [position, map]);
  return null;
}
function makeIcon(color, glyph) {
  return L.divIcon({
    className: 'masar-marker',
    html: `<div style="background:${color}">${glyph}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -17]
  });
}
const userIcon = makeIcon('#38d6c3', '●');
const destinationIcon = makeIcon('#2f91ff', '◆');
const reportIcon = value => makeIcon(reportInfo(value).color, '!');
const fmtTime = value => new Date(value).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

function App() {
  const [userPos, setUserPos] = useState(null);
  const [destination, setDestination] = useState(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportType, setReportType] = useState('traffic');
  const [reportMode, setReportMode] = useState(false);
  const [status, setStatus] = useState('الخريطة جاهزة — ابحث عن وجهة أو حدّد موقعك.');
  const [panelOpen, setPanelOpen] = useState(true);
  const [liveEnabled, setLiveEnabled] = useState(Boolean(supabase));

  async function loadReports() {
    if (!supabase) return;
    const { data, error } = await supabase.from('road_reports')
      .select('id, kind, lat, lng, note, created_at, expires_at, confirmations')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(250);
    if (!error && data) setReports(data);
  }

  useEffect(() => {
    if (!supabase) return;
    loadReports();
    const channel = supabase.channel('road-reports-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_reports' }, loadReports)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function locateMe() {
    if (!navigator.geolocation) { setStatus('المتصفح لا يدعم تحديد الموقع.'); return; }
    setStatus('بانتظار إذن تحديد الموقع…');
    navigator.geolocation.getCurrentPosition(p => {
      const pos = [p.coords.latitude, p.coords.longitude];
      setUserPos(pos); setStatus('تم تحديد موقعك. دقة GPS التقريبية ' + Math.round(p.coords.accuracy) + ' متر.');
    }, e => setStatus(e.code === 1 ? 'لم تسمح بإذن الموقع. فعّله من إعدادات المتصفح.' : 'تعذر تحديد الموقع؛ تحقق من GPS والاتصال.'),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }

  async function searchPlace(e) {
    e?.preventDefault();
    if (!query.trim()) { setStatus('اكتب اسم المكان أولاً.'); return; }
    setSearching(true); setStatus('جارٍ البحث عن الوجهة…');
    try {
      // Nominatim is only a prototype search endpoint. Review its policy before public launch.
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=iq&q=' + encodeURIComponent(query.trim());
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      if (!data.length) { setStatus('لم نجد المكان. جرّب اسماً أوضح أو اسم المدينة.'); return; }
      const p = data[0], pos = [Number(p.lat), Number(p.lon)];
      setDestination({ position: pos, label: p.display_name });
      setRoute(null); setRouteInfo(null);
      setStatus('تم العثور على الوجهة. حدّد موقعك ثم اضغط «احسب الطريق».');
    } catch { setStatus('تعذر البحث الآن. جرّب لاحقاً.'); }
    finally { setSearching(false); }
  }

  async function calculateRoute() {
    if (!userPos || !destination) { setStatus('حدد موقعك وابحث عن وجهة أولاً.'); return; }
    setStatus('جارٍ حساب الطريق التجريبي…');
    try {
      const [a, b] = [userPos, destination.position];
      const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('route failed');
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.length) throw new Error('no route');
      const r = data.routes[0];
      setRoute(r.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
      setRouteInfo({ km: (r.distance / 1000).toFixed(1), mins: Math.round(r.duration / 60) });
      setStatus('مسار تجريبي جاهز. الوقت لا يتضمن ازدحاماً مباشراً.');
    } catch { setStatus('تعذر حساب الطريق الآن. خدمة المسارات التجريبية قد تكون غير متاحة.'); }
  }

  async function addReport(position) {
    setReportMode(false);
    if (!supabase) {
      setStatus('البلاغ لم يُحفظ: اربط Supabase لتفعيل المشاركة بين الأجهزة.');
      return;
    }
    const { error } = await supabase.from('road_reports').insert({
      kind: reportType, lat: position[0], lng: position[1],
      expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    });
    if (error) setStatus('تعذر إرسال البلاغ. راجع إعدادات قاعدة البيانات وسياسات الوصول.');
    else { setStatus('تم إرسال البلاغ للمستخدمين المتصلين.'); await loadReports(); }
  }

  const activeReports = useMemo(() => reports.filter(r => !r.expires_at || new Date(r.expires_at) > new Date()), [reports]);

  return <div className="app-shell">
    <aside className={`sidebar ${panelOpen ? '' : 'sidebar-collapsed'}`}>
      <div className="brand-row">
        <div className="brand-mark"><MapPinned size={25}/></div>
        <div className="brand-copy"><h1>مسار</h1><p>طريقك أوضح، وين ما تروح</p></div>
        <button className="icon-button close-panel" onClick={() => setPanelOpen(false)} aria-label="إغلاق اللوحة"><X size={18}/></button>
      </div>
      <div className="prototype-badge"><span/> نسخة تجريبية قيد التطوير</div>
      <form className="search-box" onSubmit={searchPlace}>
        <Search size={19}/>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="وين تريد تروح؟" aria-label="ابحث عن وجهة"/>
        <button type="submit" disabled={searching} aria-label="بحث">{searching ? '…' : 'بحث'}</button>
      </form>
      <div className="quick-actions">
        <button onClick={locateMe}><LocateFixed size={17}/> موقعي</button>
        <button onClick={calculateRoute}><Navigation size={17}/> احسب الطريق</button>
      </div>
      {destination && <div className="destination-card">
        <div className="destination-dot"/>
        <div className="destination-text"><b>الوجهة</b><span>{destination.label}</span></div>
        <button className="icon-button" onClick={() => { setDestination(null); setRoute(null); setRouteInfo(null); }} aria-label="مسح الوجهة"><X size={16}/></button>
      </div>}
      {routeInfo && <div className="route-card"><div><strong>{routeInfo.km} كم</strong><span>المسافة التقريبية</span></div><div><strong>{routeInfo.mins} دقيقة</strong><span>وقت بلا ازدحام مباشر</span></div></div>}
      <section className="report-section">
        <div className="section-heading"><div><h2>بلاغات الطريق</h2><p>ساعد السائقين بمعلومة موثوقة</p></div><span className="count">{activeReports.length}</span></div>
        <div className="report-types">
          {REPORTS.map(r => <button key={r.value} className={reportType === r.value ? 'report-type selected' : 'report-type'} onClick={() => setReportType(r.value)}>
            <span style={{ background: r.color }}><r.icon size={16}/></span>{r.label}
          </button>)}
        </div>
        <button className={`report-cta ${reportMode ? 'is-active' : ''}`} onClick={() => { setReportMode(!reportMode); setStatus(!reportMode ? 'اضغط على موقع البلاغ بالخريطة.' : 'تم إلغاء إضافة البلاغ.'); }}>
          <AlertTriangle size={18}/>{reportMode ? 'إلغاء تحديد الموقع' : 'أضف بلاغاً على الخريطة'}
        </button>
        {reportMode && <div className="instruction">اضغط على موقع البلاغ بالخريطة لتأكيد مكانه.</div>}
      </section>
      <section className="live-section">
        <div className="section-heading"><div><h2><Radio size={16}/> الحالة المباشرة</h2><p>{supabase ? 'اتصال قاعدة البيانات مهيأ' : 'قاعدة البيانات غير مربوطة بعد'}</p></div><span className={`live-pill ${supabase ? 'on' : ''}`}>{supabase ? 'متصل' : 'تجريبي'}</span></div>
        {!supabase && <p className="setup-note">لإظهار البلاغات نفسها لجميع المستخدمين، أنشئ مشروع Supabase وأضف بياناته إلى ملف البيئة. راجع README.</p>}
        <div className="report-feed">
          {activeReports.slice(0, 5).map(r => {
            const info = reportInfo(r.kind);
            return <div className="feed-item" key={r.id}><span className="feed-icon" style={{ color: info.color }}><info.icon size={17}/></span><div><b>{info.label}</b><small>{fmtTime(r.created_at)} · ينتهي بعد فترة محدودة</small></div></div>;
          })}
          {activeReports.length === 0 && <div className="empty-feed">لا توجد بلاغات فعالة حالياً.</div>}
        </div>
      </section>
      <div className="status-bar"><span className="status-dot"/><span>{status}</span></div>
      <footer>مسار © نسخة تجريبية · بيانات الخريطة © OpenStreetMap</footer>
    </aside>

    {!panelOpen && <button className="open-panel" onClick={() => setPanelOpen(true)}><MapPinned size={18}/> مسار</button>}
    <main className="map-area">
      <MapContainer center={IRAQ_CENTER} zoom={6} minZoom={5} maxZoom={19} zoomControl={false} className="map">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Recenter position={userPos || destination?.position}/>
        <ReportClick enabled={reportMode} onChoose={addReport}/>
        {userPos && <Marker position={userPos} icon={userIcon}><Popup>موقعك الحالي</Popup></Marker>}
        {destination && <Marker position={destination.position} icon={destinationIcon}><Popup>{destination.label}</Popup></Marker>}
        {route && <Polyline positions={route} pathOptions={{ color: '#1687ff', weight: 6, opacity: .9 }}/>}
        {activeReports.map(r => <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r.kind)}>
          <Popup><b>{reportInfo(r.kind).label}</b><br/>{r.note || 'بلاغ من مستخدم مسار'}<br/><small>{fmtTime(r.created_at)}</small></Popup>
        </Marker>)}
      </MapContainer>
      <div className="map-top-chip"><span className="gps-pulse"/>{userPos ? 'تم تحديد موقعك' : 'العراق · خريطة مباشرة'}</div>
      <div className="map-legend"><span><i className="legend-blue"/> مسار مقترح</span><span><i className="legend-yellow"/> بلاغ طريق</span></div>
      {reportMode && <div className="map-banner">اضغط على الخريطة لتحديد مكان البلاغ</div>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
