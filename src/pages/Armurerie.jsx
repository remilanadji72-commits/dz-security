import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';
import { exportToExcel, generateTemplate, importFromExcel, buildReport, upsertRows } from '../utils/excelUtils';
import { toast } from '../store/useToastStore';
import ImportPreviewModal from '../components/ImportPreviewModal';

// ── Référentiels ───────────────────────────────────────────────────────────────
const TYPES_ARME    = ['Pistolet', 'Pistolet Mitrailleur', 'Fusil d\'Assaut', 'Fusil de Chasse', 'Carabine', 'Mitraillette'];
const STATUTS_ARME  = ['AU_COFFRE', 'AFFECTEE', 'MAINTENANCE'];
const TYPES_RADIO   = ['UHF', 'VHF', 'PMR', 'TETRA'];
const ETATS_BATT    = ['BON', 'FAIBLE', 'HORS_SERVICE'];
const STATUTS_RADIO = ['DISPONIBLE', 'AFFECTEE', 'MAINTENANCE', 'HORS_SERVICE'];
const TYPES_MAINT   = ['NETTOYAGE', 'RÉVISION', 'RÉPARATION'];
const STATUTS_ACH   = ['PLANIFIE', 'EN_TRANSIT', 'ARRIVE', 'ANNULE'];
const SITES         = ['BNA Alger', 'MIDY Béjaïa', 'Direction Alger', 'Siège', 'Antenne Oran', 'Antenne Constantine'];

// ── Business rules ─────────────────────────────────────────────────────────────
function delaiNettoyage(typeArme) {
  const t = (typeArme || '').toUpperCase();
  return (t.includes('FUSIL') || t.includes('CARABINE') || t.includes('MITRAILLETTE')) ? 90 : 30;
}

function categorieArme(typeArme) {
  const t = (typeArme || '').toUpperCase();
  return t.includes('PISTOLET') ? 'pistolet' : 'long';
}

function joursDepuisNettoyage(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function nettoyageOk(arme) {
  return joursDepuisNettoyage(arme.date_dernier_nettoyage) <= delaiNettoyage(arme.type_arme);
}

function alerteNettoyage(arme) {
  const j = joursDepuisNettoyage(arme.date_dernier_nettoyage);
  const delai = delaiNettoyage(arme.type_arme);
  const reste = delai - j;
  if (j === Infinity) return { bg: '#fee2e2', c: '#991b1b', label: 'Jamais nettoyée', icon: '🚨', level: 3 };
  if (reste < 0)      return { bg: '#fee2e2', c: '#991b1b', label: `Retard ${Math.abs(reste)}j`, icon: '🚨', level: 3 };
  if (reste <= 7)     return { bg: '#fee2e2', c: '#b91c1c', label: `${reste}j restants`, icon: '🔴', level: 2 };
  if (reste <= 15)    return { bg: '#fef9c3', c: '#854d0e', label: `${reste}j restants`, icon: '🟡', level: 1 };
  return                     { bg: '#dcfce7', c: '#15803d', label: `OK (${j}j/${delai}j)`, icon: '✅', level: 0 };
}

function alerteControleRadio(dateStr) {
  if (!dateStr) return { bg: '#fee2e2', c: '#991b1b', label: 'Jamais contrôlée', icon: '🚨', level: 3 };
  const j = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  const reste = 90 - j;
  if (reste < 0)   return { bg: '#fee2e2', c: '#991b1b', label: `Retard ${Math.abs(reste)}j`, icon: '🚨', level: 3 };
  if (reste <= 10) return { bg: '#fef9c3', c: '#854d0e', label: `${reste}j restants`,        icon: '🟡', level: 1 };
  return                  { bg: '#dcfce7', c: '#15803d', label: `OK (J+${j})`,                icon: '✅', level: 0 };
}

// ── Générateur de matricule séquentiel ────────────────────────────────────────
async function genMatricule(table, field, prefix) {
  const yr  = new Date().getFullYear();
  const pfx = `${prefix}-${yr}-`;
  const { data } = await supabase.from(table).select(field).ilike(field, `${pfx}%`).not(field, 'is', null).order(field, { ascending: false }).limit(1);
  const last = data?.length ? parseInt(data[0][field].split('-')[2]) || 0 : 0;
  return `${pfx}${String(last + 1).padStart(3, '0')}`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const TH = (bg = '#1e3a8a') => ({ padding: '10px 14px', backgroundColor: bg, color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', textAlign: 'left' });
const TD = { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const G   = (min = 160) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: '14px' });
const PNL = { backgroundColor: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '18px' };
const BTN_P = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' };
const BTN_R = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' };
const BTN_G = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#15803d', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' };
const BTN_V = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' };

const BADGE_A = { 'AU_COFFRE': { bg: '#dbeafe', c: '#1d4ed8', i: '🔒' }, 'AFFECTEE': { bg: '#dcfce7', c: '#15803d', i: '🎯' }, 'MAINTENANCE': { bg: '#fef9c3', c: '#854d0e', i: '🔧' } };
const BADGE_R = { 'DISPONIBLE': { bg: '#dbeafe', c: '#1d4ed8', i: '📻' }, 'AFFECTEE': { bg: '#dcfce7', c: '#15803d', i: '🎯' }, 'MAINTENANCE': { bg: '#fef9c3', c: '#854d0e', i: '🔧' }, 'HORS_SERVICE': { bg: '#f1f5f9', c: '#6b7280', i: '⛔' } };
const BADGE_ACH = { 'PLANIFIE': { bg: '#dbeafe', c: '#1d4ed8', i: '📋' }, 'EN_TRANSIT': { bg: '#fef9c3', c: '#854d0e', i: '🚚' }, 'ARRIVE': { bg: '#dcfce7', c: '#15803d', i: '✅' }, 'ANNULE': { bg: '#f1f5f9', c: '#6b7280', i: '✕' } };
const BADGE_BATT = { 'BON': { bg: '#dcfce7', c: '#15803d', i: '🔋' }, 'FAIBLE': { bg: '#fef9c3', c: '#854d0e', i: '🪫' }, 'HORS_SERVICE': { bg: '#fee2e2', c: '#991b1b', i: '❌' } };

// ── Valeurs initiales ──────────────────────────────────────────────────────────
const A_VIDE    = { matricule: '', serie_arme: '', type_arme: 'Pistolet', coffre_site: 'Siège', date_acquisition: '', date_dernier_nettoyage: '', notes: '' };
const R_VIDE    = { matricule: '', type_radio: 'UHF', marque_modele: '', canal: '', etat_batterie: 'BON', date_dernier_controle: '', site_actuel: 'Siège', statut: 'DISPONIBLE', notes: '' };
const M_VIDE    = { arme_id: '', radio_id: '', type_maintenance: 'NETTOYAGE', date_maintenance: '', technicien: '', pieces_remplacees: '', notes: '' };
const ACH_VIDE  = { reference: '', type_colis: 'ARME', arme_id: '', radio_id: '', site_depart: 'Siège', site_destination: 'BNA Alger', statut: 'PLANIFIE', date_depart: '', date_arrivee_prevue: '', transporteur: '', escorte: '', notes: '' };

const dateFr  = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const dateAuj = () => new Date().toISOString().split('T')[0];

// ══════════════════════════════════════════════════════════════════════════════
function Armurerie() {
  const { armesData, agentsData, fetchToutesLesDonnees, _cachedUserId } = useDataStore();

  const [sousMenu,     setSousMenu]     = useState('verification');
  const [loading,      setLoading]      = useState(false);
  const [radios,       setRadios]       = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [acheminements,setAcheminements]= useState([]);

  const [showFrmArme, setShowFrmArme] = useState(false);
  const [showFrmRadio,setShowFrmRadio]= useState(false);
  const [showFrmMaint,setShowFrmMaint]= useState(false);
  const [showFrmAch,  setShowFrmAch]  = useState(false);
  const [frmArme, setFrmArme]   = useState(A_VIDE);
  const [frmRadio,setFrmRadio]  = useState(R_VIDE);
  const [frmMaint,setFrmMaint]  = useState(M_VIDE);
  const [frmAch,  setFrmAch]    = useState(ACH_VIDE);

  // Déploiement
  const [scanInput,   setScanInput]    = useState('');
  const [scanResultat,setScanResultat] = useState(null);
  const [armeDepId,   setArmeDepId]    = useState('');
  const [agentDepId,  setAgentDepId]   = useState('');

  // Filtres
  const [recherche,    setRecherche]    = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreAlerte, setFiltreAlerte] = useState('');
  const [importing,     setImporting]     = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchRadios       = async () => { const { data } = await supabase.from('radios_uhf').select('*, agents(nom, matricule)').order('id', { ascending: false }); if (data) setRadios(data); };
  const fetchMaintenances = async () => { const { data } = await supabase.from('maintenances_armes').select('*, armes(matricule, serie_arme, type_arme), radios_uhf(matricule, type_radio)').order('created_at', { ascending: false }); if (data) setMaintenances(data); };
  const fetchAcheminements= async () => { const { data } = await supabase.from('acheminements_armes').select('*, armes(matricule, type_arme), radios_uhf(matricule, type_radio)').order('id', { ascending: false }); if (data) setAcheminements(data); };

  useEffect(() => { fetchRadios(); fetchMaintenances(); fetchAcheminements(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI ───────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    totalArmes:  armesData.length,
    auCoffre:    armesData.filter(a => a.statut === 'AU_COFFRE').length,
    affectees:   armesData.filter(a => a.statut === 'AFFECTEE').length,
    maintenance: armesData.filter(a => a.statut === 'MAINTENANCE').length,
    alertesNett: armesData.filter(a => alerteNettoyage(a).level >= 2).length,
    totalRadios: radios.length,
    radiosDisp:  radios.filter(r => r.statut === 'DISPONIBLE').length,
    alertesUHF:  radios.filter(r => alerteControleRadio(r.date_dernier_controle).level >= 1).length,
  }), [armesData, radios]);

  const armesFiltre = useMemo(() => armesData.filter(a => {
    if (filtreStatut && a.statut !== filtreStatut) return false;
    if (filtreAlerte === 'oui' && alerteNettoyage(a).level < 2) return false;
    if (recherche) {
      const q = recherche.toLowerCase();
      return (a.matricule || a.serie_arme || '').toLowerCase().includes(q)
          || (a.type_arme || '').toLowerCase().includes(q)
          || (a.agents?.nom || '').toLowerCase().includes(q)
          || (a.coffre_site || '').toLowerCase().includes(q);
    }
    return true;
  }), [armesData, filtreStatut, filtreAlerte, recherche]);

  const armesAlerte = useMemo(() =>
    [...armesData].filter(a => alerteNettoyage(a).level >= 1)
      .sort((a, b) => joursDepuisNettoyage(b.date_dernier_nettoyage) - joursDepuisNettoyage(a.date_dernier_nettoyage)),
    [armesData]);

  // ── Actions Armes ─────────────────────────────────────────────────────────
  const ajouterArme = async (e) => {
    e.preventDefault();
    setLoading(true);
    const matricule = frmArme.matricule || await genMatricule('armes', 'matricule', 'ARM');
    const { error } = await supabase.from('armes').insert([{
      matricule, serie_arme: frmArme.serie_arme, type_arme: frmArme.type_arme,
      coffre_site: frmArme.coffre_site, statut: 'AU_COFFRE',
      date_acquisition: frmArme.date_acquisition || null,
      date_dernier_nettoyage: frmArme.date_dernier_nettoyage || null,
      notes: frmArme.notes || null,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmArme(A_VIDE); setShowFrmArme(false); await fetchToutesLesDonnees(_cachedUserId); }
    setLoading(false);
  };

  const deployerArme = async (e) => {
    e.preventDefault();
    if (!armeDepId || !agentDepId) return;
    const arme = armesData.find(a => a.id === parseInt(armeDepId));
    const agentId = parseInt(agentDepId);
    if (!arme) return;
    if (!nettoyageOk(arme)) {
      alert(`❌ Déploiement bloqué — nettoyage en retard pour ${arme.matricule || arme.serie_arme}.\nEffectuez un nettoyage avant toute affectation.`);
      return;
    }
    const armesAgent = armesData.filter(a => a.agent_id === agentId && a.statut === 'AFFECTEE');
    const cat = categorieArme(arme.type_arme);
    if (cat === 'pistolet' && armesAgent.some(a => categorieArme(a.type_arme) === 'pistolet')) {
      alert('❌ Cet agent porte déjà une arme de poing en dotation.'); return;
    }
    if (cat === 'long' && armesAgent.some(a => categorieArme(a.type_arme) === 'long')) {
      alert('❌ Cet agent porte déjà une arme longue en dotation.'); return;
    }
    setLoading(true);
    const { error } = await supabase.from('armes').update({ statut: 'AFFECTEE', agent_id: agentId }).eq('id', arme.id);
    if (!error) {
      await supabase.from('attributions_armes').insert([{ arme_id: arme.id, agent_id: agentId, statut: 'ACTIVE', confirmation_agent: false }]);
      setArmeDepId(''); setAgentDepId('');
      await fetchToutesLesDonnees(_cachedUserId);
    } else alert('Erreur : ' + error.message);
    setLoading(false);
  };

  const restituerArme = async (arme) => {
    if (!window.confirm(`Restituer ${arme.matricule || arme.serie_arme} ?`)) return;
    setLoading(true);
    await supabase.from('armes').update({ statut: 'AU_COFFRE', agent_id: null }).eq('id', arme.id);
    await supabase.from('attributions_armes').update({ statut: 'RESTITUEE', date_restitution: new Date().toISOString() }).eq('arme_id', arme.id).eq('statut', 'ACTIVE');
    await fetchToutesLesDonnees(_cachedUserId);
    setLoading(false);
  };

  const changerStatutArme = async (id, statut) => {
    await supabase.from('armes').update({ statut, ...(statut === 'AU_COFFRE' ? { agent_id: null } : {}) }).eq('id', id);
    await fetchToutesLesDonnees(_cachedUserId);
  };

  const scannerMatricule = () => {
    if (!scanInput.trim()) return;
    const q = scanInput.trim().toLowerCase();
    const found = armesData.find(a => (a.matricule || '').toLowerCase() === q || (a.serie_arme || '').toLowerCase() === q)
               || radios.find(r => (r.matricule || '').toLowerCase() === q);
    setScanResultat(found || 'notfound');
  };

  // ── Actions Maintenance ───────────────────────────────────────────────────
  const enregistrerMaintenance = async (e) => {
    e.preventDefault();
    setLoading(true);
    const armeId  = frmMaint.arme_id  ? parseInt(frmMaint.arme_id)  : null;
    const radioId = frmMaint.radio_id ? parseInt(frmMaint.radio_id) : null;
    const date    = frmMaint.date_maintenance || dateAuj();
    const { error } = await supabase.from('maintenances_armes').insert([{
      arme_id: armeId, radio_id: radioId,
      type_maintenance: frmMaint.type_maintenance, date_maintenance: date,
      technicien: frmMaint.technicien || null, pieces_remplacees: frmMaint.pieces_remplacees || null, notes: frmMaint.notes || null,
    }]);
    if (!error) {
      if (frmMaint.type_maintenance === 'NETTOYAGE' && armeId) {
        await supabase.from('armes').update({ date_dernier_nettoyage: date }).eq('id', armeId);
        await fetchToutesLesDonnees(_cachedUserId);
      }
      if (radioId) { await supabase.from('radios_uhf').update({ date_dernier_controle: date }).eq('id', radioId); await fetchRadios(); }
      setFrmMaint(M_VIDE); setShowFrmMaint(false); await fetchMaintenances();
    } else alert('Erreur : ' + error.message);
    setLoading(false);
  };

  // ── Actions Radios ────────────────────────────────────────────────────────
  const ajouterRadio = async (e) => {
    e.preventDefault();
    setLoading(true);
    const matricule = frmRadio.matricule || await genMatricule('radios_uhf', 'matricule', 'RAD');
    const { error } = await supabase.from('radios_uhf').insert([{
      matricule, type_radio: frmRadio.type_radio, marque_modele: frmRadio.marque_modele || null,
      canal: frmRadio.canal || null, etat_batterie: frmRadio.etat_batterie,
      date_dernier_controle: frmRadio.date_dernier_controle || null,
      site_actuel: frmRadio.site_actuel, statut: frmRadio.statut, notes: frmRadio.notes || null,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmRadio(R_VIDE); setShowFrmRadio(false); await fetchRadios(); }
    setLoading(false);
  };

  const affecterRadio = async (radioId, agentSelectId) => {
    const agentId = parseInt(agentSelectId);
    if (!agentId) return;
    if (radios.some(r => r.agent_id === agentId && r.statut === 'AFFECTEE')) { alert('❌ Cet agent a déjà une radio en dotation.'); return; }
    setLoading(true);
    await supabase.from('radios_uhf').update({ statut: 'AFFECTEE', agent_id: agentId }).eq('id', radioId);
    await supabase.from('attributions_armes').insert([{ radio_id: radioId, agent_id: agentId, statut: 'ACTIVE', confirmation_agent: false }]);
    await fetchRadios();
    setLoading(false);
  };

  const restituerRadio = async (radio) => {
    if (!window.confirm(`Restituer ${radio.matricule} ?`)) return;
    setLoading(true);
    await supabase.from('radios_uhf').update({ statut: 'DISPONIBLE', agent_id: null }).eq('id', radio.id);
    await supabase.from('attributions_armes').update({ statut: 'RESTITUEE', date_restitution: new Date().toISOString() }).eq('radio_id', radio.id).eq('statut', 'ACTIVE');
    await fetchRadios();
    setLoading(false);
  };

  const changerStatutRadio = async (id, statut) => {
    await supabase.from('radios_uhf').update({ statut, ...(statut === 'DISPONIBLE' ? { agent_id: null } : {}) }).eq('id', id);
    await fetchRadios();
  };

  // ── Actions Acheminement ──────────────────────────────────────────────────
  const creerAcheminement = async (e) => {
    e.preventDefault();
    setLoading(true);
    const reference = frmAch.reference || await genMatricule('acheminements_armes', 'reference', 'ACH');
    const { error } = await supabase.from('acheminements_armes').insert([{
      reference, type_colis: frmAch.type_colis,
      arme_id:  frmAch.arme_id  ? parseInt(frmAch.arme_id)  : null,
      radio_id: frmAch.radio_id ? parseInt(frmAch.radio_id) : null,
      site_depart: frmAch.site_depart, site_destination: frmAch.site_destination, statut: frmAch.statut,
      date_depart: frmAch.date_depart || null, date_arrivee_prevue: frmAch.date_arrivee_prevue || null,
      transporteur: frmAch.transporteur || null, escorte: frmAch.escorte || null, notes: frmAch.notes || null,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmAch(ACH_VIDE); setShowFrmAch(false); await fetchAcheminements(); }
    setLoading(false);
  };

  const changerStatutAch = async (id, statut) => {
    const patch = statut === 'ARRIVE' ? { statut, date_arrivee_reelle: dateAuj() } : { statut };
    await supabase.from('acheminements_armes').update(patch).eq('id', id);
    await fetchAcheminements();
  };

  // ── Excel armes & radios ──────────────────────────────────────────────────
  const ARMES_COLS = [
    { key: 'matricule',              label: 'Référence',            labelAr: 'المرجع',             required: true, example: 'ARM-2025-001' },
    { key: 'serie_arme',             label: "N° Série",             labelAr: 'رقم السلسلة',        example: 'FR123456' },
    { key: 'type_arme',              label: "Type d'arme",          labelAr: 'نوع السلاح',         type: 'enum', enumValues: TYPES_ARME, example: 'Pistolet' },
    { key: 'coffre_site',            label: 'Site de stockage',     labelAr: 'موقع التخزين',       example: 'Direction Alger' },
    { key: 'statut',                 label: 'Statut',               labelAr: 'الحالة',             type: 'enum', enumValues: STATUTS_ARME, example: 'AU_COFFRE' },
    { key: 'date_acquisition',       label: 'Date acquisition',     labelAr: 'تاريخ الاقتناء',     type: 'date', example: '2022-03-15' },
    { key: 'date_dernier_nettoyage', label: 'Dernier nettoyage',    labelAr: 'آخر تنظيف',         type: 'date', example: '2025-06-01' },
    { key: 'notes',                  label: 'Notes',                labelAr: 'ملاحظات',            example: '' },
  ];

  const RADIOS_COLS = [
    { key: 'matricule',              label: 'Référence',            labelAr: 'المرجع',             required: true, example: 'RAD-2025-001' },
    { key: 'type_radio',             label: 'Type radio',           labelAr: 'نوع الراديو',        type: 'enum', enumValues: TYPES_RADIO, example: 'UHF' },
    { key: 'marque_modele',          label: 'Marque / Modèle',      labelAr: 'الماركة / الموديل',  example: 'Motorola GP340' },
    { key: 'canal',                  label: 'Canal',                labelAr: 'القناة',             example: '1' },
    { key: 'etat_batterie',          label: 'État batterie',        labelAr: 'حالة البطارية',      type: 'enum', enumValues: ETATS_BATT, example: 'BON' },
    { key: 'date_dernier_controle',  label: 'Dernier contrôle',     labelAr: 'آخر فحص',           type: 'date', example: '2025-06-01' },
    { key: 'site_actuel',            label: 'Site actuel',          labelAr: 'الموقع الحالي',      example: 'Direction Alger' },
    { key: 'statut',                 label: 'Statut',               labelAr: 'الحالة',             type: 'enum', enumValues: STATUTS_RADIO, example: 'DISPONIBLE' },
    { key: 'notes',                  label: 'Notes',                labelAr: 'ملاحظات',            example: '' },
  ];

  const exporterArmes  = () => exportToExcel(armesData,  ARMES_COLS,  'Armes_DZSecurity');
  const exporterRadios = () => exportToExcel(radios,     RADIOS_COLS, 'Radios_DZSecurity');
  const genModeleArme  = () => generateTemplate(ARMES_COLS,  'armes');
  const genModeleRadio = () => generateTemplate(RADIOS_COLS, 'radios_uhf');

  const handleImportArmes = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const { rows, errors } = await importFromExcel(file, ARMES_COLS);
      setImportPreview({
        rows, errors, colDefs: ARMES_COLS,
        label: 'Import Armes · استيراد الأسلحة',
        onConfirm: async (validRows) => {
          const { inserted, errorsCount } = await upsertRows(supabase, 'armes', validRows, 'matricule', { statut: 'AU_COFFRE' });
          toast.success(buildReport({ total: validRows.length, inserted, errorsCount }));
          fetchToutesLesDonnees();
          setImportPreview(null);
        },
      });
    } catch (err) { toast.error('Erreur : ' + err.message); }
    finally { setImporting(false); }
  };

  const handleImportRadios = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const { rows, errors } = await importFromExcel(file, RADIOS_COLS);
      setImportPreview({
        rows, errors, colDefs: RADIOS_COLS,
        label: 'Import Radios UHF · استيراد أجهزة الراديو',
        onConfirm: async (validRows) => {
          const { inserted, errorsCount } = await upsertRows(supabase, 'radios_uhf', validRows, 'matricule', { statut: 'DISPONIBLE', etat_batterie: 'BON' });
          toast.success(buildReport({ total: validRows.length, inserted, errorsCount }));
          fetchRadios();
          setImportPreview(null);
        },
      });
    } catch (err) { toast.error('Erreur : ' + err.message); }
    finally { setImporting(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── En-tête ── */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🔫</span>
        <div>
          <h1 className="page-title">SERVICE ARMEMENT & TRANSMISSIONS</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Déploiement · Acheminement · Maintenance · Matériel UHF/VHF</p>
        </div>
      </div>

      {/* ── Barre Excel armes & radios ── */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', padding:'10px 14px', marginBottom:'16px', backgroundColor:'#f0f9ff', borderRadius:'10px', border:'1px solid #bae6fd' }}>
        <span style={{ fontSize:'12px', fontWeight:'800', color:'#0369a1', marginRight:'4px' }}>📊 Excel / إكسل</span>
        <button onClick={exporterArmes} disabled={!armesData.length}
          style={{ padding:'6px 12px', border:'none', borderRadius:'6px', backgroundColor: armesData.length ? '#059669' : '#d1fae5', color: armesData.length ? 'white' : '#6b7280', fontWeight:'700', cursor: armesData.length ? 'pointer' : 'not-allowed', fontSize:'12px' }}>
          🔫 Exporter Armes ({armesData.length}) · تصدير
        </button>
        <button onClick={genModeleArme}
          style={{ padding:'6px 12px', border:'none', borderRadius:'6px', backgroundColor:'#7c3aed', color:'white', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>
          📋 Modèle Armes · نموذج
        </button>
        <label style={{ padding:'6px 12px', borderRadius:'6px', backgroundColor: importing ? '#9ca3af' : '#1d4ed8', color:'white', fontWeight:'700', cursor: importing ? 'not-allowed' : 'pointer', fontSize:'12px', display:'inline-block' }}>
          {importing ? '⏳ Import…' : '📤 Import Armes · استيراد'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportArmes} style={{ display:'none' }} disabled={importing} />
        </label>
        <span style={{ color:'#cbd5e1', fontWeight:'300' }}>|</span>
        <button onClick={exporterRadios} disabled={!radios.length}
          style={{ padding:'6px 12px', border:'none', borderRadius:'6px', backgroundColor: radios.length ? '#0891b2' : '#e0f2fe', color: radios.length ? 'white' : '#6b7280', fontWeight:'700', cursor: radios.length ? 'pointer' : 'not-allowed', fontSize:'12px' }}>
          📻 Exporter Radios ({radios.length}) · تصدير
        </button>
        <button onClick={genModeleRadio}
          style={{ padding:'6px 12px', border:'none', borderRadius:'6px', backgroundColor:'#7c3aed', color:'white', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>
          📋 Modèle Radios · نموذج
        </button>
        <label style={{ padding:'6px 12px', borderRadius:'6px', backgroundColor: importing ? '#9ca3af' : '#0891b2', color:'white', fontWeight:'700', cursor: importing ? 'not-allowed' : 'pointer', fontSize:'12px', display:'inline-block' }}>
          {importing ? '⏳ Import…' : '📤 Import Radios · استيراد'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportRadios} style={{ display:'none' }} disabled={importing} />
        </label>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { l: 'Armes total',   v: kpi.totalArmes,  i: '🔫', bg: '#dbeafe', c: '#1d4ed8' },
          { l: 'Au coffre',     v: kpi.auCoffre,    i: '🔒', bg: '#f0fdf4', c: '#15803d' },
          { l: 'Déployées',     v: kpi.affectees,   i: '🎯', bg: '#dcfce7', c: '#166534' },
          { l: 'Alerte nett.',  v: kpi.alertesNett, i: '🚨', bg: '#fee2e2', c: '#991b1b', click: () => { setFiltreAlerte('oui'); setSousMenu('verification'); } },
          { l: 'Maintenance',   v: kpi.maintenance, i: '🔧', bg: '#fef3c7', c: '#92400e', click: () => setSousMenu('maintenance') },
          { l: 'Radios',        v: kpi.totalRadios, i: '📻', bg: '#f3e8ff', c: '#7c3aed', click: () => setSousMenu('uhf') },
          { l: 'Alerte UHF',    v: kpi.alertesUHF,  i: '⚠️', bg: '#fef9c3', c: '#854d0e', click: () => setSousMenu('uhf') },
        ].map(k => (
          <div key={k.l} onClick={k.click}
            style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '13px 14px', cursor: k.click ? 'pointer' : 'default', transition: 'transform 0.1s' }}
            onMouseEnter={e => k.click && (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => k.click && (e.currentTarget.style.transform = 'scale(1)')}>
            <div style={{ fontSize: '18px', marginBottom: '4px' }}>{k.i}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{k.l}</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div className="nav-tabs">
        {[
          { key: 'verification', label: '🎯 Vérification & Déploiement', bg: colors.blue  },
          { key: 'acheminement', label: '🚚 Acheminement',               bg: colors.dark  },
          { key: 'maintenance',  label: '🔧 Maintenance & Nettoyage',    bg: colors.red   },
          { key: 'uhf',          label: '📻 Matériel UHF',               bg: '#7c3aed'    },
        ].map(t => (
          <button key={t.key} onClick={() => setSousMenu(t.key)}
            className={`nav-tab${sousMenu === t.key ? ' active' : ''}`}
            style={sousMenu === t.key ? { backgroundColor: t.bg } : {}}>
            {t.key === 'maintenance' && kpi.alertesNett > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '10px', fontWeight: '900', marginRight: '5px' }}>
                {kpi.alertesNett}
              </span>
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          ONGLET 1 — VÉRIFICATION & DÉPLOIEMENT
      ════════════════════════════════════════════ */}
      {sousMenu === 'verification' && (
        <>
          {/* Scanner */}
          <div style={{ ...PNL, border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#1e3a8a', fontSize: '14px', fontWeight: '800' }}>🔍 Scanner / Rechercher un matricule</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder="ARM-2025-001 ou numéro de série…" value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && scannerMatricule()}
                style={{ ...INP, flex: 1 }} />
              <button onClick={scannerMatricule} style={BTN_P}>Rechercher</button>
              {scanInput && <button onClick={() => { setScanInput(''); setScanResultat(null); }}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>✕</button>}
            </div>
            {scanResultat === 'notfound' && (
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '13px', fontWeight: '700' }}>
                ❌ Aucune arme/radio trouvée pour "{scanInput}"
              </div>
            )}
            {scanResultat && scanResultat !== 'notfound' && (
              <div style={{ marginTop: '12px', padding: '14px', backgroundColor: 'white', borderRadius: '10px', border: '2px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontWeight: '900', fontSize: '15px', color: '#1e3a8a' }}>{scanResultat.matricule || scanResultat.serie_arme}</span>
                  <span style={{ marginLeft: '10px', fontSize: '13px', color: '#374151' }}>{scanResultat.type_arme || scanResultat.type_radio}</span>
                  {scanResultat.agents?.nom && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#6b7280' }}>→ {scanResultat.agents.nom}</span>}
                </div>
                {scanResultat.type_arme && (() => { const al = alerteNettoyage(scanResultat); return <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: al.bg, color: al.c }}>{al.icon} {al.label}</span>; })()}
              </div>
            )}
          </div>

          {/* Déploiement */}
          <div className="card card-blue mb-16">
            <div className="flex-between mb-20">
              <div>
                <h3 className="section-title">🎯 Affecter une arme à un agent</h3>
                <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Nettoyage à jour obligatoire — sinon le déploiement est automatiquement bloqué.</p>
              </div>
              <button onClick={() => { setFrmArme(A_VIDE); setShowFrmArme(v => !v); }} style={BTN_G}>
                {showFrmArme ? '✕' : '＋ Nouvelle arme'}
              </button>
            </div>

            {showFrmArme && (
              <form onSubmit={ajouterArme} style={{ ...PNL, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', marginBottom: '18px' }}>
                <h4 style={{ margin: '0 0 14px 0', color: '#166534' }}>Enregistrer une nouvelle arme</h4>
                <div style={{ ...G(), marginBottom: '14px' }}>
                  <div><label style={LBL}>Matricule (auto si vide)</label><input placeholder="ARM-2025-001" value={frmArme.matricule} onChange={e => setFrmArme(p => ({ ...p, matricule: e.target.value.toUpperCase() }))} style={INP} /></div>
                  <div><label style={LBL}>N° Série <span style={{ color: '#ef4444' }}>*</span></label><input required placeholder="SN-78245A" value={frmArme.serie_arme} onChange={e => setFrmArme(p => ({ ...p, serie_arme: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Type <span style={{ color: '#ef4444' }}>*</span></label><select required value={frmArme.type_arme} onChange={e => setFrmArme(p => ({ ...p, type_arme: e.target.value }))} style={INP}>{TYPES_ARME.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label style={LBL}>Site de stockage</label><select value={frmArme.coffre_site} onChange={e => setFrmArme(p => ({ ...p, coffre_site: e.target.value }))} style={INP}>{SITES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={LBL}>Date acquisition</label><input type="date" value={frmArme.date_acquisition} onChange={e => setFrmArme(p => ({ ...p, date_acquisition: e.target.value }))} style={INP} /></div>
                  <div><label style={{ ...LBL, color: '#991b1b' }}>Dernier nettoyage</label><input type="date" value={frmArme.date_dernier_nettoyage} onChange={e => setFrmArme(p => ({ ...p, date_dernier_nettoyage: e.target.value }))} style={{ ...INP, borderColor: '#fca5a5' }} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowFrmArme(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={loading} style={BTN_P}>➕ Enregistrer</button>
                </div>
              </form>
            )}

            <form onSubmit={deployerArme} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={LBL}>Arme AU_COFFRE</label>
                <select value={armeDepId} onChange={e => setArmeDepId(e.target.value)} required style={INP}>
                  <option value="">— Sélectionner —</option>
                  {armesData.filter(a => a.statut === 'AU_COFFRE').map(a => {
                    const al = alerteNettoyage(a);
                    return <option key={a.id} value={a.id} disabled={al.level >= 2}>{al.icon} {a.matricule || a.serie_arme} — {a.type_arme}{al.level >= 2 ? ' [NETTOYAGE REQUIS]' : ''}</option>;
                  })}
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={LBL}>Agent réceptionnaire</label>
                <select value={agentDepId} onChange={e => setAgentDepId(e.target.value)} required style={INP}>
                  <option value="">— Sélectionner —</option>
                  {agentsData.filter(a => a.statut_agent === 'ACTIF').map(a => <option key={a.id} value={a.id}>{a.nom} {a.prenom} — {a.site_affecte}</option>)}
                </select>
              </div>
              <button type="submit" disabled={loading} style={{ ...BTN_G, flexShrink: 0 }}>🎯 Affecter</button>
            </form>
          </div>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
            <input type="text" placeholder="🔍 Matricule, type, agent…" value={recherche} onChange={e => setRecherche(e.target.value)} style={{ ...INP, maxWidth: '250px', flex: '1 1 150px' }} />
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ ...INP, maxWidth: '170px' }}>
              <option value="">Tous les statuts</option>
              {STATUTS_ARME.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtreAlerte} onChange={e => setFiltreAlerte(e.target.value)} style={{ ...INP, maxWidth: '170px' }}>
              <option value="">Toutes alertes</option>
              <option value="oui">🚨 Alertes nettoyage</option>
            </select>
            {(recherche || filtreStatut || filtreAlerte) && <button onClick={() => { setRecherche(''); setFiltreStatut(''); setFiltreAlerte(''); }} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>✕</button>}
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Matricule', 'Série', 'Type', 'Site/Coffre', 'Statut', 'Affecté à', 'Nettoyage', 'Actions'].map(h => <th key={h} style={TH(colors.blue)}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {armesFiltre.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">{armesData.length === 0 ? 'Aucune arme enregistrée.' : 'Aucun résultat.'}</td></tr>
                ) : armesFiltre.map((a, i) => {
                  const bs = BADGE_A[a.statut] || BADGE_A['AU_COFFRE'];
                  const al = alerteNettoyage(a);
                  return (
                    <tr key={a.id} style={{ backgroundColor: al.level >= 2 ? '#fff5f5' : i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '900', color: '#1e3a8a', fontSize: '12px' }}>
                        {a.matricule || <span style={{ color: '#9ca3af', fontStyle: 'italic', fontFamily: 'inherit', fontWeight: '400', fontSize: '11px' }}>—</span>}
                      </td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: '11px', color: '#6b7280' }}>{a.serie_arme}</td>
                      <td style={TD}>{a.type_arme}</td>
                      <td style={{ ...TD, fontSize: '12px', color: '#6b7280' }}>{a.coffre_site || a.contrats?.nom_site || '—'}</td>
                      <td style={TD}>
                        <select value={a.statut} onChange={e => changerStatutArme(a.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', fontWeight: '800', backgroundColor: bs.bg, color: bs.c, cursor: 'pointer' }}>
                          {STATUTS_ARME.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, fontWeight: '700', color: '#1e3a8a' }}>{a.agents?.nom || <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '400' }}>—</span>}</td>
                      <td style={TD}><span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: al.bg, color: al.c }}>{al.icon} {al.label}</span></td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {a.statut === 'AFFECTEE' && (
                            <button onClick={() => restituerArme(a)} style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '7px', border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>↩</button>
                          )}
                          <button onClick={() => { setFrmMaint(p => ({ ...p, arme_id: String(a.id), type_maintenance: 'NETTOYAGE' })); setShowFrmMaint(true); setSousMenu('maintenance'); }}
                            style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '7px', border: '1px solid #fcd34d', backgroundColor: '#fef9c3', color: '#854d0e', cursor: 'pointer', fontWeight: '700' }}>🧹</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 2 — ACHEMINEMENT
      ════════════════════════════════════════════ */}
      {sousMenu === 'acheminement' && (
        <>
          <div className="card card-dark mb-16">
            <div className="flex-between mb-20">
              <div>
                <h3 className="section-title">🚚 Acheminement entre sites</h3>
                <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Référence unique auto-générée · Suivi planifié → en transit → arrivé</p>
              </div>
              <button onClick={() => setShowFrmAch(v => !v)} style={BTN_P}>{showFrmAch ? '✕ Annuler' : '＋ Nouveau mouvement'}</button>
            </div>

            {showFrmAch && (
              <form onSubmit={creerAcheminement} style={{ ...PNL, border: '1px solid #94a3b8', backgroundColor: '#f8fafc', marginBottom: 0 }}>
                <div style={{ ...G(160), marginBottom: '14px' }}>
                  <div><label style={LBL}>Référence</label><input placeholder="ACH-2025-001 (auto)" value={frmAch.reference} onChange={e => setFrmAch(p => ({ ...p, reference: e.target.value.toUpperCase() }))} style={INP} /></div>
                  <div><label style={LBL}>Type de colis</label><select value={frmAch.type_colis} onChange={e => setFrmAch(p => ({ ...p, type_colis: e.target.value }))} style={INP}>{['ARME', 'RADIO', 'MUNITIONS', 'MIXTE'].map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label style={LBL}>Arme (si applicable)</label><select value={frmAch.arme_id} onChange={e => setFrmAch(p => ({ ...p, arme_id: e.target.value }))} style={INP}><option value="">— Optionnel —</option>{armesData.map(a => <option key={a.id} value={a.id}>{a.matricule || a.serie_arme} — {a.type_arme}</option>)}</select></div>
                  <div><label style={LBL}>Radio (si applicable)</label><select value={frmAch.radio_id} onChange={e => setFrmAch(p => ({ ...p, radio_id: e.target.value }))} style={INP}><option value="">— Optionnel —</option>{radios.map(r => <option key={r.id} value={r.id}>{r.matricule} — {r.type_radio}</option>)}</select></div>
                  <div><label style={LBL}>Site départ <span style={{ color: '#ef4444' }}>*</span></label><select required value={frmAch.site_depart} onChange={e => setFrmAch(p => ({ ...p, site_depart: e.target.value }))} style={INP}>{SITES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={LBL}>Site destination <span style={{ color: '#ef4444' }}>*</span></label><select required value={frmAch.site_destination} onChange={e => setFrmAch(p => ({ ...p, site_destination: e.target.value }))} style={INP}>{SITES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={LBL}>Date départ</label><input type="date" value={frmAch.date_depart} onChange={e => setFrmAch(p => ({ ...p, date_depart: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Arrivée prévue</label><input type="date" value={frmAch.date_arrivee_prevue} onChange={e => setFrmAch(p => ({ ...p, date_arrivee_prevue: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Transporteur</label><input placeholder="Agent ou société" value={frmAch.transporteur} onChange={e => setFrmAch(p => ({ ...p, transporteur: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Escorte armée</label><input placeholder="Nom escorte" value={frmAch.escorte} onChange={e => setFrmAch(p => ({ ...p, escorte: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Statut initial</label><select value={frmAch.statut} onChange={e => setFrmAch(p => ({ ...p, statut: e.target.value }))} style={INP}>{STATUTS_ACH.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={LBL}>Notes</label><textarea rows="2" value={frmAch.notes} onChange={e => setFrmAch(p => ({ ...p, notes: e.target.value }))} style={{ ...INP, resize: 'vertical', minHeight: '52px' }} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowFrmAch(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={loading} style={BTN_P}>🚚 Enregistrer</button>
                </div>
              </form>
            )}
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Référence', 'Type', 'Contenu', 'Départ → Destination', 'Dates', 'Transporteur / Escorte', 'Statut', 'Actions'].map(h => <th key={h} style={TH(colors.dark)}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {acheminements.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">Aucun mouvement enregistré.</td></tr>
                ) : acheminements.map((ac, i) => {
                  const bs = BADGE_ACH[ac.statut] || BADGE_ACH['PLANIFIE'];
                  return (
                    <tr key={ac.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '900', color: '#1e3a8a' }}>{ac.reference}</td>
                      <td style={TD}>{ac.type_colis}</td>
                      <td style={{ ...TD, fontSize: '12px' }}>
                        {ac.armes    && <div>🔫 {ac.armes.matricule}</div>}
                        {ac.radios_uhf && <div>📻 {ac.radios_uhf.matricule}</div>}
                        {!ac.armes && !ac.radios_uhf && '—'}
                      </td>
                      <td style={TD}>
                        <span style={{ fontWeight: '700' }}>{ac.site_depart}</span>
                        <span style={{ color: '#9ca3af', margin: '0 6px' }}>→</span>
                        <span style={{ fontWeight: '700', color: '#1d4ed8' }}>{ac.site_destination}</span>
                      </td>
                      <td style={{ ...TD, fontSize: '12px', color: '#6b7280' }}>
                        <div>↑ {dateFr(ac.date_depart)}</div>
                        <div>↓ {dateFr(ac.date_arrivee_prevue)}</div>
                        {ac.date_arrivee_reelle && <div style={{ color: '#15803d', fontWeight: '700' }}>✅ {dateFr(ac.date_arrivee_reelle)}</div>}
                      </td>
                      <td style={{ ...TD, fontSize: '12px' }}>
                        {ac.transporteur || '—'}
                        {ac.escorte && <div style={{ color: '#6b7280' }}>🛡️ {ac.escorte}</div>}
                      </td>
                      <td style={TD}><span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: bs.bg, color: bs.c }}>{bs.i} {ac.statut}</span></td>
                      <td style={TD}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ac.statut === 'PLANIFIE'   && <button onClick={() => changerStatutAch(ac.id, 'EN_TRANSIT')} style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #fcd34d', backgroundColor: '#fef9c3', color: '#854d0e', cursor: 'pointer', fontWeight: '700' }}>En transit</button>}
                          {ac.statut === 'EN_TRANSIT' && <button onClick={() => changerStatutAch(ac.id, 'ARRIVE')}    style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #86efac', backgroundColor: '#dcfce7', color: '#15803d', cursor: 'pointer', fontWeight: '700' }}>Arrivé ✅</button>}
                          {!['ARRIVE','ANNULE'].includes(ac.statut) && <button onClick={() => changerStatutAch(ac.id, 'ANNULE')} style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>Annuler</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 3 — MAINTENANCE & NETTOYAGE
      ════════════════════════════════════════════ */}
      {sousMenu === 'maintenance' && (
        <>
          {armesAlerte.length > 0 && (
            <div style={{ backgroundColor: '#fee2e2', border: '2px solid #ef4444', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#991b1b', fontSize: '14px', fontWeight: '800' }}>🚨 {armesAlerte.length} arme(s) nécessitent un nettoyage</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {armesAlerte.slice(0, 5).map(a => {
                  const al = alerteNettoyage(a);
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '10px 14px', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#1e3a8a', fontSize: '13px' }}>{a.matricule || a.serie_arme}</span>
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#374151' }}>{a.type_arme}</span>
                        {a.agents?.nom && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>→ {a.agents.nom}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: al.bg, color: al.c }}>{al.icon} {al.label}</span>
                        <button onClick={() => setFrmMaint(p => ({ ...p, arme_id: String(a.id), type_maintenance: 'NETTOYAGE' }))}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card card-red mb-16">
            <div className="flex-between mb-20">
              <div>
                <h3 className="section-title">🔧 Enregistrer une intervention</h3>
                <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Nettoyage = date mise à jour automatiquement sur l'arme.</p>
              </div>
              <button onClick={() => setShowFrmMaint(v => !v)} style={BTN_R}>{showFrmMaint ? '✕ Annuler' : '＋ Log intervention'}</button>
            </div>

            {showFrmMaint && (
              <form onSubmit={enregistrerMaintenance} style={{ ...PNL, border: '1px solid #fca5a5', backgroundColor: '#fff5f5', marginBottom: 0 }}>
                <div style={{ ...G(), marginBottom: '14px' }}>
                  <div><label style={LBL}>Arme</label><select value={frmMaint.arme_id} onChange={e => setFrmMaint(p => ({ ...p, arme_id: e.target.value, radio_id: '' }))} style={INP}><option value="">— Sélectionner —</option>{armesData.map(a => <option key={a.id} value={a.id}>{a.matricule || a.serie_arme} — {a.type_arme}</option>)}</select></div>
                  <div><label style={LBL}>Radio</label><select value={frmMaint.radio_id} onChange={e => setFrmMaint(p => ({ ...p, radio_id: e.target.value, arme_id: '' }))} style={INP}><option value="">— Sélectionner —</option>{radios.map(r => <option key={r.id} value={r.id}>{r.matricule} — {r.type_radio}</option>)}</select></div>
                  <div><label style={LBL}>Type <span style={{ color: '#ef4444' }}>*</span></label><select required value={frmMaint.type_maintenance} onChange={e => setFrmMaint(p => ({ ...p, type_maintenance: e.target.value }))} style={INP}>{TYPES_MAINT.concat(['SIGNALEMENT_AGENT']).map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label style={LBL}>Date</label><input type="date" value={frmMaint.date_maintenance} onChange={e => setFrmMaint(p => ({ ...p, date_maintenance: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Technicien / Armurier</label><input placeholder="Nom" value={frmMaint.technicien} onChange={e => setFrmMaint(p => ({ ...p, technicien: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Pièces remplacées</label><input placeholder="Ressort, extracteur…" value={frmMaint.pieces_remplacees} onChange={e => setFrmMaint(p => ({ ...p, pieces_remplacees: e.target.value }))} style={INP} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={LBL}>Notes</label><textarea rows="2" value={frmMaint.notes} onChange={e => setFrmMaint(p => ({ ...p, notes: e.target.value }))} style={{ ...INP, resize: 'vertical', minHeight: '52px' }} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowFrmMaint(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={loading} style={BTN_R}>🔧 Enregistrer</button>
                </div>
              </form>
            )}
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}><h3 className="section-title">Historique des interventions</h3></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Matériel', 'Type', 'Date', 'Technicien', 'Pièces remplacées', 'Notes'].map(h => <th key={h} style={TH(colors.red)}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {maintenances.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">Aucune intervention enregistrée.</td></tr>
                ) : maintenances.map((m, i) => (
                  <tr key={m.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fff8f8' }}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '800', fontSize: '12px', color: '#1e3a8a' }}>
                      {m.armes ? `🔫 ${m.armes.matricule || m.armes.serie_arme}` : m.radios_uhf ? `📻 ${m.radios_uhf.matricule}` : '—'}
                    </td>
                    <td style={TD}>
                      <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                        backgroundColor: m.type_maintenance === 'NETTOYAGE' ? '#dcfce7' : m.type_maintenance === 'RÉVISION' ? '#dbeafe' : m.type_maintenance === 'SIGNALEMENT_AGENT' ? '#fef9c3' : '#fee2e2',
                        color:           m.type_maintenance === 'NETTOYAGE' ? '#15803d' : m.type_maintenance === 'RÉVISION' ? '#1d4ed8' : m.type_maintenance === 'SIGNALEMENT_AGENT' ? '#854d0e' : '#991b1b' }}>
                        {m.type_maintenance}
                      </span>
                    </td>
                    <td style={TD}>{dateFr(m.date_maintenance)}</td>
                    <td style={TD}>{m.technicien || '—'}</td>
                    <td style={{ ...TD, fontSize: '12px', color: '#6b7280' }}>{m.pieces_remplacees || '—'}</td>
                    <td style={{ ...TD, fontSize: '12px', color: '#374151', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 4 — MATÉRIEL UHF/VHF
      ════════════════════════════════════════════ */}
      {sousMenu === 'uhf' && (
        <>
          {radios.filter(r => alerteControleRadio(r.date_dernier_controle).level >= 1).length > 0 && (
            <div style={{ backgroundColor: '#fef9c3', border: '2px solid #fbbf24', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ color: '#92400e', fontWeight: '800', fontSize: '13px' }}>
                ⚠️ {radios.filter(r => alerteControleRadio(r.date_dernier_controle).level >= 1).length} radio(s) : contrôle 90 jours dépassé ou jamais effectué
              </div>
              <button onClick={() => { setFrmMaint(M_VIDE); setShowFrmMaint(true); setSousMenu('maintenance'); }}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #fbbf24', backgroundColor: '#fef3c7', color: '#92400e', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
                Enregistrer contrôle →
              </button>
            </div>
          )}

          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
            <div className="flex-between mb-20">
              <div>
                <h3 style={{ margin: 0, color: '#7c3aed', fontSize: '15px', fontWeight: '800' }}>📻 Gestion des radios UHF/VHF</h3>
                <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Contrôle périodique 90 jours · Un agent = une radio max · Matricule RAD-AAAA-NNN</p>
              </div>
              <button onClick={() => setShowFrmRadio(v => !v)} style={BTN_V}>{showFrmRadio ? '✕ Annuler' : '＋ Nouvelle radio'}</button>
            </div>

            {showFrmRadio && (
              <form onSubmit={ajouterRadio} style={{ ...PNL, border: '1px solid #c4b5fd', backgroundColor: '#fdf4ff', marginBottom: 0 }}>
                <div style={{ ...G(), marginBottom: '14px' }}>
                  <div><label style={LBL}>Matricule (auto)</label><input placeholder="RAD-2025-001" value={frmRadio.matricule} onChange={e => setFrmRadio(p => ({ ...p, matricule: e.target.value.toUpperCase() }))} style={INP} /></div>
                  <div><label style={LBL}>Type <span style={{ color: '#ef4444' }}>*</span></label><select required value={frmRadio.type_radio} onChange={e => setFrmRadio(p => ({ ...p, type_radio: e.target.value }))} style={INP}>{TYPES_RADIO.map(t => <option key={t}>{t}</option>)}</select></div>
                  <div><label style={LBL}>Marque / Modèle</label><input placeholder="Motorola DP4400" value={frmRadio.marque_modele} onChange={e => setFrmRadio(p => ({ ...p, marque_modele: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>Canal</label><input placeholder="Ch 3 – 446 MHz" value={frmRadio.canal} onChange={e => setFrmRadio(p => ({ ...p, canal: e.target.value }))} style={INP} /></div>
                  <div><label style={LBL}>État batterie</label><select value={frmRadio.etat_batterie} onChange={e => setFrmRadio(p => ({ ...p, etat_batterie: e.target.value }))} style={INP}>{ETATS_BATT.map(e => <option key={e}>{e}</option>)}</select></div>
                  <div><label style={{ ...LBL, color: '#7c3aed' }}>Dernier contrôle</label><input type="date" value={frmRadio.date_dernier_controle} onChange={e => setFrmRadio(p => ({ ...p, date_dernier_controle: e.target.value }))} style={{ ...INP, borderColor: '#c4b5fd' }} /></div>
                  <div><label style={LBL}>Site actuel</label><select value={frmRadio.site_actuel} onChange={e => setFrmRadio(p => ({ ...p, site_actuel: e.target.value }))} style={INP}>{SITES.map(s => <option key={s}>{s}</option>)}</select></div>
                  <div><label style={LBL}>Statut</label><select value={frmRadio.statut} onChange={e => setFrmRadio(p => ({ ...p, statut: e.target.value }))} style={INP}>{STATUTS_RADIO.map(s => <option key={s}>{s}</option>)}</select></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowFrmRadio(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={loading} style={BTN_V}>📻 Enregistrer</button>
                </div>
              </form>
            )}
          </div>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Matricule', 'Type / Modèle', 'Canal', 'Batterie', 'Contrôle (90j)', 'Statut', 'Agent', 'Actions'].map(h => <th key={h} style={TH('#7c3aed')}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {radios.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">Aucune radio enregistrée.</td></tr>
                ) : radios.map((r, i) => {
                  const bs  = BADGE_R[r.statut]         || BADGE_R['DISPONIBLE'];
                  const al  = alerteControleRadio(r.date_dernier_controle);
                  const bat = BADGE_BATT[r.etat_batterie] || BADGE_BATT['BON'];
                  const selId = `ag-r-${r.id}`;
                  return (
                    <tr key={r.id} style={{ backgroundColor: al.level >= 2 ? '#fffbeb' : i % 2 === 0 ? 'white' : '#faf5ff' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '900', color: '#7c3aed' }}>{r.matricule}</td>
                      <td style={TD}><div style={{ fontWeight: '700' }}>{r.type_radio}</div><div style={{ fontSize: '11px', color: '#6b7280' }}>{r.marque_modele || '—'}</div></td>
                      <td style={{ ...TD, fontSize: '12px', color: '#6b7280' }}>{r.canal || '—'}</td>
                      <td style={TD}><span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: bat.bg, color: bat.c }}>{bat.i} {r.etat_batterie}</span></td>
                      <td style={TD}><span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: al.bg, color: al.c }}>{al.icon} {al.label}</span></td>
                      <td style={TD}>
                        <select value={r.statut} onChange={e => changerStatutRadio(r.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', fontWeight: '800', backgroundColor: bs.bg, color: bs.c, cursor: 'pointer' }}>
                          {STATUTS_RADIO.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ ...TD, fontWeight: '700', color: '#1e3a8a' }}>{r.agents?.nom || <span style={{ color: '#9ca3af', fontSize: '12px', fontWeight: '400' }}>—</span>}</td>
                      <td style={TD}>
                        {r.statut === 'DISPONIBLE' ? (
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <select id={selId} defaultValue="" style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e5e7eb', maxWidth: '120px' }}>
                              <option value="">Agent…</option>
                              {agentsData.filter(a => a.statut_agent === 'ACTIF').map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                            </select>
                            <button onClick={() => { const el = document.getElementById(selId); affecterRadio(r.id, el?.value); }}
                              style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #bbf7d0', backgroundColor: '#dcfce7', color: '#15803d', cursor: 'pointer', fontWeight: '700' }}>
                              🎯
                            </button>
                          </div>
                        ) : r.statut === 'AFFECTEE' ? (
                          <button onClick={() => restituerRadio(r)}
                            style={{ fontSize: '11px', padding: '5px 9px', borderRadius: '7px', border: '1px solid #fca5a5', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                            ↩ Restituer
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {importPreview && (
        <ImportPreviewModal
          rows={importPreview.rows}
          errors={importPreview.errors}
          colDefs={importPreview.colDefs}
          label={importPreview.label}
          onConfirm={importPreview.onConfirm}
          onCancel={() => setImportPreview(null)}
        />
      )}
    </div>
  );
}

export default Armurerie;
