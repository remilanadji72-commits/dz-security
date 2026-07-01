import React, { useState, useMemo, useEffect } from 'react';

const LS_CAUTIONS  = 'dzsec_cautions_bancaires';
const LS_RETENUES  = 'dzsec_retenues_garantie';

const TYPES_CAUTION   = ['Soumission', 'Bonne exécution', 'Substitution'];
const STATUTS_CAUTION = ['Active', 'Libérée', 'Échue'];
const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function fmt(n) {
  if (n === '' || n === null || n === undefined || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('fr-FR') + ' DA';
}

function dateFr(d) {
  if (!d) return '—';
  const [y, m, j] = d.split('-');
  return `${j}/${m}/${y}`;
}

function statutBadge(statut) {
  const map = {
    Active:  { bg: '#dcfce7', color: '#15803d' },
    Libérée: { bg: '#dbeafe', color: '#1d4ed8' },
    Échue:   { bg: '#fee2e2', color: '#991b1b' },
  };
  return map[statut] || { bg: '#f1f5f9', color: '#475569' };
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

// ── Styles partagés ────────────────────────────────────────────────────────────
const TH = (bg = '#1e3a8a') => ({
  padding: '10px 14px',
  backgroundColor: bg,
  color: 'white',
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
  textAlign: 'left',
});
const TD = { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };
const INPUT = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const LABEL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const FORM_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' };

// ── Composant formulaire caution ───────────────────────────────────────────────
const CAUTION_VIDE = {
  nMarche: '', objet: '', typeCaution: 'Bonne exécution', banque: '', nCaution: '',
  montant: '', dateEmission: '', dateEcheance: '', dateRemiseMO: '',
  statut: 'Active', dateMainlevee: '', coutCaution: '',
};

// ── Composant formulaire retenue ───────────────────────────────────────────────
const RETENUE_VIDE = {
  nMarche: '', nDecompte: '', dateDecompte: '', montantTTC: '', restitution: '', dateRestitution: '',
};

export default function Garanties() {
  const [onglet, setOnglet] = useState('cautions');

  // ── État cautions ──────────────────────────────────────────────────────────
  const [cautions, setCautions] = useState(() => load(LS_CAUTIONS));
  const [showFrmC, setShowFrmC] = useState(false);
  const [frmC, setFrmC]         = useState(CAUTION_VIDE);

  useEffect(() => localStorage.setItem(LS_CAUTIONS, JSON.stringify(cautions)), [cautions]);

  const ajouterCaution = (e) => {
    e.preventDefault();
    setCautions(prev => [...prev, { id: Date.now(), ...frmC }]);
    setFrmC(CAUTION_VIDE);
    setShowFrmC(false);
  };

  const majStatutCaution = (id, statut) =>
    setCautions(prev => prev.map(c => c.id === id ? { ...c, statut } : c));

  const suppCaution = (id) => {
    if (!window.confirm('Supprimer cette caution ?')) return;
    setCautions(prev => prev.filter(c => c.id !== id));
  };

  // ── État retenues ──────────────────────────────────────────────────────────
  const [retenues, setRetenues] = useState(() => load(LS_RETENUES));
  const [showFrmR, setShowFrmR] = useState(false);
  const [frmR, setFrmR]         = useState(RETENUE_VIDE);

  useEffect(() => localStorage.setItem(LS_RETENUES, JSON.stringify(retenues)), [retenues]);

  const ajouterRetenue = (e) => {
    e.preventDefault();
    setRetenues(prev => [...prev, { id: Date.now(), ...frmR }]);
    setFrmR(RETENUE_VIDE);
    setShowFrmR(false);
  };

  const suppRetenue = (id) => {
    if (!window.confirm('Supprimer ce décompte ?')) return;
    setRetenues(prev => prev.filter(r => r.id !== id));
  };

  // ── Calculs retenues (cumul + solde courant) ───────────────────────────────
  const retenuesCalc = useMemo(() => {
    let cumulRetenues     = 0;
    let cumulRestitutions = 0;
    return retenues.map(r => {
      const retenue5 = (parseFloat(r.montantTTC) || 0) * 0.05;
      cumulRetenues     += retenue5;
      cumulRestitutions += parseFloat(r.restitution) || 0;
      return { ...r, retenue5, cumulRetenues, solde: cumulRetenues - cumulRestitutions };
    });
  }, [retenues]);

  const totalRetenues     = retenuesCalc.reduce((a, r) => a + r.retenue5, 0);
  const totalRestitutions = retenues.reduce((a, r) => a + (parseFloat(r.restitution) || 0), 0);
  const soldeGlobal       = totalRetenues - totalRestitutions;

  // ── Échéancier mensuel ─────────────────────────────────────────────────────
  const echeancier = useMemo(() => {
    const map = {};

    const addMonth = (dateStr) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const ensure = (k) => { if (!map[k]) map[k] = { commissions: 0, nouvellesRetenues: 0, restitutions: 0 }; };

    cautions.forEach(c => {
      const k = addMonth(c.dateEmission);
      if (k && c.coutCaution) { ensure(k); map[k].commissions += parseFloat(c.coutCaution) || 0; }
    });

    retenues.forEach(r => {
      const kD = addMonth(r.dateDecompte);
      if (kD) { ensure(kD); map[kD].nouvellesRetenues += (parseFloat(r.montantTTC) || 0) * 0.05; }
      const kR = addMonth(r.dateRestitution);
      if (kR && parseFloat(r.restitution) > 0) { ensure(kR); map[kR].restitutions += parseFloat(r.restitution) || 0; }
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [year, month] = key.split('-');
        return {
          key,
          mois: `${MOIS_FR[parseInt(month) - 1]} ${year}`,
          ...v,
          fluxNet: v.restitutions - (v.commissions + v.nouvellesRetenues),
        };
      });
  }, [cautions, retenues]);

  // ── Totaux échéancier ──────────────────────────────────────────────────────
  const totEch = echeancier.reduce((acc, r) => ({
    commissions:      acc.commissions      + r.commissions,
    nouvellesRetenues:acc.nouvellesRetenues + r.nouvellesRetenues,
    restitutions:     acc.restitutions     + r.restitutions,
    fluxNet:          acc.fluxNet          + r.fluxNet,
  }), { commissions: 0, nouvellesRetenues: 0, restitutions: 0, fluxNet: 0 });

  // ── KPI header ─────────────────────────────────────────────────────────────
  const nbActives  = cautions.filter(c => !isExpired(c.dateEcheance) && c.statut === 'Active').length;
  const nbEchues   = cautions.filter(c => isExpired(c.dateEcheance) && c.statut === 'Active').length;
  const totalMtsCautions = cautions.reduce((a, c) => a + (parseFloat(c.montant) || 0), 0);

  return (
    <div className="page-container">

      {/* ── En-tête ── */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🏦</span>
        <div>
          <h1 className="page-title">SUIVI DES GARANTIES</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Cautions bancaires · Retenues de garantie · Échéancier de trésorerie
          </p>
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Cautions actives',         value: nbActives,               icon: '✅', color: '#15803d', bg: '#dcfce7' },
          { label: 'Cautions échues',           value: nbEchues,                icon: '⚠️', color: '#b45309', bg: '#fef9c3' },
          { label: 'Montant total cautionné',   value: fmt(totalMtsCautions),   icon: '💰', color: '#1d4ed8', bg: '#dbeafe' },
          { label: 'Solde retenues à restituer',value: fmt(soldeGlobal),        icon: '🔒', color: soldeGlobal > 0 ? '#991b1b' : '#15803d', bg: soldeGlobal > 0 ? '#fee2e2' : '#dcfce7' },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${k.bg}` }}>
            <div style={{ fontSize: '22px', marginBottom: '4px' }}>{k.icon}</div>
            <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700', marginBottom: '2px' }}>{k.label}</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div className="nav-tabs">
        {[
          { key: 'cautions',   label: '🏦 Cautions Bancaires' },
          { key: 'retenues',   label: '📊 Retenues de Garantie' },
          { key: 'echeancier', label: '📅 Échéancier de Trésorerie' },
        ].map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)}
            className={`nav-tab${onglet === t.key ? ' active' : ''}`}
            style={onglet === t.key ? { backgroundColor: '#1e3a8a' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 1 — CAUTIONS BANCAIRES
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === 'cautions' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Suivi des Cautions Bancaires</h3>
              <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Pilotez les dates d'émission, d'échéance et de mainlevée.</p>
            </div>
            <button
              onClick={() => setShowFrmC(v => !v)}
              className="btn btn-sm"
              style={{ backgroundColor: '#1d4ed8', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
              {showFrmC ? '✕ Annuler' : '＋ Nouvelle caution'}
            </button>
          </div>

          {/* Formulaire ajout */}
          {showFrmC && (
            <form onSubmit={ajouterCaution} style={{ backgroundColor: '#f0f7ff', padding: '20px', borderRadius: '12px', marginBottom: '22px', border: '1px solid #bfdbfe' }}>
              <div style={FORM_GRID}>
                {[
                  { key: 'nMarche',     label: 'N° Marché',          type: 'text',   req: true },
                  { key: 'objet',       label: 'Objet',               type: 'text',   req: true },
                  { key: 'banque',      label: 'Banque',              type: 'text',   req: true },
                  { key: 'nCaution',    label: 'N° Caution',          type: 'text',   req: true },
                  { key: 'montant',     label: 'Montant (DA)',         type: 'number', req: true },
                  { key: 'dateEmission',label: "Date d'émission",      type: 'date',   req: true },
                  { key: 'dateEcheance',label: "Date d'échéance",      type: 'date' },
                  { key: 'dateRemiseMO',label: 'Date remise MO',       type: 'date' },
                  { key: 'dateMainlevee',label:'Date mainlevée',       type: 'date' },
                  { key: 'coutCaution', label: 'Coût commission (DA)', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={LABEL}>{f.label}{f.req && <span style={{ color: '#ef4444' }}> *</span>}</label>
                    <input type={f.type} required={!!f.req} value={frmC[f.key]}
                      onChange={e => setFrmC(p => ({ ...p, [f.key]: e.target.value }))} style={INPUT} />
                  </div>
                ))}
                <div>
                  <label style={LABEL}>Type de caution <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={frmC.typeCaution} onChange={e => setFrmC(p => ({ ...p, typeCaution: e.target.value }))} style={INPUT} required>
                    {TYPES_CAUTION.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Statut initial</label>
                  <select value={frmC.statut} onChange={e => setFrmC(p => ({ ...p, statut: e.target.value }))} style={INPUT}>
                    {STATUTS_CAUTION.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowFrmC(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontWeight: '600' }}>Annuler</button>
                <button type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '700', cursor: 'pointer' }}>💾 Enregistrer</button>
              </div>
            </form>
          )}

          {/* Tableau */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['N° Marché','Objet','Type','Banque','N° Caution','Montant (DA)','Émission','Échéance','Remise MO','Statut','Mainlevée','Coût commission',''].map(h => (
                    <th key={h} style={TH()}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cautions.length === 0 ? (
                  <tr><td colSpan="13" className="empty-state">Aucune caution bancaire enregistrée.</td></tr>
                ) : cautions.map(c => {
                  const echue   = isExpired(c.dateEcheance) && c.statut === 'Active';
                  const statut  = echue ? 'Échue' : c.statut;
                  const badge   = statutBadge(statut);
                  return (
                    <tr key={c.id} style={{ backgroundColor: echue ? '#fff8f8' : 'white' }}>
                      <td style={{ ...TD, fontWeight: '700', color: '#1e3a8a' }}>{c.nMarche}</td>
                      <td style={{ ...TD, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.objet}</td>
                      <td style={TD}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {c.typeCaution}
                        </span>
                      </td>
                      <td style={TD}>{c.banque}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: '12px', color: '#374151' }}>{c.nCaution}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: '700' }}>{fmt(c.montant)}</td>
                      <td style={TD}>{dateFr(c.dateEmission)}</td>
                      <td style={{ ...TD, color: echue ? '#991b1b' : 'inherit', fontWeight: echue ? '800' : 'normal' }}>
                        {dateFr(c.dateEcheance)}{echue && <span style={{ marginLeft: '4px', fontSize: '10px' }}>⚠️</span>}
                      </td>
                      <td style={TD}>{dateFr(c.dateRemiseMO)}</td>
                      <td style={TD}>
                        <select
                          value={statut}
                          onChange={e => majStatutCaution(c.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', fontWeight: '800', backgroundColor: badge.bg, color: badge.color, cursor: 'pointer' }}>
                          {STATUTS_CAUTION.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={TD}>{dateFr(c.dateMainlevee)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#6b7280' }}>{fmt(c.coutCaution)}</td>
                      <td style={TD}>
                        <button onClick={() => suppCaution(c.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {cautions.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#1e3a8a', color: 'white' }}>
                    <td colSpan="5" style={{ padding: '10px 14px', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase' }}>
                      Total — {cautions.length} caution(s)
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900', fontSize: '14px' }}>{fmt(totalMtsCautions)}</td>
                    <td colSpan="5" style={{ padding: '10px 14px' }}></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>
                      {fmt(cautions.reduce((a, c) => a + (parseFloat(c.coutCaution) || 0), 0))}
                    </td>
                    <td style={{ padding: '10px 14px' }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 2 — RETENUES DE GARANTIE
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === 'retenues' && (
        <div className="card card-green">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Suivi de la Retenue de Garantie (5%)</h3>
              <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Argent bloqué par décompte et suivi des restitutions.</p>
            </div>
            <button onClick={() => setShowFrmR(v => !v)}
              style={{ backgroundColor: '#15803d', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
              {showFrmR ? '✕ Annuler' : '＋ Nouveau décompte'}
            </button>
          </div>

          {/* Formulaire ajout */}
          {showFrmR && (
            <form onSubmit={ajouterRetenue} style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', marginBottom: '22px', border: '1px solid #bbf7d0' }}>
              <div style={FORM_GRID}>
                {[
                  { key: 'nMarche',         label: 'N° Marché',             type: 'text',   req: true, ph: 'Ex : M-2025-01' },
                  { key: 'nDecompte',       label: 'N° Décompte',           type: 'text',   req: true, ph: 'Décompte n°1' },
                  { key: 'dateDecompte',    label: 'Date décompte',          type: 'date',   req: true },
                  { key: 'montantTTC',      label: 'Montant TTC décompte (DA)', type: 'number', req: true },
                  { key: 'restitution',     label: 'Montant restitution (DA)',  type: 'number', ph: '0' },
                  { key: 'dateRestitution', label: 'Date de restitution',    type: 'date' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={LABEL}>{f.label}{f.req && <span style={{ color: '#ef4444' }}> *</span>}</label>
                    <input type={f.type} required={!!f.req} placeholder={f.ph}
                      value={frmR[f.key]}
                      onChange={e => setFrmR(p => ({ ...p, [f.key]: e.target.value }))} style={INPUT} />
                  </div>
                ))}
              </div>
              {frmR.montantTTC && (
                <div style={{ marginTop: '14px', padding: '10px 16px', backgroundColor: '#fef3c7', borderRadius: '8px', fontSize: '13px', color: '#92400e', fontWeight: '700', border: '1px solid #fcd34d' }}>
                  Retenue calculée (5%) : <span style={{ fontSize: '16px' }}>{fmt((parseFloat(frmR.montantTTC) || 0) * 0.05)}</span>
                </div>
              )}
              <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowFrmR(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer', fontWeight: '600' }}>Annuler</button>
                <button type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#15803d', color: 'white', fontWeight: '700', cursor: 'pointer' }}>💾 Enregistrer</button>
              </div>
            </form>
          )}

          {/* Légende */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '700' }}>🔴 Solde &gt; 0 : retenue non restituée</span>
            <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '700' }}>🟢 Solde = 0 : retenue restituée</span>
          </div>

          {/* Tableau */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['N° Marché','N° Décompte','Date décompte','Montant TTC (D)','Retenue 5% (E)','Cumul retenues (F)','Restitution (G)','Date restitution (H)','Solde restant dû (I)',''].map((h, i) => (
                    <th key={i} style={TH('#166534')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retenuesCalc.length === 0 ? (
                  <tr><td colSpan="10" className="empty-state">Aucun décompte enregistré.</td></tr>
                ) : retenuesCalc.map(r => {
                  const soldeCl = r.solde > 0
                    ? { backgroundColor: '#fff5f5', color: '#991b1b', fontWeight: '900' }
                    : { backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: '900' };
                  return (
                    <tr key={r.id}>
                      <td style={{ ...TD, fontWeight: '700', color: '#166534' }}>{r.nMarche}</td>
                      <td style={TD}>{r.nDecompte}</td>
                      <td style={TD}>{dateFr(r.dateDecompte)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: '700' }}>{fmt(r.montantTTC)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#dc2626', fontWeight: '700' }}>{fmt(r.retenue5)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#1d4ed8', fontWeight: '800' }}>{fmt(r.cumulRetenues)}</td>
                      <td style={{ ...TD, textAlign: 'right', color: '#15803d' }}>{r.restitution ? fmt(r.restitution) : '—'}</td>
                      <td style={TD}>{dateFr(r.dateRestitution)}</td>
                      <td style={{ ...TD, textAlign: 'right', ...soldeCl }}>{fmt(r.solde)}</td>
                      <td style={TD}>
                        <button onClick={() => suppRetenue(r.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {retenuesCalc.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#166534', color: 'white' }}>
                    <td colSpan="3" style={{ padding: '10px 14px', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase' }}>TOTAUX — {retenues.length} décompte(s)</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>{fmt(retenues.reduce((a, r) => a + (parseFloat(r.montantTTC) || 0), 0))}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalRetenues)}</td>
                    <td style={{ padding: '10px 14px' }}></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>{fmt(totalRestitutions)}</td>
                    <td style={{ padding: '10px 14px' }}></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900', color: soldeGlobal > 0 ? '#fca5a5' : '#86efac' }}>{fmt(soldeGlobal)}</td>
                    <td style={{ padding: '10px 14px' }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ONGLET 3 — ÉCHÉANCIER DE TRÉSORERIE
      ══════════════════════════════════════════════════════════════════════ */}
      {onglet === 'echeancier' && (
        <div className="card card-neutral">
          <div className="mb-20">
            <h3 className="section-title">Échéancier de Trésorerie des Garanties</h3>
            <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
              Synthèse mensuelle automatique — calculée depuis les onglets Cautions et Retenues.
            </p>
          </div>

          {echeancier.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
              Aucune donnée disponible — renseignez les cautions et décomptes dans les onglets précédents.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Mois (A)', 'Commissions payées (B)', 'Nouvelles retenues 5% (C)', 'Restitutions reçues (D)', 'Flux net de trésorerie (D−B−C)'].map((h, i) => (
                        <th key={i} style={TH('#374151')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {echeancier.map(row => {
                      const fluxPos = row.fluxNet >= 0;
                      return (
                        <tr key={row.key} style={{ backgroundColor: 'white' }}>
                          <td style={{ ...TD, fontWeight: '700', color: '#374151' }}>{row.mois}</td>
                          <td style={{ ...TD, textAlign: 'right', color: row.commissions > 0 ? '#dc2626' : '#9ca3af' }}>
                            {row.commissions > 0 ? fmt(row.commissions) : '—'}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', color: row.nouvellesRetenues > 0 ? '#dc2626' : '#9ca3af' }}>
                            {row.nouvellesRetenues > 0 ? fmt(row.nouvellesRetenues) : '—'}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', color: row.restitutions > 0 ? '#15803d' : '#9ca3af' }}>
                            {row.restitutions > 0 ? fmt(row.restitutions) : '—'}
                          </td>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: '900', color: fluxPos ? '#15803d' : '#991b1b', backgroundColor: fluxPos ? '#f0fdf4' : '#fff5f5' }}>
                            {fluxPos ? '+' : ''}{fmt(row.fluxNet)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#111827', color: 'white' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase' }}>TOTAL CUMULÉ</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700' }}>{fmt(totEch.commissions)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700' }}>{fmt(totEch.nouvellesRetenues)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700' }}>{fmt(totEch.restitutions)}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', fontSize: '15px', color: totEch.fluxNet >= 0 ? '#86efac' : '#fca5a5' }}>
                        {totEch.fluxNet >= 0 ? '+' : ''}{fmt(totEch.fluxNet)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Note de lecture */}
              <div style={{ marginTop: '20px', padding: '16px 18px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', lineHeight: '1.7' }}>
                <strong style={{ color: '#1e3a8a' }}>📌 Lecture du flux net :</strong><br />
                <span style={{ color: '#15803d', fontWeight: '700' }}>Positif (+)</span> : plus d'argent débloqué (restitutions) que de charges ce mois-ci.<br />
                <span style={{ color: '#991b1b', fontWeight: '700' }}>Négatif (−)</span> : charges (commissions bancaires + retenues prélevées) supérieures aux fonds récupérés.<br />
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Formule : Flux net = D − (B + C)</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
