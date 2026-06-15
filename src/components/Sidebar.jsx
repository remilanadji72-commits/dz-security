import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { colors } from '../constants';

const MODULES = [
  // Direction Générale
  { id: 'kpi',          icon: '📊', roles: ['GERANT'] },
  { id: 'statistiques', icon: '📈', roles: ['GERANT'] },
  { id: 'parametres',   icon: '⚙️', roles: ['GERANT'] },
  // Opérations
  { id: 'salleops',   icon: '🖥️',  roles: ['GERANT', 'OPERATIONS'] },
  { id: 'inspection', icon: '🕵️',  roles: ['GERANT', 'OPERATIONS'] },
  { id: 'logistique', icon: '🚙',  roles: ['GERANT', 'OPERATIONS'] },
  { id: 'armurerie',  icon: '🔫',  roles: ['GERANT', 'OPERATIONS'] },
  { id: 'formation',  icon: '🎓',  roles: ['GERANT', 'OPERATIONS'] },
  { id: 'planning',   icon: '⏱️',  roles: ['GERANT', 'OPERATIONS', 'RH'] },
  { id: 'incidents',  icon: '🚨',  roles: ['GERANT', 'OPERATIONS'] },
  // Commercial
  { id: 'marches',      icon: '📄', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'facturation',  icon: '💰', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'recouvrement', icon: '🏦', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'prospection',  icon: '🎯', roles: ['GERANT', 'COMMERCIAL'] },
  // RH
  { id: 'recrutement',  icon: '📝', roles: ['GERANT', 'RH'] },
  { id: 'social',       icon: '🏥', roles: ['GERANT', 'RH'] },
  { id: 'archives',     icon: '📂', roles: ['GERANT', 'RH'] },
  { id: 'attachements', icon: '📑', roles: ['GERANT', 'RH', 'COMMERCIAL'] },
  // Juridique
  { id: 'juridique', icon: '⚖️', roles: ['GERANT', 'JURIDIQUE'] },
];

function Sidebar({ activeTab, setActiveTab, handleLogout, roleAdmin }) {
  const { t: i18nT } = useTranslation();
  const { lang, isRTL, toggleLanguage } = useLanguage();

  const allowed = MODULES.filter(m => m.roles.includes(roleAdmin));
  const roleLabel = i18nT(`roles.${roleAdmin}`, { defaultValue: roleAdmin });

  return (
    <div style={{
      width: '280px',
      backgroundColor: colors?.sidebar || '#111827',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>

      {/* Header */}
      <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ color: colors?.red || '#ef4444', margin: '0 0 5px 0', fontSize: '26px', fontWeight: '900', letterSpacing: '-1px' }}>
          DZ SECURITY
        </h2>
        <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.5' }}>
          <span style={{ fontWeight: 'bold' }}>{i18nT('auth.erp_system')}</span>
          <div style={{ marginTop: '10px', padding: '5px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <strong style={{ color: '#10b981', display: 'block', fontSize: '13px', textTransform: 'uppercase' }}>
              {roleLabel}
            </strong>
          </div>
        </div>
      </div>

      {/* Module list */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 0', flex: 1 }}>
        {allowed.map(item => {
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                borderLeft:  isRTL ? 'none' : (isActive ? `4px solid ${colors?.red || '#ef4444'}` : '4px solid transparent'),
                borderRight: isRTL ? (isActive ? `4px solid ${colors?.red || '#ef4444'}` : '4px solid transparent') : 'none',
                padding: '12px 20px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                direction: isRTL ? 'rtl' : 'ltr',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '22px' }}>{item.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {i18nT(`nav.${item.id}`)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          onClick={toggleLanguage}
          style={{
            textAlign: 'center', cursor: 'pointer', color: 'white',
            backgroundColor: colors?.blue || '#3b82f6',
            padding: '10px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px',
          }}
        >
          {lang === 'fr' ? i18nT('auth.lang_toggle_to_ar') : i18nT('auth.lang_toggle_to_fr')}
        </div>
        <div
          onClick={handleLogout}
          style={{
            textAlign: 'center', cursor: 'pointer', color: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            padding: '10px', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px',
          }}
        >
          {i18nT('auth.logout')}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
