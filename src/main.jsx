import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import MobileApp from './MobileApp.jsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';
import './styles.css';

// /mobile → interface agent terrain
// /admin  → ERP admin (forcé même sur mobile)
// /       → auto-détection selon l'appareil
const path = window.location.pathname;
const forceMobile = path.startsWith('/mobile');
const forceAdmin  = path.startsWith('/admin');
const isMobile    = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || window.innerWidth < 768;

const showMobile  = forceMobile || (!forceAdmin && isMobile);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        {showMobile ? <MobileApp /> : <App />}
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
