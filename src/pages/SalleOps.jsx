import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';
import { exportPlanDefenseToPDF } from '../utils/export';
import OPSSitesMap from '../components/OPSSitesMap';

// ── Helpers ────────────────────────────────────────────────────────────────────
const dateFr    = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const heureFr   = d => d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
const dateAuj   = () => new Date().toISOString().slice(0, 10);
const dateLabel = d => d === dateAuj() ? 'Aujourd\'hui' : dateFr(d);

// ── Styles ─────────────────────────────────────────────────────────────────────
const TH = (bg = '#1e3a8a') => ({ padding: '10px 14px', backgroundColor: bg, color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', textAlign: 'left' });
const TD = { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const INP = { padding: '8px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px' };

// ══════════════════════════════════════════════════════════════════════════════
function SalleOps() {
  const { contratsData, agentsData, incidentsData, historiquePointages, passationsData, roleAdmin, fetchPassations, fetchPointages, fetchIncidents, resoudreIncident } = useDataStore();

  const [sousMenu,        setSousMenu]        = useState('dashboard');
  const [loadingOps,      setLoadingOps]      = useState(true);
  const [lastRefresh,     setLastRefresh]      = useState(null);

  // Filtres Présence
  const [dateFiltre,      setDateFiltre]       = useState(dateAuj());
  const [siteFiltre,      setSiteFiltre]       = useState('');
  const [selectedPts,     setSelectedPts]      = useState(new Set());

  // Filtres Passations
  const [passDateDebut,   setPassDateDebut]    = useState('');
  const [passDateFin,     setPassDateFin]      = useState('');
  const [passSiteFiltre,  setPassSiteFiltre]   = useState('');
  const [passTypeFiltre,  setPassTypeFiltre]   = useState('');

  // Rapport
  const [rapportDateDeb,  setRapportDateDeb]   = useState('');
  const [rapportDateFin,  setRapportDateFin]   = useState('');
  const [rapportSite,     setRapportSite]      = useState('');
  const [rapportType,     setRapportType]      = useState('passations');

  const fetchOpsData = useCallback(async () => {
    try {
      setLoadingOps(true);
      await Promise.all([fetchPassations(), fetchPointages(), fetchIncidents()]);
      setLastRefresh(new Date());
    } catch (e) { console.error('[SalleOps]', e); }
    finally { setLoadingOps(false); }
  }, [fetchPassations, fetchPointages, fetchIncidents]);

  useEffect(() => {
    fetchOpsData();
    const iv = setInterval(fetchOpsData, 30000);
    return () => clearInterval(iv);
  }, [fetchOpsData]);

  // ── Calculs dérivés ───────────────────────────────────────────────────────
  const sitesGeres = useMemo(() => {
    const s = new Set();
    contratsData.forEach(c => c.nom_site && s.add(c.nom_site));
    agentsData.forEach(a => a.site_affecte && s.add(a.site_affecte));
    return Array.from(s).sort();
  }, [contratsData, agentsData]);

  const pointagesDateFiltre = useMemo(() =>
    historiquePointages.filter(p => p.date_pointage === dateFiltre),
    [historiquePointages, dateFiltre]);

  const pointagesToday = useMemo(() =>
    historiquePointages.filter(p => p.date_pointage === dateAuj()),
    [historiquePointages]);

  const agentsJourCount = useMemo(() => new Set(pointagesToday.filter(p => p.type_vacation === 'JOUR').map(p => p.nom_agent)).size, [pointagesToday]);
  const agentsNuitCount = useMemo(() => new Set(pointagesToday.filter(p => p.type_vacation === 'NUIT').map(p => p.nom_agent)).size, [pointagesToday]);

  const pointagesFiltre = useMemo(() => {
    let pts = pointagesDateFiltre;
    if (siteFiltre) pts = pts.filter(p => p.site_affecte === siteFiltre);
    return pts;
  }, [pointagesDateFiltre, siteFiltre]);

  const pointagesEnAttente = useMemo(() => pointagesFiltre.filter(p => p.statut_validation === 'EN ATTENTE'), [pointagesFiltre]);
  const pointagesValides   = useMemo(() => pointagesFiltre.filter(p => p.statut_validation === 'VALIDE'), [pointagesFiltre]);

  const passationsFiltrees = useMemo(() => {
    return passationsData.filter(p => {
      const d = p.date_heure?.slice(0, 10);
      if (passSiteFiltre && p.site !== passSiteFiltre) return false;
      if (passDateDebut && d < passDateDebut) return false;
      if (passDateFin   && d > passDateFin)   return false;
      if (passTypeFiltre === 'anomalie'   && (!p.anomalies || p.anomalies === 'R.A.S')) return false;
      if (passTypeFiltre === 'itineraire' && !p.consignes?.startsWith('[ITINÉRAIRE]')) return false;
      if (passTypeFiltre === 'normal'     && p.consignes?.startsWith('[ITINÉRAIRE]')) return false;
      return true;
    });
  }, [passationsData, passSiteFiltre, passDateDebut, passDateFin, passTypeFiltre]);

  const anomaliesCount = useMemo(() =>
    passationsData.filter(p => p.anomalies && p.anomalies !== 'R.A.S').length,
    [passationsData]);

  // ── Stats par site ─────────────────────────────────────────────────────────
  const statsSites = useMemo(() => sitesGeres.map(site => {
    const agentsSite = agentsData.filter(a => a.site_affecte === site && a.statut_agent === 'ACTIF');
    const ptsSite    = pointagesToday.filter(p => p.site_affecte === site);
    const passSite   = passationsData.filter(p => p.site === site);
    const lastPass   = passSite[0];
    const incidents  = incidentsData.filter(i => i.site === site);
    const contrat    = contratsData.find(c => c.nom_site === site);
    return {
      site,
      agentsCount:  agentsSite.length,
      pointesJour:  new Set(ptsSite.filter(p => p.type_vacation === 'JOUR').map(p => p.nom_agent)).size,
      pointesNuit:  new Set(ptsSite.filter(p => p.type_vacation === 'NUIT').map(p => p.nom_agent)).size,
      lastPass,
      incidentsOpen: incidents.length,
      anomalies:    passSite.filter(p => p.anomalies && p.anomalies !== 'R.A.S').length,
      planValide:   contrat?.plan_defense_valide,
    };
  }), [sitesGeres, agentsData, pointagesToday, passationsData, incidentsData, contratsData]);

  // ── Actions Présence ──────────────────────────────────────────────────────
  const validerPointage = async id => {
    await supabase.from('pointages_journaliers').update({ statut_validation: 'VALIDE' }).eq('id', id);
    fetchOpsData();
  };

  const validerSelection = async () => {
    if (selectedPts.size === 0) return;
    await Promise.all([...selectedPts].map(id =>
      supabase.from('pointages_journaliers').update({ statut_validation: 'VALIDE' }).eq('id', id)
    ));
    setSelectedPts(new Set());
    fetchOpsData();
  };

  const togglePt = id => setSelectedPts(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleTous = () => {
    if (selectedPts.size === pointagesEnAttente.length) setSelectedPts(new Set());
    else setSelectedPts(new Set(pointagesEnAttente.map(p => p.id)));
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exporterRapport = () => {
    let donnees = [];
    let entetes = [];
    if (rapportType === 'passations') {
      entetes = ['Date', 'Site', 'Chef Montant', 'Chef Descendant', 'Matériel', 'Consignes', 'Anomalies'];
      donnees = passationsData.filter(p => {
        const d = p.date_heure?.slice(0, 10);
        if (rapportSite    && p.site !== rapportSite) return false;
        if (rapportDateDeb && d < rapportDateDeb)     return false;
        if (rapportDateFin && d > rapportDateFin)     return false;
        return true;
      }).map(p => [
        new Date(p.date_heure).toLocaleString('fr-FR'), p.site, p.chef_montant, p.chef_descendant,
        p.materiel_ok ? 'Conforme' : 'Défaillant', p.consignes, p.anomalies,
      ]);
    } else if (rapportType === 'presences') {
      entetes = ['Date', 'Site', 'Agent', 'Heure', 'Type', 'Statut'];
      donnees = historiquePointages.filter(p => {
        if (rapportSite    && p.site_affecte !== rapportSite) return false;
        if (rapportDateDeb && p.date_pointage < rapportDateDeb) return false;
        if (rapportDateFin && p.date_pointage > rapportDateFin) return false;
        return true;
      }).map(p => [p.date_pointage, p.site_affecte, p.nom_agent, p.heure_arrivee, p.type_vacation, p.statut_validation]);
    } else {
      entetes = ['Date', 'Site', 'Description', 'Agent', 'Résolu'];
      donnees = incidentsData.map(i => [i.heure_incident, i.site, i.description, i.nom_agent, i.resolu ? 'Oui' : 'Non']);
    }
    const esc = v => `"${(v || '').toString().replace(/"/g, '""')}"`;
    const csv = 'data:text/csv;charset=utf-8,﻿'
      + entetes.map(esc).join(';') + '\n'
      + donnees.map(r => r.map(esc).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Rapport_${rapportType}_${dateAuj()}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container print-container">

      {/* ── En-tête ── */}
      <div className="hide-on-print page-header mb-20">
        <span style={{ fontSize: '32px' }}>🖥️</span>
        <div>
          <h1 className="page-title">SALLE OPS — SUPERVISION EN TEMPS RÉEL</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Tableau de bord · Présence · Passations · Plans de défense · Rapports
            {lastRefresh && <span style={{ marginLeft: '12px', fontSize: '11px', color: '#9ca3af' }}>
              Dernière actualisation : {heureFr(lastRefresh)}
            </span>}
          </p>
        </div>
        <button onClick={fetchOpsData} disabled={loadingOps}
          style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151', fontWeight: '700' }}>
          {loadingOps ? '⏳' : '🔄'} Actualiser
        </button>
      </div>

      {/* ── KPI permanents ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {[
          { l: 'Sites gérés',    v: sitesGeres.length,           i: '📍', bg: '#dbeafe', c: '#1d4ed8' },
          { l: 'Agents Jour',    v: `☀️ ${agentsJourCount}`,     i: '🌞', bg: '#fef9c3', c: '#854d0e' },
          { l: 'Agents Nuit',    v: `🌙 ${agentsNuitCount}`,     i: '🌙', bg: '#e0e7ff', c: '#4338ca' },
          { l: 'En attente OPS', v: historiquePointages.filter(p => p.statut_validation === 'EN ATTENTE').length, i: '⏳', bg: '#fef3c7', c: '#92400e', click: () => setSousMenu('presence') },
          { l: 'Incidents ouverts',v: incidentsData.length,      i: '🚨', bg: '#fee2e2', c: '#991b1b', click: () => setSousMenu('dashboard') },
          { l: 'Anomalies',      v: anomaliesCount,              i: '⚠️', bg: '#fdf4ff', c: '#7c3aed', click: () => setSousMenu('passations') },
          { l: 'Passations',     v: passationsData.length,       i: '📋', bg: '#f0fdf4', c: '#15803d', click: () => setSousMenu('passations') },
        ].map(k => (
          <div key={k.l} onClick={k.click}
            style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '12px 14px', cursor: k.click ? 'pointer' : 'default', transition: 'transform 0.1s' }}
            onMouseEnter={e => k.click && (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => k.click && (e.currentTarget.style.transform = 'scale(1)')}>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{k.l}</div>
            <div style={{ fontSize: '20px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div className="hide-on-print nav-tabs">
        {[
          { key: 'dashboard',  label: '🖥️ Tableau de Bord',          bg: '#1e3a8a' },
          { key: 'presence',   label: '⏱️ Présence & Validation',      bg: colors.blue },
          { key: 'passations', label: `📋 Passations${anomaliesCount > 0 ? ` (${anomaliesCount} ⚠️)` : ''}`, bg: colors.green },
          { key: 'plans',      label: '🛡️ Sites & Plans de Défense',   bg: colors.dark },
          { key: 'rapports',   label: '📊 Rapports',                   bg: '#f59e0b' },
        ].map(t => (
          <button key={t.key} onClick={() => setSousMenu(t.key)}
            className={`nav-tab${sousMenu === t.key ? ' active' : ''}`}
            style={sousMenu === t.key ? { backgroundColor: t.bg } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          ONGLET 1 — TABLEAU DE BORD
      ════════════════════════════════════════════ */}
      {sousMenu === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Incidents ouverts */}
          {incidentsData.length > 0 && (
            <div style={{ backgroundColor: '#fee2e2', border: '2px solid #ef4444', borderRadius: '14px', padding: '16px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#991b1b', fontSize: '14px', fontWeight: '800' }}>
                🚨 {incidentsData.length} incident(s) ouvert(s) — traitement requis
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {incidentsData.slice(0, 5).map(inc => (
                  <div key={inc.id} style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', boxShadow: '0 1px 4px rgba(239,68,68,0.1)' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: '#991b1b' }}>{inc.site} — {inc.nom_agent}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                        🕐 {inc.heure_incident} · {inc.description || 'Alerte panique'}
                      </div>
                    </div>
                    <button onClick={() => resoudreIncident(inc.id)}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
                      ✅ Résoudre
                    </button>
                  </div>
                ))}
                {incidentsData.length > 5 && <p style={{ margin: 0, textAlign: 'center', color: '#991b1b', fontSize: '12px', fontWeight: '700' }}>+ {incidentsData.length - 5} autres incidents</p>}
              </div>
            </div>
          )}

          {/* ── Carte interactive des sites ── */}
          <div className="card" style={{ padding: '18px' }}>
            <OPSSitesMap roleAdmin={roleAdmin} />
          </div>

          {/* Cards par site */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {statsSites.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📍</div>
                <p style={{ margin: 0, fontWeight: '700' }}>Aucun site détecté. Vérifiez les contrats et affectations agents.</p>
              </div>
            ) : statsSites.map(s => {
              const hasIncident = s.incidentsOpen > 0;
              const hasAnomalie = s.anomalies > 0;
              const border = hasIncident ? '2px solid #ef4444' : hasAnomalie ? '2px solid #f59e0b' : '1px solid #e2e8f0';
              const totalPointes = s.pointesJour + s.pointesNuit;
              const taux = s.agentsCount > 0 ? Math.round((totalPointes / s.agentsCount) * 100) : 0;
              return (
                <div key={s.site} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px', border, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '900', color: '#1e3a8a' }}>📍 {s.site}</div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                        {s.agentsCount} agent{s.agentsCount > 1 ? 's' : ''} affecté{s.agentsCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                      {hasIncident && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: '800' }}>🚨 {s.incidentsOpen} incident{s.incidentsOpen > 1 ? 's' : ''}</span>}
                      {hasAnomalie && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: '800' }}>⚠️ {s.anomalies} anomalie{s.anomalies > 1 ? 's' : ''}</span>}
                      {!hasIncident && !hasAnomalie && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '800' }}>✅ Normal</span>}
                    </div>
                  </div>

                  {/* Présence du jour */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {[
                      { l: '☀️ Jour', v: s.pointesJour, c: '#854d0e', bg: '#fef9c3' },
                      { l: '🌙 Nuit', v: s.pointesNuit, c: '#4338ca', bg: '#e0e7ff' },
                      { l: '📊 Taux', v: `${taux}%`,    c: taux >= 80 ? '#15803d' : taux >= 50 ? '#854d0e' : '#991b1b', bg: taux >= 80 ? '#dcfce7' : taux >= 50 ? '#fef9c3' : '#fee2e2' },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: 'center', padding: '8px', borderRadius: '10px', backgroundColor: m.bg }}>
                        <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', marginBottom: '2px' }}>{m.l}</div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barre de progression présence */}
                  <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#f1f5f9', marginBottom: '12px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(taux, 100)}%`, backgroundColor: taux >= 80 ? '#10b981' : taux >= 50 ? '#f59e0b' : '#ef4444', borderRadius: '3px', transition: 'width 0.5s' }} />
                  </div>

                  {/* Dernière passation */}
                  {s.lastPass ? (
                    <div style={{ fontSize: '12px', padding: '8px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: '700', color: '#374151' }}>📋 Dernière passation :</span>
                      <span style={{ marginLeft: '6px', color: '#6b7280' }}>{heureFr(s.lastPass.date_heure)}</span>
                      <div style={{ marginTop: '3px', color: '#1d4ed8', fontWeight: '600', fontSize: '11px' }}>
                        {s.lastPass.chef_montant} → {s.lastPass.chef_descendant}
                        {s.lastPass.anomalies && s.lastPass.anomalies !== 'R.A.S' && (
                          <span style={{ color: '#ef4444', marginLeft: '6px' }}>⚠️</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                      Aucune passation aujourd'hui
                    </div>
                  )}

                  {/* Plan de défense */}
                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', fontWeight: '700',
                      backgroundColor: s.planValide ? '#dcfce7' : '#fee2e2',
                      color:           s.planValide ? '#15803d' : '#991b1b' }}>
                      {s.planValide ? '🛡️ Plan ✓' : '🛡️ Plan manquant'}
                    </span>
                    <button onClick={() => { setSiteFiltre(s.site); setSousMenu('presence'); }}
                      style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: '1px solid #bfdbfe', backgroundColor: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: '700' }}>
                      Voir présence →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 2 — PRÉSENCE & VALIDATION
      ════════════════════════════════════════════ */}
      {sousMenu === 'presence' && (
        <>
          {/* Barre filtres */}
          <div className="card mb-16" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Date</label>
                <input type="date" value={dateFiltre} onChange={e => { setDateFiltre(e.target.value); setSelectedPts(new Set()); }}
                  style={INP} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Site</label>
                <select value={siteFiltre} onChange={e => setSiteFiltre(e.target.value)} style={INP}>
                  <option value="">Tous les sites</option>
                  {sitesGeres.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#fef9c3', color: '#854d0e', fontWeight: '700', fontSize: '12px' }}>
                  ⏳ {pointagesEnAttente.length} en attente
                </span>
                <span style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: '700', fontSize: '12px' }}>
                  ✅ {pointagesValides.length} validés
                </span>
              </div>
              <div style={{ marginLeft: 'auto', marginTop: 'auto', display: 'flex', gap: '8px' }}>
                {pointagesEnAttente.length > 0 && (
                  <>
                    <button onClick={toggleTous}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                      {selectedPts.size === pointagesEnAttente.length ? '☐ Désélectionner' : '☑ Tout sélectionner'}
                    </button>
                    {selectedPts.size > 0 && (
                      <button onClick={validerSelection}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                        ✅ Valider {selectedPts.size} sélectionné{selectedPts.size > 1 ? 's' : ''}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Section EN ATTENTE */}
          {pointagesEnAttente.length > 0 && (
            <div className="card card-blue mb-16">
              <h3 className="section-title mb-10" style={{ color: '#92400e' }}>
                ⏳ Prises de service en attente — {dateLabel(dateFiltre)}
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TH('#854d0e')}>
                        <input type="checkbox" checked={selectedPts.size === pointagesEnAttente.length && pointagesEnAttente.length > 0}
                          onChange={toggleTous} style={{ cursor: 'pointer' }} />
                      </th>
                      {['Site', 'Agent', 'Heure', 'Vacation', 'Action'].map(h => <th key={h} style={TH('#854d0e')}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pointagesEnAttente.map((pt, i) => (
                      <tr key={pt.id} style={{ backgroundColor: selectedPts.has(pt.id) ? '#fefce8' : i % 2 === 0 ? 'white' : '#fffbeb' }}>
                        <td style={TD}>
                          <input type="checkbox" checked={selectedPts.has(pt.id)} onChange={() => togglePt(pt.id)} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ ...TD, fontWeight: '700', color: colors.dark }}>📍 {pt.site_affecte}</td>
                        <td style={TD}>{pt.nom_agent}</td>
                        <td style={{ ...TD, fontWeight: '800', color: colors.blue }}>{pt.heure_arrivee}</td>
                        <td style={TD}>
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                            backgroundColor: pt.type_vacation === 'JOUR' ? '#fef9c3' : '#e0e7ff',
                            color:           pt.type_vacation === 'JOUR' ? '#854d0e' : '#4338ca' }}>
                            {pt.type_vacation === 'JOUR' ? '☀️ Jour' : '🌙 Nuit'}
                          </span>
                        </td>
                        <td style={TD}>
                          <button onClick={() => validerPointage(pt.id)}
                            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '12px', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>
                            ✅ Valider
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section VALIDÉS */}
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="section-title">✅ Pointages validés — {dateLabel(dateFiltre)}</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Site', 'Agent', 'Heure arrivée', 'Vacation', 'Statut'].map(h => <th key={h} style={TH(colors.blue)}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pointagesValides.length === 0 ? (
                    <tr><td colSpan="5" className="empty-state">Aucun pointage validé pour {dateLabel(dateFiltre)}.</td></tr>
                  ) : pointagesValides.map((pt, i) => (
                    <tr key={pt.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                      <td style={{ ...TD, fontWeight: '700', color: colors.dark }}>📍 {pt.site_affecte}</td>
                      <td style={TD}>{pt.nom_agent}</td>
                      <td style={{ ...TD, fontWeight: '800', color: '#1d4ed8' }}>{pt.heure_arrivee}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                          backgroundColor: pt.type_vacation === 'JOUR' ? '#fef9c3' : '#e0e7ff',
                          color:           pt.type_vacation === 'JOUR' ? '#854d0e' : '#4338ca' }}>
                          {pt.type_vacation === 'JOUR' ? '☀️ Jour' : '🌙 Nuit'}
                        </span>
                      </td>
                      <td style={TD}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', backgroundColor: '#dcfce7', color: '#15803d' }}>
                          ✅ Validé
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          ONGLET 3 — PASSATIONS
      ════════════════════════════════════════════ */}
      {sousMenu === 'passations' && (
        <>
          <div className="card mb-16" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Du</label>
                  <input type="date" value={passDateDebut} onChange={e => setPassDateDebut(e.target.value)} style={INP} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Au</label>
                  <input type="date" value={passDateFin} onChange={e => setPassDateFin(e.target.value)} style={INP} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Site</label>
                  <select value={passSiteFiltre} onChange={e => setPassSiteFiltre(e.target.value)} style={INP}>
                    <option value="">Tous</option>
                    {sitesGeres.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '3px', textTransform: 'uppercase' }}>Type</label>
                  <select value={passTypeFiltre} onChange={e => setPassTypeFiltre(e.target.value)} style={INP}>
                    <option value="">Tous</option>
                    <option value="normal">Passations normales</option>
                    <option value="anomalie">⚠️ Avec anomalies</option>
                    <option value="itineraire">🗺 Itinéraires</option>
                  </select>
                </div>
                {(passDateDebut || passDateFin || passSiteFiltre || passTypeFiltre) && (
                  <div style={{ marginTop: 'auto' }}>
                    <button onClick={() => { setPassDateDebut(''); setPassDateFin(''); setPassSiteFiltre(''); setPassTypeFiltre(''); }}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: colors.dark, color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>📥 PDF</button>
              </div>
            </div>
          </div>

          <div className="card print-planning" style={{ overflowX: 'auto' }}>
            <div className="show-only-on-print mb-20" style={{ textAlign: 'center' }}>
              <h2 style={{ textTransform: 'uppercase' }}>REGISTRE DES PASSATIONS DE CONSIGNES</h2>
              <h3>Date d'édition : {new Date().toLocaleDateString('fr-FR')}</h3>
            </div>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="hide-on-print">
              <h3 className="section-title">
                Journal des passations
                <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '400', color: '#6b7280' }}>({passationsFiltrees.length} entrée{passationsFiltrees.length > 1 ? 's' : ''})</span>
              </h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Site & Date', 'Montant → Descendant', 'Matériel', 'Consignes / Anomalies'].map(h => (
                    <th key={h} style={{ ...TH(colors.green), border: '1px solid #d1fae5' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passationsFiltrees.length === 0 ? (
                  <tr><td colSpan="4" className="empty-state">Aucune passation pour ces filtres.</td></tr>
                ) : passationsFiltrees.map((p, i) => {
                  const isItineraire = p.consignes?.startsWith('[ITINÉRAIRE]');
                  const hasAnomalie  = p.anomalies && p.anomalies !== 'R.A.S';
                  return (
                    <tr key={p.id} style={{ backgroundColor: hasAnomalie ? '#fff5f0' : isItineraire ? '#faf5ff' : i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                      <td style={{ ...TD, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: '800', color: colors.dark }}>📍 {p.site}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>
                          {new Date(p.date_heure).toLocaleString('fr-FR')}
                        </div>
                        {isItineraire && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', backgroundColor: '#f3e8ff', color: '#7c3aed', fontWeight: '800', display: 'inline-block', marginTop: '4px' }}>🗺 ITINÉRAIRE</span>}
                      </td>
                      <td style={{ ...TD, fontWeight: '700', border: '1px solid #e2e8f0' }}>
                        {p.chef_montant}
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: '400', marginTop: '2px' }}>→ {p.chef_descendant}</div>
                      </td>
                      <td style={{ ...TD, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                          backgroundColor: p.materiel_ok ? '#dcfce7' : '#fee2e2',
                          color:           p.materiel_ok ? '#15803d' : '#991b1b' }}>
                          {p.materiel_ok ? '✅ Conforme' : '❌ Défaillant'}
                        </span>
                      </td>
                      <td style={{ ...TD, border: '1px solid #e2e8f0', maxWidth: '260px' }}>
                        {hasAnomalie && (
                          <div style={{ marginBottom: '6px', padding: '6px 10px', backgroundColor: '#fee2e2', borderRadius: '6px', fontSize: '12px', color: '#991b1b', fontWeight: '700' }}>
                            ⚠️ {p.anomalies}
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {isItineraire ? p.consignes.replace('[ITINÉRAIRE] ', '') : p.consignes}
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
          ONGLET 4 — SITES & PLANS DE DÉFENSE
      ════════════════════════════════════════════ */}
      {sousMenu === 'plans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Vue globale sites */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {statsSites.map(s => {
              const contrat = contratsData.find(c => c.nom_site === s.site);
              const agentsSite = agentsData.filter(a => a.site_affecte === s.site && a.statut_agent === 'ACTIF');
              return (
                <div key={s.site} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#1e3a8a' }}>📍 {s.site}</div>
                      {contrat && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Client : {contrat.clients?.nom_entreprise || '—'}</div>}
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                      backgroundColor: s.planValide ? '#dcfce7' : '#fee2e2',
                      color:           s.planValide ? '#15803d' : '#991b1b' }}>
                      {s.planValide ? '🛡️ Plan validé' : '🛡️ Plan manquant'}
                    </span>
                  </div>

                  {/* Agents du site */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Agents actifs ({agentsSite.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {agentsSite.slice(0, 6).map(a => (
                        <span key={a.id} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#374151', fontWeight: '600' }}>
                          {a.nom}
                        </span>
                      ))}
                      {agentsSite.length > 6 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: '700' }}>+{agentsSite.length - 6}</span>}
                      {agentsSite.length === 0 && <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Aucun agent actif</span>}
                    </div>
                  </div>

                  {/* Boutons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {contrat && (
                      <button onClick={() => exportPlanDefenseToPDF(contrat)}
                        style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: colors.dark, color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flex: 1 }}>
                        📄 Générer Plan PDF
                      </button>
                    )}
                    <label style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '12px', flex: 1, textAlign: 'center' }}>
                      📂 Importer PDF
                      <input type="file" accept=".pdf" onChange={e => e.target.files[0] && alert(`Fichier "${e.target.files[0].name}" importé pour ${s.site}.`)} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tableau récap */}
          <div className="card card-dark" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #4b5563' }}><h3 className="section-title" style={{ color: 'white' }}>Récapitulatif Plans de Défense</h3></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Site (Client)', 'Agents ACTIFS', 'Agents pointés (auj.)', 'Plan de Défense', 'Actions'].map(h => <th key={h} style={TH(colors.dark)}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {contratsData.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">Aucun contrat.</td></tr>
                ) : contratsData.map((c, i) => {
                  const ss = statsSites.find(s => s.site === c.nom_site);
                  return (
                    <tr key={c.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ ...TD, fontWeight: '800' }}>{c.nom_site}</td>
                      <td style={TD}>{ss?.agentsCount ?? '—'}</td>
                      <td style={TD}>
                        {ss ? <span style={{ fontWeight: '700', color: '#1d4ed8' }}>☀️ {ss.pointesJour} · 🌙 {ss.pointesNuit}</span> : '—'}
                      </td>
                      <td style={TD}>
                        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                          backgroundColor: c.plan_defense_valide ? '#dcfce7' : '#fee2e2',
                          color:           c.plan_defense_valide ? '#15803d' : '#991b1b' }}>
                          {c.plan_defense_valide ? '✅ Validé' : '❌ Manquant'}
                        </span>
                      </td>
                      <td style={TD}>
                        <button onClick={() => exportPlanDefenseToPDF(c)}
                          style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: colors.dark, color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}>
                          📄 PDF
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
          ONGLET 5 — RAPPORTS
      ════════════════════════════════════════════ */}
      {sousMenu === 'rapports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card card-yellow" style={{ padding: '22px' }}>
            <h3 className="section-title mb-20">📊 Générateur de rapports d'activité</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Type de rapport</label>
                <select value={rapportType} onChange={e => setRapportType(e.target.value)} style={{ ...INP, width: '100%' }}>
                  <option value="passations">Passations de service</option>
                  <option value="presences">Présences & Pointages</option>
                  <option value="incidents">Incidents & Alertes</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Période — Du</label>
                <input type="date" value={rapportDateDeb} onChange={e => setRapportDateDeb(e.target.value)} style={{ ...INP, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Période — Au</label>
                <input type="date" value={rapportDateFin} onChange={e => setRapportDateFin(e.target.value)} style={{ ...INP, width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Site (optionnel)</label>
                <select value={rapportSite} onChange={e => setRapportSite(e.target.value)} style={{ ...INP, width: '100%' }}>
                  <option value="">Tous les sites</option>
                  {sitesGeres.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Statistiques aperçu */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              {[
                { l: 'Total passations', v: passationsData.length, i: '📋' },
                { l: 'Anomalies détectées', v: anomaliesCount, i: '⚠️' },
                { l: 'Pointages historique', v: historiquePointages.length, i: '⏱️' },
                { l: 'Incidents enregistrés', v: incidentsData.length, i: '🚨' },
              ].map(k => (
                <div key={k.l} style={{ backgroundColor: '#fef9c3', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid #fcd34d' }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{k.i}</div>
                  <div style={{ fontSize: '10px', color: '#92400e', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: '#78350f' }}>{k.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={exporterRapport}
                style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>
                📥 Exporter CSV — {rapportType === 'passations' ? 'Passations' : rapportType === 'presences' ? 'Présences' : 'Incidents'}
              </button>
              <button onClick={() => window.print()}
                style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>
                🖨️ Imprimer la page
              </button>
            </div>

            <p style={{ marginTop: '14px', fontSize: '12px', color: '#92400e', marginBottom: 0 }}>
              💡 Le rapport CSV inclut toutes les données selon la plage de dates et le site sélectionnés. Sans filtre = export complet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalleOps;
