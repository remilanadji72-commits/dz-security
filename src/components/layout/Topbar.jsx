import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDataStore } from '../../store/useDataStore';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../ui/LanguageSwitcher';

function Topbar() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { roleAdmin, incidentsData } = useDataStore();
  const location = useLocation();
  const navigate = useNavigate();

  const route = location.pathname.replace('/', '') || 'kpi';
  const pageTitle = t(`nav.${route}`, { defaultValue: route.toUpperCase() });
  const roleLabel = t(`roles.${roleAdmin}`, { defaultValue: roleAdmin || '' });

  return (
    <div className="topbar" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <div className="topbar-left">
        <h2 className="topbar-title">{pageTitle}</h2>
      </div>
      <div className="topbar-right" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {incidentsData.length > 0 && (
          <button className="topbar-sos" onClick={() => navigate('/incidents')}>
            🚨 {incidentsData.length} SOS
          </button>
        )}
        <LanguageSwitcher />
        {roleLabel && <span className="topbar-role">{roleLabel}</span>}
      </div>
    </div>
  );
}

export default Topbar;
