import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../i18n/index.js';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { t: i18nT, i18n } = useTranslation();
  const [lang, setLang] = useState('fr');

  const isRTL = lang === 'ar';

  const toggleLanguage = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    setLang(next);
  };

  // Sync <html> dir + lang attributes on change
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  }, [lang, isRTL]);

  // t() compatible avec l'ancienne API (clés plates) ET i18next (clés pointées)
  const t = (key) => i18nT(key) || key;

  return (
    <LanguageContext.Provider value={{ lang, isRTL, toggleLanguage, t }}>
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{ fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Segoe UI", Tahoma, Arial, sans-serif' }}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

// Hook de commodité
export const useLanguage = () => useContext(LanguageContext);
