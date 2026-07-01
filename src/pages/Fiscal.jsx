import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

// ── Styles helper ─────────────────────────────────────────────────────────────
const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f9fafb' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const GRID = cols => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${cols}px, 1fr))`, gap: '14px' });
const fmt = (n, dec = 0) => typeof n === 'number' ? n.toLocaleString('fr-DZ', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
const fmtDZD = n => typeof n === 'number' ? `${fmt(Math.round(n))} DA` : '—';

// ── Constantes fiscales algériennes ──────────────────────────────────────────
const TRANCHES_IRG = [
  { min: 0,        max: 240000,  taux: 0.00 },
  { min: 240001,   max: 480000,  taux: 0.23 },
  { min: 480001,   max: 960000,  taux: 0.27 },
  { min: 960001,   max: 1920000, taux: 0.30 },
  { min: 1920001,  max: Infinity,taux: 0.35 },
];

const TAUX_IBS = {
  PRODUCTION:          { taux: 0.19, label: 'Production / Fabrication' },
  BTP:                 { taux: 0.19, label: 'BTP / Bâtiment & Travaux Publics' },
  TOURISME:            { taux: 0.19, label: 'Tourisme / Hôtellerie' },
  SERVICES:            { taux: 0.23, label: 'Services / Gardiennage / Sécurité' },
  PROFESSIONS_LIBERALES:{ taux: 0.23, label: 'Professions libérales' },
  IMPORTATION:         { taux: 0.26, label: 'Importation' },
  NEGOCIATION:         { taux: 0.26, label: 'Négoce / Commerce de gros' },
};

const CATEGORIES_IMMO = {
  BATIMENT:      { label: 'Bâtiment / Construction',     dureeMin: 20, dureeMax: 50, tauxMin: 2,  tauxMax: 5  },
  INFORMATIQUE:  { label: 'Matériel informatique',        dureeMin: 3,  dureeMax: 5,  tauxMin: 20, tauxMax: 33 },
  TRANSPORT:     { label: 'Matériel de transport',        dureeMin: 4,  dureeMax: 5,  tauxMin: 20, tauxMax: 25 },
  MOBILIER:      { label: 'Mobilier & Agencements',       dureeMin: 10, dureeMax: 10, tauxMin: 10, tauxMax: 10 },
  BREVET:        { label: 'Brevets / Logiciels / Licences',dureeMin: 5, dureeMax: 7,  tauxMin: 14, tauxMax: 20 },
  AUTRE:         { label: 'Autre immobilisation',          dureeMin: 5,  dureeMax: 20, tauxMin: 5,  tauxMax: 20 },
};

// ── Moteur IRG ────────────────────────────────────────────────────────────────
function calculIRG(brut_mensuel) {
  const brut_annuel = brut_mensuel * 12;
  const cnas_annuel = brut_annuel * 0.09;
  const net_annuel  = brut_annuel - cnas_annuel;

  // Abattement 40% plafonné entre 12 000 et 18 000 DA/an
  const abattement_calcule = net_annuel * 0.40;
  const abattement = Math.min(18000, Math.max(12000, abattement_calcule));

  const imposable_annuel = net_annuel - abattement;

  let irg_annuel = 0;
  let prev_max = 0;
  for (const t of TRANCHES_IRG) {
    if (imposable_annuel > t.min - 1) {
      const base = Math.min(imposable_annuel, t.max) - t.min + 1;
      if (base > 0) irg_annuel += base * t.taux;
    }
    prev_max = t.max;
  }

  const irg_mensuel_brut = irg_annuel / 12;
  const irg_mensuel = Math.round(irg_mensuel_brut / 10) * 10; // arrondi à 10 DA

  const cnas_mensuel = Math.round(cnas_annuel / 12);
  const net_mensuel  = Math.round(net_annuel  / 12);
  const net_apayer   = brut_mensuel - cnas_mensuel - irg_mensuel;

  return {
    brut_mensuel, brut_annuel,
    cnas_mensuel, cnas_annuel,
    net_mensuel,  net_annuel,
    abattement,   imposable_annuel,
    irg_mensuel,  irg_annuel: irg_mensuel * 12,
    net_apayer,
    taux_effectif: brut_mensuel > 0 ? ((irg_mensuel / brut_mensuel) * 100).toFixed(1) : 0,
  };
}

// ── Moteur Amortissement ─────────────────────────────────────────────────────
function getCoeffDegressif(duree) {
  if (duree <= 4) return 1.25;
  if (duree <= 6) return 1.75;
  return 2.25;
}

function calculTableauAmortissement(valeur, duree, methode = 'LINEAIRE', anneeDebut = new Date().getFullYear()) {
  const taux_lin = 1 / duree;
  const coeff    = getCoeffDegressif(duree);
  const taux_deg = taux_lin * coeff;

  let vnc = valeur;
  let cumul = 0;
  const lignes = [];

  for (let i = 0; i < duree; i++) {
    const an = i + 1;
    const annees_restantes = duree - i;

    let taux_utilise, libelle_methode;
    if (methode === 'DEGRESSIF') {
      const taux_lin_restant = 1 / annees_restantes;
      if (taux_lin_restant >= taux_deg) {
        taux_utilise   = taux_lin_restant;
        libelle_methode = 'Linéaire (bascule)';
      } else {
        taux_utilise   = taux_deg;
        libelle_methode = 'Dégressif';
      }
    } else {
      taux_utilise   = taux_lin;
      libelle_methode = 'Linéaire';
    }

    const dotation = Math.round(i < duree - 1 ? vnc * taux_utilise : vnc);
    cumul = cumul + dotation;
    const vnc_fin = Math.max(0, valeur - cumul);

    lignes.push({
      annee:         anneeDebut + i,
      rang:          an,
      vnc_debut:     Math.round(vnc),
      taux_pct:      (taux_utilise * 100).toFixed(2),
      dotation,
      cumul,
      vnc_fin,
      methode_label: libelle_methode,
    });

    vnc = vnc_fin;
  }

  return lignes;
}

// ── Formulaire initial ────────────────────────────────────────────────────────
const IMMO_INIT = { designation: '', categorie: 'INFORMATIQUE', date_acquisition: new Date().toISOString().slice(0, 10), valeur_acquisition: '', duree_amortissement: 3, methode: 'LINEAIRE', notes: '' };

// ══════════════════════════════════════════════════════════════════════════════
function Fiscal() {
  const { agentsData } = useDataStore();
  const [onglet, setOnglet] = useState('dashboard');

  // ── État IRG ──────────────────────────────────────────────────────────────
  const [brutIRG,      setBrutIRG]      = useState('');
  const [agentIRG,     setAgentIRG]     = useState('');
  const resultIRG = useMemo(() => brutIRG ? calculIRG(parseFloat(brutIRG) || 0) : null, [brutIRG]);

  // ── État IBS ──────────────────────────────────────────────────────────────
  const [beneficeIBS,  setBeneficeIBS]  = useState('');
  const [secteurIBS,   setSecteurIBS]   = useState('SERVICES');
  const resultIBS = useMemo(() => {
    if (!beneficeIBS) return null;
    const b = parseFloat(beneficeIBS) || 0;
    const { taux } = TAUX_IBS[secteurIBS];
    const ibs = Math.max(10000, b * taux);
    return { benefice: b, taux: taux * 100, ibs_calcule: b * taux, ibs_du: ibs, deficit: b < 0 };
  }, [beneficeIBS, secteurIBS]);

  // ── État TVA ──────────────────────────────────────────────────────────────
  const [montantTVA,   setMontantTVA]   = useState('');
  const [tauxTVA,      setTauxTVA]      = useState('NORMAL');
  const [sensTVA,      setSensTVA]      = useState('HT_TTC');
  const resultTVA = useMemo(() => {
    if (!montantTVA) return null;
    const m = parseFloat(montantTVA) || 0;
    const t = tauxTVA === 'REDUIT' ? 0.09 : 0.19;
    if (sensTVA === 'HT_TTC') return { ht: m, tva: Math.round(m * t), ttc: Math.round(m * (1 + t)) };
    else {
      const ht  = Math.round(m / (1 + t));
      const tva = m - ht;
      return { ht, tva, ttc: m };
    }
  }, [montantTVA, tauxTVA, sensTVA]);

  // ── État Immobilisations ──────────────────────────────────────────────────
  const [immobilisations, setImmobilisations] = useState([]);
  const [showImmoForm,    setShowImmoForm]    = useState(false);
  const [immoForm,        setImmoForm]        = useState(IMMO_INIT);
  const [editImmo,        setEditImmo]        = useState(null);
  const [savingImmo,      setSavingImmo]      = useState(false);
  const [selectedImmo,    setSelectedImmo]    = useState(null);
  const setIf = (k, v) => setImmoForm(p => ({ ...p, [k]: v }));

  // ── État Déclarations ──────────────────────────────────────────────────────
  const [declarations,  setDeclarations]  = useState([]);
  const [showDeclForm,  setShowDeclForm]  = useState(false);
  const [declForm,      setDeclForm]      = useState({ type_declaration: 'G50_MENSUEL', periode: '', montant_base: '', montant_impot: '', statut: 'BROUILLON', date_depot: '', notes: '' });
  const setDf = (k, v) => setDeclForm(p => ({ ...p, [k]: v }));

  const [tableauOk, setTableauOk] = useState({ immo: true, decl: true });

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchImmo = useCallback(async () => {
    const { data, error } = await supabase.from('immobilisations').select('*').order('date_acquisition', { ascending: false });
    if (!error && data) setImmobilisations(data);
    if (error?.code === '42P01') setTableauOk(p => ({ ...p, immo: false }));
  }, []);

  const fetchDecl = useCallback(async () => {
    const { data, error } = await supabase.from('declarations_fiscales').select('*').order('periode', { ascending: false });
    if (!error && data) setDeclarations(data);
    if (error?.code === '42P01') setTableauOk(p => ({ ...p, decl: false }));
  }, []);

  useEffect(() => { fetchImmo(); fetchDecl(); }, [fetchImmo, fetchDecl]);

  // Calculé une seule fois quand agentsData change — évite 4 filtres + N×3 calculIRG par render
  const agentsAvecIRG = useMemo(() =>
    agentsData
      .filter(a => a.statut_agent === 'ACTIF' && a.salaire_brut > 0)
      .map(a => ({ ...a, _irg: calculIRG(parseFloat(a.salaire_brut)) })),
  [agentsData]);

  // ── KPIs Dashboard ────────────────────────────────────────────────────────
  const kpiDashboard = useMemo(() => {
    const agentsActifs   = agentsData.filter(a => a.statut_agent === 'ACTIF');
    const masseSalariale = agentsActifs.reduce((s, a) => s + (parseFloat(a.salaire_brut) || 0), 0);
    const irg_total      = agentsActifs.reduce((s, a) => {
      const b = parseFloat(a.salaire_brut) || 0;
      return b ? s + calculIRG(b).irg_mensuel : s;
    }, 0);
    const immoTotal      = immobilisations.reduce((s, i) => s + (parseFloat(i.valeur_acquisition) || 0), 0);
    const vnc_total      = immobilisations.reduce((s, i) => {
      const v = parseFloat(i.valeur_acquisition) || 0;
      const d = parseInt(i.duree_amortissement) || 1;
      const dateAcq = new Date(i.date_acquisition);
      const anneesEcoules = (new Date().getFullYear()) - dateAcq.getFullYear();
      const cumul = Math.min(v, v * (anneesEcoules / d));
      return s + (v - cumul);
    }, 0);
    const declEnAttente  = declarations.filter(d => d.statut === 'BROUILLON').length;
    return { masseSalariale, irg_total, immoTotal, vnc_total, nbAgents: agentsActifs.length, declEnAttente };
  }, [agentsData, immobilisations, declarations]);

  // ── Sauvegarder Immobilisation ────────────────────────────────────────────
  const sauvegarderImmo = async e => {
    e.preventDefault();
    setSavingImmo(true);
    const payload = { ...immoForm, valeur_acquisition: parseFloat(immoForm.valeur_acquisition), duree_amortissement: parseInt(immoForm.duree_amortissement) };
    if (editImmo) await supabase.from('immobilisations').update(payload).eq('id', editImmo.id);
    else          await supabase.from('immobilisations').insert([payload]);
    setSavingImmo(false); setShowImmoForm(false); setEditImmo(null); setImmoForm(IMMO_INIT);
    fetchImmo();
  };

  const supprimerImmo = async id => {
    if (!window.confirm('Supprimer cette immobilisation ?')) return;
    await supabase.from('immobilisations').delete().eq('id', id);
    if (selectedImmo?.id === id) setSelectedImmo(null);
    fetchImmo();
  };

  // ── Sauvegarder Déclaration ────────────────────────────────────────────────
  const sauvegarderDecl = async e => {
    e.preventDefault();
    const payload = { ...declForm, montant_base: parseFloat(declForm.montant_base) || null, montant_impot: parseFloat(declForm.montant_impot) || null };
    await supabase.from('declarations_fiscales').insert([payload]);
    setShowDeclForm(false); setDeclForm({ type_declaration: 'G50_MENSUEL', periode: '', montant_base: '', montant_impot: '', statut: 'BROUILLON', date_depot: '', notes: '' });
    fetchDecl();
  };

  const changeStatutDecl = async (id, statut) => {
    await supabase.from('declarations_fiscales').update({ statut }).eq('id', id);
    fetchDecl();
  };

  // ── Tableau d'amortissement de l'immobilisation sélectionnée ─────────────
  const tableauAmortissement = useMemo(() => {
    if (!selectedImmo) return [];
    return calculTableauAmortissement(
      parseFloat(selectedImmo.valeur_acquisition),
      parseInt(selectedImmo.duree_amortissement),
      selectedImmo.methode,
      new Date(selectedImmo.date_acquisition).getFullYear()
    );
  }, [selectedImmo]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🧾</span>
        <div>
          <h1 className="page-title">MODULE FISCAL — DROIT ALGÉRIEN</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>IRG · IBS · TVA · Amortissements · Déclarations — conforme législation algérienne</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="nav-tabs mb-20">
        {[
          { k: 'dashboard', l: '📊 Tableau de Bord',       bg: '#1e3a8a' },
          { k: 'irg',       l: '👔 Calculatrice IRG',       bg: '#7c3aed' },
          { k: 'ibs_tva',   l: '🏢 IBS & TVA',              bg: colors.blue },
          { k: 'immo',      l: '🏗️ Immobilisations',         bg: colors.green },
          { k: 'decl',      l: `📋 Déclarations${kpiDashboard.declEnAttente > 0 ? ` (${kpiDashboard.declEnAttente})` : ''}`, bg: '#f59e0b' },
        ].map(t => (
          <button key={t.k} onClick={() => setOnglet(t.k)} className={`nav-tab${onglet === t.k ? ' active' : ''}`}
            style={onglet === t.k ? { backgroundColor: t.bg } : {}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════════════════════════════════════════════ */}
      {onglet === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            {[
              { l: 'Agents actifs',      v: kpiDashboard.nbAgents,         bg: '#dbeafe', c: '#1d4ed8', i: '👥' },
              { l: 'Masse salariale/mois',v: fmtDZD(kpiDashboard.masseSalariale), bg: '#fde8ff', c: '#7c3aed', i: '💼' },
              { l: 'IRG collecté/mois',  v: fmtDZD(kpiDashboard.irg_total), bg: '#fee2e2', c: '#991b1b', i: '🧾' },
              { l: 'Valeur immobilisée', v: fmtDZD(kpiDashboard.immoTotal), bg: '#dcfce7', c: '#15803d', i: '🏗️' },
              { l: 'VNC total',          v: fmtDZD(kpiDashboard.vnc_total), bg: '#fef9c3', c: '#854d0e', i: '📉' },
              { l: 'Décl. en attente',   v: kpiDashboard.declEnAttente,     bg: '#fef3c7', c: '#92400e', i: '📋', click: () => setOnglet('decl') },
            ].map(k => (
              <div key={k.l} onClick={k.click}
                style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '14px', cursor: k.click ? 'pointer' : 'default' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.i}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Barème IRG de référence */}
          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#7c3aed', fontSize: '14px' }}>📐 Barème IRG annuel (Art. 104 Code des impôts directs)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Tranche annuelle', 'Taux marginal', 'Impôt marginal max', 'Impôt cumulé max'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', backgroundColor: '#7c3aed', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    { t: '0 — 240 000 DA',          taux: '0 %',  imp: '0',           cumul: '0' },
                    { t: '240 001 — 480 000 DA',     taux: '23 %', imp: '55 200 DA',   cumul: '55 200 DA' },
                    { t: '480 001 — 960 000 DA',     taux: '27 %', imp: '129 600 DA',  cumul: '184 800 DA' },
                    { t: '960 001 — 1 920 000 DA',   taux: '30 %', imp: '288 000 DA',  cumul: '472 800 DA' },
                    { t: '> 1 920 000 DA',           taux: '35 %', imp: '—',           cumul: '—' },
                  ].map((r, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#faf5ff', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 14px', fontSize: '13px', fontWeight: '700' }}>{r.t}</td>
                      <td style={{ padding: '9px 14px' }}><span style={{ padding: '2px 10px', borderRadius: '8px', backgroundColor: '#ede9fe', color: '#7c3aed', fontWeight: '800', fontSize: '12px' }}>{r.taux}</span></td>
                      <td style={{ padding: '9px 14px', fontSize: '12px', color: '#374151' }}>{r.imp}</td>
                      <td style={{ padding: '9px 14px', fontSize: '12px', color: '#374151' }}>{r.cumul}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
              CNAS salariale : 9% · Abattement : 40% du net (min 12 000 / max 18 000 DA/an) · Arrondi à 10 DA près
            </p>
          </div>
        </div>
      )}

      {/* ════════ IRG ══════════════════════════════════════════════════════ */}
      {onglet === 'irg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>

            {/* Formulaire simulateur */}
            <div className="card" style={{ border: '2px solid #ede9fe' }}>
              <h3 style={{ margin: '0 0 18px 0', fontWeight: '900', color: '#7c3aed', fontSize: '15px' }}>👔 Simulateur IRG Mensuel</h3>
              <div style={{ marginBottom: '14px' }}>
                <label style={LBL}>Choisir un agent (optionnel)</label>
                <select value={agentIRG} onChange={e => { setAgentIRG(e.target.value); const a = agentsData.find(a => a.id === parseInt(e.target.value)); if (a?.salaire_brut) setBrutIRG(a.salaire_brut); }}
                  style={INP}>
                  <option value="">— Saisie manuelle —</option>
                  {agentsData.filter(a => a.statut_agent === 'ACTIF').map(a => (
                    <option key={a.id} value={a.id}>{a.nom}{a.salaire_brut ? ` — ${fmt(a.salaire_brut)} DA` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LBL}>Salaire brut mensuel (DA) *</label>
                <input type="number" min="0" step="1000" value={brutIRG} onChange={e => { setBrutIRG(e.target.value); setAgentIRG(''); }} placeholder="Ex: 50 000" style={{ ...INP, fontSize: '18px', fontWeight: '800' }} />
              </div>
              {resultIRG && (
                <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#faf5ff', borderRadius: '10px', border: '1px solid #ddd6fe' }}>
                  <div style={{ fontSize: '11px', fontWeight: '900', color: '#7c3aed', textTransform: 'uppercase', marginBottom: '10px' }}>Détail du calcul</div>
                  {[
                    { l: 'Salaire brut mensuel',        v: fmtDZD(resultIRG.brut_mensuel),    bold: false },
                    { l: '— CNAS salariale (9%)',        v: `- ${fmtDZD(resultIRG.cnas_mensuel)}`, c: '#ef4444' },
                    { l: '= Salaire net mensuel',        v: fmtDZD(resultIRG.net_mensuel),     bold: true  },
                    { l: 'Base imposable (ann.)',         v: fmtDZD(resultIRG.imposable_annuel),bold: false },
                    { l: 'Abattement (40% cap.)',         v: fmtDZD(resultIRG.abattement),      c: '#15803d' },
                    { l: 'IRG mensuel (arrondi 10 DA)',  v: fmtDZD(resultIRG.irg_mensuel),     bold: true, c: '#991b1b' },
                    { l: '= Net à payer',                 v: fmtDZD(resultIRG.net_apayer),      bold: true, c: '#15803d', big: true },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 6 ? '1px solid #ede9fe' : 'none' }}>
                      <span style={{ fontSize: r.big ? '14px' : '12px', color: '#6b7280' }}>{r.l}</span>
                      <span style={{ fontSize: r.big ? '16px' : '13px', fontWeight: r.bold || r.big ? '900' : '600', color: r.c || '#374151' }}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#ede9fe', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700' }}>Taux effectif d'imposition</span>
                    <span style={{ fontSize: '14px', fontWeight: '900', color: '#7c3aed' }}>{resultIRG.taux_effectif} %</span>
                  </div>
                </div>
              )}
            </div>

            {/* Simulation annuelle masse salariale */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#374151', fontSize: '14px' }}>📊 IRG — Masse salariale agents actifs</h3>
              {agentsAvecIRG.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
                  <p>Aucun agent actif avec salaire renseigné.</p>
                  <p style={{ fontSize: '12px' }}>Renseignez <code>salaire_brut</code> dans la table <code>agents</code>.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: '380px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}>
                      <tr>{['Agent', 'Brut mensuel', 'CNAS', 'IRG', 'Net à payer'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', backgroundColor: '#7c3aed', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: h === 'Agent' ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {agentsAvecIRG.map((a, i) => (
                        <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#faf5ff', cursor: 'pointer' }} onClick={() => { setBrutIRG(a.salaire_brut); setOnglet('irg'); }}>
                          <td style={{ padding: '8px 10px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>{a.nom}</td>
                          <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right' }}>{fmt(a._irg.brut_mensuel)} DA</td>
                          <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right', color: '#ef4444' }}>{fmt(a._irg.cnas_mensuel)} DA</td>
                          <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right', color: '#991b1b', fontWeight: '800' }}>{fmt(a._irg.irg_mensuel)} DA</td>
                          <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right', color: '#15803d', fontWeight: '800' }}>{fmt(a._irg.net_apayer)} DA</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#ede9fe' }}>
                        <td colSpan="3" style={{ padding: '9px 10px', fontWeight: '900', fontSize: '12px', color: '#7c3aed' }}>TOTAL MENSUEL</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '900', color: '#991b1b', fontSize: '13px' }}>
                          {fmt(agentsAvecIRG.reduce((s, a) => s + a._irg.irg_mensuel, 0))} DA
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: '900', color: '#15803d', fontSize: '13px' }}>
                          {fmt(agentsAvecIRG.reduce((s, a) => s + a._irg.net_apayer, 0))} DA
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════ IBS & TVA ════════════════════════════════════════════════ */}
      {onglet === 'ibs_tva' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>

          {/* IBS */}
          <div className="card card-dark">
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '900', color: 'white', fontSize: '15px' }}>🏢 Calculatrice IBS</h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ ...LBL, color: '#d1d5db' }}>Secteur d'activité</label>
              <select value={secteurIBS} onChange={e => setSecteurIBS(e.target.value)} style={{ ...INP, backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563' }}>
                {Object.entries(TAUX_IBS).map(([k, v]) => <option key={k} value={k}>{v.label} — {(v.taux*100)}%</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ ...LBL, color: '#d1d5db' }}>Bénéfice imposable annuel (DA)</label>
              <input type="number" value={beneficeIBS} onChange={e => setBeneficeIBS(e.target.value)} placeholder="Ex: 5 000 000" style={{ ...INP, backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', fontSize: '16px', fontWeight: '800' }} />
            </div>
            {resultIBS && (
              <div style={{ backgroundColor: '#374151', borderRadius: '10px', padding: '14px' }}>
                {[
                  { l: 'Bénéfice imposable',   v: fmtDZD(resultIBS.benefice) },
                  { l: `Taux IBS (${TAUX_IBS[secteurIBS].label})`, v: `${resultIBS.taux} %` },
                  { l: 'IBS calculé',           v: fmtDZD(resultIBS.ibs_calcule) },
                  { l: 'Minimum légal',         v: '10 000 DA' },
                  { l: 'IBS dû',                v: fmtDZD(resultIBS.ibs_du), big: true },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < 4 ? '1px solid #4b5563' : 'none' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{r.l}</span>
                    <span style={{ fontSize: r.big ? '16px' : '13px', fontWeight: r.big ? '900' : '600', color: r.big ? '#fbbf24' : 'white' }}>{r.v}</span>
                  </div>
                ))}
                {resultIBS.deficit && (
                  <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fee2e2', borderRadius: '6px', fontSize: '12px', color: '#991b1b', fontWeight: '700' }}>
                    ⚠️ Déficit fiscal — IBS minimum de 10 000 DA reste dû
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TVA */}
          <div className="card" style={{ border: '2px solid #dbeafe' }}>
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '900', color: '#1d4ed8', fontSize: '15px' }}>💱 Convertisseur TVA</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={LBL}>Taux applicable</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { v: 'NORMAL', l: '19% — Taux normal', bg: '#1d4ed8' },
                  { v: 'REDUIT', l: '9% — Taux réduit', bg: '#0891b2' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setTauxTVA(opt.v)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: tauxTVA === opt.v ? opt.bg : '#f1f5f9', color: tauxTVA === opt.v ? 'white' : '#374151', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={LBL}>Sens de conversion</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[{ v: 'HT_TTC', l: 'HT → TTC' }, { v: 'TTC_HT', l: 'TTC → HT' }].map(opt => (
                  <button key={opt.v} onClick={() => setSensTVA(opt.v)}
                    style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: sensTVA === opt.v ? '#1d4ed8' : '#f1f5f9', color: sensTVA === opt.v ? 'white' : '#374151', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={LBL}>Montant {sensTVA === 'HT_TTC' ? 'HT' : 'TTC'} (DA)</label>
              <input type="number" value={montantTVA} onChange={e => setMontantTVA(e.target.value)} placeholder="Ex: 100 000" style={{ ...INP, fontSize: '16px', fontWeight: '800' }} />
            </div>
            {resultTVA && (
              <div style={{ backgroundColor: '#eff6ff', borderRadius: '10px', padding: '14px', border: '1px solid #bfdbfe' }}>
                {[
                  { l: 'Montant HT',  v: fmtDZD(resultTVA.ht),  c: '#1d4ed8', big: false },
                  { l: `TVA (${tauxTVA === 'REDUIT' ? '9' : '19'}%)`, v: fmtDZD(resultTVA.tva), c: '#9ca3af' },
                  { l: 'Montant TTC', v: fmtDZD(resultTVA.ttc), c: '#1d4ed8', big: true  },
                ].map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid #bfdbfe' : 'none' }}>
                    <span style={{ fontSize: '13px', color: '#374151' }}>{r.l}</span>
                    <span style={{ fontSize: r.big ? '18px' : '13px', fontWeight: r.big ? '900' : '600', color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ IMMOBILISATIONS ══════════════════════════════════════════ */}
      {onglet === 'immo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!tableauOk.immo && (
            <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '18px' }}>
              <p style={{ color: '#f8fafc', fontWeight: '700', marginBottom: '10px' }}>🗄️ Table <code>immobilisations</code> manquante — exécutez le SQL fourni dans l'onglet déclarations.</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{immobilisations.length} immobilisation{immobilisations.length > 1 ? 's' : ''} enregistrée{immobilisations.length > 1 ? 's' : ''}</p>
            <button onClick={() => { setEditImmo(null); setImmoForm(IMMO_INIT); setShowImmoForm(true); }}
              style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', backgroundColor: colors.green, color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
              + Nouvelle immobilisation
            </button>
          </div>

          {/* Formulaire */}
          {showImmoForm && (
            <div className="card card-green">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontWeight: '900', color: '#15803d' }}>{editImmo ? '✏️ Modifier' : '+ Nouvelle immobilisation'}</h3>
                <button onClick={() => setShowImmoForm(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#ef4444' }}>✕</button>
              </div>
              <form onSubmit={sauvegarderImmo}>
                <div style={{ ...GRID(200), marginBottom: '14px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={LBL}>Désignation *</label>
                    <input type="text" required value={immoForm.designation} onChange={e => setIf('designation', e.target.value)} placeholder="Ex: Serveur Dell PowerEdge, Véhicule Peugeot Expert…" style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Catégorie</label>
                    <select value={immoForm.categorie} onChange={e => { setIf('categorie', e.target.value); setIf('duree_amortissement', CATEGORIES_IMMO[e.target.value].dureeMin); }} style={INP}>
                      {Object.entries(CATEGORIES_IMMO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Méthode</label>
                    <select value={immoForm.methode} onChange={e => setIf('methode', e.target.value)} style={INP}>
                      <option value="LINEAIRE">Linéaire (obligatoire)</option>
                      <option value="DEGRESSIF">Dégressive (option fiscale)</option>
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Date d'acquisition</label>
                    <input type="date" value={immoForm.date_acquisition} onChange={e => setIf('date_acquisition', e.target.value)} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Valeur d'acquisition (DA) *</label>
                    <input type="number" required min="1" value={immoForm.valeur_acquisition} onChange={e => setIf('valeur_acquisition', e.target.value)} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>
                      Durée d'amortissement (ans)
                      <span style={{ marginLeft: '6px', fontWeight: '400', color: '#9ca3af' }}>
                        ({CATEGORIES_IMMO[immoForm.categorie].tauxMin}–{CATEGORIES_IMMO[immoForm.categorie].tauxMax}%)
                      </span>
                    </label>
                    <input type="number" min={CATEGORIES_IMMO[immoForm.categorie].dureeMin} max={CATEGORIES_IMMO[immoForm.categorie].dureeMax} value={immoForm.duree_amortissement} onChange={e => setIf('duree_amortissement', e.target.value)} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Notes</label>
                    <input type="text" value={immoForm.notes} onChange={e => setIf('notes', e.target.value)} style={INP} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowImmoForm(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={savingImmo} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: colors.green, color: 'white', fontWeight: '800', cursor: 'pointer' }}>
                    {savingImmo ? '⏳…' : editImmo ? '✅ Mettre à jour' : '✅ Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Liste */}
          <div style={{ overflowX: 'auto' }} className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Désignation', 'Catégorie', 'Date acq.', 'Valeur', 'Durée', 'Méthode', 'Taux', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', backgroundColor: colors.green, color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {immobilisations.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">Aucune immobilisation. Cliquez + pour commencer.</td></tr>
                ) : immobilisations.map((immo, i) => {
                  const taux = (1 / immo.duree_amortissement * 100).toFixed(1);
                  const isSelected = selectedImmo?.id === immo.id;
                  return (
                    <tr key={immo.id} style={{ backgroundColor: isSelected ? '#f0fdf4' : i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => setSelectedImmo(isSelected ? null : immo)}>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#1e3a8a', fontSize: '13px' }}>{immo.designation}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '700' }}>{CATEGORIES_IMMO[immo.categorie]?.label || immo.categorie}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{immo.date_acquisition}</td>
                      <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: '800' }}>{fmt(immo.valeur_acquisition)} DA</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center' }}>{immo.duree_amortissement} ans</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', backgroundColor: immo.methode === 'DEGRESSIF' ? '#fef9c3' : '#dbeafe', color: immo.methode === 'DEGRESSIF' ? '#854d0e' : '#1d4ed8', fontWeight: '700' }}>{immo.methode}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>{taux}%</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={e => { e.stopPropagation(); setEditImmo(immo); setImmoForm({ ...immo }); setShowImmoForm(true); }} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); supprimerImmo(immo.id); }} style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Tableau d'amortissement */}
          {selectedImmo && (
            <div className="card" style={{ border: '2px solid #86efac' }}>
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#15803d', fontSize: '14px' }}>
                📉 Tableau d'amortissement — {selectedImmo.designation}
                <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '400', color: '#6b7280' }}>
                  {fmtDZD(selectedImmo.valeur_acquisition)} · {selectedImmo.duree_amortissement} ans · {selectedImmo.methode}
                  {selectedImmo.methode === 'DEGRESSIF' && <span style={{ marginLeft: '6px', color: '#854d0e' }}>coeff ×{getCoeffDegressif(selectedImmo.duree_amortissement)}</span>}
                </span>
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Exercice', 'VNC Début', 'Taux', 'Dotation', 'Cumul Amort.', 'VNC Fin', 'Méthode'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', backgroundColor: colors.green, color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'right',
                        ...(h === 'Exercice' || h === 'Méthode' ? { textAlign: 'left' } : {}) }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {tableauAmortissement.map((l, i) => (
                      <tr key={l.annee} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4', borderBottom: '1px solid #d1fae5' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '800', color: '#15803d' }}>{l.annee}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px' }}>{fmt(l.vnc_debut)} DA</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '700' }}>{l.taux_pct} %</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '800', color: '#15803d' }}>{fmt(l.dotation)} DA</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', color: '#6b7280' }}>{fmt(l.cumul)} DA</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', fontWeight: '800', color: l.vnc_fin === 0 ? '#9ca3af' : '#374151' }}>{fmt(l.vnc_fin)} DA</td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: '#6b7280' }}>{l.methode_label}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#dcfce7' }}>
                      <td colSpan="3" style={{ padding: '9px 12px', fontWeight: '900', color: '#15803d' }}>TOTAL</td>
                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '900', color: '#15803d', fontSize: '14px' }}>{fmt(tableauAmortissement.reduce((s, l) => s + l.dotation, 0))} DA</td>
                      <td colSpan="3" style={{ padding: '9px 12px', fontSize: '11px', color: '#6b7280', textAlign: 'right' }}>= Valeur d'origine {fmtDZD(selectedImmo.valeur_acquisition)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════ DÉCLARATIONS ═════════════════════════════════════════════ */}
      {onglet === 'decl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>{declarations.length} déclaration{declarations.length > 1 ? 's' : ''} enregistrée{declarations.length > 1 ? 's' : ''}</p>
            <button onClick={() => setShowDeclForm(p => !p)}
              style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', backgroundColor: '#f59e0b', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
              + Nouvelle déclaration
            </button>
          </div>

          {showDeclForm && (
            <div className="card card-yellow">
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#92400e' }}>+ Enregistrer une déclaration</h3>
              <form onSubmit={sauvegarderDecl}>
                <div style={{ ...GRID(180), marginBottom: '14px' }}>
                  <div>
                    <label style={LBL}>Type de déclaration</label>
                    <select value={declForm.type_declaration} onChange={e => setDf('type_declaration', e.target.value)} style={INP}>
                      {['G50_MENSUEL', 'IRG_MENSUEL', 'IBS_ANNUEL', 'TVA_MENSUEL', 'TAP', 'CNAS_DAS', 'AUTRE'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Période (AAAA-MM ou AAAA)</label>
                    <input type="text" value={declForm.periode} onChange={e => setDf('periode', e.target.value)} placeholder="Ex: 2025-01 ou 2025" style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Base imposable (DA)</label>
                    <input type="number" value={declForm.montant_base} onChange={e => setDf('montant_base', e.target.value)} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Montant impôt/cotisation (DA)</label>
                    <input type="number" value={declForm.montant_impot} onChange={e => setDf('montant_impot', e.target.value)} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Statut</label>
                    <select value={declForm.statut} onChange={e => setDf('statut', e.target.value)} style={INP}>
                      <option value="BROUILLON">⏳ Brouillon</option>
                      <option value="DEPOSEE">📤 Déposée</option>
                      <option value="VALIDEE">✅ Validée / Payée</option>
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Date de dépôt</label>
                    <input type="date" value={declForm.date_depot} onChange={e => setDf('date_depot', e.target.value)} style={INP} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowDeclForm(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#f59e0b', color: 'white', fontWeight: '800', cursor: 'pointer' }}>✅ Enregistrer</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ overflowX: 'auto' }} className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Type', 'Période', 'Base imposable', 'Impôt dû', 'Statut', 'Date dépôt', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', backgroundColor: '#f59e0b', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {declarations.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">Aucune déclaration enregistrée.</td></tr>
                ) : declarations.map((d, i) => (
                  <tr key={d.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fffbeb', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '9px 12px', fontWeight: '800', color: '#92400e' }}>{d.type_declaration}</td>
                    <td style={{ padding: '9px 12px', fontWeight: '700', color: '#374151' }}>{d.periode}</td>
                    <td style={{ padding: '9px 12px', fontSize: '12px', textAlign: 'right' }}>{d.montant_base ? fmt(d.montant_base) + ' DA' : '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '13px', fontWeight: '800', color: '#92400e', textAlign: 'right' }}>{d.montant_impot ? fmt(d.montant_impot) + ' DA' : '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '10px', fontWeight: '800',
                        backgroundColor: d.statut === 'VALIDEE' ? '#dcfce7' : d.statut === 'DEPOSEE' ? '#dbeafe' : '#fef3c7',
                        color:           d.statut === 'VALIDEE' ? '#15803d' : d.statut === 'DEPOSEE' ? '#1d4ed8' : '#92400e' }}>
                        {d.statut === 'VALIDEE' ? '✅ Validée' : d.statut === 'DEPOSEE' ? '📤 Déposée' : '⏳ Brouillon'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '12px', color: '#6b7280' }}>{d.date_depot || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {d.statut === 'BROUILLON' && <button onClick={() => changeStatutDecl(d.id, 'DEPOSEE')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>📤</button>}
                        {d.statut !== 'VALIDEE' && <button onClick={() => changeStatutDecl(d.id, 'VALIDEE')} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>✅</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SQL Migration block */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontWeight: '900', fontSize: '13px' }}>🗄️ Migration SQL — Tables requises</h4>
            <pre style={{ margin: 0, backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', fontSize: '10.5px', color: '#7dd3fc', overflowX: 'auto', lineHeight: 1.65 }}>{`-- 1. Ajouter salaire_brut aux agents (si absent)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS salaire_brut NUMERIC(12,2) DEFAULT 0;

-- 2. Table immobilisations
CREATE TABLE IF NOT EXISTS immobilisations (
  id                  SERIAL PRIMARY KEY,
  designation         TEXT    NOT NULL,
  categorie           TEXT    DEFAULT 'AUTRE',
  date_acquisition    DATE    NOT NULL,
  valeur_acquisition  NUMERIC(15,2) NOT NULL,
  duree_amortissement INTEGER NOT NULL,
  methode             TEXT    DEFAULT 'LINEAIRE',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table déclarations fiscales
CREATE TABLE IF NOT EXISTS declarations_fiscales (
  id               SERIAL PRIMARY KEY,
  type_declaration TEXT    NOT NULL,
  periode          TEXT    NOT NULL,
  montant_base     NUMERIC(15,2),
  montant_impot    NUMERIC(15,2),
  statut           TEXT    DEFAULT 'BROUILLON',
  date_depot       DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Activer Realtime (optionnel)
ALTER TABLE immobilisations    REPLICA IDENTITY FULL;
ALTER TABLE declarations_fiscales REPLICA IDENTITY FULL;`}</pre>
            <button onClick={() => navigator.clipboard?.writeText('voir ci-dessus')}
              style={{ marginTop: '10px', padding: '7px 14px', borderRadius: '7px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
              📋 Copier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Fiscal;
