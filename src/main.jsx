import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import MobileApp from './MobileApp.jsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';
import './styles.css';

const isMobile =
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ||
  window.innerWidth < 768;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        {isMobile ? <MobileApp /> : <App />}
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
