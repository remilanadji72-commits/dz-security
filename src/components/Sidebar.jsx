import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { colors } from '../constants';
import { getMenuForRole } from '../navigation/modules';
import LanguageSwitcher from './ui/LanguageSwitcher';

function Sidebar({ activeTab, setActiveTab, handleLogout, roleAdmin }) {
  const { t: i18nT } = useTranslation();
  const { isRTL } = useLanguage();

  const sections = getMenuForRole(roleAdmin || 'GERANT');
  const roleLabel = i18nT(`roles.${roleAdmin}`, { defaultValue: roleAdmin });

  return (
    <div style={{
      width: '260px',
      backgroundColor: colors?.sidebar || '#111827',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
    }}>

      {/* Header */}
      <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ color: colors?.red || '#ef4444', margin: '0 0 4px 0', fontSize: '24px', fontWeight: '900', letterSpacing: '-1px' }}>
          DZ SECURITY
        </h2>
        <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {i18nT('auth.erp_system')}
        </div>
        <div style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}>
          <strong style={{ color: '#10b981', display: 'block', fontSize: '12px', textTransform: 'uppercase' }}>
            {roleLabel}
          </strong>
        </div>
      </div>

      {/* Module list — grouped by section */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', flex: 1 }}>
        {sections.map((section, sIdx) => (
          <div key={section.sectionKey}>
            {/* Section label */}
            <div
              className="sidebar-section"
              style={{ marginTop: sIdx > 0 ? '8px' : '0', borderTop: sIdx > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              {i18nT(`sections.${section.sectionKey}`, { defaultValue: section.sectionKey.toUpperCase() })}
            </div>

            {/* Items */}
            {section.items.map(item => {
              const isActive = activeTab === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    borderLeft:  isRTL ? 'none' : (isActive ? `3px solid ${colors?.red || '#ef4444'}` : '3px solid transparent'),
                    borderRight: isRTL ? (isActive ? `3px solid ${colors?.red || '#ef4444'}` : '3px solid transparent') : 'none',
                    padding: '10px 20px',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    transition: 'background-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: isActive ? 'bold' : '500', color: isActive ? 'white' : '#d1d5db' }}>
                    {i18nT(`nav.${item.id}`)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <LanguageSwitcher className="lang-switcher-sidebar" />
        <div
          onClick={handleLogout}
          style={{
            textAlign: 'center', cursor: 'pointer', color: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            padding: '9px', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px',
          }}
        >
          🚪 {i18nT('auth.logout')}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
