import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function BarChart({ items, height = 10, moisActif = null }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="flex-col">
      {items.map((item) => {
        const isActif = moisActif && item.key === moisActif;
        return (
          <div key={item.label} style={{ marginBottom: '12px' }}>
            <div className="flex-between" style={{ marginBottom: '4px' }}>
              <span className="text-xs text-bold" style={{ color: isActif ? '#1f2937' : undefined }}>
                {isActif ? '▶ ' : ''}{item.label}
              </span>
              <span className="text-xs text-bold" style={{ color: item.color || colors.blue }}>{item.value}</span>
            </div>
            <div style={{ backgroundColor: '#e5e7eb', borderRadius: '99px', height: `${height}px` }}>
              <div style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%`,
                backgroundColor: item.color || colors.blue,
                height: '100%', borderRadius: '99px',
                transition: 'width 0.6s ease',
                outline: isActif ? `2px solid ${item.color || colors.blue}` : 'none',
                outlineOffset: '1px',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutStat({ value, total, color, label }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x="50" y="54" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 'bold', fill: '#1f2937' }}>{pct}%</text>
      </svg>
      <div>
        <div className="text-bold" style={{ color }}>{value} / {total}</div>
        <div className="text-xs text-muted">{label}</div>
      </div>
    </div>
  );
}

// Formate YYYY-MM en "Juin 2026"
function libelleMois(ym) {
  if (!ym) return '';
  return new Date(ym + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function Statistiques() {
  const { agentsData, contratsData, incidentsData, armesData } = useDataStore();

  // ─── État du filtre et du chargement ───
  const maintenant = new Date();
  const moisCourant = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}`;
  const [moisFiltre, setMoisFiltre] = useState(moisCourant);
  const [chargement, setChargement] = useState(true);
  const [rafraichi, setRafraichi] = useState(false);
  const [dernierRefresh, setDernierRefresh] = useState(null);

  // ─── Données Supabase ───
  const [factures, setFactures] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [prospections, setProspections] = useState([]);
  const [allIncidents, setAllIncidents] = useState([]);
  const [accidents, setAccidents] = useState([]);

  const fetchAll = useCallback(async () => {
    setRafraichi(true);
    const [
      { data: fac },
      { data: veh },
      { data: pro },
      { data: inc },
      { data: acc },
    ] = await Promise.all([
      supabase.from('factures').select('*'),
      supabase.from('vehicules').select('*'),
      supabase.from('prospections').select('*'),
      supabase.from('incidents').select('*').order('created_at', { ascending: false }),
      supabase.from('accidents_travail').select('*'),
    ]);
    if (fac) setFactures(fac);
    if (veh) setVehicules(veh);
    if (pro) setProspections(pro);
    if (inc) setAllIncidents(inc);
    if (acc) setAccidents(acc);
    setDernierRefresh(new Date());
    setChargement(false);
    setRafraichi(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Décompose le mois sélectionné ───
  const [anneeF, moisF] = moisFiltre.split('-').map(Number);

  const estDansMoisFiltre = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === anneeF && (d.getMonth() + 1) === moisF;
  };

  // ─── CALCULS RH (indépendants du filtre mois — état actuel) ───
  const agentsActifs  = agentsData.filter(a => a.statut_agent !== 'INACTIF');
  const agentsInactifs = agentsData.filter(a => a.statut_agent === 'INACTIF');

  const parContrat = [
    { label: 'CDD',       value: agentsActifs.filter(a => a.type_contrat === 'CDD').length,        color: colors.blue },
    { label: 'CDI',       value: agentsActifs.filter(a => a.type_contrat === 'CDI').length,        color: colors.green },
    { label: 'CTA (ANEM)',value: agentsActifs.filter(a => a.type_contrat === 'CTA (ANEM)').length, color: '#f59e0b' },
  ];

  const parQualif = ['Agent Simple','Chef de Groupe','Maître-Chien','Convoyeur de Fonds'].map(q => ({
    label: q,
    value: agentsActifs.filter(a => a.qualification === q).length,
    color: { 'Agent Simple':'#6b7280','Chef de Groupe':colors.blue,'Maître-Chien':colors.green,'Convoyeur de Fonds':colors.red }[q]
  })).filter(q => q.value > 0);

  const affiliesCNAS = agentsActifs.filter(a => a.numero_ss && a.numero_ss !== 'NON_DECLARE' && a.numero_ss.trim() !== '').length;

  const aujourd = new Date();
  const cartesPro60  = agentsActifs.filter(a => { if (!a.validite_carte_pro) return false; const j = Math.ceil((new Date(a.validite_carte_pro) - aujourd) / 86400000); return j <= 60 && j > 0; });
  const cartesExpir  = agentsActifs.filter(a => a.validite_carte_pro && new Date(a.validite_carte_pro) < aujourd);
  const cddExpir15   = agentsActifs.filter(a => a.date_fin_contrat && new Date(a.date_fin_contrat) - aujourd < 15 * 86400000);

  const siteCounts = {};
  agentsActifs.forEach(a => { const s = a.site_affecte || 'Non affecté'; siteCounts[s] = (siteCounts[s] || 0) + 1; });
  const parSite = Object.entries(siteCounts).sort((a,b) => b[1]-a[1]).slice(0,8)
    .map(([label, value], i) => ({ label, value, color: [colors.blue,colors.green,colors.red,'#f59e0b','#8b5cf6','#06b6d4','#ec4899',colors.dark][i % 8] }));

  // ─── CALCULS FINANCE — filtrés sur le mois sélectionné ───
  const facturesMois  = factures.filter(f => estDansMoisFiltre(f.date_facturation));
  const caEncaisseM   = facturesMois.filter(f => f.statut_paiement === 'PAYEE').reduce((s,f) => s + Number(f.montant), 0);
  const caAttenteM    = facturesMois.filter(f => f.statut_paiement !== 'PAYEE').reduce((s,f) => s + Number(f.montant), 0);

  // CA global tous mois (pour les totaux dans les donuts)
  const caTotal  = factures.filter(f => f.statut_paiement === 'PAYEE').reduce((s,f) => s + Number(f.montant), 0);
  const caAttente= factures.filter(f => f.statut_paiement !== 'PAYEE').reduce((s,f) => s + Number(f.montant), 0);

  const pipelines = [
    { label:'📞 À Contacter',   value: prospections.filter(p => p.etape_pipeline==='A CONTACTER').length,   color:'#9ca3af' },
    { label:'💬 En Négociation', value: prospections.filter(p => p.etape_pipeline==='EN NEGOCIATION').length, color:'#f59e0b' },
    { label:'📄 Devis Envoyé',   value: prospections.filter(p => p.etape_pipeline==='DEVIS ENVOYE').length,  color:colors.blue },
    { label:'✅ Marchés Gagnés', value: prospections.filter(p => p.etape_pipeline==='GAGNE').length,         color:colors.green },
    { label:'❌ Perdus',         value: prospections.filter(p => p.etape_pipeline==='PERDU').length,         color:colors.red },
  ].filter(p => p.value > 0);

  // Série CA sur 6 mois glissants (axe temporel fixe, indépendant du filtre)
  const caParMois = {};
  factures.filter(f => f.statut_paiement === 'PAYEE' && f.date_encaissement).forEach(f => {
    const d = new Date(f.date_encaissement);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    caParMois[key] = (caParMois[key] || 0) + Number(f.montant);
  });
  const moisCa = Object.entries(caParMois).sort().slice(-6).map(([m, v]) => ({
    key: m,
    label: new Date(m+'-01').toLocaleString('fr-FR',{month:'short',year:'2-digit'}),
    value: v, color: colors.green,
  }));

  // ─── CALCULS INCIDENTS — filtrés sur le mois sélectionné ───
  const incidentsMoisFiltre  = allIncidents.filter(i => estDansMoisFiltre(i.created_at));
  const incidentsCeMois      = incidentsMoisFiltre.length;
  const incidentsResolusM    = incidentsMoisFiltre.filter(i => i.resolu).length;

  // Série incidents sur 6 mois glissants (indépendant du filtre)
  const incParMois = {};
  allIncidents.forEach(i => {
    if (!i.created_at) return;
    const d = new Date(i.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    incParMois[key] = (incParMois[key] || 0) + 1;
  });
  const moisInc = Object.entries(incParMois).sort().slice(-6).map(([m,v]) => ({
    key: m,
    label: new Date(m+'-01').toLocaleString('fr-FR',{month:'short',year:'2-digit'}),
    value: v, color: colors.red,
  }));

  // ─── CALCULS OPÉRATIONS ───
  const vehOpe        = vehicules.filter(v => v.statut === 'OPERATIONNEL').length;
  const vehPanne      = vehicules.filter(v => v.statut !== 'OPERATIONNEL').length;
  const armesAffectees  = armesData.filter(a => a.statut === 'AFFECTEE').length;
  const armesDisponibles= armesData.filter(a => a.statut !== 'AFFECTEE').length;

  const formater = (n) => new Intl.NumberFormat('fr-DZ',{minimumFractionDigits:0}).format(n);

  // ─── CHARGEMENT INITIAL ───
  if (chargement) {
    return (
      <div className="page-container" style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'48px', marginBottom:'20px' }}>📊</div>
          <p className="text-muted">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">

      {/* ─── EN-TÊTE PRINT ONLY ─── */}
      <div className="show-only-on-print" style={{ marginBottom:'20px', paddingBottom:'15px', borderBottom:'2px solid black' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
          <div>
            <h1 style={{ margin:'0 0 4px 0', fontSize:'20px', textTransform:'uppercase' }}>DZ SECURITY — Tableau de Bord Analytique</h1>
            <p style={{ margin:0, fontSize:'13px', color:'#4b5563' }}>
              Période : <strong>{libelleMois(moisFiltre)}</strong> · Généré le {new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
          <div style={{ textAlign:'right', fontSize:'12px', color:'#6b7280' }}>
            <div>{agentsActifs.length} agents actifs · {contratsData.length} sites</div>
            <div>{factures.length} factures enregistrées</div>
          </div>
        </div>
      </div>

      {/* ─── EN-TÊTE ÉCRAN ─── */}
      <div className="flex-between mb-20 hide-on-print" style={{ flexWrap:'wrap', gap:'15px', alignItems:'flex-start' }}>
        <div className="flex-row" style={{ alignItems:'center', gap:'15px' }}>
          <span style={{ fontSize:'32px' }}>📊</span>
          <div>
            <h1 className="page-title">TABLEAU DE BORD ANALYTIQUE</h1>
            <p className="page-subtitle" style={{ margin:0 }}>
              {agentsActifs.length} agents actifs · {contratsData.length} sites · {factures.length} factures
            </p>
          </div>
        </div>

        {/* CONTRÔLES : filtre mois + refresh + export */}
        <div className="flex-row-sm" style={{ alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column' }}>
            <label className="form-label-sm" style={{ marginBottom:'4px' }}>📅 Filtrer par mois</label>
            <input
              type="month"
              value={moisFiltre}
              onChange={e => setMoisFiltre(e.target.value)}
              className="form-input"
              style={{ minWidth:'160px' }}
            />
          </div>
          {moisFiltre !== moisCourant && (
            <button
              onClick={() => setMoisFiltre(moisCourant)}
              className="btn btn-secondary btn-sm"
              style={{ alignSelf:'flex-end' }}
            >
              Mois actuel
            </button>
          )}
          <button
            onClick={fetchAll}
            disabled={rafraichi}
            className="btn btn-dark btn-sm"
            style={{ alignSelf:'flex-end', minWidth:'120px' }}
          >
            {rafraichi ? '⏳ Chargement…' : '🔄 Rafraîchir'}
          </button>
          <button
            onClick={() => window.print()}
            className="btn btn-danger btn-sm"
            style={{ alignSelf:'flex-end' }}
          >
            🖨️ Exporter PDF
          </button>
        </div>
      </div>

      {/* Bandeau mois filtré (seulement si différent du mois courant) */}
      {moisFiltre !== moisCourant && (
        <div className="alert alert-info mb-20 hide-on-print" style={{ padding:'10px 20px' }}>
          📅 Affichage filtré sur <strong>{libelleMois(moisFiltre)}</strong> — les statistiques financières et incidents reflètent ce mois uniquement.
        </div>
      )}

      {/* ─── KPI GLOBAUX ─── */}
      <div className="flex-row mb-20 stats-section" style={{ flexWrap:'wrap' }}>
        <div className="stat-card flex-1" style={{ borderLeft:`5px solid ${colors.blue}` }}>
          <div className="stat-card-label">Agents Actifs</div>
          <div className="stat-card-value">{agentsActifs.length}</div>
          <div className="text-xs text-muted" style={{ marginTop:'4px' }}>{agentsInactifs.length} archivé(s)</div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft:`5px solid ${colors.green}` }}>
          <div className="stat-card-label">Sites Actifs</div>
          <div className="stat-card-value">{contratsData.length}</div>
          <div className="text-xs text-muted" style={{ marginTop:'4px' }}>{prospections.filter(p=>p.etape_pipeline==='GAGNE').length} marchés gagnés</div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft:`5px solid ${colors.green}` }}>
          <div className="stat-card-label">CA Facturé — {libelleMois(moisFiltre)}</div>
          <div className="stat-card-value" style={{ fontSize:'18px', color: caEncaisseM > 0 ? colors.green : '#1f2937' }}>
            {formater(caEncaisseM + caAttenteM)} DA
          </div>
          <div className="text-xs" style={{ marginTop:'4px', color: caAttenteM > 0 ? colors.red : '#6b7280' }}>
            {formater(caEncaisseM)} encaissé · {formater(caAttenteM)} en attente
          </div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft:`5px solid ${colors.red}` }}>
          <div className="stat-card-label">Incidents — {libelleMois(moisFiltre)}</div>
          <div className="stat-card-value" style={{ color: incidentsCeMois > 0 ? colors.red : '#1f2937' }}>{incidentsCeMois}</div>
          <div className="text-xs text-muted" style={{ marginTop:'4px' }}>{incidentsResolusM} résolus · {incidentsData.length} en cours</div>
        </div>
      </div>

      {/* ─── ALERTES ─── */}
      {(cartesPro60.length > 0 || cartesExpir.length > 0 || cddExpir15.length > 0 || accidents.filter(a => !a.declaration_cnas_faite).length > 0) && (
        <div className="alert alert-danger flex-wrap mb-20" style={{ gap:'15px' }}>
          <span style={{ fontSize:'24px' }}>⚠️</span>
          <div>
            <strong style={{ color:'#991b1b', display:'block', marginBottom:'8px' }}>ALERTES DE CONFORMITÉ</strong>
            <div className="flex-row" style={{ flexWrap:'wrap', gap:'20px' }}>
              {cartesExpir.length > 0 && (
                <div className="text-xs" style={{ color:'#991b1b' }}>
                  <strong>🪪 {cartesExpir.length} carte(s) pro EXPIRÉE(S)</strong>
                  <ul style={{ margin:'4px 0 0 15px', padding:0 }}>
                    {cartesExpir.slice(0,3).map(a => <li key={a.id}>{a.nom}</li>)}
                    {cartesExpir.length > 3 && <li>+ {cartesExpir.length-3} autre(s)…</li>}
                  </ul>
                </div>
              )}
              {cartesPro60.length > 0 && (
                <div className="text-xs" style={{ color:'#b45309' }}>
                  <strong>⏳ {cartesPro60.length} carte(s) pro expire(nt) dans 60j</strong>
                  <ul style={{ margin:'4px 0 0 15px', padding:0 }}>
                    {cartesPro60.slice(0,3).map(a => <li key={a.id}>{a.nom} — {a.validite_carte_pro}</li>)}
                  </ul>
                </div>
              )}
              {cddExpir15.length > 0 && (
                <div className="text-xs" style={{ color:'#991b1b' }}>
                  <strong>📋 {cddExpir15.length} CDD expire(nt) dans 15j</strong>
                  <ul style={{ margin:'4px 0 0 15px', padding:0 }}>
                    {cddExpir15.slice(0,3).map(a => <li key={a.id}>{a.nom}</li>)}
                  </ul>
                </div>
              )}
              {accidents.filter(a => !a.declaration_cnas_faite).length > 0 && (
                <div className="text-xs" style={{ color:'#991b1b' }}>
                  <strong>🏥 {accidents.filter(a => !a.declaration_cnas_faite).length} accident(s) non déclaré(s) CNAS</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── LIGNE 1 : RH + COMMERCIAL ─── */}
      <div className="flex-row mb-20 stats-flex-print stats-section" style={{ flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* Bloc RH */}
        <div style={{ flex:'1 1 480px' }} className="flex-col">
          <div className="card card-blue mb-20">
            <h3 className="section-title mb-20">👥 Ressources Humaines <span className="badge badge-info" style={{ fontSize:'11px', marginLeft:'8px' }}>État actuel</span></h3>
            <div className="flex-row" style={{ alignItems:'flex-start', flexWrap:'wrap' }}>
              <div className="flex-1">
                <p className="text-xs text-bold text-muted" style={{ marginBottom:'10px', textTransform:'uppercase' }}>Type de Contrat</p>
                <BarChart items={parContrat} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-bold text-muted" style={{ marginBottom:'10px', textTransform:'uppercase' }}>Qualification</p>
                <BarChart items={parQualif} />
              </div>
            </div>
            <div style={{ marginTop:'20px', paddingTop:'15px', borderTop:'1px solid #e5e7eb', display:'flex', gap:'20px', flexWrap:'wrap' }}>
              <DonutStat value={affiliesCNAS} total={agentsActifs.length} color={colors.green} label="Affiliés CNAS" />
              <div className="flex-row-sm" style={{ flexWrap:'wrap' }}>
                <div className="stat-card" style={{ borderLeft:`4px solid ${colors.blue}`, padding:'10px 15px', minWidth:'80px' }}>
                  <div className="stat-card-label" style={{ fontSize:'10px' }}>Actifs</div>
                  <div className="stat-card-value" style={{ fontSize:'22px' }}>{agentsActifs.length}</div>
                </div>
                <div className="stat-card" style={{ borderLeft:'4px solid #9ca3af', padding:'10px 15px', minWidth:'80px' }}>
                  <div className="stat-card-label" style={{ fontSize:'10px' }}>Archivés</div>
                  <div className="stat-card-value" style={{ fontSize:'22px', color:'#9ca3af' }}>{agentsInactifs.length}</div>
                </div>
                <div className="stat-card" style={{ borderLeft:`4px solid ${colors.red}`, padding:'10px 15px', minWidth:'80px' }}>
                  <div className="stat-card-label" style={{ fontSize:'10px' }}>Accidents</div>
                  <div className="stat-card-value" style={{ fontSize:'22px', color:colors.red }}>{accidents.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card card-dark">
            <h3 className="section-title mb-20">📍 Répartition par Site <span className="badge badge-neutral" style={{ fontSize:'11px', marginLeft:'8px' }}>État actuel</span></h3>
            {parSite.length > 0 ? <BarChart items={parSite} height={8} /> : <p className="text-muted text-xs">Aucune affectation enregistrée.</p>}
          </div>
        </div>

        {/* Bloc Commercial */}
        <div style={{ flex:'1 1 400px' }} className="flex-col">
          <div className="card card-green mb-20">
            <div className="flex-between mb-20">
              <h3 className="section-title">💰 Finance & Recouvrement</h3>
              <span className="badge badge-success" style={{ fontSize:'11px' }}>{libelleMois(moisFiltre)}</span>
            </div>
            <div className="flex-row" style={{ flexWrap:'wrap', gap:'15px', marginBottom:'20px' }}>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.green}`, minWidth:'130px' }}>
                <div className="stat-card-label">CA Encaissé</div>
                <div className="stat-card-value" style={{ fontSize:'17px', color:colors.green }}>{formater(caEncaisseM)}</div>
                <div className="text-xxs text-muted">DZD — {libelleMois(moisFiltre)}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.red}`, minWidth:'130px' }}>
                <div className="stat-card-label">En Attente</div>
                <div className="stat-card-value" style={{ fontSize:'17px', color:colors.red }}>{formater(caAttenteM)}</div>
                <div className="text-xxs text-muted">DZD — {libelleMois(moisFiltre)}</div>
              </div>
            </div>
            <DonutStat
              value={factures.filter(f=>f.statut_paiement==='PAYEE').length}
              total={factures.length}
              color={colors.green}
              label="Factures payées (tous mois)"
            />
            <div style={{ marginTop:'15px', paddingTop:'15px', borderTop:'1px solid #e5e7eb' }}>
              <p className="text-xs text-bold text-muted" style={{ marginBottom:'10px', textTransform:'uppercase' }}>
                CA Encaissé — 6 mois glissants
                <span style={{ fontWeight:'normal', color:'#6b7280', marginLeft:'6px' }}>(mois sélectionné surligné)</span>
              </p>
              {moisCa.length > 0
                ? <BarChart items={moisCa} moisActif={moisFiltre} />
                : <p className="text-muted text-xs">Aucun encaissement enregistré.</p>
              }
            </div>
          </div>

          <div className="card card-blue">
            <h3 className="section-title mb-20">🎯 Pipeline Commercial <span className="badge badge-info" style={{ fontSize:'11px', marginLeft:'8px' }}>État actuel</span></h3>
            {pipelines.length > 0 ? <BarChart items={pipelines} /> : <p className="text-muted text-xs">Aucune prospection enregistrée.</p>}
            <div style={{ marginTop:'15px', paddingTop:'15px', borderTop:'1px solid #e5e7eb' }}>
              <div className="flex-between">
                <span className="text-xs text-muted">Total prospects</span>
                <span className="text-bold">{prospections.length}</span>
              </div>
              <div className="flex-between" style={{ marginTop:'5px' }}>
                <span className="text-xs text-muted">Taux de conversion</span>
                <span className="text-bold" style={{ color:colors.green }}>
                  {prospections.length > 0 ? Math.round((prospections.filter(p=>p.etape_pipeline==='GAGNE').length / prospections.length)*100) : 0}%
                </span>
              </div>
              <div className="flex-between" style={{ marginTop:'5px' }}>
                <span className="text-xs text-muted">CA total encaissé (cumulé)</span>
                <span className="text-bold" style={{ color:colors.green }}>{formater(caTotal)} DA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── LIGNE 2 : OPÉRATIONS + INCIDENTS ─── */}
      <div className="flex-row mb-20 stats-flex-print stats-section" style={{ flexWrap:'wrap', alignItems:'flex-start' }}>

        {/* Logistique */}
        <div style={{ flex:'1 1 340px' }} className="flex-col">
          <div className="card card-dark">
            <h3 className="section-title mb-20">🚙 Logistique & Armement <span className="badge badge-neutral" style={{ fontSize:'11px', marginLeft:'8px' }}>État actuel</span></h3>
            <div className="flex-row mb-15" style={{ flexWrap:'wrap', gap:'10px' }}>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.green}`, padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>Véhicules Opérationnels</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:colors.green }}>{vehOpe}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.red}`, padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>En Panne</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:colors.red }}>{vehPanne}</div>
              </div>
            </div>
            {vehicules.length > 0 && (
              <div style={{ marginBottom:'20px', paddingBottom:'15px', borderBottom:'1px solid #e5e7eb' }}>
                <p className="text-xs text-bold text-muted" style={{ marginBottom:'6px' }}>DISPONIBILITÉ FLOTTE</p>
                <div style={{ backgroundColor:'#e5e7eb', borderRadius:'99px', height:'12px', overflow:'hidden' }}>
                  <div style={{ width:`${(vehOpe/vehicules.length)*100}%`, background:`linear-gradient(90deg, ${colors.green}, #34d399)`, height:'100%', borderRadius:'99px' }} />
                </div>
                <div className="flex-between" style={{ marginTop:'4px' }}>
                  <span className="text-xxs text-muted">{vehicules.length} véhicule(s)</span>
                  <span className="text-xxs text-bold" style={{ color:colors.green }}>{Math.round((vehOpe/vehicules.length)*100)}% opérationnels</span>
                </div>
              </div>
            )}
            <div className="flex-row" style={{ flexWrap:'wrap', gap:'10px' }}>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.red}`, padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>Armes Affectées</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:colors.red }}>{armesAffectees}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:'4px solid #9ca3af', padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>En Stock</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:'#6b7280' }}>{armesDisponibles}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Incidents */}
        <div style={{ flex:'1 1 480px' }} className="flex-col">
          <div className="card card-red">
            <div className="flex-between mb-20">
              <h3 className="section-title">🚨 Incidents</h3>
              <span className="badge badge-danger" style={{ fontSize:'11px' }}>{libelleMois(moisFiltre)}</span>
            </div>
            <div className="flex-row mb-20" style={{ flexWrap:'wrap', gap:'10px' }}>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.red}`, padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>Ce mois</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:colors.red }}>{incidentsCeMois}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:`4px solid ${colors.green}`, padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>Résolus</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:colors.green }}>{incidentsResolusM}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:'4px solid #f59e0b', padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>En cours (live)</div>
                <div className="stat-card-value" style={{ fontSize:'24px', color:'#f59e0b' }}>{incidentsData.length}</div>
              </div>
              <div className="stat-card flex-1" style={{ borderLeft:'4px solid #6b7280', padding:'10px 12px' }}>
                <div className="stat-card-label" style={{ fontSize:'11px' }}>Total BDD</div>
                <div className="stat-card-value" style={{ fontSize:'24px' }}>{allIncidents.length}</div>
              </div>
            </div>
            <p className="text-xs text-bold text-muted" style={{ marginBottom:'10px', textTransform:'uppercase' }}>
              Incidents — 6 mois glissants
              <span style={{ fontWeight:'normal', color:'#6b7280', marginLeft:'6px' }}>(mois sélectionné surligné)</span>
            </p>
            {moisInc.length > 0
              ? <BarChart items={moisInc} height={8} moisActif={moisFiltre} />
              : <p className="text-muted text-xs">Aucun incident enregistré.</p>
            }

            {incidentsMoisFiltre.length > 0 && (
              <div style={{ marginTop:'20px', paddingTop:'15px', borderTop:'1px solid #e5e7eb' }}>
                <p className="text-xs text-bold text-muted" style={{ marginBottom:'10px', textTransform:'uppercase' }}>
                  Incidents de {libelleMois(moisFiltre)} ({incidentsMoisFiltre.length})
                </p>
                <table className="table table-xs">
                  <thead>
                    <tr><th>Agent</th><th>Site</th><th>Heure</th><th className="text-center">Statut</th></tr>
                  </thead>
                  <tbody>
                    {incidentsMoisFiltre.slice(0,5).map(inc => (
                      <tr key={inc.id}>
                        <td className="text-bold">{inc.nom_agent}</td>
                        <td className="text-muted text-xs">{inc.site}</td>
                        <td className="text-xs">{inc.heure_incident}</td>
                        <td className="text-center">
                          {inc.resolu
                            ? <span className="badge badge-success" style={{ fontSize:'10px' }}>✅ Résolu</span>
                            : <span className="badge badge-danger"  style={{ fontSize:'10px' }}>🔴 En cours</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {incidentsMoisFiltre.length > 5 && (
                  <p className="text-xs text-muted text-center" style={{ marginTop:'8px' }}>
                    + {incidentsMoisFiltre.length - 5} autre(s) incident(s) ce mois
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── PIED ─── */}
      <div className="text-center text-xs text-muted" style={{ padding:'20px 0 10px 0' }}>
        {dernierRefresh
          ? `Dernière actualisation : ${dernierRefresh.toLocaleTimeString('fr-FR')} · Filtre actif : ${libelleMois(moisFiltre)}`
          : 'Données chargées depuis la base de données'
        }
      </div>

    </div>
  );
}

export default Statistiques;
