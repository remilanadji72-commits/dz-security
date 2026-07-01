import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';

import { useDataStore } from './store/useDataStore';
import { useLanguage } from './context/LanguageContext';

import Sidebar        from './components/Sidebar';
import Topbar          from './components/layout/Topbar';
import RoleGuard       from './components/layout/RoleGuard';
import ErrorBoundary   from './components/layout/ErrorBoundary';
import ToastContainer  from './components/ui/ToastContainer';

import './App.css';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────
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
const Garanties     = lazy(() => import('./pages/Garanties'));
const Tenues        = lazy(() => import('./pages/Tenues'));
const Juridique     = lazy(() => import('./pages/Juridique'));
const Fiscal        = lazy(() => import('./pages/Fiscal'));
const Onboarding    = lazy(() => import('./pages/Onboarding'));
const SuperAdmin      = lazy(() => import('./pages/SuperAdmin'));
const AlertesLegales  = lazy(() => import('./pages/AlertesLegales'));
const Paie            = lazy(() => import('./pages/Paie'));
const NotFound        = lazy(() => import('./pages/NotFound'));

function LoadingFallback() {
  return (
    <div className="page-container text-center" style={{ paddingTop: '80px' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}>⏳</div>
      <p className="text-muted">Chargement...</p>
    </div>
  );
}

function ArchivesRedirect() {
  const { t } = useLanguage();
  return (
    <div className="page-container text-center">
      <h1 className="page-title">{t('archives.title')}</h1>
      <p className="page-subtitle">{t('archives.subtitle')}</p>
    </div>
  );
}

// ── Page de connexion unifiée ──────────────────────────────────────────────────
// Après connexion : GERANT/admin → /kpi   |   pas de profil admin → /mobile
function LoginPage() {
  const { t }                       = useLanguage();
  const [email,    setEmail]        = useState('');
  const [password, setPassword]     = useState('');
  const [loading,  setLoading]      = useState(false);
  const [error,    setError]        = useState('');

  const mapError = (msg = '') => {
    if (msg.includes('Invalid login credentials'))                         return t('auth.error_invalid');
    if (msg.includes('Email not confirmed'))                               return t('auth.error_not_confirmed');
    if (msg.includes('Too many requests') || msg.includes('rate limit'))   return t('auth.error_too_many');
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) return t('auth.error_network');
    return t('auth.error_unknown');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) { setError(mapError(authError.message)); return; }
      // La redirection est gérée par onAuthStateChange + resolveRole dans App
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
        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '20px', paddingTop: '16px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#9ca3af' }}>{t('auth.register_cta')}</p>
          <a href="/register" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', fontWeight: '800', fontSize: '13px', textDecoration: 'none' }}>
            {t('auth.trial_label')}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Layout admin (sidebar + topbar + contenu) ──────────────────────────────────
function AdminLayout({ session }) {
  const { roleAdmin, fetchToutesLesDonnees, initRealtime } = useDataStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  useEffect(() => {
    if (!session) return;
    fetchToutesLesDonnees(session.user.id);
    return initRealtime();
    // fetchToutesLesDonnees et initRealtime sont des actions Zustand stables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // /admin → affiche kpi dans la sidebar comme onglet actif
  const raw         = location.pathname.replace(/^\//, '') || 'kpi';
  const activeRoute = raw === 'admin' ? 'kpi' : raw;

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
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </RoleGuard>
        </div>
      </div>
      {/* Notifications globales — portal sur document.body, visible sur toutes les pages admin */}
      <ToastContainer />
    </div>
  );
}

// ── App racine ─────────────────────────────────────────────────────────────────
function App() {
  const [session,  setSession]  = useState(undefined); // undefined = init
  const [isAdmin,  setIsAdmin]  = useState(undefined); // undefined = rôle en cours de résolution
  const [checked,  setChecked]  = useState(false);
  // Sélecteur atomique — ne déclenche un re-render que si roleAdmin change
  const roleAdmin = useDataStore(s => s.roleAdmin);
  // Mémorise le dernier userId pour lequel on a résolu le rôle
  // → évite de re-résoudre (et de flasher) lors des TOKEN_REFRESHED
  const resolvedForUserId = useRef(null);

  const resolveRole = useCallback(async (userId) => {
    if (!userId) { setIsAdmin(false); resolvedForUserId.current = null; return; }
    try {
      const { data } = await supabase.from('profils_admin').select('role').eq('id', userId).maybeSingle();
      setIsAdmin(!!data?.role);
      resolvedForUserId.current = userId;
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    // Chargement initial — on attend la résolution du rôle avant d'afficher quoi que ce soit
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s ?? null);
      await resolveRole(s?.user?.id ?? null);
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s ?? null);
      if (!s) {
        setIsAdmin(false);
        resolvedForUserId.current = null;
      } else if (s.user.id !== resolvedForUserId.current) {
        // Nouvel utilisateur (premier login) — résoudre le rôle
        // isAdmin passe à undefined pendant la résolution → LoadingFallback affiché
        setIsAdmin(undefined);
        resolveRole(s.user.id);
      }
      // Même userId (TOKEN_REFRESHED, USER_UPDATED, …) : isAdmin inchangé, pas de flash
    });
    return () => subscription.unsubscribe();
  }, [resolveRole]);

  // Attendre la vérification initiale de session + rôle
  if (!checked) return <LoadingFallback />;

  // Destination après connexion selon le rôle
  const homeUrl = isAdmin ? '/kpi' : '/mobile';
  // Afficher le loader si session existante mais rôle en cours de résolution
  const loginRedirect = isAdmin === undefined ? <LoadingFallback /> : <Navigate to={homeUrl} replace />;

  return (
    <Routes>
      {/* ── Connexion — / + /login + /admin (si pas connecté) ── */}
      {/* ── Onboarding public — accessible sans compte ── */}
      <Route path="/register" element={
        <Suspense fallback={<LoadingFallback />}>
          <Onboarding />
        </Suspense>
      } />

      <Route path="/"      element={session ? loginRedirect : <LoginPage />} />
      <Route path="/login" element={session ? loginRedirect : <LoginPage />} />
      <Route path="/admin" element={session ? loginRedirect : <LoginPage />} />

      {/* ── Layout admin — accessible uniquement aux utilisateurs avec profil admin ── */}
      <Route element={
        !session         ? <Navigate to="/" replace /> :
        isAdmin === undefined ? <LoadingFallback /> :
        isAdmin          ? <AdminLayout session={session} /> :
                           <Navigate to="/mobile" replace />
      }>
        <Route path="/kpi"          element={<Kpi />} />
        <Route path="/statistiques" element={<Statistiques />} />
        <Route path="/parametres"   element={<Parametres />} />

        <Route path="/salleops"     element={<SalleOps />} />
        <Route path="/inspection"   element={<Inspection />} />
        <Route path="/logistique"   element={<Logistique />} />
        <Route path="/armurerie"    element={<Armurerie />} />
        <Route path="/formation"    element={<Formation />} />
        <Route path="/planning"     element={<Planning />} />
        <Route path="/incidents"    element={<Incidents />} />

        <Route path="/marches"      element={<Contrats />} />
        <Route path="/facturation"  element={<Facturation />} />
        <Route path="/recouvrement" element={<Recouvrement />} />
        <Route path="/prospection"  element={<Prospection />} />
        <Route path="/garanties"    element={<Garanties />} />
        <Route path="/tenues"       element={<Tenues />} />

        <Route path="/paie"         element={<Paie />} />
        <Route path="/recrutement"  element={<Recrutement />} />
        <Route path="/social"       element={<Social />} />
        <Route path="/pointage"     element={<Pointage />} />
        <Route path="/attachements" element={<Attachements />} />
        <Route path="/archives"     element={<ArchivesRedirect />} />

        <Route path="/juridique"    element={<Juridique />} />
        <Route path="/fiscal"       element={<Fiscal />} />
        <Route path="/alertes"      element={<AlertesLegales />} />
        <Route path="/superadmin"   element={
          roleAdmin !== 'SUPER_ADMIN'
            ? <Navigate to="/kpi" replace />
            : <SuperAdmin />
        } />
      </Route>

      {/* ── 404 ── */}
      <Route path="*" element={
        <Suspense fallback={<LoadingFallback />}>
          {session ? <NotFound /> : <Navigate to="/" replace />}
        </Suspense>
      } />
    </Routes>
  );
}

export default App;
