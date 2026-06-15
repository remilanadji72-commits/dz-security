import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

function LanguageSwitcher({ className = '' }) {
  const { lang, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={`lang-switcher ${className}`}
      title={lang === 'fr' ? 'Basculer en arabe' : 'التبديل إلى الفرنسية'}
    >
      {lang === 'fr' ? '🇩🇿 عربي' : '🇫🇷 Français'}
    </button>
  );
}

export default LanguageSwitcher;
