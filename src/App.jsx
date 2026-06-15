import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import { useDataStore } from './store/useDataStore';
import { useLanguage } from './context/LanguageContext';
import { colors } from './constants';

import Sidebar    from './components/Sidebar';
import Facturation  from './pages/Facturation';
import Armurerie    from './pages/Armurerie';
import Contrats     from './pages/Contrats';
import Planning     from './pages/Planning';
import Incidents    from './pages/Incidents';
import Attachements from './pages/Attachements';
import Social       from './pages/Social';
import Parametres   from './pages/Parametres';
import Logistique   from './pages/Logistique';
import Pointage     from './pages/Pointage';
import Recouvrement from './pages/Recouvrement';
import SalleOps     from './pages/SalleOps';
import Inspection   from './pages/Inspection';
import Formation    from './pages/Formation';
import Prospection  from './pages/Prospection';
import Recrutement  from './pages/Recrutement';
import Juridique    from './pages/Juridique';
import Statistiques from './pages/Statistiques';

import './App.css';

// ── Leaflet icons fix ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});
const redIcon = new L.Icon({
  iconUrl:   'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const mapCenter = [36.7525, 3.0419];

// ── Login page ─────────────────────────────────────────────────────────────────
function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    await supabase.auth.signInWithPassword({ email, password });
  };

  return (
    <div style={{ backgroundColor: '#2b303b', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '5px', width: '350px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
        <h2 style={{ textAlign: 'center', color: '#dc2626', margin: '0 0 5px 0', fontSize: '28px', fontWeight: '900' }}>DZ SECURITY</h2>
        <p className="text-muted text-xs text-center" style={{ marginBottom: '30px', textTransform: 'uppercase' }}>
          {t('auth.subtitle')}
        </p>
        <form onSubmit={handleLogin} className="flex-col">
          <input type="email" placeholder={t('auth.email')} value={email}
            onChange={e => setEmail(e.target.value)} className="form-input" required />
          <input type="password" placeholder={t('auth.password')} value={password}
            onChange={e => setPassword(e.target.value)} className="form-input" required />
          <button type="submit" className="btn btn-danger btn-full">{t('auth.login')}</button>
        </form>
      </div>
    </div>
  );
}

// ── Command Center (KPI tab) ───────────────────────────────────────────────────
function CommandCenter() {
  const { agentsData, incidentsData } = useDataStore();
  const { t } = useLanguage();

  return (
    <div className="page-container">
      <h1 className="page-title">{t('kpi.title')}</h1>
      <p className="page-subtitle">{t('kpi.subtitle')}</p>

      <div className="flex-row mb-30">
        <div className="stat-card" style={{ borderLeft: `5px solid ${colors.blue}` }}>
          <div className="stat-card-label">{t('kpi.total_staff')}</div>
          <div className="stat-card-value">{agentsData.length}</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: colors.red, boxShadow: '0 4px 6px rgba(220,38,38,0.3)' }}>
          <div className="stat-card-label" style={{ color: 'white' }}>{t('kpi.active_sos')}</div>
          <div className="stat-card-value-white">{incidentsData.length}</div>
        </div>
      </div>

      <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
          {t('kpi.live_map')}
        </div>
        <div style={{ flex: 1 }}>
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {agentsData.map(a => a.lat && a.lng && (
              <Marker key={`ag-${a.id}`} position={[a.lat, a.lng]}>
                <Popup><strong>{a.nom}</strong><br />{a.site_affecte}</Popup>
              </Marker>
            ))}
            {incidentsData.map(inc => inc.lat && inc.lng && (
              <div key={`inc-${inc.id}`}>
                <Circle center={[inc.lat, inc.lng]} pathOptions={{ color: 'red', fillColor: 'red' }} radius={500} />
                <Marker position={[inc.lat, inc.lng]} icon={redIcon}>
                  <Popup><strong style={{ color: 'red' }}>🚨 SOS : {inc.nom_agent}</strong></Popup>
                </Marker>
              </div>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

// ── Archives redirect page ─────────────────────────────────────────────────────
function ArchivesRedirect() {
  const { t } = useLanguage();
  return (
    <div className="page-container text-center">
      <h1 className="page-title">{t('archives.title')}</h1>
      <p className="page-subtitle">{t('archives.subtitle')}</p>
    </div>
  );
}

// ── Admin layout (Sidebar + content) ──────────────────────────────────────────
function AdminLayout({ session }) {
  const { incidentsData, roleAdmin, fetchToutesLesDonnees, initRealtime } = useDataStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!session) return;
    fetchToutesLesDonnees(session.user.id);
    return initRealtime();
  }, [session]);

  const activeRoute = location.pathname.replace('/', '') || 'kpi';

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f4f6f9' }}>
      <Sidebar
        activeTab={activeRoute}
        setActiveTab={(id) => navigate(`/${id}`)}
        handleLogout={() => supabase.auth.signOut()}
        roleAdmin={roleAdmin}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {incidentsData.length > 0 && activeRoute !== 'incidents' && (
          <div
            onClick={() => navigate('/incidents')}
            style={{ backgroundColor: '#ef4444', color: 'white', padding: '10px 20px', cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', animation: 'pulse 2s infinite' }}
          >
            🚨 {t('kpi.alert_msg', { count: incidentsData.length })}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// ── Root app ──────────────────────────────────────────────────────────────────
function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/kpi" replace /> : <LoginPage />} />

      <Route
        path="/"
        element={session ? <AdminLayout session={session} /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="/kpi" replace />} />

        {/* Direction Générale */}
        <Route path="kpi"          element={<CommandCenter />} />
        <Route path="statistiques" element={<Statistiques />} />
        <Route path="parametres"   element={<Parametres />} />

        {/* Opérations */}
        <Route path="salleops"   element={<SalleOps />} />
        <Route path="inspection" element={<Inspection />} />
        <Route path="logistique" element={<Logistique />} />
        <Route path="armurerie"  element={<Armurerie />} />
        <Route path="formation"  element={<Formation />} />
        <Route path="planning"   element={<Planning />} />
        <Route path="incidents"  element={<Incidents />} />

        {/* Commercial */}
        <Route path="marches"      element={<Contrats />} />
        <Route path="facturation"  element={<Facturation />} />
        <Route path="recouvrement" element={<Recouvrement />} />
        <Route path="prospection"  element={<Prospection />} />

        {/* Ressources Humaines */}
        <Route path="recrutement"  element={<Recrutement />} />
        <Route path="social"       element={<Social />} />
        <Route path="pointage"     element={<Pointage />} />
        <Route path="attachements" element={<Attachements />} />
        <Route path="archives"     element={<ArchivesRedirect />} />

        {/* Juridique */}
        <Route path="juridique" element={<Juridique />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={session ? '/kpi' : '/login'} replace />} />
    </Routes>
  );
}

export default App;
