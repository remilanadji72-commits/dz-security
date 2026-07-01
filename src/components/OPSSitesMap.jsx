import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';

// ── Fix Leaflet default icon (Vite build) ────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
});

// ── Custom DivIcon factory ────────────────────────────────────────────────────
function mkIcon(bg, border, emoji, size = 36) {
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:3px solid ${border};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.44)}px;box-shadow:0 3px 10px rgba(0,0,0,0.35);cursor:pointer;">${emoji}</div>`,
    className: '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 6],
  });
}

const ICONS = {
  SIEGE:       mkIcon('#fbbf24', '#92400e', '🏢', 44),
  SITE_CLIENT: mkIcon('#3b82f6', '#1d4ed8', '📍', 36),
  DEPOT:       mkIcon('#10b981', '#065f46', '📦', 36),
  EN_COURS:    mkIcon('#f97316', '#c2410c', '🚧', 36),
  INACTIF:     mkIcon('#9ca3af', '#6b7280', '📍', 30),
};

function getIcon(site) {
  if (site.type === 'SIEGE') return ICONS.SIEGE;
  if (site.type === 'DEPOT') return ICONS.DEPOT;
  if (site.statut === 'INACTIF') return ICONS.INACTIF;
  if (site.statut === 'EN_COURS') return ICONS.EN_COURS;
  return ICONS.SITE_CLIENT;
}

function getCircleStyle(site) {
  const c = site.type === 'SIEGE' ? '#fbbf24'
    : site.statut === 'INACTIF'   ? '#9ca3af'
    : site.statut === 'EN_COURS'  ? '#f97316'
    : '#3b82f6';
  return { color: c, fillColor: c, fillOpacity: 0.10, weight: 2, dashArray: site.type === 'SIEGE' ? null : '8 5' };
}

// ── FitBounds — runs inside MapContainer ────────────────────────────────────
function FitBounds({ coords }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || coords.length === 0) return;
    try {
      map.fitBounds(L.latLngBounds(coords).pad(0.35));
      done.current = true;
    } catch { /* ignore */ }
  }, [coords, map]);
  return null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ALGIERS = [36.7538, 3.0588];
const FORM0 = { nom: '', type: 'SITE_CLIENT', adresse: '', latitude: '', longitude: '', statut: 'ACTIF', telephone: '', responsable: '', rayon_metres: 500, notes: '' };
const INP = { padding: '8px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f9fafb' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' };

// ══════════════════════════════════════════════════════════════════════════════
export default function OPSSitesMap({ roleAdmin = 'GERANT' }) {
  const [sites,       setSites]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tableOk,     setTableOk]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [editSite,    setEditSite]    = useState(null);
  const [form,        setForm]        = useState(FORM0);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [saving,      setSaving]      = useState(false);
  const [coverage,    setCoverage]    = useState(true);
  const [filterSt,    setFilterSt]    = useState('ACTIF');
  const [liveLabel,   setLiveLabel]   = useState('LIVE');

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchSites = useCallback(async () => {
    const { data, error } = await supabase.from('sites').select('*').order('type').order('nom');
    if (error) {
      if (error.code === '42P01') setTableOk(false); // table doesn't exist yet
      setLoading(false); return;
    }
    if (data) { setSites(data); setTableOk(true); }
    setLoading(false);
    setLiveLabel('LIVE · ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    fetchSites();
    const ch = supabase.channel('ops-sites-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, () => { fetchSites(); })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchSites]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const displayed = filterSt === 'ALL'
    ? sites
    : sites.filter(s => s.type === 'SIEGE' || s.statut === filterSt);

  const gpsCoords = displayed
    .filter(s => s.latitude && s.longitude)
    .map(s => [parseFloat(s.latitude), parseFloat(s.longitude)]);

  const siege      = sites.find(s => s.type === 'SIEGE');
  const actifCount = sites.filter(s => s.statut === 'ACTIF' && s.type !== 'SIEGE').length;
  const noGPS      = sites.filter(s => !s.latitude || !s.longitude);
  const canEdit    = roleAdmin === 'GERANT' || roleAdmin === 'OPERATIONS';

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openAdd  = () => { setEditSite(null); setForm(FORM0); setShowForm(true); };
  const openEdit = s  => { setEditSite(s); setForm({ ...FORM0, ...s }); setShowForm(true); };

  const sauvegarder = async e => {
    e.preventDefault();
    if (!form.nom.trim()) return;
    setSaving(true);
    const payload = {
      nom: form.nom.trim(), type: form.type, adresse: form.adresse, statut: form.statut,
      telephone: form.telephone, responsable: form.responsable, notes: form.notes,
      latitude:      parseFloat(form.latitude)     || null,
      longitude:     parseFloat(form.longitude)    || null,
      rayon_metres:  parseInt(form.rayon_metres)   || 500,
    };
    if (editSite) { await supabase.from('sites').update(payload).eq('id', editSite.id); }
    else          { await supabase.from('sites').insert([payload]); }
    setSaving(false); setShowForm(false); fetchSites();
  };

  const supprimer = async id => {
    if (!window.confirm('Supprimer ce site définitivement ?')) return;
    await supabase.from('sites').delete().eq('id', id);
    fetchSites();
  };

  const geoloc = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setF('latitude', pos.coords.latitude.toFixed(6)); setF('longitude', pos.coords.longitude.toFixed(6)); },
      () => alert('Géolocalisation refusée ou non disponible.')
    );
  };

  // ── Table missing ─────────────────────────────────────────────────────────
  if (!tableOk) return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '14px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#f8fafc', fontWeight: '900' }}>🗄️ Table <code>sites</code> manquante</h3>
      <p style={{ color: '#94a3b8', margin: '0 0 14px 0', fontSize: '13px' }}>Exécutez ce SQL dans <strong>Supabase → SQL Editor</strong> pour créer la table :</p>
      <pre style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '10px', color: '#7dd3fc', fontSize: '11.5px', overflowX: 'auto', lineHeight: 1.7, margin: 0 }}>{`CREATE TABLE sites (
  id              SERIAL PRIMARY KEY,
  nom             TEXT NOT NULL,
  adresse         TEXT,
  latitude        NUMERIC(10, 6),
  longitude       NUMERIC(10, 6),
  type            TEXT DEFAULT 'SITE_CLIENT',
  statut          TEXT DEFAULT 'ACTIF',
  telephone       TEXT,
  responsable     TEXT,
  rayon_metres    INTEGER DEFAULT 500,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index spatial (optionnel, performances)
CREATE INDEX idx_sites_statut ON sites(statut);

-- Activer Realtime
ALTER TABLE sites REPLICA IDENTITY FULL;`}</pre>
      <button onClick={fetchSites} style={{ marginTop: '14px', padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
        🔄 Réessayer
      </button>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0, fontWeight: '900', color: '#1e3a8a', fontSize: '15px' }}>🗺️ Carte Interactive des Sites</h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
            {actifCount} site{actifCount > 1 ? 's' : ''} actif{actifCount > 1 ? 's' : ''} ·{' '}
            {siege ? '🏢 Siège défini' : '⚠️ Siège non défini'} ·{' '}
            <span style={{ color: '#10b981', fontWeight: '800' }}>🔴 {liveLabel}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: '#374151' }}>
            <input type="checkbox" checked={coverage} onChange={e => setCoverage(e.target.checked)} />
            Zones de couverture
          </label>
          <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px', fontWeight: '700', backgroundColor: 'white' }}>
            <option value="ACTIF">Actifs seulement</option>
            <option value="EN_COURS">En cours</option>
            <option value="INACTIF">Inactifs</option>
            <option value="ALL">Tous</option>
          </select>
          {canEdit && (
            <button onClick={openAdd}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}>
              + Ajouter site
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ borderRadius: '14px', overflow: 'hidden', border: '2px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, borderRadius: '14px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗺️</div>
              <p style={{ margin: 0, fontWeight: '700', color: '#6b7280' }}>Chargement de la carte…</p>
            </div>
          </div>
        )}

        <MapContainer
          center={gpsCoords.length > 0 ? gpsCoords[0] : ALGIERS}
          zoom={12}
          style={{ height: '490px', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />

          {gpsCoords.length > 1 && <FitBounds coords={gpsCoords} />}

          {displayed.map(site => {
            if (!site.latitude || !site.longitude) return null;
            const pos = [parseFloat(site.latitude), parseFloat(site.longitude)];
            return (
              <React.Fragment key={site.id}>
                {coverage && site.statut !== 'INACTIF' && (
                  <Circle
                    center={pos}
                    radius={site.rayon_metres || 500}
                    pathOptions={getCircleStyle(site)}
                  />
                )}
                <Marker position={pos} icon={getIcon(site)}>
                  <Popup maxWidth={270} minWidth={200}>
                    <div style={{ padding: '4px 2px', fontFamily: 'system-ui, sans-serif' }}>
                      {/* Titre */}
                      <div style={{ fontWeight: '900', fontSize: '14px', color: '#1e3a8a', marginBottom: '8px', lineHeight: 1.3 }}>
                        {site.type === 'SIEGE' ? '🏢' : site.type === 'DEPOT' ? '📦' : '📍'} {site.nom}
                      </div>
                      {/* Badge statut */}
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: '800', marginBottom: '10px',
                        backgroundColor: site.statut === 'ACTIF' ? '#dcfce7' : site.statut === 'EN_COURS' ? '#fef9c3' : '#f3f4f6',
                        color:           site.statut === 'ACTIF' ? '#15803d' : site.statut === 'EN_COURS' ? '#854d0e' : '#6b7280' }}>
                        {site.statut}
                      </span>
                      {/* Infos */}
                      {site.adresse    && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>📌 {site.adresse}</div>}
                      {site.responsable&& <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>👤 {site.responsable}</div>}
                      {site.telephone  && <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>📞 <a href={`tel:${site.telephone}`} style={{ color: '#1d4ed8' }}>{site.telephone}</a></div>}
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>⭕ Rayon : {site.rayon_metres || 500} m</div>
                      {site.notes && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                          {site.notes}
                        </div>
                      )}
                      {/* Actions admin */}
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                          <button onClick={() => openEdit(site)}
                            style={{ flex: 1, padding: '6px', borderRadius: '7px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                            ✏️ Modifier
                          </button>
                          <button onClick={() => supprimer(site.id)}
                            style={{ padding: '6px 10px', borderRadius: '7px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Légende (absolute, sur la carte) */}
        <div style={{
          position: 'absolute', bottom: '20px', left: '16px', zIndex: 1000,
          backgroundColor: 'white', borderRadius: '10px', padding: '10px 14px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Légende</div>
          {[
            { label: 'Siège social',   bg: '#fbbf24', b: '#92400e', emoji: '🏢' },
            { label: 'Site actif',     bg: '#3b82f6', b: '#1d4ed8', emoji: '📍' },
            { label: 'En cours / démarrage', bg: '#f97316', b: '#c2410c', emoji: '🚧' },
            { label: 'Site inactif',   bg: '#9ca3af', b: '#6b7280', emoji: '📍' },
            { label: 'Dépôt / Base',   bg: '#10b981', b: '#065f46', emoji: '📦' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', fontSize: '12px', color: '#374151' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: l.bg, border: `2px solid ${l.b}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                {l.emoji}
              </div>
              {l.label}
            </div>
          ))}
          {coverage && (
            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
              ⭕ Zone de couverture
            </div>
          )}
        </div>
      </div>

      {/* Avertissement GPS manquants */}
      {noGPS.length > 0 && (
        <div style={{ padding: '10px 16px', backgroundColor: '#fef9c3', borderRadius: '10px', border: '1px solid #fcd34d', fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
          ⚠️ <strong>{noGPS.length} site{noGPS.length > 1 ? 's' : ''}</strong> sans coordonnées GPS (non affichés sur la carte) :{' '}
          {noGPS.map(s => s.nom).join(', ')}. Cliquez ✏️ pour compléter.
        </div>
      )}

      {/* Tableau des sites */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Site / Adresse', 'Type', 'Statut', 'Responsable', 'Téléphone', 'Rayon', 'GPS', canEdit ? 'Actions' : ''].filter(Boolean).map(h => (
                <th key={h} style={{ padding: '10px 14px', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.length === 0 ? (
              <tr><td colSpan={canEdit ? 8 : 7} style={{ textAlign: 'center', padding: '36px', color: '#9ca3af', fontSize: '13px' }}>
                Aucun site enregistré. Cliquez <strong>+ Ajouter site</strong> pour commencer.
              </td></tr>
            ) : sites.map((s, i) => (
              <tr key={s.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '13px' }}>{s.nom}</div>
                  {s.adresse && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.adresse}</div>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '8px', fontWeight: '700',
                    backgroundColor: s.type === 'SIEGE' ? '#fef9c3' : s.type === 'DEPOT' ? '#dcfce7' : '#dbeafe',
                    color:           s.type === 'SIEGE' ? '#854d0e' : s.type === 'DEPOT' ? '#15803d' : '#1d4ed8' }}>
                    {s.type === 'SIEGE' ? '🏢 Siège' : s.type === 'DEPOT' ? '📦 Dépôt' : '📍 Client'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '8px', fontWeight: '700',
                    backgroundColor: s.statut === 'ACTIF' ? '#dcfce7' : s.statut === 'EN_COURS' ? '#fef9c3' : '#f3f4f6',
                    color:           s.statut === 'ACTIF' ? '#15803d' : s.statut === 'EN_COURS' ? '#854d0e' : '#6b7280' }}>
                    {s.statut}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: '12px', color: '#374151' }}>{s.responsable || '—'}</td>
                <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                  {s.telephone ? <a href={`tel:${s.telephone}`} style={{ color: '#1d4ed8', fontWeight: '700', textDecoration: 'none' }}>{s.telephone}</a> : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280' }}>{(s.rayon_metres || 500).toLocaleString('fr-FR')} m</td>
                <td style={{ padding: '10px 14px' }}>
                  {s.latitude && s.longitude
                    ? <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '700' }}>✅ {parseFloat(s.latitude).toFixed(4)}, {parseFloat(s.longitude).toFixed(4)}</span>
                    : <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>⚠️ Manquant</span>}
                </td>
                {canEdit && (
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(s)}
                        style={{ padding: '6px 11px', borderRadius: '7px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => supprimer(s.id)}
                        style={{ padding: '6px 11px', borderRadius: '7px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal Formulaire ──────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '28px', width: '100%', maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <h3 style={{ margin: 0, fontWeight: '900', color: '#1e3a8a', fontSize: '16px' }}>
                {editSite ? '✏️ Modifier le site' : '🗺️ Ajouter un site'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#ef4444', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={sauvegarder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

                {/* Nom */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LBL}>Nom du site *</label>
                  <input type="text" required value={form.nom} onChange={e => setF('nom', e.target.value)} placeholder="Ex: Banque BNA — Alger Centre" style={INP} />
                </div>

                {/* Type / Statut */}
                <div>
                  <label style={LBL}>Type de site</label>
                  <select value={form.type} onChange={e => setF('type', e.target.value)} style={INP}>
                    <option value="SITE_CLIENT">📍 Site client</option>
                    <option value="SIEGE">🏢 Siège social</option>
                    <option value="DEPOT">📦 Dépôt / Base logistique</option>
                  </select>
                </div>
                <div>
                  <label style={LBL}>Statut opérationnel</label>
                  <select value={form.statut} onChange={e => setF('statut', e.target.value)} style={INP}>
                    <option value="ACTIF">✅ ACTIF</option>
                    <option value="EN_COURS">🚧 EN COURS (démarrage)</option>
                    <option value="INACTIF">⛔ INACTIF</option>
                  </select>
                </div>

                {/* Adresse */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LBL}>Adresse complète</label>
                  <input type="text" value={form.adresse} onChange={e => setF('adresse', e.target.value)} placeholder="Rue, Cité, Code postal, Wilaya" style={INP} />
                </div>

                {/* Responsable / Téléphone */}
                <div>
                  <label style={LBL}>Responsable / Chef de site</label>
                  <input type="text" value={form.responsable} onChange={e => setF('responsable', e.target.value)} placeholder="Nom et prénom" style={INP} />
                </div>
                <div>
                  <label style={LBL}>Téléphone</label>
                  <input type="text" value={form.telephone} onChange={e => setF('telephone', e.target.value)} placeholder="0XXX XX XX XX" style={INP} />
                </div>

                {/* GPS */}
                <div>
                  <label style={LBL}>Latitude</label>
                  <input type="number" step="0.000001" value={form.latitude} onChange={e => setF('latitude', e.target.value)} placeholder="36.753800" style={INP} />
                </div>
                <div>
                  <label style={LBL}>Longitude</label>
                  <input type="number" step="0.000001" value={form.longitude} onChange={e => setF('longitude', e.target.value)} placeholder="3.058800" style={INP} />
                </div>

                {/* Bouton géoloc + aide */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={geoloc}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                    📡 Utiliser ma position GPS
                  </button>
                  <span style={{ fontSize: '11px', color: '#9ca3af', flex: 1 }}>
                    Ou Google Maps → clic droit → "Plus d'infos" → coordonnées
                  </span>
                </div>

                {/* Rayon */}
                <div>
                  <label style={LBL}>Rayon de couverture (mètres)</label>
                  <input type="number" min="50" max="50000" step="50" value={form.rayon_metres} onChange={e => setF('rayon_metres', e.target.value)} style={INP} />
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px' }}>Cercle affiché sur la carte</div>
                </div>

                {/* Notes */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LBL}>Notes / Informations complémentaires</label>
                  <textarea rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Accès, horaires, spécificités…" style={{ ...INP, resize: 'vertical' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '900', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⏳ Enregistrement…' : editSite ? '✅ Mettre à jour' : '✅ Ajouter le site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
