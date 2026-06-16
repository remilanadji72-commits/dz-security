import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';
import { exportPlanDefenseToPDF } from '../utils/export';

function SalleOps() {
  const { contratsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('assiduite');
  const [passations, setPassations] = useState([]);
  const [pointagesAttente, setPointagesAttente] = useState([]);

  const fetchOpsData = async () => {
    try {
      const { data: pass } = await supabase.from('passations').select('*').order('id', { ascending: false });
      if (pass) setPassations(pass);
      const { data: pts } = await supabase.from('pointages_journaliers').select('*').eq('statut_validation', 'EN ATTENTE').order('id', { ascending: false });
      if (pts) setPointagesAttente(pts);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchOpsData();
    const interval = setInterval(fetchOpsData, 3000);
    return () => clearInterval(interval);
  }, []);

  const validerPointage = async (idPointage) => {
    const { error } = await supabase.from('pointages_journaliers').update({ statut_validation: 'VALIDE' }).eq('id', idPointage);
    if (!error) fetchOpsData();
    else alert("Erreur de validation");
  };


  const genererRapportClient = () => {
    if (passations.length === 0) { alert("Aucune donnée disponible pour générer un rapport."); return; }
    let csvContent = "data:text/csv;charset=utf-8,﻿";
    csvContent += "RAPPORT MENSUEL D'ACTIVITE\n\nDate & Heure;Site;Chef de Poste;Etat du Materiel;Consignes & Anomalies\n";
    passations.forEach(p => {
      const dateStr = new Date(p.date_heure).toLocaleString('fr-FR').replace(/;/g, ',');
      const materiel = p.materiel_ok ? "Conforme" : "Defaillant";
      const remarques = (p.anomalies !== 'R.A.S' ? `Anomalie: ${p.anomalies} - ` : '') + `Consigne: ${p.consignes}`.replace(/;/g, ',');
      csvContent += `${dateStr};${p.site.replace(/;/g, ',')};${p.chef_montant.replace(/;/g, ',')};${materiel};${remarques}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Rapport_Mensuel_Client_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="page-container print-container">
      <div className="hide-on-print page-header mb-20">
        <span style={{ fontSize: '32px' }}>🖥️</span>
        <div>
          <h1 className="page-title">SERVICE GESTION DES SITES & SALLE OPS</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Installation, Assiduité, Passations, Vérification des pointages et Plans de Défense.</p>
        </div>
      </div>

      <div className="hide-on-print nav-tabs">
        <button onClick={() => setSousMenu('assiduite')} className={`nav-tab${sousMenu === 'assiduite' ? ' active' : ''}`} style={sousMenu === 'assiduite' ? { backgroundColor: colors.blue } : {}}>Suivi Présence & Assiduité</button>
        <button onClick={() => setSousMenu('passations')} className={`nav-tab${sousMenu === 'passations' ? ' active' : ''}`} style={sousMenu === 'passations' ? { backgroundColor: colors.green } : {}}>Passations Quotidiennes</button>
        <button onClick={() => setSousMenu('plans')} className={`nav-tab${sousMenu === 'plans' ? ' active' : ''}`} style={sousMenu === 'plans' ? { backgroundColor: colors.dark } : {}}>Plans de Défense</button>
        <button onClick={() => setSousMenu('rapports')} className={`nav-tab${sousMenu === 'rapports' ? ' active' : ''}`} style={sousMenu === 'rapports' ? { backgroundColor: '#f59e0b' } : {}}>Rapports Mensuels (Client)</button>
      </div>

      {/* 1. ASSIDUITÉ */}
      {sousMenu === 'assiduite' && (
        <div className="card card-blue">
          <h3 className="page-title mb-10">Vérification des Pointages (Aujourd'hui)</h3>
          <p className="text-sm text-muted mb-20">Validez les prises de service pour qu'elles soient comptabilisées par la DRH sur l'attachement mensuel.</p>
          <table className="table table-sm">
            <thead>
              <tr><th>Site Ops</th><th>Agent</th><th>Heure d'arrivée</th><th className="text-center">Validation OPS</th></tr>
            </thead>
            <tbody>
              {pointagesAttente.length > 0 ? pointagesAttente.map((pt) => (
                <tr key={pt.id} style={{ backgroundColor: '#fffbeb' }}>
                  <td className="text-bold" style={{ color: colors.dark }}>{pt.site_affecte}</td>
                  <td>{pt.nom_agent}</td>
                  <td className="text-bold" style={{ color: colors.blue }}>{pt.heure_arrivee} ({pt.type_vacation})</td>
                  <td className="text-center">
                    <button onClick={() => validerPointage(pt.id)} className="btn btn-success btn-sm" style={{ boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>
                      ✅ Valider la présence
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="empty-state">Tous les pointages en attente ont été traités.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. PASSATIONS */}
      {sousMenu === 'passations' && (
        <div className="card card-green print-planning">
          <div className="hide-on-print flex-between mb-20">
            <div>
              <h3 className="section-title">Journal des Passations de Consignes (Relève)</h3>
              <p className="text-sm text-muted" style={{ marginTop: '5px' }}>Supervision des remontées des Chefs de Sites (Matériel, Anomalies).</p>
            </div>
            <button onClick={() => window.print()} className="btn btn-success btn-sm">📥 Exporter PDF</button>
          </div>
          <div className="show-only-on-print mb-20 text-center">
            <h2 style={{ textTransform: 'uppercase' }}>REGISTRE DES PASSATIONS DE CONSIGNES</h2>
            <h3>Date d'édition : {new Date().toLocaleDateString('fr-FR')}</h3>
          </div>
          <table className="table table-sm" style={{ border: '1px solid black' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black' }}>Site & Date</th>
                <th style={{ border: '1px solid black' }}>Montant ➔ Descendant</th>
                <th style={{ border: '1px solid black' }}>État du Matériel</th>
                <th style={{ border: '1px solid black' }}>Consignes / Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {passations.length > 0 ? passations.map(p => (
                <tr key={p.id}>
                  <td style={{ border: '1px solid black', padding: '12px' }}>
                    <strong>{p.site}</strong><br />
                    <span style={{ color: colors.blue }}>{new Date(p.date_heure).toLocaleString('fr-FR')}</span>
                  </td>
                  <td className="text-bold" style={{ border: '1px solid black', padding: '12px' }}>
                    {p.chef_montant}<br />
                    <span className="text-xxs text-muted" style={{ fontWeight: 'normal' }}>Relève: {p.chef_descendant}</span>
                  </td>
                  <td style={{ border: '1px solid black', padding: '12px' }}>
                    <span className={`badge ${p.materiel_ok ? 'badge-success' : 'badge-danger'}`}>
                      {p.materiel_ok ? '✅ VÉRIFIÉ' : '❌ PROBLÈME'}
                    </span>
                  </td>
                  <td style={{ border: '1px solid black', padding: '12px' }}>
                    {p.anomalies && p.anomalies !== 'R.A.S' && <><span style={{ color: '#991b1b', fontWeight: 'bold' }}>⚠ Anomalie:</span> {p.anomalies}<br /></>}
                    <span className="text-xxs text-muted">Consignes: {p.consignes}</span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="empty-state">Aucune passation reçue pour le moment.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. PLANS DE DÉFENSE */}
      {sousMenu === 'plans' && (
        <div className="card card-dark">
          <h3 className="section-title mb-20">Élaboration et Suivi des Plans de Défense</h3>
          <table className="table table-sm">
            <thead>
              <tr><th>Site (Client)</th><th>Statut du Plan de Défense</th><th className="text-right">Document</th></tr>
            </thead>
            <tbody>
              {contratsData.map((c) => (
                <tr key={c.id}>
                  <td className="text-bold">{c.nom_site}</td>
                  <td>
                    {c.plan_defense_valide
                      ? <span style={{ color: colors.green, fontWeight: 'bold' }}>✅ Validé</span>
                      : <span style={{ color: colors.red, fontWeight: 'bold' }}>❌ Manquant ou Expiré</span>
                    }
                  </td>
                  <td className="text-right flex-row" style={{ justifyContent: 'flex-end' }}>
                    <input type="file" accept=".pdf" onChange={(e) => { if (e.target.files[0]) alert(`Le fichier ${e.target.files[0].name} a été importé pour ${c.nom_site}.`); }} style={{ fontSize: '11px', maxWidth: '180px' }} />
                    <button onClick={() => exportPlanDefenseToPDF(c)} className="btn btn-dark btn-xs">📄 Générer Plan PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. RAPPORTS MENSUELS */}
      {sousMenu === 'rapports' && (
        <div className="card card-yellow">
          <div className="flex-between mb-20">
            <h3 className="section-title">Élaboration des Rapports d'Activités Mensuels</h3>
            <button onClick={genererRapportClient} className="btn btn-warning btn-sm">Générer Rapport Mensuel (Client)</button>
          </div>
          <p className="text-sm text-muted">Ces rapports de synthèse sont destinés à la coordination avec les clients finaux.</p>
        </div>
      )}
    </div>
  );
}

export default SalleOps;
