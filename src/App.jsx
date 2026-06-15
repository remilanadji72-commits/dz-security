import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';

import { useDataStore } from './store/useDataStore';
import { useLanguage } from './context/LanguageContext';

import Sidebar   from './components/Sidebar';
import Topbar    from './components/layout/Topbar';
import RoleGuard from './components/layout/RoleGuard';

import './App.css';

// ── Lazy-loaded pages (each route is a separate chunk) ─────────────────────────
const Kpi           = lazy(() => import('./pages/Kpi'));
const Statistiques  = lazy(() => import('./pages/Statistiques'));
const Parametres    = lazy(() => import('./pages/Parametres'));
const SalleOps      = lazy(() => import('./pages/SalleOps'));
const Inspection    = lazy(() => import('./pages/Inspection'));
const Logistique    = lazy(() => import('./pages/Logistique'));
const Armurerie     = lazy(() => import('./pages/Armurerie'));
const Formation     = lazy(() => import('./pages/Formation'));
const Planning      = lazy(() => import('./pages/Planning'));
const Incidents     = lazy(() => import('./pages/Incidents'));
const Contrats      = lazy(() => import('./pages/Contrats'));
const Facturation   = lazy(() => import('./pages/Facturation'));
const Recouvrement  = lazy(() => import('./pages/Recouvrement'));
const Prospection   = lazy(() => import('./pages/Prospection'));
const Recrutement   = lazy(() => import('./pages/Recrutement'));
const Social        = lazy(() => import('./pages/Social'));
const Pointage      = lazy(() => import('./pages/Pointage'));
const Attachements  = lazy(() => import('./pages/Attachements'));
const Juridique     = lazy(() => import('./pages/Juridique'));
const NotFound      = lazy(() => import('./pages/NotFound'));

// ── Loading fallback ──────────────────────────────────────────────────────────
function LoadingFallback() {
  return (
    <div className="page-container text-center" style={{ paddingTop: '80px' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>⏳</div>
      <p className="text-muted">Chargement...</p>
    </div>
  );
}

// ── Archives redirect (tiny, stays inline) ─────────────────────────────────────
function ArchivesRedirect() {
  const { t } = useLanguage();
  return (
    <div className="page-container text-center">
      <h1 className="page-title">{t('archives.title')}</h1>
      <p className="page-subtitle">{t('archives.subtitle')}</p>
    </div>
  );
}

// ── Login page ─────────────────────────────────────────────────────────────────
function LoginPage() {
  const { t } = useLanguage();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const mapError = (msg = '') => {
    if (msg.includes('Invalid login credentials'))  return t('auth.error_invalid');
    if (msg.includes('Email not confirmed'))         return t('auth.error_not_confirmed');
    if (msg.includes('Too many requests') || msg.includes('rate limit')) return t('auth.error_too_many');
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) return t('auth.error_network');
    return t('auth.error_unknown');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(mapError(authError.message));
    } catch {
      setError(t('auth.error_network'));
    } finally {
      setLoading(false);
    }
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
          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px',
              padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginBottom: '8px' }}>
              ⚠️ {error}
            </div>
          )}
          <button type="submit" className="btn btn-danger btn-full" disabled={loading}>
            {loading ? t('auth.logging_in') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Admin layout ──────────────────────────────────────────────────────────────
function AdminLayout({ session }) {
  const { roleAdmin, fetchToutesLesDonnees, initRealtime } = useDataStore();
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
        <Topbar />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RoleGuard>
            <Suspense fallback={<LoadingFallback />}>
              <Outlet />
            </Suspense>
          </RoleGuard>
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

      <Route path="/" element={session ? <AdminLayout session={session} /> : <Navigate to="/login" replace />}>
        <Route index element={<Navigate to="/kpi" replace />} />

        {/* Direction Générale */}
        <Route path="kpi"          element={<Kpi />} />
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

      <Route path="*" element={
        <Suspense fallback={<LoadingFallback />}>
          {session ? <NotFound /> : <Navigate to="/login" replace />}
        </Suspense>
      } />
    </Routes>
  );
}

export default App;
