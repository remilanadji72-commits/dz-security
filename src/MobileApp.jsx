import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './supabaseClient';

// Référence GPS par site (recherche par sous-chaîne du nom)
const SITES_GPS = {
  'BNA':        { lat: 36.7725, lng: 3.0543,  rayon: 5000000 },
  'Cevital':    { lat: 36.7500, lng: 5.0667,  rayon: 5000000 },
  'Pétrolière': { lat: 31.6881, lng: 6.0463,  rayon: 5000000 },
};

function getSiteGPS(siteNom) {
  if (!siteNom) return { lat: 36.75, lng: 3.05, rayon: 5000000 };
  const key = Object.keys(SITES_GPS).find(k => siteNom.includes(k));
  return key ? SITES_GPS[key] : { lat: 36.75, lng: 3.05, rayon: 5000000 };
}

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371e3, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getTabs(qualification) {
  const tenues   = { key: 'tenues',   icon: '👕', label: 'Tenues'   };
  const armement = { key: 'armement', icon: '🔫', label: 'Armement' };
  if (qualification === 'Convoyeur de Fonds') {
    return [
      { key: 'pointage',   icon: '⏱',  label: 'Pointage'   },
      { key: 'releve',     icon: '📋',  label: 'Relevé'     },
      { key: 'itineraire', icon: '🗺',  label: 'Itinéraire' },
      tenues, armement,
    ];
  }
  if (qualification === 'Chef de Groupe' || qualification === 'Chef de Site') {
    return [
      { key: 'pointage', icon: '⏱',  label: 'Pointage' },
      { key: 'rondes',   icon: '🔦', label: 'Rondes'   },
      { key: 'releve',   icon: '📋', label: 'Relevé'   },
      tenues, armement,
    ];
  }
  // Agent Simple, Maître-Chien
  return [
    { key: 'pointage', icon: '⏱',  label: 'Pointage' },
    { key: 'rondes',   icon: '🔦', label: 'Rondes'   },
    tenues, armement,
  ];
}

function jours(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  return Math.ceil((d - a) / 86400000);
}

export default function MobileApp() {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'fr';
  const isRTL = lang === 'ar';

  // ── Auth ──
  const [codeCarte, setCodeCarte]       = useState('');
  const [connecte, setConnecte]         = useState(false);
  const [erreurAuth, setErreurAuth]     = useState('');
  const [chargement, setChargement]     = useState(false);

  // ── Agent connecté ──
  const [agent, setAgent]               = useState(null);
  const [nomAgent, setNomAgent]         = useState('');
  const [siteAgent, setSiteAgent]       = useState('');
  const [qualification, setQualification] = useState('Agent Simple');
  const [tabs, setTabs]                 = useState([]);
  const [avertissement, setAvertissement] = useState('');

  // ── UI ──
  const [heure, setHeure]   = useState('');
  const [vue, setVue]       = useState('pointage');

  // ── GPS ──
  const [position, setPosition]     = useState(null);
  const [erreurGPS, setErreurGPS]   = useState('wait');
  const [dansZone, setDansZone]     = useState(false);

  // ── Pointage ──
  const [statutPointage, setStatutPointage] = useState(null);

  // ── SOS ──
  const [statutSOS, setStatutSOS]   = useState(false);
  const [messageSOS, setMessageSOS] = useState('');

  // ── Rondes ──
  const [dernierScan, setDernierScan] = useState(null);

  // ── Relevé ──
  const [chefDesc, setChefDesc]     = useState('');
  const [consignes, setConsignes]   = useState('');
  const [anomalies, setAnomalies]   = useState('');
  const [releveOk, setReleveOk]     = useState(false);

  // ── Itinéraire ──
  const [itineraireTexte, setItineraireTexte] = useState('');
  const [itineraireOk, setItineraireOk]       = useState(false);

  // ── Tenues ──
  const [mesTenues, setMesTenues]             = useState([]);
  const [signalementOk, setSignalementOk]     = useState(null);

  // ── Armement ──
  const [mesArmes,       setMesArmes]         = useState([]);
  const [mesRadios,      setMesRadios]        = useState([]);
  const [mesAttributions,setMesAttributions]  = useState([]);
  const [confirmArmOk,   setConfirmArmOk]     = useState(null);
  const [problemeEnCours,setProblemeEnCours]  = useState(null);
  const [texteProbleme,  setTexteProbleme]    = useState('');

  useEffect(() => {
    const t = setInterval(() => setHeure(new Date().toLocaleTimeString('fr-FR')), 1000);
    return () => clearInterval(t);
  }, []);

  const verifierGPS = () => {
    if (!navigator.geolocation) { setErreurGPS('no_gps'); return; }
    setErreurGPS('wait');
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        setPosition({ lat, lng });
        const ref = getSiteGPS(siteAgent);
        setDansZone(dist(lat, lng, ref.lat, ref.lng) <= ref.rayon);
        setErreurGPS('');
      },
      () => setErreurGPS('error'),
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => { if (connecte) verifierGPS(); }, [connecte]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMesTenues = async () => {
    if (!agent?.id) return;
    const { data } = await supabase
      .from('exemplaires_tenues')
      .select('*, articles_tenues(designation, taille, duree_vie_mois)')
      .eq('agent_id', agent.id);
    if (data) setMesTenues(data);
  };

  useEffect(() => { if (connecte && agent) { fetchMesTenues(); fetchMesArmes(); } }, [connecte, agent]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMesArmes = async () => {
    if (!agent?.id) return;
    const [{ data: arms }, { data: radios }, { data: attrs }] = await Promise.all([
      supabase.from('armes').select('*').eq('agent_id', agent.id).eq('statut', 'AFFECTEE'),
      supabase.from('radios_uhf').select('*').eq('agent_id', agent.id).eq('statut', 'AFFECTEE'),
      supabase.from('attributions_armes').select('*').eq('agent_id', agent.id).eq('statut', 'ACTIVE'),
    ]);
    setMesArmes(arms || []);
    setMesRadios(radios || []);
    setMesAttributions(attrs || []);
  };

  const confirmerReception = async (type, itemId) => {
    const attr = mesAttributions.find(a => type === 'arme' ? a.arme_id === itemId : a.radio_id === itemId);
    if (!attr) return;
    await supabase.from('attributions_armes')
      .update({ confirmation_agent: true, date_confirmation: new Date().toISOString() })
      .eq('id', attr.id);
    setConfirmArmOk(itemId);
    await fetchMesArmes();
  };

  const signalerProblemeArme = async (type, itemId) => {
    if (!texteProbleme.trim()) return;
    await supabase.rpc('mobile_signaler_probleme_materiel', {
      p_nom_agent:        nomAgent,
      p_notes:            `[MOBILE] ${nomAgent} : ${texteProbleme}`,
      p_arme_id:          type === 'arme'  ? itemId : null,
      p_radio_id:         type === 'radio' ? itemId : null,
      p_date_maintenance: new Date().toISOString().split('T')[0],
    });
    setProblemeEnCours(null);
    setTexteProbleme('');
    setConfirmArmOk(itemId);
  };

  const signalerEtatTenue = async (idEx, nouvelEtat) => {
    const { error } = await supabase.from('exemplaires_tenues').update({ etat: nouvelEtat }).eq('id', idEx);
    if (!error) { setSignalementOk(idEx); await fetchMesTenues(); }
  };

  const toggleLang = () => {
    const next = lang === 'fr' ? 'ar' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute('dir', next === 'ar' ? 'rtl' : 'ltr');
  };

  // ── Connexion par code carte pro ──────────────────────────────────────────────
  const seConnecter = async (e) => {
    e.preventDefault();
    setChargement(true);
    setErreurAuth('');

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .ilike('num_carte_pro', codeCarte.trim())
      .eq('statut_agent', 'ACTIF')
      .maybeSingle();

    if (error || !data) {
      setErreurAuth('Code invalide ou agent non trouvé / inactif');
      setChargement(false);
      return;
    }

    // Vérifier la validité de la carte pro
    const reste = jours(data.validite_carte_pro);
    if (reste !== null && reste < 0) {
      setErreurAuth('Carte professionnelle expirée — accès refusé');
      setChargement(false);
      return;
    }
    if (reste !== null && reste <= 30) {
      setAvertissement(`⚠️ Carte pro expire dans ${reste} jour(s) — renouvelez dès que possible`);
    }

    const fullName = [data.nom, data.prenom].filter(Boolean).join(' ');
    const qual = data.qualification || 'Agent Simple';
    setAgent(data);
    setNomAgent(fullName);
    setSiteAgent(data.site_affecte || '—');
    setQualification(qual);
    setTabs(getTabs(qual));
    setConnecte(true);
    setChargement(false);
  };

  // ── Actions métier ────────────────────────────────────────────────────────────
  const gpsOk = !erreurGPS && dansZone;
  const gpsLabel = erreurGPS === 'wait' ? '📡 Localisation en cours…'
    : erreurGPS ? '❌ GPS indisponible'
    : dansZone ? '✅ Position vérifiée — zone autorisée'
    : '⚠️ Hors zone de service';

  const pointerService = async () => {
    if (!gpsOk || !position) return;
    const h = new Date().getHours();
    const typeVac = (h >= 16 || h < 6) ? 'NUIT' : 'JOUR';
    const { error } = await supabase.rpc('mobile_enregistrer_pointage', {
      p_nom_agent:     nomAgent,
      p_site_affecte:  siteAgent,
      p_date_pointage: new Date().toISOString().split('T')[0],
      p_heure_arrivee: heure,
      p_type_vacation: typeVac,
      p_lat:           position.lat,
      p_lng:           position.lng,
      p_num_carte_pro: agent?.num_carte_pro || null,
    });
    if (!error) setStatutPointage('VALIDE');
  };

  const lancerSOS = async () => {
    const { error } = await supabase.rpc('inserer_alerte_sos', {
      p_nom_agent:   nomAgent   || '—',
      p_site:        siteAgent  || '—',
      p_description: messageSOS || 'Alerte panique',
      p_lat:         position?.lat ?? 36.75,
      p_lng:         position?.lng ?? 3.05,
    });
    if (!error) { setStatutSOS(true); setMessageSOS(''); }
  };

  const scannerPoint = async (point) => {
    const { error } = await supabase.rpc('mobile_scanner_ronde', {
      p_nom_agent:      nomAgent,
      p_site:           siteAgent,
      p_point_controle: point,
      p_heure_passage:  heure,
    });
    if (!error) { setDernierScan(`${point} — ${heure}`); alert(`✅ Passage enregistré : ${point}`); }
  };

  const transmettreReleve = async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc('mobile_transmettre_passation', {
      p_site:            siteAgent,
      p_chef_montant:    nomAgent,
      p_chef_descendant: chefDesc,
      p_consignes:       consignes || 'R.A.S',
      p_anomalies:       anomalies || 'R.A.S',
      p_materiel_ok:     true,
    });
    if (!error) { setReleveOk(true); setChefDesc(''); setConsignes(''); setAnomalies(''); }
  };

  const transmettreItineraire = async (e) => {
    e.preventDefault();
    const { error } = await supabase.rpc('mobile_transmettre_passation', {
      p_site:            siteAgent,
      p_chef_montant:    nomAgent,
      p_chef_descendant: 'DISPATCHING',
      p_consignes:       `[ITINÉRAIRE] ${itineraireTexte}`,
      p_anomalies:       'R.A.S',
      p_materiel_ok:     true,
    });
    if (!error) { setItineraireOk(true); setItineraireTexte(''); }
  };

  // ─── STYLES partagés ──────────────────────────────────────────────────────────
  const card = { backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' };
  const inputStyle = { width: '100%', padding: '13px', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', textAlign: isRTL ? 'right' : 'left', direction: isRTL ? 'rtl' : 'ltr' };
  const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: isRTL ? 'right' : 'left' };
  const btnPrimary = { width: '100%', padding: '16px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', backgroundColor: '#1d4ed8', color: 'white', boxShadow: '0 4px 12px rgba(29,78,216,0.3)' };

  // ─── ÉCRAN DE CONNEXION ───────────────────────────────────────────────────────
  if (!connecte) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Segoe UI", sans-serif', padding: '20px' }}>

        <button onClick={toggleLang} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
          {lang === 'fr' ? '🇩🇿 عربي' : '🇫🇷 Français'}
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '56px', marginBottom: '8px' }}>🛡️</div>
          <h1 style={{ color: 'white', margin: 0, fontSize: '22px', fontWeight: '900', letterSpacing: '1px' }}>DZ Security</h1>
          <p style={{ color: '#94a3b8', margin: '6px 0 0 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px' }}>Espace Agent</p>
        </div>

        <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '380px', padding: '36px 32px', borderRadius: '20px', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#111827', fontWeight: '800' }}>Connexion sécurisée</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#6b7280' }}>Saisissez votre numéro de carte professionnelle</p>

          <form onSubmit={seConnecter} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>N° Carte Professionnelle</label>
              <input
                type="text"
                placeholder="Ex : CP-2025-102"
                value={codeCarte}
                onChange={e => setCodeCarte(e.target.value)}
                style={{ ...inputStyle, fontSize: '18px', fontWeight: '700', letterSpacing: '1px', textAlign: 'center' }}
                autoComplete="off"
                required
              />
            </div>

            {erreurAuth && (
              <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '10px', fontSize: '13px', fontWeight: '600', textAlign: 'center', border: '1px solid #fca5a5' }}>
                🚫 {erreurAuth}
              </div>
            )}

            <button type="submit" disabled={chargement} style={{ ...btnPrimary, opacity: chargement ? 0.7 : 1, cursor: chargement ? 'not-allowed' : 'pointer' }}>
              {chargement ? '⏳ Vérification…' : '🔐 Accéder'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginTop: '20px', marginBottom: 0 }}>
            L'accès expire à la date de validité de votre carte pro
          </p>
        </div>
      </div>
    );
  }

  // ─── INTERFACE PRINCIPALE ─────────────────────────────────────────────────────
  const badgeQual = {
    'Agent Simple':     { bg: '#dbeafe', color: '#1d4ed8' },
    'Chef de Groupe':   { bg: '#dcfce7', color: '#15803d' },
    'Chef de Site':     { bg: '#fef9c3', color: '#854d0e' },
    'Convoyeur de Fonds': { bg: '#f3e8ff', color: '#7c3aed' },
    'Maître-Chien':     { bg: '#fee2e2', color: '#991b1b' },
  };
  const q = badgeQual[qualification] || { bg: '#f1f5f9', color: '#475569' };

  // Expiry info
  const reste = jours(agent?.validite_carte_pro);
  const expiryStr = agent?.validite_carte_pro
    ? new Date(agent.validite_carte_pro).toLocaleDateString('fr-FR')
    : null;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: isRTL ? 'Tahoma, Arial, sans-serif' : '"Segoe UI", sans-serif', maxWidth: '480px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', color: 'white', padding: '16px 20px 14px', boxShadow: '0 4px 16px rgba(30,58,138,0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', opacity: 0.75, marginBottom: '2px' }}>🛡️ DZ Security — Agent</div>
            <div style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '0.3px' }}>{nomAgent}</div>
            <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>📍 {siteAgent}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <button onClick={toggleLang} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '4px 10px', borderRadius: '15px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
              {lang === 'fr' ? '🇩🇿 AR' : '🇫🇷 FR'}
            </button>
            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '700', backgroundColor: q.bg, color: q.color }}>
              {qualification}
            </span>
          </div>
        </div>

        {/* Barre de validité carte pro */}
        {expiryStr && (
          <div style={{ marginTop: '10px', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '600', textAlign: 'center', backgroundColor: reste !== null && reste <= 30 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)', color: reste !== null && reste <= 30 ? '#fca5a5' : 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.15)' }}>
            {reste !== null && reste <= 30 ? `⚠️ Carte pro expire le ${expiryStr} (${reste}j)` : `🪪 Carte pro valide jusqu'au ${expiryStr}`}
          </div>
        )}
      </div>

      {/* Avertissement global */}
      {avertissement && (
        <div style={{ margin: '12px 16px 0', padding: '10px 14px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '10px', fontSize: '12px', fontWeight: '600', border: '1px solid #fcd34d' }}>
          {avertissement}
        </div>
      )}

      {/* Contenu principal */}
      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>

        {/* GPS badge */}
        <div style={{ padding: '10px 16px', borderRadius: '10px', textAlign: 'center', fontWeight: '600', fontSize: '13px', backgroundColor: gpsOk ? '#dcfce7' : erreurGPS === 'wait' ? '#e0f2fe' : '#fee2e2', color: gpsOk ? '#065f46' : erreurGPS === 'wait' ? '#0369a1' : '#991b1b', border: `1px solid ${gpsOk ? '#86efac' : erreurGPS === 'wait' ? '#7dd3fc' : '#fca5a5'}` }}>
          {gpsLabel}
          {erreurGPS && erreurGPS !== 'wait' && (
            <button onClick={verifierGPS} style={{ marginLeft: '10px', fontSize: '11px', padding: '2px 8px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer', color: 'inherit', fontWeight: '700' }}>
              Réessayer
            </button>
          )}
        </div>

        {/* ── VUE POINTAGE ── */}
        {vue === 'pointage' && (
          <>
            <div style={{ ...card, textAlign: 'center' }}>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Heure actuelle</div>
              <div style={{ fontSize: '54px', fontWeight: '900', color: '#1e3a8a', letterSpacing: '3px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{heure}</div>
            </div>

            {statutPointage === 'VALIDE' ? (
              <div style={{ ...card, textAlign: 'center' }}>
                <div style={{ fontSize: '52px' }}>✅</div>
                <h3 style={{ color: '#10b981', margin: '8px 0 0 0', fontSize: '18px' }}>Pointage enregistré</h3>
                <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0 0' }}>Bonne vacation !</p>
              </div>
            ) : (
              <button onClick={pointerService} disabled={!gpsOk}
                style={{ width: '100%', padding: '22px', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: '800', cursor: gpsOk ? 'pointer' : 'not-allowed', backgroundColor: gpsOk ? '#10b981' : '#d1d5db', color: gpsOk ? 'white' : '#9ca3af', boxShadow: gpsOk ? '0 6px 16px rgba(16,185,129,0.35)' : 'none', transition: 'all 0.2s', letterSpacing: '0.5px' }}>
                {gpsOk ? '⏱ Pointer ma présence' : '🔒 En attente de GPS'}
              </button>
            )}

            {/* SOS */}
            <div style={{ ...card, border: '2px solid #ef4444', boxShadow: '0 2px 10px rgba(239,68,68,0.1)', padding: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#991b1b', marginBottom: '10px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>🆘 Alerte Urgence</div>
              {statutSOS ? (
                <div style={{ color: '#991b1b', textAlign: 'center', fontWeight: '700', fontSize: '14px', padding: '8px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                  ✅ Alerte transmise — restez en sécurité
                </div>
              ) : (
                <>
                  <textarea placeholder="Décrivez la situation (optionnel)…" value={messageSOS} onChange={e => setMessageSOS(e.target.value)}
                    style={{ ...inputStyle, minHeight: '56px', marginBottom: '10px', border: '1px solid #fca5a5', fontSize: '13px' }} />
                  <button onClick={lancerSOS}
                    style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', padding: '14px', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)', letterSpacing: '0.5px' }}>
                    🆘 Envoyer l'alerte SOS
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── VUE RONDES ── */}
        {vue === 'rondes' && (
          <div>
            <div style={{ ...card, marginBottom: '14px', padding: '16px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#1e3a8a', textAlign: isRTL ? 'right' : 'left' }}>🔦 Rondes de sécurité</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', textAlign: isRTL ? 'right' : 'left' }}>Scannez chaque point de contrôle lors de votre passage</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Porte Principale', 'Salle des Serveurs', 'Parking Extérieur', 'Local Technique'].map(p => (
                <button key={p} onClick={() => scannerPoint(p)}
                  style={{ padding: '18px 20px', backgroundColor: 'white', border: '2px solid #3b82f6', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', textAlign: isRTL ? 'right' : 'left', boxShadow: '0 2px 8px rgba(59,130,246,0.1)', transition: 'all 0.15s', color: '#1e3a8a' }}>
                  🔍 {p}
                </button>
              ))}
            </div>
            {dernierScan && (
              <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#d1fae5', color: '#065f46', textAlign: 'center', fontWeight: '700', borderRadius: '12px', fontSize: '13px', border: '1px solid #6ee7b7' }}>
                ✅ Dernier scan : {dernierScan}
              </div>
            )}
          </div>
        )}

        {/* ── VUE RELEVÉ (passation de service) ── */}
        {vue === 'releve' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#1e3a8a', textAlign: isRTL ? 'right' : 'left' }}>📋 Relevé / Passation</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#6b7280', textAlign: isRTL ? 'right' : 'left' }}>Transmettez la prise de service au chef suivant</p>

            {releveOk ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '48px' }}>✅</div>
                <h3 style={{ color: '#10b981', margin: '10px 0 6px 0' }}>Relevé transmis</h3>
                <button onClick={() => setReleveOk(false)} style={{ marginTop: '10px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #10b981', background: 'transparent', color: '#10b981', cursor: 'pointer', fontWeight: '700' }}>
                  Nouveau relevé
                </button>
              </div>
            ) : (
              <form onSubmit={transmettreReleve} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Chef montant (vous)</label>
                  <input type="text" value={nomAgent} readOnly
                    style={{ ...inputStyle, backgroundColor: '#f9fafb', color: '#374151', fontWeight: '600' }} />
                </div>
                <div>
                  <label style={labelStyle}>Chef descendant</label>
                  <input type="text" placeholder="Nom du chef qui vous remplace" value={chefDesc} onChange={e => setChefDesc(e.target.value)} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Consignes</label>
                  <textarea value={consignes} onChange={e => setConsignes(e.target.value)} rows="3" placeholder="Instructions pour le service suivant…" style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#991b1b' }}>Anomalies constatées</label>
                  <textarea value={anomalies} onChange={e => setAnomalies(e.target.value)} rows="3" placeholder="R.A.S si aucune anomalie" style={{ ...inputStyle, minHeight: '70px', border: '1px solid #fca5a5', resize: 'vertical' }} />
                </div>
                <button type="submit" style={btnPrimary}>📤 Transmettre le relevé</button>
              </form>
            )}
          </div>
        )}

        {/* ── VUE TENUES ── */}
        {vue === 'tenues' && (
          <div>
            <div style={{ ...card, marginBottom: '14px', padding: '16px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#1e3a8a' }}>👕 Mes tenues</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Vos dotations en cours — signalez tout problème à l'OPS.</p>
            </div>
            {mesTenues.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>👕</div>
                <p style={{ margin: 0, fontWeight: '600' }}>Aucune tenue attribuée.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Contactez votre responsable.</p>
              </div>
            ) : mesTenues.map(t => {
              const etatStyle = {
                BON:      { bg: '#dcfce7', color: '#15803d', icon: '✅' },
                'USÉ':    { bg: '#fef9c3', color: '#854d0e', icon: '⚠️' },
                DÉTRUIT:  { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
                PERDU:    { bg: '#f1f5f9', color: '#475569', icon: '🔍' },
              }[t.etat] || { bg: '#f1f5f9', color: '#374151', icon: '❓' };
              const dejaSignale = signalementOk === t.id;
              return (
                <div key={t.id} style={{ ...card, marginBottom: '12px', borderLeft: `4px solid ${etatStyle.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '15px', color: '#1e3a8a' }}>{t.articles_tenues?.designation}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Taille : {t.articles_tenues?.taille}</div>
                    </div>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '800', backgroundColor: etatStyle.bg, color: etatStyle.color }}>
                      {etatStyle.icon} {t.etat}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', padding: '6px 10px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'inline-block' }}>
                    🏷️ {t.matricule}
                  </div>
                  {!dejaSignale ? (
                    <div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Signaler un problème :</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['USÉ', 'DÉTRUIT', 'PERDU'].map(et => (
                          <button key={et} onClick={() => signalerEtatTenue(t.id, et)}
                            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fff5f5', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                            {et === 'USÉ' ? '⚠️ Usé' : et === 'DÉTRUIT' ? '❌ Détruit' : '🔍 Perdu'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                      ✅ Signalement transmis à l'OPS
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── VUE ITINÉRAIRE (Convoyeur de Fonds) ── */}
        {vue === 'itineraire' && (
          <div style={card}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#7c3aed', textAlign: isRTL ? 'right' : 'left' }}>🗺 Itinéraire de convoyage</h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#6b7280', textAlign: isRTL ? 'right' : 'left' }}>Déclarez votre itinéraire de transport de fonds</p>

            {itineraireOk ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '48px' }}>✅</div>
                <h3 style={{ color: '#7c3aed', margin: '10px 0 6px 0' }}>Itinéraire transmis</h3>
                <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>Bonne route — restez vigilant</p>
                <button onClick={() => setItineraireOk(false)} style={{ marginTop: '14px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #7c3aed', background: 'transparent', color: '#7c3aed', cursor: 'pointer', fontWeight: '700' }}>
                  Nouvel itinéraire
                </button>
              </div>
            ) : (
              <form onSubmit={transmettreItineraire} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', backgroundColor: '#faf5ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                  <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700', marginBottom: '4px' }}>Point de départ</div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>📍 {siteAgent}</div>
                </div>
                <div>
                  <label style={labelStyle}>Description de l'itinéraire</label>
                  <textarea
                    value={itineraireTexte}
                    onChange={e => setItineraireTexte(e.target.value)}
                    rows="5"
                    placeholder="Ex: BNA Alger → Agence Belcourt → Agence El Harrach → retour base…"
                    style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
                    required
                  />
                </div>
                <div style={{ padding: '12px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '1px solid #fcd34d', fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                  ⚠️ Cet itinéraire sera transmis au responsable sécurité. Ne déviez pas sans autorisation.
                </div>
                <button type="submit" style={{ ...btnPrimary, backgroundColor: '#7c3aed', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
                  🗺 Valider l'itinéraire
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── VUE ARMEMENT ── */}
        {vue === 'armement' && (
          <div>
            <div style={{ ...card, marginBottom: '14px', padding: '16px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '17px', color: '#1e3a8a' }}>🔫 Mon armement</h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Confirmer réception — signaler un problème à l'armurerie</p>
            </div>

            {/* Armes */}
            {mesArmes.length === 0 && mesRadios.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔫</div>
                <p style={{ margin: 0, fontWeight: '600' }}>Aucune arme ou radio affectée.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Contactez le service armement.</p>
              </div>
            ) : (
              <>
                {mesArmes.map(a => {
                  const attr = mesAttributions.find(at => at.arme_id === a.id);
                  const confirme = attr?.confirmation_agent || confirmArmOk === a.id;
                  const enSignalement = problemeEnCours === a.id;
                  return (
                    <div key={a.id} style={{ ...card, marginBottom: '12px', borderLeft: `4px solid ${confirme ? '#10b981' : '#f59e0b'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '15px', color: '#1e3a8a', fontFamily: 'monospace' }}>{a.matricule || a.serie_arme}</div>
                          <div style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>{a.type_arme}</div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '800',
                          backgroundColor: confirme ? '#dcfce7' : '#fef3c7',
                          color:           confirme ? '#15803d' : '#92400e' }}>
                          {confirme ? '✅ Réception confirmée' : '⏳ En attente confirmation'}
                        </span>
                      </div>
                      {!confirme && !enSignalement && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => confirmerReception('arme', a.id)}
                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                            ✅ Confirmer réception
                          </button>
                          <button onClick={() => setProblemeEnCours(a.id)}
                            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #ef4444', backgroundColor: '#fff5f5', color: '#991b1b', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                            ⚠️
                          </button>
                        </div>
                      )}
                      {enSignalement && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea placeholder="Décrivez le problème constaté…" value={texteProbleme} onChange={e => setTexteProbleme(e.target.value)}
                            rows="2" style={{ ...inputStyle, border: '1px solid #fca5a5', fontSize: '13px', minHeight: '56px' }} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setProblemeEnCours(null); setTexteProbleme(''); }}
                              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: '700' }}>Annuler</button>
                            <button onClick={() => signalerProblemeArme('arme', a.id)}
                              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: '800', cursor: 'pointer' }}>Signaler</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Radios */}
                {mesRadios.map(r => {
                  const attr = mesAttributions.find(at => at.radio_id === r.id);
                  const confirme = attr?.confirmation_agent || confirmArmOk === r.id;
                  const enSignalement = problemeEnCours === `r${r.id}`;
                  const batStyle = { 'BON': { c: '#15803d', i: '🔋' }, 'FAIBLE': { c: '#854d0e', i: '🪫' }, 'HORS_SERVICE': { c: '#991b1b', i: '❌' } }[r.etat_batterie] || {};
                  return (
                    <div key={`r${r.id}`} style={{ ...card, marginBottom: '12px', borderLeft: `4px solid ${confirme ? '#10b981' : '#7c3aed'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div>
                          <div style={{ fontWeight: '900', fontSize: '15px', color: '#7c3aed', fontFamily: 'monospace' }}>📻 {r.matricule}</div>
                          <div style={{ fontSize: '13px', color: '#374151', marginTop: '2px' }}>{r.type_radio}{r.marque_modele ? ` — ${r.marque_modele}` : ''}</div>
                          <div style={{ fontSize: '12px', marginTop: '4px', color: batStyle.c, fontWeight: '700' }}>{batStyle.i} Batterie : {r.etat_batterie}</div>
                        </div>
                        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '800',
                          backgroundColor: confirme ? '#dcfce7' : '#f3e8ff',
                          color:           confirme ? '#15803d' : '#7c3aed' }}>
                          {confirme ? '✅ Confirmée' : '⏳ En attente'}
                        </span>
                      </div>
                      {!confirme && !enSignalement && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => confirmerReception('radio', r.id)}
                            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                            ✅ Confirmer réception
                          </button>
                          <button onClick={() => setProblemeEnCours(`r${r.id}`)}
                            style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #ef4444', backgroundColor: '#fff5f5', color: '#991b1b', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                            ⚠️
                          </button>
                        </div>
                      )}
                      {enSignalement && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea placeholder="Décrivez le problème (batterie, réception…)" value={texteProbleme} onChange={e => setTexteProbleme(e.target.value)}
                            rows="2" style={{ ...inputStyle, border: '1px solid #fca5a5', fontSize: '13px', minHeight: '52px' }} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setProblemeEnCours(null); setTexteProbleme(''); }}
                              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: '700' }}>Annuler</button>
                            <button onClick={() => signalerProblemeArme('radio', r.id)}
                              style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: '800', cursor: 'pointer' }}>Signaler</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

      </div>

      {/* Barre d'onglets bas — générée selon la qualification */}
      <div style={{ display: 'flex', backgroundColor: 'white', borderTop: '1px solid #e5e7eb', boxShadow: '0 -2px 12px rgba(0,0,0,0.07)' }}>
        {tabs.map(tab => (
          <div key={tab.key} onClick={() => setVue(tab.key)}
            style={{ flex: 1, padding: '12px 0', textAlign: 'center', cursor: 'pointer', color: vue === tab.key ? '#1d4ed8' : '#9ca3af', borderTop: vue === tab.key ? '3px solid #1d4ed8' : '3px solid transparent', transition: 'all 0.15s' }}>
            <span style={{ fontSize: '22px', display: 'block' }}>{tab.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
