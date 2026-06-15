import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import MobileApp from './MobileApp.jsx';
import { LanguageProvider } from './context/LanguageContext';
import './index.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          {/* /mobile → interface agent terrain (toujours) */}
          <Route path="/mobile/*" element={<MobileApp />} />
          {/* tout le reste → app admin */}
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
