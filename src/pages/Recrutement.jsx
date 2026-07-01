import React, { useState, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants';
import { Button, Badge, Card, Table, Modal, useModal } from '../components/ui';
import { recognizeDocument, parseRecruitmentData, extractRecruitmentDataWithClaude, extractRecruitmentDataWithDeepSeek } from '../utils/ocr';
import { exportToExcel, generateTemplate, importFromExcel, buildReport, upsertRows } from '../utils/excelUtils';
import { toast } from '../store/useToastStore';
import ImportPreviewModal from '../components/ImportPreviewModal';

// ── Helpers ─────────────────────────────────────────────────────────────────
const dateFr    = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const joursAvant = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : 999;
const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f9fafb' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };

function badgeCarte(jours) {
  if (jours <= 0)  return { bg: '#fee2e2', c: '#991b1b', txt: `Expirée (${Math.abs(jours)}j)`,  icon: '🚨' };
  if (jours <= 30) return { bg: '#fee2e2', c: '#991b1b', txt: `${jours}j restants`,              icon: '🔴' };
  if (jours <= 60) return { bg: '#fef3c7', c: '#92400e', txt: `${jours}j restants`,              icon: '🟡' };
  if (jours <= 90) return { bg: '#fef9c3', c: '#854d0e', txt: `${jours}j restants`,              icon: '🟠' };
  return                   { bg: '#dcfce7', c: '#15803d', txt: `OK (${jours}j)`,                  icon: '✅' };
}

function badgeContrat(jours) {
  if (jours <= 0)  return { bg: '#fee2e2', c: '#991b1b', txt: 'Expiré'                };
  if (jours <= 30) return { bg: '#fee2e2', c: '#991b1b', txt: `${jours}j`             };
  if (jours <= 60) return { bg: '#fef3c7', c: '#92400e', txt: `${jours}j`             };
  return                   { bg: '#f0fdf4', c: '#15803d', txt: dateFr(new Date(Date.now() + jours*86400000)) };
}

async function genMatriculeAgent() {
  const yr = new Date().getFullYear();
  const pfx = `AG-${yr}-`;
  const { data } = await supabase.from('agents').select('matricule').ilike('matricule', `${pfx}%`).not('matricule', 'is', null).order('matricule', { ascending: false }).limit(1);
  const last = data?.length ? parseInt(data[0].matricule.split('-')[2]) || 0 : 0;
  return `${pfx}${String(last + 1).padStart(3, '0')}`;
}

const FORM_INIT = {
  matricule: '', nom: '', prenom: '', dateNaissance: '', numCin: '', telephone: '', wilaya: '',
  dateEmbauche: '', qualification: 'Agent Simple', cqp: 'NON', numCartePro: '', validiteCartePro: '',
  siteAffecte: '', typeContrat: 'CDD', dateFin: '', numAnem: '',
};

// ══════════════════════════════════════════════════════════════════════════════
function Recrutement() {
  const { agentsData, fetchToutesLesDonnees } = useDataStore();
  const { t } = useTranslation();
  const [sousMenu, setSousMenu]         = useState('dashboard');
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(FORM_INIT);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const deleteModal = useModal();

  // États OCR
  const [scanLoading, setScanLoading]   = useState(false);
  const [ocrStatus, setOcrStatus]       = useState('');
  const [ocrText, setOcrText]           = useState('');
  const [parsedData, setParsedData]     = useState({});

  // Filtres Personnel
  const [rechercheNom,       setRechercheNom]       = useState('');
  const [rechercheSite,      setRechercheSite]       = useState('');
  const [filtreQualif,       setFiltreQualif]        = useState('');
  const [filtreContrat,      setFiltreContrat]       = useState('');

  // Filtres Archives
  const [rechercheArchive,   setRechercheArchive]    = useState('');

  // Filtres Cartes Pro
  const [filtreCarteDelai,   setFiltreCarteDelai]    = useState('90');

  // Désactivation agent
  const [agentADesactiver,   setAgentADesactiver]    = useState(null);
  const [motifSortie,        setMotifSortie]         = useState('FIN_CONTRAT');
  const [dateSortie,         setDateSortie]          = useState('');
  const [actionLoad,         setActionLoad]          = useState(false);

  // Renouvellement carte pro
  const [agentRenouvellement, setAgentRenouvellement] = useState(null);
  const [nouvelleCarte,        setNouvelleCarte]       = useState({ num: '', validite: '' });

  const [chargement, setChargement] = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [importPreview, setImportPreview] = useState(null);

  // ── Données dérivées ──────────────────────────────────────────────────────
  const agentsActifs   = useMemo(() => agentsData.filter(a => a.statut_agent !== 'INACTIF'), [agentsData]);
  const agentsInactifs = useMemo(() => agentsData.filter(a => a.statut_agent === 'INACTIF'),  [agentsData]);

  const sitesUniques = useMemo(() =>
    [...new Set(agentsActifs.map(a => a.site_affecte).filter(Boolean))].sort(),
    [agentsActifs]);

  const agentsFiltres = useMemo(() => agentsActifs.filter(a => {
    if (rechercheNom  && !(a.nom || '').toLowerCase().includes(rechercheNom.toLowerCase()) && !(a.matricule || '').toLowerCase().includes(rechercheNom.toLowerCase())) return false;
    if (rechercheSite && a.site_affecte !== rechercheSite) return false;
    if (filtreQualif  && a.qualification !== filtreQualif) return false;
    if (filtreContrat && a.type_contrat  !== filtreContrat) return false;
    return true;
  }), [agentsActifs, rechercheNom, rechercheSite, filtreQualif, filtreContrat]);

  const agentsArchivesFiltres = useMemo(() => agentsInactifs.filter(a =>
    !rechercheArchive || (a.nom || '').toLowerCase().includes(rechercheArchive.toLowerCase()) || (a.matricule || '').toLowerCase().includes(rechercheArchive.toLowerCase())
  ), [agentsInactifs, rechercheArchive]);

  const agentsCarteAlerte = useMemo(() =>
    agentsActifs
      .filter(a => a.validite_carte_pro && joursAvant(a.validite_carte_pro) <= parseInt(filtreCarteDelai))
      .sort((a, b) => joursAvant(a.validite_carte_pro) - joursAvant(b.validite_carte_pro)),
    [agentsActifs, filtreCarteDelai]);

  // KPIs
  const kpi = useMemo(() => {
    const cartes30 = agentsActifs.filter(a => a.validite_carte_pro && joursAvant(a.validite_carte_pro) <= 30).length;
    const cartes60 = agentsActifs.filter(a => a.validite_carte_pro && joursAvant(a.validite_carte_pro) <= 60 && joursAvant(a.validite_carte_pro) > 30).length;
    const cdd30    = agentsActifs.filter(a => a.type_contrat === 'CDD' && a.date_fin_contrat && joursAvant(a.date_fin_contrat) <= 30).length;
    const sansCarte = agentsActifs.filter(a => !a.num_carte_pro).length;
    const byQualif = agentsActifs.reduce((acc, a) => { acc[a.qualification || 'N/A'] = (acc[a.qualification || 'N/A'] || 0) + 1; return acc; }, {});
    return { cartes30, cartes60, cdd30, sansCarte, byQualif };
  }, [agentsActifs]);

  // Agents recrutés dans les 10 derniers jours → countdown CNAS (décret 94-11)
  const agentsCnasPending = useMemo(() =>
    agentsActifs
      .filter(a => {
        if (!a.date_recrutement) return false;
        const joursEcoules = Math.floor((Date.now() - new Date(a.date_recrutement)) / 86400000);
        return joursEcoules >= 0 && joursEcoules <= 10;
      })
      .map(a => {
        const joursEcoules = Math.floor((Date.now() - new Date(a.date_recrutement)) / 86400000);
        return { ...a, joursRestantsCnas: 10 - joursEcoules };
      })
      .sort((a, b) => a.joursRestantsCnas - b.joursRestantsCnas),
    [agentsActifs]);

  // ── OCR ──────────────────────────────────────────────────────────────────
  const handleScanFile = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    setScanLoading(true); setOcrStatus('Analyse OCR en cours…'); setOcrText(''); setParsedData({});
    try {
      const text = await recognizeDocument(file, ({ progress, status }) => setOcrStatus(`${status} (${Math.round(progress * 100)}%)`));
      setOcrText(text);
      const parsed = parseRecruitmentData(text);
      setParsedData(parsed); setOcrStatus('OCR terminé. Données extraites.');
    } catch (err) { setOcrStatus(`Erreur OCR: ${err.message}`); }
    finally { setScanLoading(false); }
  };

  const fillFromData = useCallback(data => {
    if (!data || typeof data !== 'object') return;
    if (data.nom)          setF('nom',           data.nom);
    if (data.prenom)       setF('prenom',        data.prenom);
    if (data.dateNaissance)setF('dateNaissance', data.dateNaissance);
    if (data.numCin)       setF('numCin',        data.numCin);
    if (data.telephone)    setF('telephone',     data.telephone);
    if (data.wilaya)       setF('wilaya',        data.wilaya);
  }, []);

  const handleExtractWithClaude = async () => {
    if (!ocrText) return;
    setScanLoading(true); setOcrStatus('Extraction Claude en cours…');
    try { const r = await extractRecruitmentDataWithClaude(ocrText); setParsedData(r); fillFromData(r); setOcrStatus('Extraction Claude réussie.'); }
    catch (err) { setOcrStatus(`Erreur Claude: ${err.message}`); }
    finally { setScanLoading(false); }
  };

  const handleExtractWithDeepSeek = async () => {
    if (!ocrText) return;
    setScanLoading(true); setOcrStatus('Extraction DeepSeek en cours…');
    try { const r = await extractRecruitmentDataWithDeepSeek(ocrText, parsedData); setParsedData(r); fillFromData(r); setOcrStatus('Extraction DeepSeek réussie.'); }
    catch (err) { setOcrStatus(`Erreur DeepSeek: ${err.message}`); }
    finally { setScanLoading(false); }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const recruterAgent = async e => {
    e.preventDefault();
    if (!form.nom || !form.prenom || !form.dateEmbauche || !form.typeContrat) return;
    setChargement(true);
    const matricule = form.matricule || await genMatriculeAgent();
    const { data: newAgent, error } = await supabase.from('agents').insert([{
      matricule,
      nom: (form.nom + ' ' + form.prenom).toUpperCase(),
      prenom: form.prenom.toUpperCase(),
      date_naissance: form.dateNaissance || null,
      carte_identite_num: form.numCin, telephone: form.telephone, wilaya: form.wilaya,
      date_recrutement: form.dateEmbauche, type_contrat: form.typeContrat,
      date_fin_contrat: form.typeContrat === 'CDI' ? null : form.dateFin || null,
      numero_anem: form.numAnem, qualification: form.qualification,
      cqp_formation: form.cqp === 'OUI',
      num_carte_pro: form.numCartePro,
      validite_carte_pro: form.validiteCartePro || null,
      site_affecte: form.siteAffecte || 'En attente',
      statut_agent: 'ACTIF', heure_pointage: '00:00:00',
    }]).select('id').single();
    if (!error && newAgent) {
      // Génère les alertes légales CNAS / ANEM automatiquement (requiert la migration SQL)
      const { error: rpcErr } = await supabase.rpc('generer_alertes_recrutement', { p_agent_id: newAgent.id });
      if (rpcErr) console.warn('[CNAS] Alertes non générées (migration SQL requise):', rpcErr.message);
    }
    setChargement(false);
    if (!error) {
      setShowForm(false); setForm(FORM_INIT);
      if (fetchToutesLesDonnees) fetchToutesLesDonnees();
    } else alert('Erreur lors de l\'enregistrement.');
  };

  const desactiverAgent = async () => {
    if (!agentADesactiver || !dateSortie) return;
    setActionLoad(true);
    await supabase.from('agents').update({ statut_agent: 'INACTIF', motif_sortie: motifSortie, date_sortie: dateSortie }).eq('id', agentADesactiver.id);
    setActionLoad(false); setAgentADesactiver(null); setMotifSortie('FIN_CONTRAT'); setDateSortie('');
    if (fetchToutesLesDonnees) fetchToutesLesDonnees();
  };

  const reactiverAgent = async id => {
    await supabase.from('agents').update({ statut_agent: 'ACTIF', motif_sortie: null, date_sortie: null }).eq('id', id);
    if (fetchToutesLesDonnees) fetchToutesLesDonnees();
  };

  const sauvegarderRenouvellement = async () => {
    if (!agentRenouvellement || !nouvelleCarte.validite) return;
    setActionLoad(true);
    await supabase.from('agents').update({ num_carte_pro: nouvelleCarte.num, validite_carte_pro: nouvelleCarte.validite }).eq('id', agentRenouvellement.id);
    setActionLoad(false); setAgentRenouvellement(null); setNouvelleCarte({ num: '', validite: '' });
    if (fetchToutesLesDonnees) fetchToutesLesDonnees();
  };

  const exporterCSV = () => {
    const esc = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
    const entetes = ['Matricule', 'Nom', 'Téléphone', 'Wilaya', 'Qualification', 'CQP', 'N° Carte Pro', 'Validité Carte', 'Type Contrat', 'Date Fin Contrat', 'Site affecté', 'Date embauche'];
    const rows = agentsFiltres.map(a => [
      a.matricule, a.nom, a.telephone, a.wilaya, a.qualification,
      a.cqp_formation ? 'OUI' : 'NON', a.num_carte_pro, a.validite_carte_pro,
      a.type_contrat, a.date_fin_contrat, a.site_affecte, a.date_recrutement,
    ]);
    const csv = 'data:text/csv;charset=utf-8,﻿' + entetes.map(esc).join(';') + '\n' + rows.map(r => r.map(esc).join(';')).join('\n');
    const link = document.createElement('a'); link.href = encodeURI(csv);
    link.download = `Personnel_DZSecurity_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ── Excel agents ──────────────────────────────────────────────────────────
  const AGENTS_COLS = [
    { key: 'matricule',          label: 'Matricule',             labelAr: 'الرقم المرجعي',          required: true,  example: 'AG-2025-001' },
    { key: 'nom',                label: 'Nom Complet',           labelAr: 'الاسم الكامل',            required: true,  example: 'BENALI AHMED' },
    { key: 'telephone',          label: 'Téléphone',             labelAr: 'الهاتف',                 example: '0555123456' },
    { key: 'wilaya',             label: 'Wilaya',                labelAr: 'الولاية',                example: 'Alger' },
    { key: 'date_naissance',     label: 'Date de naissance',     labelAr: 'تاريخ الميلاد',          type: 'date',    example: '1990-05-15' },
    { key: 'carte_identite_num', label: 'N° CIN',                labelAr: 'رقم بطاقة الهوية',       example: '123456789012345' },
    { key: 'qualification',      label: 'Qualification',         labelAr: 'التأهيل',                type: 'enum', enumValues: ['Agent Simple','Chef de Groupe','Chef de Site','Maître-Chien','Convoyeur de Fonds'], example: 'Agent Simple' },
    { key: 'num_carte_pro',      label: 'N° Carte Pro',          labelAr: 'رقم البطاقة المهنية',    example: 'CP-2025-102' },
    { key: 'validite_carte_pro', label: 'Validité Carte Pro',    labelAr: 'صلاحية البطاقة المهنية', type: 'date',    example: '2026-12-31' },
    { key: 'site_affecte',       label: 'Site affecté',          labelAr: 'الموقع المعيّن',         example: 'BNA Alger' },
    { key: 'type_contrat',       label: 'Type contrat',          labelAr: 'نوع العقد',              type: 'enum', enumValues: ['CDI','CDD'], example: 'CDI' },
    { key: 'date_recrutement',   label: 'Date embauche',         labelAr: 'تاريخ التوظيف',          type: 'date', required: true, example: '2025-01-15' },
    { key: 'date_fin_contrat',   label: 'Date fin contrat',      labelAr: 'تاريخ انتهاء العقد',     type: 'date', example: '2026-01-14' },
    { key: 'numero_anem',        label: 'N° ANEM',               labelAr: 'رقم ANEM',               example: '' },
    { key: 'cqp_formation',      label: 'Formation CQP',         labelAr: 'تكوين CQP',              type: 'boolean', example: 'NON' },
    { key: 'statut_agent',       label: 'Statut',                labelAr: 'الحالة',                 skipImport: true, example: 'ACTIF' },
  ];

  const exporterExcel = () => exportToExcel(agentsFiltres, AGENTS_COLS, 'Personnel_DZSecurity');
  const genererModele = () => generateTemplate(AGENTS_COLS, 'agents');

  const handleImportAgents = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const { rows, errors } = await importFromExcel(file, AGENTS_COLS);
      setImportPreview({
        rows, errors, colDefs: AGENTS_COLS,
        label: 'Import Agents · استيراد الأعوان',
        onConfirm: async (validRows) => {
          const { inserted, errorsCount } = await upsertRows(supabase, 'agents', validRows, 'matricule', { statut_agent: 'ACTIF' });
          toast.success(buildReport({ total: validRows.length, inserted, errorsCount }));
          if (errors.length) toast.warning(`${errors.length} ligne(s) ignorée(s) — consultez la console`);
          if (fetchToutesLesDonnees) fetchToutesLesDonnees();
          setImportPreview(null);
        },
      });
    } catch (err) {
      toast.error('Erreur lecture fichier : ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>📝</span>
        <div>
          <h1 className="page-title">SERVICE RECRUTEMENT & CARRIÈRE</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {agentsActifs.length} agents actifs · {agentsInactifs.length} en archives · {kpi.cartes30 + kpi.cartes60} alertes carte pro
          </p>
        </div>
        {sousMenu === 'personnel' && !showForm && (
          <button onClick={() => { setShowForm(true); setForm(FORM_INIT); setSousMenu('personnel'); }}
            style={{ marginLeft: 'auto', padding: '10px 18px', borderRadius: '9px', border: 'none', backgroundColor: colors.blue, color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
            + Nouveau Recrutement
          </button>
        )}
      </div>

      {/* ── Barre Excel agents ── */}
      {sousMenu === 'personnel' && !showForm && (
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', padding:'10px 14px', marginBottom:'16px', backgroundColor:'#f0f9ff', borderRadius:'10px', border:'1px solid #bae6fd' }}>
          <span style={{ fontSize:'12px', fontWeight:'800', color:'#0369a1', marginRight:'4px' }}>📊 Excel / إكسل</span>
          <button onClick={exporterExcel} disabled={!agentsFiltres.length}
            style={{ padding:'6px 13px', border:'none', borderRadius:'6px', backgroundColor: agentsFiltres.length ? '#059669' : '#d1fae5', color: agentsFiltres.length ? 'white' : '#6b7280', fontWeight:'700', cursor: agentsFiltres.length ? 'pointer' : 'not-allowed', fontSize:'12px' }}>
            📥 Exporter ({agentsFiltres.length}) · تصدير
          </button>
          <button onClick={genererModele}
            style={{ padding:'6px 13px', border:'none', borderRadius:'6px', backgroundColor:'#7c3aed', color:'white', fontWeight:'700', cursor:'pointer', fontSize:'12px' }}>
            📋 Modèle · نموذج
          </button>
          <label style={{ padding:'6px 13px', borderRadius:'6px', backgroundColor: importing ? '#9ca3af' : '#1d4ed8', color:'white', fontWeight:'700', cursor: importing ? 'not-allowed' : 'pointer', fontSize:'12px', display:'inline-block' }}>
            {importing ? '⏳ Import…' : '📤 Importer · استيراد'}
            <input type="file" accept=".xlsx,.xls" onChange={handleImportAgents} style={{ display:'none' }} disabled={importing} />
          </label>
        </div>
      )}

      {/* Onglets */}
      <div className="nav-tabs mb-20">
        {[
          { key: 'dashboard', label: '📊 Tableau de Bord', bg: '#1e3a8a'  },
          { key: 'personnel', label: '👥 Personnel & Contrats', bg: colors.blue },
          { key: 'cartes',    label: `🪪 Cartes Pro${kpi.cartes30 > 0 ? ` (${kpi.cartes30} 🚨)` : ''}`, bg: '#7c3aed' },
          { key: 'organismes',label: '📋 Organismes & ANEM', bg: colors.green },
          { key: 'archives',  label: `🗄️ Archives (${agentsInactifs.length})`, bg: '#6b7280' },
        ].map(t => (
          <button key={t.key} onClick={() => setSousMenu(t.key)} className={`nav-tab${sousMenu === t.key ? ' active' : ''}`}
            style={sousMenu === t.key ? { backgroundColor: t.bg } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          ONGLET 1 — TABLEAU DE BORD
      ════════════════════════════════════════════ */}
      {sousMenu === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Bannière CNAS — agents recrutés dans les 10 derniers jours */}
          {agentsCnasPending.length > 0 && (
            <div style={{ backgroundColor: '#fee2e2', borderRadius: '12px', padding: '16px 20px', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '22px' }}>🏛️</span>
                <div>
                  <h3 style={{ margin: 0, fontWeight: '900', color: '#991b1b', fontSize: '14px' }}>
                    Déclarations CNAS en attente — {agentsCnasPending.length} agent{agentsCnasPending.length > 1 ? 's' : ''}
                  </h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#7f1d1d' }}>
                    Délai légal : 10 jours ouvrables — Décret exécutif 94-11 · loi 83-14 art. 13
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {agentsCnasPending.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderRadius: '8px', padding: '10px 14px' }}>
                    <div>
                      <span style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '13px' }}>{a.nom}</span>
                      <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '8px' }}>
                        · {a.matricule} · Recruté le {dateFr(a.date_recrutement)}
                      </span>
                    </div>
                    <span style={{
                      padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800',
                      backgroundColor: a.joursRestantsCnas <= 1 ? '#7f1d1d' : a.joursRestantsCnas <= 3 ? '#dc2626' : '#fecaca',
                      color: a.joursRestantsCnas <= 3 ? 'white' : '#991b1b',
                    }}>
                      {a.joursRestantsCnas <= 0 ? '⚠️ Dépassé !' : `J-${a.joursRestantsCnas}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {[
              { l: 'Agents Actifs',    v: agentsActifs.length,   bg: '#dbeafe', c: '#1d4ed8', icon: '👥' },
              { l: 'Sans carte pro',   v: kpi.sansCarte,          bg: '#fde8ff', c: '#7c3aed', icon: '⚠️', click: () => setSousMenu('cartes') },
              { l: '< 30j (carte)',    v: kpi.cartes30,           bg: '#fee2e2', c: '#991b1b', icon: '🚨', click: () => setSousMenu('cartes') },
              { l: '30-60j (carte)',   v: kpi.cartes60,           bg: '#fef3c7', c: '#92400e', icon: '🟡', click: () => setSousMenu('cartes') },
              { l: 'CDD < 30j',        v: kpi.cdd30,              bg: '#fee2e2', c: '#991b1b', icon: '📄', click: () => setSousMenu('personnel') },
              { l: 'Agents Inactifs',  v: agentsInactifs.length,  bg: '#f3f4f6', c: '#374151', icon: '🗄️', click: () => setSousMenu('archives') },
            ].map(k => (
              <div key={k.l} onClick={k.click}
                style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '14px', cursor: k.click ? 'pointer' : 'default', transition: 'transform 0.1s' }}
                onMouseEnter={e => k.click && (e.currentTarget.style.transform = 'scale(1.04)')}
                onMouseLeave={e => k.click && (e.currentTarget.style.transform = 'scale(1)')}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icon}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
                <div style={{ fontSize: '24px', fontWeight: '900', color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* Répartition qualification */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#1e3a8a', fontSize: '14px' }}>🎖️ Répartition par Qualification</h3>
              {Object.entries(kpi.byQualif).sort((a, b) => b[1] - a[1]).map(([q, n]) => (
                <div key={q} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: '#374151' }}>
                    <span>{q}</span><span style={{ color: colors.blue }}>{n} agents</span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round((n / agentsActifs.length) * 100)}%`, backgroundColor: colors.blue, borderRadius: '4px', transition: 'width 0.4s' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Urgences cartes pro */}
            <div className="card" style={{ border: kpi.cartes30 > 0 ? '2px solid #ef4444' : '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: kpi.cartes30 > 0 ? '#991b1b' : '#374151', fontSize: '14px' }}>
                🚨 Cartes Pro — Renouvellement urgent
              </h3>
              {agentsActifs.filter(a => a.validite_carte_pro && joursAvant(a.validite_carte_pro) <= 60).slice(0, 6).map(a => {
                const j = joursAvant(a.validite_carte_pro);
                const b = badgeCarte(j);
                return (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginBottom: '6px', borderRadius: '8px', backgroundColor: b.bg }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>{a.nom}</div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: b.c }}>{b.icon} {b.txt}</span>
                  </div>
                );
              })}
              {kpi.cartes30 + kpi.cartes60 === 0 && <p style={{ margin: 0, color: '#15803d', fontWeight: '700', fontSize: '13px' }}>✅ Aucune carte urgente dans les 60 prochains jours.</p>}
              {kpi.cartes30 + kpi.cartes60 > 6 && (
                <button onClick={() => setSousMenu('cartes')} style={{ marginTop: '8px', width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                  Voir toutes les alertes →
                </button>
              )}
            </div>

            {/* CDD arrivant à terme */}
            <div className="card">
              <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#374151', fontSize: '14px' }}>📄 CDD arrivant à terme</h3>
              {agentsActifs.filter(a => a.type_contrat === 'CDD' && a.date_fin_contrat && joursAvant(a.date_fin_contrat) <= 60)
                .sort((a, b) => joursAvant(a.date_fin_contrat) - joursAvant(b.date_fin_contrat))
                .slice(0, 5).map(a => {
                  const j = joursAvant(a.date_fin_contrat);
                  const b = badgeContrat(j);
                  return (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', marginBottom: '6px', borderRadius: '8px', backgroundColor: b.bg }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#374151' }}>{a.nom}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{a.site_affecte}</div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: b.c }}>{j <= 0 ? '🚨 Expiré' : `${j}j`}</span>
                    </div>
                  );
                })}
              {agentsActifs.filter(a => a.type_contrat === 'CDD' && a.date_fin_contrat && joursAvant(a.date_fin_contrat) <= 60).length === 0 &&
                <p style={{ margin: 0, color: '#15803d', fontWeight: '700', fontSize: '13px' }}>✅ Aucun CDD à renouveler dans les 60 jours.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 2 — PERSONNEL & CONTRATS
      ════════════════════════════════════════════ */}
      {sousMenu === 'personnel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Formulaire de recrutement */}
          {showForm && (
            <div className="card card-blue">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #bfdbfe' }}>
                <h2 style={{ margin: 0, fontWeight: '900', color: '#1e3a8a', fontSize: '16px' }}>📋 Dossier de Recrutement</h2>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#ef4444' }}>✖</button>
              </div>

              <form onSubmit={recruterAgent}>
                {/* OCR */}
                <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '14px', marginBottom: '18px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#374151', marginBottom: '10px' }}>📷 SCAN DOCUMENT (OCR)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <input type="file" accept="image/*" capture="environment" onChange={handleScanFile} style={{ fontSize: '12px', flex: 1, minWidth: '160px' }} />
                    <button type="button" onClick={() => { fillFromData(parsedData); }} disabled={!ocrText || scanLoading}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#374151', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700', opacity: !ocrText || scanLoading ? 0.5 : 1 }}>
                      Remplir OCR
                    </button>
                    <button type="button" onClick={handleExtractWithClaude} disabled={!ocrText || scanLoading}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700', opacity: !ocrText || scanLoading ? 0.5 : 1 }}>
                      Claude
                    </button>
                    <button type="button" onClick={handleExtractWithDeepSeek} disabled={!ocrText || scanLoading}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#0891b2', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700', opacity: !ocrText || scanLoading ? 0.5 : 1 }}>
                      DeepSeek
                    </button>
                  </div>
                  {ocrStatus && <div style={{ marginTop: '8px', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>{ocrStatus}</div>}
                </div>

                {/* Section 1 — État civil */}
                <h4 style={{ color: colors.blue, margin: '0 0 12px 0', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>1. État civil & coordonnées</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                  {[
                    { k: 'matricule',    l: 'Matricule',         ph: 'Auto-généré' },
                    { k: 'nom',          l: 'Nom (اللقب) *',     req: true  },
                    { k: 'prenom',       l: 'Prénom (الاسم) *',  req: true  },
                    { k: 'dateNaissance',l: 'Date naissance',     tp: 'date' },
                    { k: 'numCin',       l: 'N° CIN'             },
                    { k: 'telephone',    l: 'Téléphone'          },
                    { k: 'wilaya',       l: 'Wilaya',            ph: 'Ex: 16 - Alger' },
                  ].map(f => (
                    <div key={f.k}>
                      <label style={LBL}>{f.l}</label>
                      <input type={f.tp || 'text'} value={form[f.k]} onChange={e => setF(f.k, e.target.value)} placeholder={f.ph} required={!!f.req} style={INP} />
                    </div>
                  ))}
                </div>

                {/* Section 2 — Qualifications */}
                <h4 style={{ color: colors.green, margin: '0 0 12px 0', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>2. Qualifications & habilitations</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px', padding: '14px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div>
                    <label style={LBL}>Qualification</label>
                    <select value={form.qualification} onChange={e => setF('qualification', e.target.value)} style={INP}>
                      {['Agent Simple', 'Chef de Groupe', 'Maître-Chien', 'Convoyeur de Fonds', 'Chef de Site'].map(q => <option key={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>CQP / Formation</label>
                    <select value={form.cqp} onChange={e => setF('cqp', e.target.value)} style={INP}>
                      <option value="NON">NON OBTENU</option>
                      <option value="OUI">OUI — CERTIFIÉ</option>
                    </select>
                  </div>
                  <div>
                    <label style={LBL}>N° Carte Pro</label>
                    <input type="text" value={form.numCartePro} onChange={e => setF('numCartePro', e.target.value)} placeholder="Ex: CP-2025-102" style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Validité Carte Pro</label>
                    <input type="date" value={form.validiteCartePro} onChange={e => setF('validiteCartePro', e.target.value)} style={INP} />
                  </div>
                </div>

                {/* Section 3 — Contrat */}
                <h4 style={{ color: '#7c3aed', margin: '0 0 12px 0', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>3. Contrat & affectation</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '18px', padding: '14px', backgroundColor: '#fdf4ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                  <div>
                    <label style={LBL}>Date embauche *</label>
                    <input type="date" value={form.dateEmbauche} onChange={e => setF('dateEmbauche', e.target.value)} required style={INP} />
                  </div>
                  <div>
                    <label style={LBL}>Type contrat *</label>
                    <select value={form.typeContrat} onChange={e => setF('typeContrat', e.target.value)} style={INP}>
                      <option value="CDD">CDD</option>
                      <option value="CDI">CDI</option>
                      <option value="CTA (ANEM)">CTA (ANEM)</option>
                    </select>
                  </div>
                  {form.typeContrat !== 'CDI' && (
                    <div>
                      <label style={{ ...LBL, color: '#ef4444' }}>Fin de contrat *</label>
                      <input type="date" value={form.dateFin} onChange={e => setF('dateFin', e.target.value)} required style={INP} />
                    </div>
                  )}
                  {form.typeContrat === 'CTA (ANEM)' && (
                    <div>
                      <label style={{ ...LBL, color: '#ca8a04' }}>N° ANEM *</label>
                      <input type="text" value={form.numAnem} onChange={e => setF('numAnem', e.target.value)} required style={INP} />
                    </div>
                  )}
                  <div>
                    <label style={LBL}>Site affecté</label>
                    <input type="text" list="sites-list" value={form.siteAffecte} onChange={e => setF('siteAffecte', e.target.value)} placeholder="Ex: Banque BNA" style={INP} />
                    <datalist id="sites-list">{sitesUniques.map(s => <option key={s} value={s} />)}</datalist>
                  </div>
                </div>

                <button type="submit" disabled={chargement}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '900', cursor: chargement ? 'not-allowed' : 'pointer', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: chargement ? 0.7 : 1 }}>
                  {chargement ? '⏳ Enregistrement…' : '✅ Enregistrer le dossier de recrutement'}
                </button>
              </form>
            </div>
          )}

          {/* Filtres + tableau */}
          <div className="card">
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={LBL}>Nom / Matricule</label>
                <input type="text" value={rechercheNom} onChange={e => setRechercheNom(e.target.value)} placeholder="Rechercher…" style={INP} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={LBL}>Site</label>
                <select value={rechercheSite} onChange={e => setRechercheSite(e.target.value)} style={INP}>
                  <option value="">Tous les sites</option>
                  {sitesUniques.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label style={LBL}>Qualification</label>
                <select value={filtreQualif} onChange={e => setFiltreQualif(e.target.value)} style={INP}>
                  <option value="">Toutes</option>
                  {['Agent Simple', 'Chef de Groupe', 'Maître-Chien', 'Convoyeur de Fonds', 'Chef de Site'].map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={LBL}>Contrat</label>
                <select value={filtreContrat} onChange={e => setFiltreContrat(e.target.value)} style={INP}>
                  <option value="">Tous</option>
                  <option value="CDD">CDD</option><option value="CDI">CDI</option><option value="CTA (ANEM)">CTA</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '1px' }}>
                {(rechercheNom || rechercheSite || filtreQualif || filtreContrat) &&
                  <button onClick={() => { setRechercheNom(''); setRechercheSite(''); setFiltreQualif(''); setFiltreContrat(''); }}
                    style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>✕</button>}
                <button onClick={exporterCSV}
                  style={{ padding: '9px 14px', borderRadius: '8px', border: 'none', backgroundColor: colors.green, color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}>
                  📥 CSV
                </button>
              </div>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#6b7280' }}>
              {agentsFiltres.length} résultat{agentsFiltres.length > 1 ? 's' : ''} sur {agentsActifs.length} agents actifs
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Matricule', 'Agent / Contact', 'Qualification', 'Carte Pro', 'Contrat', 'Site', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {agentsFiltres.length === 0 ? (
                    <tr><td colSpan="7" className="empty-state">Aucun agent correspondant aux filtres.</td></tr>
                  ) : agentsFiltres.map((a, i) => {
                    const jCarte   = joursAvant(a.validite_carte_pro);
                    const jContrat = a.date_fin_contrat ? joursAvant(a.date_fin_contrat) : null;
                    const bc = a.validite_carte_pro ? badgeCarte(jCarte) : null;
                    const bk = jContrat !== null ? badgeContrat(jContrat) : null;
                    return (
                      <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: '#6b7280', fontSize: '12px' }}>{a.matricule || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '800', color: colors.dark, fontSize: '13px' }}>{a.nom}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>📞 {a.telephone || '—'} · {a.wilaya || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontWeight: '700' }}>{a.qualification || '—'}</span>
                          {a.cqp_formation && <div style={{ marginTop: '4px', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '800', display: 'inline-block' }}>CQP ✓</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: '12px', fontWeight: '700' }}>{a.num_carte_pro || '—'}</div>
                          {bc ? <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', fontWeight: '800', backgroundColor: bc.bg, color: bc.c, display: 'inline-block', marginTop: '3px' }}>{bc.icon} {bc.txt}</span>
                            : <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: '700' }}>⚠️ Manquante</span>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '8px', backgroundColor: '#f3f4f6', fontWeight: '700' }}>{a.type_contrat || 'CDD'}</span>
                          {bk && <div style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', fontWeight: '800', backgroundColor: bk.bg, color: bk.c, display: 'inline-block', marginTop: '4px' }}>{jContrat <= 30 ? '⚠️ ' : ''}{bk.txt}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: colors.blue, fontSize: '12px' }}>{a.site_affecte || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => { setAgentRenouvellement(a); setNouvelleCarte({ num: a.num_carte_pro || '', validite: a.validite_carte_pro || '' }); }}
                              style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }} title="Renouveler carte pro">
                              🪪
                            </button>
                            <button onClick={() => { setAgentADesactiver(a); setDateSortie(new Date().toISOString().slice(0,10)); }}
                              style={{ padding: '5px 9px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }} title="Désactiver">
                              ✖
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
        </div>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 3 — CARTES PRO & ALERTES
      ════════════════════════════════════════════ */}
      {sousMenu === 'cartes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#374151' }}>Afficher les agents avec carte expirant dans :</span>
            {[
              { v: '30',  l: '< 30 jours', c: '#fee2e2', tc: '#991b1b' },
              { v: '60',  l: '< 60 jours', c: '#fef3c7', tc: '#92400e' },
              { v: '90',  l: '< 90 jours', c: '#fef9c3', tc: '#854d0e' },
              { v: '9999',l: 'Toutes',     c: '#f1f5f9', tc: '#374151' },
            ].map(opt => (
              <button key={opt.v} onClick={() => setFiltreCarteDelai(opt.v)}
                style={{ padding: '7px 16px', borderRadius: '20px', border: filtreCarteDelai === opt.v ? 'none' : '1px solid #e5e7eb', backgroundColor: filtreCarteDelai === opt.v ? opt.c : 'white', color: filtreCarteDelai === opt.v ? opt.tc : '#374151', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}>
                {opt.l}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280' }}>{agentsCarteAlerte.length} agent{agentsCarteAlerte.length > 1 ? 's' : ''} concerné{agentsCarteAlerte.length > 1 ? 's' : ''}</span>
          </div>

          {/* Sans carte */}
          {agentsActifs.filter(a => !a.num_carte_pro).length > 0 && (
            <div style={{ backgroundColor: '#fde8ff', border: '2px solid #d946ef', borderRadius: '12px', padding: '14px 18px' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#7c3aed', fontWeight: '900', fontSize: '14px' }}>⚠️ Agents sans carte professionnelle ({agentsActifs.filter(a => !a.num_carte_pro).length})</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {agentsActifs.filter(a => !a.num_carte_pro).map(a => (
                  <span key={a.id} style={{ padding: '4px 12px', borderRadius: '16px', backgroundColor: 'white', fontSize: '12px', fontWeight: '700', color: '#7c3aed', border: '1px solid #d946ef' }}>{a.nom}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }} className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Agent', 'Site', 'N° Carte Pro', 'Validité', 'Statut', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', backgroundColor: '#7c3aed', color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {agentsCarteAlerte.length === 0 ? (
                  <tr><td colSpan="6" className="empty-state">✅ Aucune carte pro à renouveler dans cette période.</td></tr>
                ) : agentsCarteAlerte.map((a, i) => {
                  const j = joursAvant(a.validite_carte_pro);
                  const b = badgeCarte(j);
                  return (
                    <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : b.bg + '55' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: colors.dark }}>{a.nom}<br/><span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '400' }}>{a.matricule}</span></td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: colors.blue, fontWeight: '700' }}>{a.site_affecte || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '700' }}>{a.num_carte_pro || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '700' }}>{dateFr(a.validite_carte_pro)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', backgroundColor: b.bg, color: b.c }}>{b.icon} {b.txt}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => { setAgentRenouvellement(a); setNouvelleCarte({ num: a.num_carte_pro || '', validite: '' }); }}
                          style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '12px' }}>
                          🔄 Renouveler
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 4 — ORGANISMES & ANEM
      ════════════════════════════════════════════ */}
      {sousMenu === 'organismes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* CNAS */}
          <div className="card card-blue">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>🏥</span>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', color: '#1e3a8a', fontSize: '15px' }}>CNAS — Caisse Nationale des Assurances Sociales</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Affiliations, déclarations DAS et cotisations</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              {[
                { l: 'Agents affiliés', v: agentsActifs.length,  c: '#1d4ed8', bg: '#dbeafe' },
                { l: 'CDI déclarés',    v: agentsActifs.filter(a => a.type_contrat === 'CDI').length,  c: '#15803d', bg: '#dcfce7' },
                { l: 'CDD déclarés',    v: agentsActifs.filter(a => a.type_contrat === 'CDD').length,  c: '#92400e', bg: '#fef9c3' },
                { l: 'CTA (ANEM)',      v: agentsActifs.filter(a => a.type_contrat === 'CTA (ANEM)').length, c: '#7c3aed', bg: '#fde8ff' },
              ].map(k => (
                <div key={k.l} style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: k.bg }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: '#eff6ff', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#1d4ed8', fontWeight: '600' }}>
              📋 <strong>Obligations légales :</strong> DAS mensuelle avant le 15 du mois · Déclaration annuelle 1er trimestre · G50 trimestrielle
            </div>
          </div>

          {/* ANEM */}
          <div className="card card-green">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>🏛️</span>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', color: '#15803d', fontSize: '15px' }}>ANEM — Agence Nationale de l'Emploi</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Contrats CTA, déclarations d'embauche</p>
              </div>
            </div>
            {agentsActifs.filter(a => a.type_contrat === 'CTA (ANEM)').length === 0 ? (
              <p style={{ margin: 0, color: '#6b7280', fontStyle: 'italic', fontSize: '13px' }}>Aucun agent CTA actuellement.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Agent', 'N° ANEM', 'Date embauche', 'Fin contrat', 'Site'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', backgroundColor: '#15803d', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {agentsActifs.filter(a => a.type_contrat === 'CTA (ANEM)').map((a, i) => (
                      <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                        <td style={{ padding: '9px 12px', fontWeight: '700', fontSize: '13px' }}>{a.nom}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', fontWeight: '800', color: '#15803d' }}>{a.numero_anem || '—'}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px' }}>{dateFr(a.date_recrutement)}</td>
                        <td style={{ padding: '9px 12px', fontSize: '12px' }}>
                          {a.date_fin_contrat ? (
                            <span style={{ fontWeight: '700', color: joursAvant(a.date_fin_contrat) <= 30 ? '#991b1b' : '#374151' }}>{dateFr(a.date_fin_contrat)}</span>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: '12px', color: colors.blue, fontWeight: '700' }}>{a.site_affecte || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inspection du Travail */}
          <div className="card card-dark">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '24px' }}>⚖️</span>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', color: 'white', fontSize: '15px' }}>Inspection du Travail — Registres obligatoires</h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Documents légaux à tenir à disposition</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { doc: 'Registre du personnel (Livre de paie)', statut: 'À jour',          ok: true  },
                { doc: 'Règlement intérieur affiché',            statut: 'À jour',          ok: true  },
                { doc: 'Registre des accidents de travail',      statut: 'À tenir',         ok: false },
                { doc: 'Affichage horaires de travail',          statut: 'À vérifier',      ok: false },
                { doc: 'Contrats individuels signés',            statut: `${agentsActifs.length} agents`, ok: true },
              ].map(r => (
                <div key={r.doc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#374151', borderRadius: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#e5e7eb' }}>{r.doc}</span>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: '800',
                    backgroundColor: r.ok ? '#dcfce7' : '#fee2e2',
                    color:           r.ok ? '#15803d' : '#991b1b' }}>
                    {r.ok ? '✅' : '⚠️'} {r.statut}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 5 — ARCHIVES
      ════════════════════════════════════════════ */}
      {sousMenu === 'archives' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={LBL}>Nom / Matricule</label>
              <input type="text" value={rechercheArchive} onChange={e => setRechercheArchive(e.target.value)} placeholder="Rechercher dans les archives…" style={INP} />
            </div>
            {rechercheArchive && <button onClick={() => setRechercheArchive('')} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', marginBottom: '1px' }}>✕</button>}
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>
              {agentsArchivesFiltres.length} / {agentsInactifs.length} agents archivés
            </span>
          </div>

          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Matricule', 'Agent', 'Contrat', 'Motif de sortie', 'Date de sortie', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', backgroundColor: '#6b7280', color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {agentsArchivesFiltres.length === 0 ? (
                    <tr><td colSpan="6" className="empty-state">{agentsInactifs.length === 0 ? 'Aucun agent archivé.' : 'Aucun résultat.'}</td></tr>
                  ) : agentsArchivesFiltres.map((a, i) => {
                    const motifLabels = { FIN_CONTRAT: '📄 Fin de contrat', DEMISSION: '🚶 Démission', LICENCIEMENT: '⛔ Licenciement', RETRAITE: '🎖️ Retraite', DECES: '✝️ Décès', AUTRE: '📝 Autre' };
                    return (
                      <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: '800', color: '#6b7280', fontSize: '12px' }}>{a.matricule || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: '800', fontSize: '13px', color: colors.dark }}>{a.nom}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{a.site_affecte} · {a.qualification}</div>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '8px', backgroundColor: '#f3f4f6', fontWeight: '700' }}>{a.type_contrat || '—'}</span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#ef4444', fontWeight: '700' }}>{motifLabels[a.motif_sortie] || a.motif_sortie || '—'}</td>
                        <td style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280' }}>{dateFr(a.date_sortie)}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => reactiverAgent(a.id)}
                            style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}>
                            🔄 Réactiver
                          </button>
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

      {/* ════════ MODALS ════════════════════════════ */}

      {/* Modal désactivation */}
      {agentADesactiver && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 6px 0', color: '#ef4444', fontWeight: '900' }}>⛔ Désactiver l'agent</h3>
            <p style={{ margin: '0 0 18px 0', fontWeight: '700', color: '#374151' }}>{agentADesactiver.nom}</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={LBL}>Motif de sortie</label>
              <select value={motifSortie} onChange={e => setMotifSortie(e.target.value)} style={INP}>
                <option value="FIN_CONTRAT">Fin de contrat (non renouvelé)</option>
                <option value="DEMISSION">Démission</option>
                <option value="LICENCIEMENT">Licenciement</option>
                <option value="RETRAITE">Départ en retraite</option>
                <option value="DECES">Décès</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ ...LBL, color: '#ef4444' }}>Date de sortie *</label>
              <input type="date" value={dateSortie} onChange={e => setDateSortie(e.target.value)} required style={INP} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAgentADesactiver(null)} style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
              <button onClick={desactiverAgent} disabled={!dateSortie || actionLoad}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: '800', cursor: !dateSortie ? 'not-allowed' : 'pointer', opacity: !dateSortie ? 0.6 : 1 }}>
                {actionLoad ? '⏳…' : '⛔ Archiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal renouvellement carte pro */}
      {agentRenouvellement && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 6px 0', color: '#7c3aed', fontWeight: '900' }}>🪪 Renouvellement Carte Pro</h3>
            <p style={{ margin: '0 0 18px 0', fontWeight: '700', color: '#374151' }}>{agentRenouvellement.nom}</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={LBL}>Nouveau N° Carte Pro</label>
              <input type="text" value={nouvelleCarte.num} onChange={e => setNouvelleCarte(p => ({ ...p, num: e.target.value }))} placeholder="Ex: CP-2026-102" style={INP} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ ...LBL, color: '#7c3aed' }}>Nouvelle date de validité *</label>
              <input type="date" value={nouvelleCarte.validite} onChange={e => setNouvelleCarte(p => ({ ...p, validite: e.target.value }))} required style={INP} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setAgentRenouvellement(null)} style={{ flex: 1, padding: '11px', borderRadius: '9px', border: '1px solid #e5e7eb', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
              <button onClick={sauvegarderRenouvellement} disabled={!nouvelleCarte.validite || actionLoad}
                style={{ flex: 1, padding: '11px', borderRadius: '9px', border: 'none', backgroundColor: '#7c3aed', color: 'white', fontWeight: '800', cursor: !nouvelleCarte.validite ? 'not-allowed' : 'pointer', opacity: !nouvelleCarte.validite ? 0.6 : 1 }}>
                {actionLoad ? '⏳…' : '✅ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.close} title="Confirmation" size="sm" danger confirmLabel="Supprimer" onConfirm={deleteModal.close}>
        <p>Confirmer la suppression ?</p>
      </Modal>

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

export default Recrutement;
