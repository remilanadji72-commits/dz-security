import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../store/useDataStore';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../ui/LanguageSwitcher';

const DocumentConverter = lazy(() => import('../DocumentConverter'));

function Topbar() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { roleAdmin, incidentsData, alertesData } = useDataStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Indicateur réseau
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const [showConverter, setShowConverter] = useState(false);

  const route = location.pathname.replace('/', '') || 'kpi';
  const pageTitle = t(`nav.${route}`, { defaultValue: route.toUpperCase() });
  const roleLabel = t(`roles.${roleAdmin}`, { defaultValue: roleAdmin || '' });

  return (
    <>
      <div className="topbar" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div className="topbar-left">
          <h2 className="topbar-title">{pageTitle}</h2>
        </div>
        <div className="topbar-right" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {!isOnline && (
            <span style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: '#fecaca', color: '#991b1b', fontSize: '11px', fontWeight: '800' }}>
              📵 Hors-ligne
            </span>
          )}
          {alertesData.filter(a => a.priorite === 'HAUTE').length > 0 && (
            <button onClick={() => navigate('/alertes')}
              style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>
              🔔 {alertesData.filter(a => a.priorite === 'HAUTE').length} légales
            </button>
          )}
          {incidentsData.length > 0 && (
            <button className="topbar-sos" onClick={() => navigate('/incidents')}>
              🚨 {incidentsData.length} SOS
            </button>
          )}
          <button
            onClick={() => setShowConverter(true)}
            title="Convertir un document en Markdown · تحويل مستند"
            style={{ padding: '5px 11px', borderRadius: '6px', border: '1px solid #1e3060', backgroundColor: '#070f1c', color: '#7aa8c8', fontWeight: '700', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0f1e38'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#070f1c'}
          >
            📄 MarkItDown
          </button>
          <LanguageSwitcher />
          {roleLabel && <span className="topbar-role">{roleLabel}</span>}
        </div>
      </div>

      {showConverter && (
        <Suspense fallback={null}>
          <DocumentConverter onClose={() => setShowConverter(false)} />
        </Suspense>
      )}
    </>
  );
}

export default Topbar;
