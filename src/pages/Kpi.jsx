import { Fragment, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { useDataStore } from '../store/useDataStore';
import { useLanguage } from '../context/LanguageContext';
import { colors } from '../constants';

// ── Fix Leaflet icons — local assets (pas de CDN externe) ───────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
});

const redDivIcon = new L.DivIcon({
  html: '<div style="width:20px;height:20px;background:#dc2626;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(220,38,38,0.6);"></div>',
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -14],
});

const mapCenter = [36.7525, 3.0419];

const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const joursAvant = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : 999;

// ════════════════════════════════════════════════════════════════════════════
function Kpi() {
  const { agentsData, incidentsData, contratsData, sitesData, alertesData } = useDataStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // ── KPIs calculés ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const agentsActifs   = agentsData.filter(a => a.statut_agent !== 'INACTIF');
    const marchesActifs  = contratsData.filter(c => c.statut !== 'RESILIE' && c.statut !== 'TERMINE');
    const sitesActifs    = sitesData.filter(s => s.type !== 'ARCHIVE');
    const cartesPro30    = agentsActifs.filter(a => a.validite_carte_pro && joursAvant(a.validite_carte_pro) <= 30).length;
    const sansCartePro   = agentsActifs.filter(a => !a.num_carte_pro).length;
    const cdd30          = agentsActifs.filter(a => a.type_contrat === 'CDD' && a.date_fin_contrat && joursAvant(a.date_fin_contrat) <= 30).length;
    const alertesHautes  = alertesData.filter(a => a.priorite === 'HAUTE').length;
    const caMarche       = marchesActifs.reduce((s, c) => s + (parseFloat(c.montant_annuel) || 0), 0);

    return {
      agentsActifs:  agentsActifs.length,
      sosActifs:     incidentsData.length,
      marchesActifs: marchesActifs.length,
      sitesActifs:   sitesActifs.length,
      cartesPro30,
      sansCartePro,
      cdd30,
      alertesHautes,
      caMarche,
      // pour la carte
      agentsCarte:   agentsActifs,
    };
  }, [agentsData, incidentsData, contratsData, sitesData, alertesData]);

  // ── Incidents récents (5 derniers) ────────────────────────────────────────
  const incidentsRecents = useMemo(() =>
    [...incidentsData].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 5),
    [incidentsData]);

  // ── Marchés qui expirent bientôt ─────────────────────────────────────────
  const marchesExpiration = useMemo(() =>
    contratsData
      .filter(c => c.date_fin && joursAvant(c.date_fin) <= 60 && joursAvant(c.date_fin) >= 0)
      .sort((a, b) => joursAvant(a.date_fin) - joursAvant(b.date_fin))
      .slice(0, 5),
    [contratsData]);

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>📊</span>
        <div>
          <h1 className="page-title">{t('kpi.title')}</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>{t('kpi.subtitle')}</p>
        </div>
      </div>

      {/* ── KPIs Ligne 1 — Opérations ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' }}>
        {[
          { l: 'Agents Actifs',   v: kpis.agentsActifs,  bg: '#dbeafe', c: '#1d4ed8', icon: '👥', path: '/recrutement' },
          { l: 'SOS Actifs',      v: kpis.sosActifs,     bg: kpis.sosActifs > 0 ? '#fee2e2' : '#f0fdf4', c: kpis.sosActifs > 0 ? '#991b1b' : '#15803d', icon: '🚨', path: '/incidents' },
          { l: 'Marchés Actifs',  v: kpis.marchesActifs, bg: '#fef3c7', c: '#92400e', icon: '📄', path: '/marches' },
          { l: 'Sites Couverts',  v: kpis.sitesActifs,   bg: '#f0fdf4', c: '#15803d', icon: '🏢', path: '/salleops' },
        ].map(k => (
          <div key={k.l} onClick={() => navigate(k.path)}
            style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{k.icon}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{k.l}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── KPIs Ligne 2 — Alertes ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { l: 'Alertes légales', v: kpis.alertesHautes, bg: kpis.alertesHautes > 0 ? '#fef3c7' : '#f0fdf4', c: kpis.alertesHautes > 0 ? '#92400e' : '#15803d', icon: '🔔', path: '/alertes' },
          { l: 'Cartes Pro <30j', v: kpis.cartesPro30,  bg: kpis.cartesPro30 > 0  ? '#fee2e2' : '#f0fdf4', c: kpis.cartesPro30 > 0  ? '#991b1b' : '#15803d', icon: '🪪', path: '/recrutement' },
          { l: 'Sans carte pro',  v: kpis.sansCartePro, bg: kpis.sansCartePro > 0 ? '#fde8ff' : '#f0fdf4', c: kpis.sansCartePro > 0 ? '#7c3aed' : '#15803d', icon: '⚠️', path: '/recrutement' },
          { l: 'CDD < 30j',       v: kpis.cdd30,        bg: kpis.cdd30 > 0        ? '#fee2e2' : '#f0fdf4', c: kpis.cdd30 > 0        ? '#991b1b' : '#15803d', icon: '📋', path: '/recrutement' },
        ].map(k => (
          <div key={k.l} onClick={() => navigate(k.path)}
            style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ fontSize: '22px', marginBottom: '6px' }}>{k.icon}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{k.l}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Grille 2 colonnes : Carte + Side panels ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start' }}>

        {/* Carte opérationnelle */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', fontWeight: '800', fontSize: '13px', color: '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🗺️ {t('kpi.live_map')}</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '400' }}>
              {kpis.agentsCarte.filter(a => a.lat && a.lng).length} agents géolocalisés
            </span>
          </div>
          <div style={{ height: '380px' }}>
            <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
              {kpis.agentsCarte.filter(a => a.lat != null && a.lng != null).map(a => (
                <Marker key={`ag-${a.id}`} position={[a.lat, a.lng]}>
                  <Popup>
                    <strong>{a.nom}</strong><br />
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{a.site_affecte}</span>
                  </Popup>
                </Marker>
              ))}
              {incidentsData.filter(inc => inc.lat != null && inc.lng != null).map(inc => (
                <Fragment key={`inc-${inc.id}`}>
                  <Circle center={[inc.lat, inc.lng]} pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.15 }} radius={500} />
                  <Marker position={[inc.lat, inc.lng]} icon={redDivIcon}>
                    <Popup><strong style={{ color: '#dc2626' }}>🚨 SOS : {inc.nom_agent}</strong></Popup>
                  </Marker>
                </Fragment>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* SOS récents */}
          <div className="card">
            <h3 style={{ margin: '0 0 12px 0', fontWeight: '900', color: '#991b1b', fontSize: '13px' }}>🚨 Derniers SOS</h3>
            {incidentsRecents.length === 0 ? (
              <p style={{ color: '#15803d', fontSize: '13px', margin: 0, fontWeight: '700' }}>✅ Réseau sécurisé</p>
            ) : incidentsRecents.map(inc => (
              <div key={inc.id} style={{ marginBottom: '8px', padding: '8px 10px', backgroundColor: '#fef2f2', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontWeight: '800', fontSize: '12px', color: '#991b1b' }}>{inc.nom_agent}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{inc.site} · {inc.heure_incident}</div>
              </div>
            ))}
          </div>

          {/* Marchés qui expirent */}
          <div className="card">
            <h3 style={{ margin: '0 0 12px 0', fontWeight: '900', color: '#92400e', fontSize: '13px' }}>📋 Marchés — Échéances proches</h3>
            {marchesExpiration.length === 0 ? (
              <p style={{ color: '#15803d', fontSize: '13px', margin: 0, fontWeight: '700' }}>✅ Aucune échéance dans 60j</p>
            ) : marchesExpiration.map(c => (
              <div key={c.id} style={{ marginBottom: '8px', padding: '8px 10px', backgroundColor: '#fffbeb', borderRadius: '8px', borderLeft: '3px solid #d97706' }}>
                <div style={{ fontWeight: '800', fontSize: '12px', color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.nom_site || c.clients?.nom_entreprise || '—'}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Expire le {dateFr(c.date_fin)} · J-{joursAvant(c.date_fin)}</div>
              </div>
            ))}
          </div>

          {/* CA estimé */}
          {kpis.caMarche > 0 && (
            <div className="card" style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.8, marginBottom: '6px' }}>CA Annuel Estimé (marchés actifs)</div>
              <div style={{ fontSize: '22px', fontWeight: '900' }}>
                {new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(kpis.caMarche)} DA
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Kpi;
