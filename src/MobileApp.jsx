import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './supabaseClient';

const SITES = {
  'Banque BNA - Alger':   { lat: 36.7725, lng: 3.0543,  rayon: 5000000 },
  'Usine Cevital - Bejaia': { lat: 36.7500, lng: 5.0667, rayon: 5000000 },
  'Base Pétrolière':        { lat: 31.6881, lng: 6.0463, rayon: 5000000 },
};

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371e3, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MobileApp() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fr';
  const isRTL = lang === 'ar';

  const [heure, setHeure] = useState('');
  const [connecte, setConnecte] = useState(false);
  const [nomAgent, setNomAgent] = useState('');
  const [siteAgent, setSiteAgent] = useState('Banque BNA - Alger');
  const [vue, setVue] = useState('pointage');

  const [statutPointage, setStatutPointage] = useState(null);
  const [statutSOS, setStatutSOS] = useState(false);
  const [messageSOS, setMessageSOS] = useState('');
  const [dernierScan, setDernierScan] = useState(null);
  const [position, setPosition] = useState(null);
  const [erreurGPS, setErreurGPS] = useState('wait');
  const [dansZone, setDansZone] = useState(false);

  const [chefDesc, setChefDesc] = useState('');
  const [consignes, setConsignes] = useState('');
  const [anomalies, setAnomalies] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setHeure(new Date().toLocaleTimeString('fr-FR')), 1000);
    return () => clearInterval(timer);
  }, []);

  const verifierGPS = () => {
    if (!navigator.geolocation) { setErreurGPS('no_gps'); return; }
    setErreurGPS('wait');
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setPosition({ lat, lng });
        const site = SITES[siteAgent];
        setDansZone(dist(lat, lng, site.lat, site.lng) <= site.rayon);
        setErreurGPS('');
      },
      () => setErreurGPS('error'),
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (connecte) verifierGPS();
  // verifierGPS est défini avant cet effet et référence siteAgent déjà dans les deps
  }, [connecte, siteAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const seConnecter = (e) => {
    e.preventDefault();
    if (!nomAgent.trim()) return;
    setConnecte(true);
  };

  const toggleLang = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
  };

  const pointerService = async () => {
    if (!dansZone || !position) return;
    const hh = new Date().getHours();
    const typeVac = (hh >= 16 || hh < 6) ? 'NUIT' : 'JOUR';
    const { error } = await supabase.from('pointages_journaliers').insert([{
      nom_agent: nomAgent, site_affecte: siteAgent,
      date_pointage: new Date().toISOString().split('T')[0],
      heure_arrivee: heure, type_vacation: typeVac, statut_validation: 'EN ATTENTE',
    }]);
    await supabase.from('agents').update({ site_affecte: siteAgent, heure_pointage: heure, lat: position.lat, lng: position.lng }).eq('nom', nomAgent);
    if (!error) setStatutPointage('VALIDE');
  };

  const lancerSOS = async () => {
    const { error } = await supabase.from('incidents').insert([{
      nom_agent: nomAgent, site: siteAgent, heure_incident: heure, resolu: false,
      lat: position?.lat || 36.75, lng: position?.lng || 3.05,
      description: messageSOS || 'Alerte panique',
    }]);
    if (!error) { setStatutSOS(true); setMessageSOS(''); }
  };

  const scannerPoint = async (point) => {
    const { error } = await supabase.from('rondes').insert([{ nom_agent: nomAgent, site: siteAgent, point_controle: point, heure_passage: heure }]);
    if (!error) { setDernierScan(`${point} à ${heure}`); alert(`✅ Passage enregistré : ${point}`); }
  };

  const transmettrePassation = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('passations').insert([{
      site: siteAgent, chef_montant: nomAgent, chef_descendant: chefDesc,
      materiel_ok: true, consignes: consignes || 'R.A.S', anomalies: anomalies || 'R.A.S',
    }]);
    if (!error) { alert('✅ Passation transmise !'); setChefDesc(''); setConsignes(''); setAnomalies(''); setVue('pointage'); }
  };

  const gpsLabel = erreurGPS === 'wait' ? t('mobile.gps_wait') : erreurGPS ? t('mobile.gps_far') : dansZone ? t('mobile.gps_ok') : t('mobile.gps_far');
  const gpsOk = !erreurGPS && dansZone;

  // ── Login screen ─────────────────────────────────────────────────────────────
  if (!connecte) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Segoe UI", sans-serif' }}>
        <button onClick={toggleLang} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
          {lang === 'fr' ? '🇩🇿 عربي' : '🇫🇷 Français'}
        </button>

        <div style={{ backgroundColor: 'white', width: '90%', maxWidth: '360px', padding: '35px 30px', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🛡️</div>
            <h2 style={{ margin: 0, color: '#111827', fontSize: '20px', fontWeight: '900' }}>{t('mobile.title')}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('mobile.subtitle')}</p>
          </div>

          <form onSubmit={seConnecter} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input type="text" placeholder={t('mobile.login_ph')} value={nomAgent} onChange={e => setNomAgent(e.target.value)}
              style={{ padding: '13px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '15px', textAlign: isRTL ? 'right' : 'left' }} required />

            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '5px' }}>{t('mobile.site_label')}</label>
              <select value={siteAgent} onChange={e => setSiteAgent(e.target.value)}
                style={{ width: '100%', padding: '13px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', textAlign: isRTL ? 'right' : 'left' }}>
                {Object.keys(SITES).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button type="submit" style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
              {t('mobile.connect_btn')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main interface ────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Segoe UI", sans-serif', maxWidth: '480px', margin: '0 auto' }}>

      {/* Top header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', color: 'white', padding: '16px 20px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', boxShadow: '0 4px 12px rgba(30,58,138,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>🛡️ {t('mobile.title')}</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.85 }}>{nomAgent} | {siteAgent}</p>
          </div>
          <button onClick={toggleLang} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '5px 11px', borderRadius: '15px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            {lang === 'fr' ? '🇩🇿 AR' : '🇫🇷 FR'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

        {/* GPS status */}
        <div style={{ padding: '12px 16px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', backgroundColor: gpsOk ? '#dcfce7' : '#fee2e2', color: gpsOk ? '#065f46' : '#991b1b', border: `1px solid ${gpsOk ? '#86efac' : '#fca5a5'}` }}>
          {gpsLabel}
        </div>

        {/* POINTAGE VIEW */}
        {vue === 'pointage' && (
          <>
            <div style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '52px', fontWeight: '900', color: '#1e3a8a', letterSpacing: '2px', fontVariantNumeric: 'tabular-nums' }}>{heure}</div>
            </div>

            {statutPointage === 'VALIDE' ? (
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '48px' }}>✅</div>
                <h3 style={{ color: '#10b981', margin: '8px 0 0 0' }}>{t('mobile.pointed_ok')}</h3>
              </div>
            ) : (
              <button onClick={pointerService} disabled={!gpsOk}
                style={{ width: '100%', padding: '20px', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', cursor: gpsOk ? 'pointer' : 'not-allowed', backgroundColor: gpsOk ? '#10b981' : '#d1d5db', color: gpsOk ? 'white' : '#6b7280', boxShadow: gpsOk ? '0 4px 12px rgba(16,185,129,0.3)' : 'none', transition: 'all 0.2s' }}>
                {gpsOk ? t('mobile.service_btn') : t('mobile.blocked_btn')}
              </button>
            )}

            {/* SOS block */}
            <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '16px', border: '2px solid #ef4444', boxShadow: '0 2px 8px rgba(239,68,68,0.1)' }}>
              {statutSOS ? (
                <div style={{ color: '#991b1b', textAlign: 'center', fontWeight: 'bold', fontSize: '14px', padding: '8px' }}>
                  {t('mobile.sos_sent')}
                </div>
              ) : (
                <>
                  <textarea placeholder={t('mobile.sos_ph')} value={messageSOS} onChange={e => setMessageSOS(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '10px', minHeight: '60px', fontSize: '14px', textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
                  <button onClick={lancerSOS}
                    style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}>
                    {t('mobile.sos_btn')}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* RONDES VIEW */}
        {vue === 'rondes' && (
          <div>
            <h2 style={{ textAlign: isRTL ? 'right' : 'left', margin: '0 0 16px 0' }}>{t('mobile.rounds_title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Porte Principale', 'Salle des Serveurs', 'Parking Extérieur', 'Local Technique'].map(p => (
                <button key={p} onClick={() => scannerPoint(p)}
                  style={{ padding: '18px 20px', backgroundColor: 'white', border: '2px solid #3b82f6', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                  🔍 {p}
                </button>
              ))}
            </div>
            {dernierScan && (
              <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#d1fae5', color: '#065f46', textAlign: 'center', fontWeight: 'bold', borderRadius: '10px', fontSize: '13px' }}>
                {t('mobile.last_scan')} {dernierScan}
              </div>
            )}
          </div>
        )}

        {/* PASSATION VIEW */}
        {vue === 'passation' && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ margin: '0 0 16px 0', textAlign: isRTL ? 'right' : 'left' }}>{t('mobile.relay_title')}</h2>
            <form onSubmit={transmettrePassation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '5px', textAlign: isRTL ? 'right' : 'left' }}>{t('mobile.desc_agent')}</label>
                <input type="text" value={chefDesc} onChange={e => setChefDesc(e.target.value)} required
                  style={{ width: '100%', padding: '11px', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '5px', textAlign: isRTL ? 'right' : 'left' }}>{t('mobile.asc_agent')}</label>
                <input type="text" value={nomAgent} readOnly
                  style={{ width: '100%', padding: '11px', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#f9fafb', textAlign: isRTL ? 'right' : 'left' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', display: 'block', marginBottom: '5px', textAlign: isRTL ? 'right' : 'left' }}>{t('mobile.notes')}</label>
                <textarea value={consignes} onChange={e => setConsignes(e.target.value)} rows="2"
                  style={{ width: '100%', padding: '11px', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: '8px', textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b', display: 'block', marginBottom: '5px', textAlign: isRTL ? 'right' : 'left' }}>{t('mobile.anomalies')}</label>
                <textarea value={anomalies} onChange={e => setAnomalies(e.target.value)} rows="2"
                  style={{ width: '100%', padding: '11px', boxSizing: 'border-box', border: '1px solid #fca5a5', borderRadius: '8px', textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' }} />
              </div>
              <button type="submit"
                style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
                {t('mobile.send_relay')}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <div style={{ display: 'flex', backgroundColor: 'white', borderTop: '1px solid #e5e7eb', boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}>
        {[
          { key: 'pointage', icon: '⏱', label: t('mobile.clock_tab') },
          { key: 'rondes',   icon: '🔦', label: t('mobile.rounds_tab') },
          { key: 'passation', icon: '📋', label: t('mobile.relay_tab') },
        ].map(tab => (
          <div key={tab.key} onClick={() => setVue(tab.key)}
            style={{ flex: 1, padding: '12px 0', textAlign: 'center', cursor: 'pointer', color: vue === tab.key ? '#1d4ed8' : '#9ca3af', borderTop: vue === tab.key ? '2px solid #1d4ed8' : '2px solid transparent', transition: 'all 0.15s' }}>
            <span style={{ fontSize: '22px', display: 'block' }}>{tab.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MobileApp;
