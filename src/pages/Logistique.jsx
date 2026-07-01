import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';
import { exportToExcel, generateTemplate, importFromExcel, buildReport, upsertRows } from '../utils/excelUtils';
import { toast } from '../store/useToastStore';
import ImportPreviewModal from '../components/ImportPreviewModal';

// ── Référentiels ───────────────────────────────────────────────────────────────
const TYPES_VEH       = ['Berline', 'SUV / 4x4', 'Utilitaire', 'Minibus', 'Poids Lourd', 'Moto', 'Fourgon Blindé'];
const CARBURANTS      = ['Diesel', 'Essence', 'LPG', 'Électrique'];
const STATUTS_VEH     = ['OPERATIONNEL', 'EN PANNE', 'EN RÉVISION', 'HORS SERVICE'];
const TYPES_MAINT     = ['Vidange & Filtres', 'Freinage', 'Pneumatiques', 'Carrosserie', 'Électricité', 'Climatisation', 'Révision générale', 'Contrôle technique', 'Autre'];
const STATUTS_MAINT   = ['Planifiée', 'En cours', 'Terminée', 'Annulée'];
const FOURNISSEURS    = ['Naftal', 'Total Energie', 'Sonatrach', 'AutoParts DZ', 'SecurTech', 'Uniform Factory', 'Autre'];

const BADGE_STATUT_VEH = {
  'OPERATIONNEL': { bg: '#dcfce7', c: '#15803d', i: '✅' },
  'EN PANNE':     { bg: '#fee2e2', c: '#991b1b', i: '🔴' },
  'EN RÉVISION':  { bg: '#fef9c3', c: '#854d0e', i: '🔧' },
  'HORS SERVICE': { bg: '#f1f5f9', c: '#475569', i: '⛔' },
};

const BADGE_STATUT_M = {
  'Planifiée': { bg: '#dbeafe', c: '#1d4ed8', i: '📅' },
  'En cours':  { bg: '#fef9c3', c: '#854d0e', i: '🔧' },
  'Terminée':  { bg: '#dcfce7', c: '#15803d', i: '✅' },
  'Annulée':   { bg: '#f1f5f9', c: '#6b7280', i: '✕'  },
};

// ── Valeurs initiales des formulaires ─────────────────────────────────────────
const V_VIDE = {
  immatriculation: '', marque_modele: '', type_vehicule: 'Berline',
  carburant: 'Diesel', couleur: '', annee: '', date_achat: '',
  date_assurance: '', date_vignette: '', date_ct: '',
  kilometrage: '', site_actuel: 'Siège', statut: 'OPERATIONNEL', notes: '',
};

const M_VIDE = {
  vehicule_id: '', type_intervention: 'Vidange & Filtres',
  description: '', date_intervention: '', cout: '',
  kilometrage: '', technicien: '', statut: 'Planifiée',
};

const C_VIDE = {
  vehicule_id: '', date_plein: '', litres: '',
  prix_litre: '', fournisseur: 'Naftal', km_compteur: '', notes: '',
};

const CMD_VIDE = {
  fournisseur: '', article: '', quantite: '',
  date_commande: '', statut: 'En attente',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const dateFr = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const numFr  = (n) => n !== '' && n != null ? Number(n).toLocaleString('fr-FR') : '—';
const dateAuj = () => new Date().toISOString().split('T')[0];

function joursAlerte(dateStr) {
  if (!dateStr) return null;
  const jr = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  if (jr < 0)   return { bg: '#fee2e2', c: '#991b1b', label: `Expiré ${Math.abs(jr)}j`,  icon: '🚨', level: 3 };
  if (jr <= 15)  return { bg: '#fee2e2', c: '#b91c1c', label: `${jr}j`,                    icon: '🔴', level: 2 };
  if (jr <= 45)  return { bg: '#fef9c3', c: '#854d0e', label: `${jr}j`,                    icon: '🟡', level: 1 };
  return               { bg: '#dcfce7', c: '#15803d', label: dateFr(dateStr),              icon: '✅', level: 0 };
}

function DateChip({ label, date }) {
  if (!date) return <span style={{ fontSize: '11px', color: '#9ca3af' }}>{label}: —</span>;
  const a = joursAlerte(date);
  return (
    <span title={`${label} : ${dateFr(date)}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px',
        padding: '2px 7px', borderRadius: '10px', fontWeight: '700',
        backgroundColor: a.bg, color: a.c, marginRight: '4px', marginBottom: '2px' }}>
      {a.icon} {label.slice(0,3)} {a.label}
    </span>
  );
}

// ── Styles partagés ────────────────────────────────────────────────────────────
const TH = (bg = '#1e3a8a') => ({
  padding: '10px 14px', backgroundColor: bg, color: 'white',
  fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
  letterSpacing: '0.5px', whiteSpace: 'nowrap', textAlign: 'left',
});
const TD = { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const GRID = (min = 160) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: '14px' });
const PANEL = { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' };
const BTN_P = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '700', cursor: 'pointer' };
const BTN_G = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#15803d', color: 'white', fontWeight: '700', cursor: 'pointer' };
const BTN_R = { padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: 'white', fontWeight: '700', cursor: 'pointer' };

// ══════════════════════════════════════════════════════════════════════════════
function Logistique() {
  const { agentsData }   = useDataStore();
  const navigate         = useNavigate();
  const [onglet, setOnglet]         = useState('parc');
  const [sousAppro, setSousAppro]   = useState('carburant');
  const [loading, setLoading]       = useState(false);

  // Données
  const [vehicules,    setVehicules]    = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [carburants,   setCarburants]   = useState([]);
  const [commandes,    setCommandes]    = useState([]);
  const [dotations,    setDotations]    = useState([]);

  // Formulaires
  const [showFrmV,    setShowFrmV]    = useState(false);
  const [showFrmM,    setShowFrmM]    = useState(false);
  const [showFrmC,    setShowFrmC]    = useState(false);
  const [showFrmCmd,  setShowFrmCmd]  = useState(false);
  const [editVeh,     setEditVeh]     = useState(null); // véhicule en cours d'édition
  const [frmV,  setFrmV]  = useState(V_VIDE);
  const [frmM,  setFrmM]  = useState(M_VIDE);
  const [frmC,  setFrmC]  = useState(C_VIDE);
  const [frmCmd,setFrmCmd]= useState(CMD_VIDE);

  // Filtres Parc
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreType,   setFiltreType]   = useState('');
  const [filtreAlerte, setFiltreAlerte] = useState('');
  const [recherche,    setRecherche]    = useState('');
  const [importing,     setImporting]     = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchVehicules = async () => {
    const { data } = await supabase.from('vehicules').select('*').order('id', { ascending: false });
    if (data) setVehicules(data);
  };
  const fetchMaintenances = async () => {
    const { data } = await supabase
      .from('interventions_maintenance')
      .select('*, vehicules(immatriculation, marque_modele)')
      .order('date_intervention', { ascending: false });
    if (data) setMaintenances(data);
  };
  const fetchCarburants = async () => {
    const { data } = await supabase
      .from('carburant_vehicules')
      .select('*, vehicules(immatriculation, marque_modele)')
      .order('date_plein', { ascending: false });
    if (data) setCarburants(data);
  };
  const fetchCommandes = async () => {
    const { data } = await supabase.from('commandes_logistique').select('*').order('id', { ascending: false });
    if (data) setCommandes(data);
  };
  const fetchDotations = async () => {
    try {
      const { data } = await supabase
        .from('dotations_uniformes')
        .select('*, agents(nom, matricule, site_affecte)')
        .order('id', { ascending: false });
      if (data) setDotations(data);
    } catch { /* table optionnelle */ }
  };

  const tout = async () => {
    setLoading(true);
    await Promise.all([fetchVehicules(), fetchMaintenances(), fetchCarburants(), fetchCommandes(), fetchDotations()]);
    setLoading(false);
  };

  useEffect(() => { tout(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI dérivés ───────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const alertes = vehicules.filter(v => {
      const dates = [v.date_assurance, v.date_vignette, v.date_ct].filter(Boolean);
      return dates.some(d => { const a = joursAlerte(d); return a && a.level >= 1; });
    });
    return {
      total:        vehicules.length,
      operationnel: vehicules.filter(v => v.statut === 'OPERATIONNEL').length,
      panne:        vehicules.filter(v => v.statut === 'EN PANNE').length,
      revision:     vehicules.filter(v => v.statut === 'EN RÉVISION').length,
      horsService:  vehicules.filter(v => v.statut === 'HORS SERVICE').length,
      alertes:      alertes.length,
      coutMaint:    maintenances.filter(m => m.statut === 'Terminée').reduce((s, m) => s + (parseFloat(m.cout) || 0), 0),
      litresTotal:  carburants.reduce((s, c) => s + (parseFloat(c.litres) || 0), 0),
    };
  }, [vehicules, maintenances, carburants]);

  // ── Liste véhicules filtrée ────────────────────────────────────────────────
  const vehFiltre = useMemo(() => {
    return vehicules.filter(v => {
      if (filtreStatut && v.statut !== filtreStatut) return false;
      if (filtreType   && v.type_vehicule !== filtreType) return false;
      if (recherche) {
        const q = recherche.toLowerCase();
        if (!v.immatriculation?.toLowerCase().includes(q) &&
            !v.marque_modele?.toLowerCase().includes(q)    &&
            !v.site_actuel?.toLowerCase().includes(q))     return false;
      }
      if (filtreAlerte === 'oui') {
        const dates = [v.date_assurance, v.date_vignette, v.date_ct].filter(Boolean);
        if (!dates.some(d => { const a = joursAlerte(d); return a && a.level >= 1; })) return false;
      }
      return true;
    });
  }, [vehicules, filtreStatut, filtreType, recherche, filtreAlerte]);

  // ── Actions véhicule ──────────────────────────────────────────────────────
  const soumettreVehicule = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const payload = {
      ...frmV,
      annee:       frmV.annee       ? parseInt(frmV.annee)       : null,
      kilometrage: frmV.kilometrage ? parseInt(frmV.kilometrage) : null,
      date_achat:       frmV.date_achat       || null,
      date_assurance:   frmV.date_assurance   || null,
      date_vignette:    frmV.date_vignette    || null,
      date_ct:          frmV.date_ct          || null,
    };
    const { error } = editVeh
      ? await supabase.from('vehicules').update(payload).eq('id', editVeh.id)
      : await supabase.from('vehicules').insert([payload]);
    if (error) alert('Erreur : ' + (error.message || 'immatriculation déjà existante ?'));
    else { setFrmV(V_VIDE); setShowFrmV(false); setEditVeh(null); await fetchVehicules(); }
    setLoading(false);
  };

  const ouvrirEditionVeh = (v) => {
    setEditVeh(v);
    setFrmV({
      immatriculation: v.immatriculation || '',
      marque_modele:   v.marque_modele   || '',
      type_vehicule:   v.type_vehicule   || 'Berline',
      carburant:       v.carburant       || 'Diesel',
      couleur:         v.couleur         || '',
      annee:           v.annee           || '',
      date_achat:      v.date_achat      || '',
      date_assurance:  v.date_assurance  || '',
      date_vignette:   v.date_vignette   || '',
      date_ct:         v.date_ct         || '',
      kilometrage:     v.kilometrage     || '',
      site_actuel:     v.site_actuel     || 'Siège',
      statut:          v.statut          || 'OPERATIONNEL',
      notes:           v.notes           || '',
    });
    setShowFrmV(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changerStatutVeh = async (id, statut) => {
    await supabase.from('vehicules').update({ statut }).eq('id', id);
    await fetchVehicules();
  };

  const majKm = async (id, km) => {
    if (!km) return;
    await supabase.from('vehicules').update({ kilometrage: parseInt(km) }).eq('id', id);
    await fetchVehicules();
  };

  // ── Actions maintenance ───────────────────────────────────────────────────
  const soumettreIntervention = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('interventions_maintenance').insert([{
      vehicule_id:      parseInt(frmM.vehicule_id),
      type_intervention: frmM.type_intervention,
      description:       frmM.description || null,
      date_intervention: frmM.date_intervention || dateAuj(),
      cout:              parseFloat(frmM.cout)  || 0,
      kilometrage:       frmM.kilometrage ? parseInt(frmM.kilometrage) : null,
      technicien:        frmM.technicien  || null,
      statut:            frmM.statut,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmM(M_VIDE); setShowFrmM(false); await fetchMaintenances(); }
    setLoading(false);
  };

  const changerStatutMaint = async (id, statut) => {
    await supabase.from('interventions_maintenance').update({ statut }).eq('id', id);
    await fetchMaintenances();
  };

  // ── Actions carburant ─────────────────────────────────────────────────────
  const soumettreCarburant = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('carburant_vehicules').insert([{
      vehicule_id:  parseInt(frmC.vehicule_id) || null,
      date_plein:   frmC.date_plein   || dateAuj(),
      litres:       parseFloat(frmC.litres)    || 0,
      prix_litre:   parseFloat(frmC.prix_litre) || 0,
      fournisseur:  frmC.fournisseur  || 'Naftal',
      km_compteur:  frmC.km_compteur  ? parseInt(frmC.km_compteur) : null,
      notes:        frmC.notes        || null,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmC(C_VIDE); setShowFrmC(false); await fetchCarburants(); }
    setLoading(false);
  };

  // ── Actions commandes ─────────────────────────────────────────────────────
  const soumettreCommande = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('commandes_logistique').insert([{
      fournisseur:    frmCmd.fournisseur,
      article:        frmCmd.article,
      quantite:       parseInt(frmCmd.quantite),
      date_commande:  frmCmd.date_commande || dateAuj(),
      statut:         frmCmd.statut,
    }]);
    if (error) alert('Erreur : ' + error.message);
    else { setFrmCmd(CMD_VIDE); setShowFrmCmd(false); await fetchCommandes(); }
    setLoading(false);
  };

  const changerStatutCmd = async (id, statut) => {
    await supabase.from('commandes_logistique').update({ statut }).eq('id', id);
    await fetchCommandes();
  };

  const supprimerCmd = async (id, article) => {
    if (!window.confirm(`Supprimer la commande : ${article} ?`)) return;
    await supabase.from('commandes_logistique').delete().eq('id', id);
    await fetchCommandes();
  };

  // ── Excel véhicules ───────────────────────────────────────────────────────
  const VEHICULES_COLS = [
    { key: 'immatriculation', label: 'Immatriculation',       labelAr: 'رقم اللوحة',         required: true, example: '123-A-16' },
    { key: 'marque_modele',   label: 'Marque / Modèle',       labelAr: 'الماركة / الموديل',  required: true, example: 'Toyota Hilux' },
    { key: 'type_vehicule',   label: 'Type',                  labelAr: 'النوع',              type: 'enum', enumValues: TYPES_VEH, example: 'SUV / 4x4' },
    { key: 'carburant',       label: 'Carburant',             labelAr: 'الوقود',             type: 'enum', enumValues: CARBURANTS, example: 'Diesel' },
    { key: 'couleur',         label: 'Couleur',               labelAr: 'اللون',              example: 'Blanc' },
    { key: 'annee',           label: 'Année',                 labelAr: 'السنة',              type: 'number', example: '2022' },
    { key: 'date_achat',      label: 'Date achat',            labelAr: 'تاريخ الشراء',       type: 'date', example: '2022-03-15' },
    { key: 'date_assurance',  label: 'Assurance (échéance)',  labelAr: 'التأمين (انتهاء)',   type: 'date', example: '2026-03-14' },
    { key: 'date_vignette',   label: 'Vignette (échéance)',   labelAr: 'الوينيت (انتهاء)',   type: 'date', example: '2025-12-31' },
    { key: 'date_ct',         label: 'Contrôle technique',    labelAr: 'المعاينة التقنية',   type: 'date', example: '2025-06-30' },
    { key: 'kilometrage',     label: 'Kilométrage',           labelAr: 'عداد الكيلومتر',    type: 'number', example: '85000' },
    { key: 'site_actuel',     label: 'Site actuel',           labelAr: 'الموقع الحالي',     example: 'Siège' },
    { key: 'statut',          label: 'Statut',                labelAr: 'الحالة',             type: 'enum', enumValues: STATUTS_VEH, example: 'OPERATIONNEL' },
    { key: 'notes',           label: 'Notes',                 labelAr: 'ملاحظات',            example: '' },
  ];

  const exporterVehicules = () => exportToExcel(vehicules, VEHICULES_COLS, 'Vehicules_DZSecurity');
  const genModeleVehicule = () => generateTemplate(VEHICULES_COLS, 'vehicules');

  const handleImportVehicules = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const { rows, errors } = await importFromExcel(file, VEHICULES_COLS);
      setImportPreview({
        rows, errors, colDefs: VEHICULES_COLS,
        label: 'Import Véhicules · استيراد المركبات',
        onConfirm: async (validRows) => {
          const { inserted, errorsCount } = await upsertRows(supabase, 'vehicules', validRows, 'immatriculation', { statut: 'OPERATIONNEL' });
          toast.success(buildReport({ total: validRows.length, inserted, errorsCount }));
          fetchVehicules();
          setImportPreview(null);
        },
      });
    } catch (err) { toast.error('Erreur : ' + err.message); }
    finally { setImporting(false); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="page-container">

      {/* ── En-tête ── */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🚙</span>
        <div>
          <h1 className="page-title">SERVICE LOGISTIQUE</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Parc roulant · Approvisionnement · Maintenance · Contrôle des biens
          </p>
        </div>
      </div>

      {/* ── Barre Excel véhicules ── */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', padding:'10px 14px', marginBottom:'16px', backgroundColor:'#f0f9ff', borderRadius:'10px', border:'1px solid #bae6fd' }}>
        <span style={{ fontSize:'12px', fontWeight:'800', color:'#0369a1', marginRight:'4px' }}>📊 Excel / إكسل</span>
        <button onClick={exporterVehicules} disabled={!vehicules.length}
          style={{ padding:'6px 13px', border:'none', borderRadius:'6px', backgroundColor: vehicules.length ? '#059669' : '#d1fae5', color: vehicules.length ? 'white' : '#6b7280', fontWeight:'700', cursor: vehicules.length ? 'pointer' : 'not-allowed', fontSize:'12px' }}>
          🚙 Exporter ({vehicules.length}) · تصدير
        </button>
        <button onClick={genModeleVehicule}
          style={{ padding:'6px 13px', border:'none', borderRadius:'6px', backgroundColor:'#7c3aed', color:'white', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>
          📋 Modèle · نموذج
        </button>
        <label style={{ padding:'6px 13px', borderRadius:'6px', backgroundColor: importing ? '#9ca3af' : '#1d4ed8', color:'white', fontWeight:'700', cursor: importing ? 'not-allowed' : 'pointer', fontSize:'12px', display:'inline-block' }}>
          {importing ? '⏳ Import…' : '📤 Importer · استيراد'}
          <input type="file" accept=".xlsx,.xls" onChange={handleImportVehicules} style={{ display:'none' }} disabled={importing} />
        </label>
      </div>

      {/* ── KPI flotte ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { l: 'Véhicules',      v: kpi.total,        i: '🚙', bg: '#dbeafe', c: '#1d4ed8', click: () => { setFiltreStatut(''); setFiltreType(''); setFiltreAlerte(''); setOnglet('parc'); } },
          { l: 'Opérationnels',  v: kpi.operationnel,  i: '✅', bg: '#dcfce7', c: '#15803d', click: () => { setFiltreStatut('OPERATIONNEL'); setOnglet('parc'); } },
          { l: 'En panne',       v: kpi.panne,         i: '🔴', bg: '#fee2e2', c: '#991b1b', click: () => { setFiltreStatut('EN PANNE');     setOnglet('parc'); } },
          { l: 'En révision',    v: kpi.revision,      i: '🔧', bg: '#fef9c3', c: '#854d0e', click: () => { setFiltreStatut('EN RÉVISION');  setOnglet('parc'); } },
          { l: 'Alertes dates',  v: kpi.alertes,       i: '🚨', bg: '#fee2e2', c: '#7f1d1d', click: () => { setFiltreAlerte('oui');          setOnglet('parc'); } },
          { l: 'Coût maintenance',v: numFr(kpi.coutMaint)+' DA', i: '💸', bg: '#f1f5f9', c: '#374151', click: () => setOnglet('maintenance') },
          { l: 'Carburant (L)',  v: numFr(kpi.litresTotal)+' L', i: '⛽', bg: '#f0fdf4', c: '#15803d', click: () => setOnglet('approvisionnement') },
        ].map(k => (
          <div key={k.l} onClick={k.click} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '13px 15px', cursor: 'pointer', transition: 'transform 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            <div style={{ fontSize: '18px', marginBottom: '4px' }}>{k.i}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{k.l}</div>
            <div style={{ fontSize: '19px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div className="nav-tabs">
        {[
          { key: 'parc',             label: '🚙 Parc Roulant',          bg: colors.blue  },
          { key: 'approvisionnement',label: '⛽ Approvisionnement',      bg: colors.green },
          { key: 'maintenance',      label: '🔧 Maintenance',            bg: colors.red   },
          { key: 'controle',         label: '📦 Contrôle des Biens',     bg: colors.dark  },
        ].map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)}
            className={`nav-tab${onglet === t.key ? ' active' : ''}`}
            style={onglet === t.key ? { backgroundColor: t.bg } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          ONGLET 1 — PARC ROULANT
      ════════════════════════════════════════════ */}
      {onglet === 'parc' && (
        <>
          {/* Barre filtres + bouton ajouter */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
            <input type="text" placeholder="🔍 Immatriculation, modèle, site…" value={recherche}
              onChange={e => setRecherche(e.target.value)} style={{ ...INP, maxWidth: '260px', flex: '1 1 180px' }} />
            <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ ...INP, maxWidth: '170px' }}>
              <option value="">Tous les statuts</option>
              {STATUTS_VEH.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filtreType} onChange={e => setFiltreType(e.target.value)} style={{ ...INP, maxWidth: '170px' }}>
              <option value="">Tous les types</option>
              {TYPES_VEH.map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={filtreAlerte} onChange={e => setFiltreAlerte(e.target.value)} style={{ ...INP, maxWidth: '160px' }}>
              <option value="">Toutes alertes</option>
              <option value="oui">🚨 Alertes actives</option>
            </select>
            {(recherche || filtreStatut || filtreType || filtreAlerte) && (
              <button onClick={() => { setRecherche(''); setFiltreStatut(''); setFiltreType(''); setFiltreAlerte(''); }}
                style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>✕</button>
            )}
            <button onClick={() => { setEditVeh(null); setFrmV(V_VIDE); setShowFrmV(v => !v); }}
              style={{ ...BTN_P, marginLeft: 'auto' }}>
              {showFrmV ? '✕ Annuler' : '＋ Enregistrer un véhicule'}
            </button>
          </div>

          {/* Formulaire véhicule */}
          {showFrmV && (
            <form onSubmit={soumettreVehicule} style={{ ...PANEL, border: '1px solid #bfdbfe', backgroundColor: '#f0f7ff', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#1e3a8a' }}>
                {editVeh ? `✏️ Modifier — ${editVeh.immatriculation}` : '➕ Nouveau véhicule'}
              </h3>

              {/* Bloc 1 : Identification */}
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Identification</p>
              <div style={{ ...GRID(150), marginBottom: '18px' }}>
                <div>
                  <label style={LBL}>Immatriculation <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required placeholder="12345 119 16" value={frmV.immatriculation}
                    onChange={e => setFrmV(p => ({ ...p, immatriculation: e.target.value.toUpperCase() }))} style={INP}
                    disabled={!!editVeh} />
                </div>
                <div>
                  <label style={LBL}>Marque & Modèle <span style={{ color: '#ef4444' }}>*</span></label>
                  <input required placeholder="Dacia Logan 1.5" value={frmV.marque_modele}
                    onChange={e => setFrmV(p => ({ ...p, marque_modele: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Type <span style={{ color: '#ef4444' }}>*</span></label>
                  <select required value={frmV.type_vehicule}
                    onChange={e => setFrmV(p => ({ ...p, type_vehicule: e.target.value }))} style={INP}>
                    {TYPES_VEH.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>Carburant</label>
                  <select value={frmV.carburant}
                    onChange={e => setFrmV(p => ({ ...p, carburant: e.target.value }))} style={INP}>
                    {CARBURANTS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>Couleur</label>
                  <input placeholder="Blanc" value={frmV.couleur}
                    onChange={e => setFrmV(p => ({ ...p, couleur: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Année</label>
                  <input type="number" placeholder="2020" min="1990" max="2030" value={frmV.annee}
                    onChange={e => setFrmV(p => ({ ...p, annee: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Date d'achat</label>
                  <input type="date" value={frmV.date_achat}
                    onChange={e => setFrmV(p => ({ ...p, date_achat: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Kilométrage actuel</label>
                  <input type="number" placeholder="45000" min="0" value={frmV.kilometrage}
                    onChange={e => setFrmV(p => ({ ...p, kilometrage: e.target.value }))} style={INP} />
                </div>
              </div>

              {/* Bloc 2 : Dates réglementaires */}
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '1px' }}>Dates réglementaires (alertes automatiques)</p>
              <div style={{ ...GRID(160), marginBottom: '18px' }}>
                <div>
                  <label style={{ ...LBL, color: '#991b1b' }}>Fin assurance <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="date" required value={frmV.date_assurance}
                    onChange={e => setFrmV(p => ({ ...p, date_assurance: e.target.value }))} style={{ ...INP, borderColor: '#fca5a5' }} />
                </div>
                <div>
                  <label style={{ ...LBL, color: '#b45309' }}>Fin vignette</label>
                  <input type="date" value={frmV.date_vignette}
                    onChange={e => setFrmV(p => ({ ...p, date_vignette: e.target.value }))} style={{ ...INP, borderColor: '#fcd34d' }} />
                </div>
                <div>
                  <label style={{ ...LBL, color: '#1d4ed8' }}>Contrôle technique</label>
                  <input type="date" value={frmV.date_ct}
                    onChange={e => setFrmV(p => ({ ...p, date_ct: e.target.value }))} style={{ ...INP, borderColor: '#93c5fd' }} />
                </div>
              </div>

              {/* Bloc 3 : Affectation */}
              <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '800', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>Affectation & Statut</p>
              <div style={{ ...GRID(160), marginBottom: '18px' }}>
                <div>
                  <label style={LBL}>Site / Affectation</label>
                  <input placeholder="Siège" value={frmV.site_actuel}
                    onChange={e => setFrmV(p => ({ ...p, site_actuel: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Statut</label>
                  <select value={frmV.statut}
                    onChange={e => setFrmV(p => ({ ...p, statut: e.target.value }))} style={INP}>
                    {STATUTS_VEH.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={LBL}>Notes</label>
                  <textarea rows="2" placeholder="Observations, historique…" value={frmV.notes}
                    onChange={e => setFrmV(p => ({ ...p, notes: e.target.value }))}
                    style={{ ...INP, resize: 'vertical', minHeight: '56px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => { setShowFrmV(false); setEditVeh(null); setFrmV(V_VIDE); }}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" disabled={loading} style={BTN_P}>
                  {loading ? '⏳' : editVeh ? '💾 Enregistrer les modifications' : '➕ Ajouter le véhicule'}
                </button>
              </div>
            </form>
          )}

          {/* Tableau flotte */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title">
                État de la flotte
                {vehFiltre.length !== vehicules.length && <span style={{ fontWeight: '400', color: '#6b7280', fontSize: '13px', marginLeft: '8px' }}>({vehFiltre.length} sur {vehicules.length})</span>}
              </h3>
              <button onClick={fetchVehicules} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '12px' }}>🔄</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Immatriculation', 'Modèle / Type', 'Carburant / Année', 'Kilométrage', 'Affectation', 'Dates réglementaires', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={TH(colors.blue)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vehFiltre.length === 0 ? (
                    <tr><td colSpan="8" className="empty-state">
                      {vehicules.length === 0 ? 'Aucun véhicule enregistré.' : 'Aucun résultat pour ces filtres.'}
                    </td></tr>
                  ) : vehFiltre.map((v, i) => {
                    const bs = BADGE_STATUT_VEH[v.statut] || BADGE_STATUT_VEH['HORS SERVICE'];
                    const assurAlerte = joursAlerte(v.date_assurance);
                    const rowBg = (assurAlerte?.level >= 2) ? '#fff5f5' : i % 2 === 0 ? 'white' : '#f8fafc';
                    return (
                      <tr key={v.id} style={{ backgroundColor: rowBg }}>
                        <td style={TD}>
                          <span style={{ border: '2px solid #1e3a8a', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', letterSpacing: '1px', fontSize: '13px', backgroundColor: 'white' }}>
                            {v.immatriculation}
                          </span>
                        </td>
                        <td style={TD}>
                          <div style={{ fontWeight: '700' }}>{v.marque_modele}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{v.type_vehicule}</div>
                        </td>
                        <td style={TD}>
                          <div style={{ fontSize: '12px' }}>{v.carburant || '—'}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{v.couleur} {v.annee ? `(${v.annee})` : ''}</div>
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{v.kilometrage ? numFr(v.kilometrage) + ' km' : '—'}</div>
                        </td>
                        <td style={{ ...TD, fontWeight: '600', color: colors.dark }}>📍 {v.site_actuel || 'Siège'}</td>
                        <td style={TD}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                            <DateChip label="Assurance" date={v.date_assurance} />
                            <DateChip label="Vignette"  date={v.date_vignette}  />
                            <DateChip label="CT"        date={v.date_ct}        />
                          </div>
                        </td>
                        <td style={TD}>
                          <select value={v.statut} onChange={e => changerStatutVeh(v.id, e.target.value)}
                            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', fontWeight: '800',
                              backgroundColor: bs.bg, color: bs.c, cursor: 'pointer' }}>
                            {STATUTS_VEH.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={TD}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => ouvrirEditionVeh(v)}
                              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#dbeafe', color: '#1d4ed8', cursor: 'pointer', fontWeight: '700' }}>
                              ✏️
                            </button>
                            <button onClick={() => { setFrmM(p => ({ ...p, vehicule_id: String(v.id) })); setShowFrmM(true); setOnglet('maintenance'); }}
                              style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #fcd34d', backgroundColor: '#fef9c3', color: '#854d0e', cursor: 'pointer', fontWeight: '700' }}>
                              🔧
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 2 — APPROVISIONNEMENT
      ════════════════════════════════════════════ */}
      {onglet === 'approvisionnement' && (
        <>
          {/* Sous-onglets */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[{ k: 'carburant', l: '⛽ Carburant' }, { k: 'commandes', l: '📦 Commandes générales' }].map(t => (
              <button key={t.k} onClick={() => setSousAppro(t.k)}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  backgroundColor: sousAppro === t.k ? '#15803d' : '#f1f5f9',
                  color:           sousAppro === t.k ? 'white'    : '#374151' }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── CARBURANT ── */}
          {sousAppro === 'carburant' && (
            <>
              <div className="card card-green" style={{ marginBottom: '16px' }}>
                <div className="flex-between mb-20">
                  <div>
                    <h3 className="section-title">⛽ Suivi Carburant</h3>
                    <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Enregistrez chaque plein par véhicule pour suivre la consommation.</p>
                  </div>
                  <button onClick={() => setShowFrmC(v => !v)} style={BTN_G}>
                    {showFrmC ? '✕ Annuler' : '＋ Nouveau plein'}
                  </button>
                </div>

                {showFrmC && (
                  <form onSubmit={soumettreCarburant} style={{ ...PANEL, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
                    <div style={GRID(160)}>
                      <div>
                        <label style={LBL}>Véhicule <span style={{ color: '#ef4444' }}>*</span></label>
                        <select required value={frmC.vehicule_id}
                          onChange={e => setFrmC(p => ({ ...p, vehicule_id: e.target.value }))} style={INP}>
                          <option value="">— Sélectionner —</option>
                          {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque_modele}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LBL}>Date du plein</label>
                        <input type="date" value={frmC.date_plein}
                          onChange={e => setFrmC(p => ({ ...p, date_plein: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Litres <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="number" required step="0.01" min="0" placeholder="45.5" value={frmC.litres}
                          onChange={e => setFrmC(p => ({ ...p, litres: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Prix / litre (DA)</label>
                        <input type="number" step="0.01" min="0" placeholder="60.00" value={frmC.prix_litre}
                          onChange={e => setFrmC(p => ({ ...p, prix_litre: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Fournisseur</label>
                        <select value={frmC.fournisseur}
                          onChange={e => setFrmC(p => ({ ...p, fournisseur: e.target.value }))} style={INP}>
                          {FOURNISSEURS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LBL}>Kilométrage compteur</label>
                        <input type="number" min="0" placeholder="45250" value={frmC.km_compteur}
                          onChange={e => setFrmC(p => ({ ...p, km_compteur: e.target.value }))} style={INP} />
                      </div>
                    </div>
                    {frmC.litres && frmC.prix_litre && (
                      <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#fef9c3', borderRadius: '8px', fontSize: '13px', color: '#92400e', fontWeight: '700', border: '1px solid #fcd34d' }}>
                        💰 Coût total estimé : {numFr(parseFloat(frmC.litres) * parseFloat(frmC.prix_litre))} DA
                      </div>
                    )}
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" onClick={() => setShowFrmC(false)}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                      <button type="submit" disabled={loading} style={BTN_G}>⛽ Enregistrer le plein</button>
                    </div>
                  </form>
                )}
              </div>

              {/* Tableau carburant */}
              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Véhicule', 'Date', 'Litres', 'Prix/L', 'Coût total', 'Km compteur', 'Fournisseur'].map(h => (
                        <th key={h} style={TH('#166534')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {carburants.length === 0 ? (
                      <tr><td colSpan="7" className="empty-state">Aucun plein enregistré.</td></tr>
                    ) : carburants.map((c, i) => (
                      <tr key={c.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                        <td style={{ ...TD, fontWeight: '700' }}>
                          {c.vehicules?.immatriculation || '—'}
                          <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{c.vehicules?.marque_modele}</div>
                        </td>
                        <td style={TD}>{dateFr(c.date_plein)}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: '700', color: '#15803d' }}>{numFr(c.litres)} L</td>
                        <td style={{ ...TD, textAlign: 'right' }}>{c.prix_litre ? numFr(c.prix_litre) + ' DA' : '—'}</td>
                        <td style={{ ...TD, textAlign: 'right', fontWeight: '800', color: '#1d4ed8' }}>
                          {c.litres && c.prix_litre ? numFr(parseFloat(c.litres) * parseFloat(c.prix_litre)) + ' DA' : '—'}
                        </td>
                        <td style={{ ...TD, textAlign: 'right' }}>{c.km_compteur ? numFr(c.km_compteur) + ' km' : '—'}</td>
                        <td style={TD}>{c.fournisseur}</td>
                      </tr>
                    ))}
                  </tbody>
                  {carburants.length > 0 && (
                    <tfoot>
                      <tr style={{ backgroundColor: '#166534', color: 'white' }}>
                        <td colSpan="2" style={{ padding: '10px 14px', fontWeight: '800', fontSize: '12px' }}>TOTAUX</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900' }}>{numFr(carburants.reduce((a, c) => a + (parseFloat(c.litres) || 0), 0))} L</td>
                        <td style={{ padding: '10px 14px' }}></td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '900' }}>
                          {numFr(carburants.reduce((a, c) => a + (parseFloat(c.litres) || 0) * (parseFloat(c.prix_litre) || 0), 0))} DA
                        </td>
                        <td colSpan="2" style={{ padding: '10px 14px' }}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {/* ── COMMANDES GÉNÉRALES ── */}
          {sousAppro === 'commandes' && (
            <>
              <div className="card card-green mb-20">
                <div className="flex-between mb-20">
                  <h3 className="section-title">📦 Commandes & Approvisionnements</h3>
                  <button onClick={() => setShowFrmCmd(v => !v)} style={BTN_G}>
                    {showFrmCmd ? '✕ Annuler' : '＋ Nouvelle commande'}
                  </button>
                </div>

                {showFrmCmd && (
                  <form onSubmit={soumettreCommande} style={{ ...PANEL, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', marginBottom: 0 }}>
                    <div style={GRID()}>
                      <div>
                        <label style={LBL}>Fournisseur <span style={{ color: '#ef4444' }}>*</span></label>
                        <select required value={frmCmd.fournisseur}
                          onChange={e => setFrmCmd(p => ({ ...p, fournisseur: e.target.value }))} style={INP}>
                          <option value="">— Sélectionner —</option>
                          {FOURNISSEURS.map(f => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={LBL}>Article <span style={{ color: '#ef4444' }}>*</span></label>
                        <input required placeholder="Ex : Huile moteur 5L" value={frmCmd.article}
                          onChange={e => setFrmCmd(p => ({ ...p, article: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Quantité <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="number" required min="1" value={frmCmd.quantite}
                          onChange={e => setFrmCmd(p => ({ ...p, quantite: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Date</label>
                        <input type="date" value={frmCmd.date_commande}
                          onChange={e => setFrmCmd(p => ({ ...p, date_commande: e.target.value }))} style={INP} />
                      </div>
                      <div>
                        <label style={LBL}>Statut</label>
                        <select value={frmCmd.statut}
                          onChange={e => setFrmCmd(p => ({ ...p, statut: e.target.value }))} style={INP}>
                          {['En attente', 'Validée', 'Livrée', 'Annulée'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" onClick={() => setShowFrmCmd(false)}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                      <button type="submit" disabled={loading} style={BTN_G}>📦 Enregistrer</button>
                    </div>
                  </form>
                )}
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Fournisseur', 'Article', 'Qté', 'Date', 'Statut', 'Actions'].map(h => (
                        <th key={h} style={TH('#166534')}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commandes.length === 0 ? (
                      <tr><td colSpan="6" className="empty-state">Aucune commande.</td></tr>
                    ) : commandes.map((c, i) => {
                      const st = { 'En attente': { bg: '#fef3c7', c: '#92400e', i: '⏳' }, 'Validée': { bg: '#dbeafe', c: '#1e40af', i: '✅' }, 'Livrée': { bg: '#dcfce7', c: '#166534', i: '🚚' }, 'Annulée': { bg: '#f1f5f9', c: '#6b7280', i: '✕' } }[c.statut] || {};
                      return (
                        <tr key={c.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                          <td style={TD}>{c.fournisseur}</td>
                          <td style={{ ...TD, fontWeight: '600' }}>{c.article}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>{c.quantite}</td>
                          <td style={TD}>{dateFr(c.date_commande)}</td>
                          <td style={TD}>
                            <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', backgroundColor: st.bg, color: st.c }}>
                              {st.i} {c.statut}
                            </span>
                          </td>
                          <td style={TD}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {c.statut === 'En attente' && <button onClick={() => changerStatutCmd(c.id, 'Validée')}  style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #93c5fd', bg: '#dbeafe', cursor: 'pointer', backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: '700' }}>Valider</button>}
                              {c.statut === 'Validée'    && <button onClick={() => changerStatutCmd(c.id, 'Livrée')}   style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #86efac', cursor: 'pointer', backgroundColor: '#dcfce7', color: '#166534', fontWeight: '700' }}>Livrée</button>}
                              <button onClick={() => supprimerCmd(c.id, c.article)}
                                style={{ fontSize: '11px', padding: '4px 9px', borderRadius: '6px', border: '1px solid #fca5a5', cursor: 'pointer', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '700' }}>🗑</button>
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
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 3 — MAINTENANCE
      ════════════════════════════════════════════ */}
      {onglet === 'maintenance' && (
        <>
          <div className="card card-red mb-16">
            <div className="flex-between mb-20">
              <div>
                <h3 className="section-title">🔧 Interventions Maintenance</h3>
                <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
                  Planifiez et suivez toutes les interventions techniques sur la flotte.
                </p>
              </div>
              <button onClick={() => setShowFrmM(v => !v)} style={BTN_R}>
                {showFrmM ? '✕ Annuler' : '＋ Nouvelle intervention'}
              </button>
            </div>

            {showFrmM && (
              <form onSubmit={soumettreIntervention} style={{ ...PANEL, border: '1px solid #fca5a5', backgroundColor: '#fff5f5' }}>
                <div style={GRID()}>
                  <div>
                    <label style={LBL}>Véhicule <span style={{ color: '#ef4444' }}>*</span></label>
                    <select required value={frmM.vehicule_id}
                      onChange={e => setFrmM(p => ({ ...p, vehicule_id: e.target.value }))} style={INP}>
                      <option value="">— Sélectionner —</option>
                      {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque_modele}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Type d'intervention <span style={{ color: '#ef4444' }}>*</span></label>
                    <select required value={frmM.type_intervention}
                      onChange={e => setFrmM(p => ({ ...p, type_intervention: e.target.value }))} style={INP}>
                      {TYPES_MAINT.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>Date intervention</label>
                    <input type="date" value={frmM.date_intervention}
                      onChange={e => setFrmM(p => ({ ...p, date_intervention: e.target.value }))} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Coût (DA)</label>
                    <input type="number" min="0" placeholder="15000" value={frmM.cout}
                      onChange={e => setFrmM(p => ({ ...p, cout: e.target.value }))} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Kilométrage</label>
                    <input type="number" min="0" placeholder="45200" value={frmM.kilometrage}
                      onChange={e => setFrmM(p => ({ ...p, kilometrage: e.target.value }))} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Technicien / Garage</label>
                    <input placeholder="Garage El Amel" value={frmM.technicien}
                      onChange={e => setFrmM(p => ({ ...p, technicien: e.target.value }))} style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Statut</label>
                    <select value={frmM.statut}
                      onChange={e => setFrmM(p => ({ ...p, statut: e.target.value }))} style={INP}>
                      {STATUTS_MAINT.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={LBL}>Description / Détail</label>
                    <textarea rows="2" placeholder="Nature de l'intervention, pièces remplacées…" value={frmM.description}
                      onChange={e => setFrmM(p => ({ ...p, description: e.target.value }))}
                      style={{ ...INP, resize: 'vertical', minHeight: '56px' }} />
                  </div>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button type="button" onClick={() => setShowFrmM(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                  <button type="submit" disabled={loading} style={BTN_R}>🔧 Enregistrer l'intervention</button>
                </div>
              </form>
            )}
          </div>

          {/* Tableau maintenance */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}>
              <h3 className="section-title">Historique des interventions</h3>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                Coût total (terminées) : <strong style={{ color: '#1e3a8a' }}>{numFr(kpi.coutMaint)} DA</strong>
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Véhicule', 'Type', 'Date', 'Coût', 'Km', 'Technicien', 'Description', 'Statut'].map(h => (
                    <th key={h} style={TH(colors.red)}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {maintenances.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">Aucune intervention enregistrée.</td></tr>
                ) : maintenances.map((m, i) => {
                  const bs = BADGE_STATUT_M[m.statut] || BADGE_STATUT_M['Planifiée'];
                  return (
                    <tr key={m.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fff8f8' }}>
                      <td style={{ ...TD, fontWeight: '700' }}>
                        {m.vehicules?.immatriculation || '—'}
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{m.vehicules?.marque_modele}</div>
                      </td>
                      <td style={{ ...TD, fontWeight: '600', color: '#7f1d1d' }}>{m.type_intervention}</td>
                      <td style={TD}>{dateFr(m.date_intervention)}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: '700' }}>
                        {m.cout ? numFr(m.cout) + ' DA' : '—'}
                      </td>
                      <td style={{ ...TD, textAlign: 'right' }}>{m.kilometrage ? numFr(m.kilometrage) + ' km' : '—'}</td>
                      <td style={TD}>{m.technicien || '—'}</td>
                      <td style={{ ...TD, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#6b7280', fontSize: '12px' }}>
                        {m.description || '—'}
                      </td>
                      <td style={TD}>
                        <select value={m.statut} onChange={e => changerStatutMaint(m.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', fontWeight: '700',
                            backgroundColor: bs.bg, color: bs.c, cursor: 'pointer' }}>
                          {STATUTS_MAINT.map(s => <option key={s}>{s}</option>)}
                        </select>
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
          ONGLET 4 — CONTRÔLE DES BIENS
      ════════════════════════════════════════════ */}
      {onglet === 'controle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Banner vers module Tenues */}
          <div style={{ backgroundColor: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '14px', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>👕</div>
              <h3 style={{ margin: '0 0 6px 0', color: '#1e3a8a', fontSize: '16px', fontWeight: '800' }}>
                Module Tenues — Gestion complète avec matricule
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#3b82f6' }}>
                Catalogue · Exemplaires (T-AAAA-NNN) · Attributions · Historique · Alertes stock &amp; fin de vie
              </p>
            </div>
            <button onClick={() => navigate('/tenues')}
              style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '800', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Ouvrir le module Tenues →
            </button>
          </div>

          {/* Dotations existantes (rétro-compat) */}
          <div className="card card-dark">
            <h3 className="section-title mb-10">📋 Dotations uniformes (ancien registre)</h3>
            <p className="text-sm text-muted" style={{ marginBottom: '14px' }}>
              Historique des dotations enregistrées via l'ancien système. Utilisez désormais le module Tenues.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Agent', 'Article', 'Taille', 'Date', 'Statut'].map(h => (
                      <th key={h} style={TH(colors.dark)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dotations.length === 0 ? (
                    <tr><td colSpan="5" className="empty-state">Aucune dotation dans l'ancien registre.</td></tr>
                  ) : dotations.map((d, i) => {
                    const nom = d.agents ? (Array.isArray(d.agents) ? d.agents[0]?.nom : d.agents.nom) : '—';
                    return (
                      <tr key={d.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ ...TD, fontWeight: '700' }}>{nom}</td>
                        <td style={TD}>{d.article}</td>
                        <td style={TD}>{d.taille}</td>
                        <td style={TD}>{d.date_distribution ? dateFr(d.date_distribution) : '—'}</td>
                        <td style={TD}>
                          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: '700',
                            backgroundColor: d.statut === 'EN POSSESSION' ? '#dcfce7' : '#f1f5f9',
                            color: d.statut === 'EN POSSESSION' ? '#15803d' : '#6b7280' }}>
                            {d.statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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

export default Logistique;
