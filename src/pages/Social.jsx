import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Social() {
  const { agentsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('affiliation');
  const [accidents, setAccidents] = useState([]);
  const [demandesAts, setDemandesAts] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [afficherFormulaireAccident, setAfficherFormulaireAccident] = useState(false);
  const [accAgentId, setAccAgentId] = useState('');
  const [accDate, setAccDate] = useState('');
  const [accLieu, setAccLieu] = useState('');
  const [accArretJours, setAccArretJours] = useState(0);
  const [afficherFormulaireAts, setAfficherFormulaireAts] = useState(false);
  const [atsAgentId, setAtsAgentId] = useState('');
  const [atsMotif, setAtsMotif] = useState('');

  const fetchDonneesSociales = async () => {
    const { data: accData } = await supabase.from('accidents_travail').select('*, agents(nom, matricule, numero_ss)');
    if (accData) setAccidents(accData);
    const { data: atsData } = await supabase.from('demandes_ats').select('*, agents(nom, matricule)');
    if (atsData) setDemandesAts(atsData);
    setChargement(false);
  };

  useEffect(() => { fetchDonneesSociales(); }, []);

  const exporterFichierCNAS = () => {
    const agentsAffilies = agentsData.filter(a => a.numero_ss && a.numero_ss !== 'NON_DECLARE' && a.numero_ss.trim() !== '');
    if (agentsAffilies.length === 0) { alert("Aucun agent n'a de N° SS valide."); return; }
    let csvContent = "data:text/csv;charset=utf-8,﻿Matricule;Nom;Prenom;Numero_SS;Date_Embauche\n";
    agentsAffilies.forEach(a => {
      const nom = a.nom.split(' ')[0] || '';
      const prenom = a.nom.split(' ').slice(1).join(' ') || '';
      csvContent += `${a.matricule};${nom};${prenom};${a.numero_ss};${a.date_recrutement || '01/01/2026'}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `declaration_cnas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const declarerNouvelAccident = async (e) => {
    e.preventDefault();
    if (!accAgentId || !accDate) return;
    setChargement(true);
    await supabase.from('accidents_travail').insert([{ agent_id: accAgentId, date_accident: accDate, lieu_accident: accLieu, arret_maladie_jours: accArretJours, declaration_cnas_faite: false }]);
    setAfficherFormulaireAccident(false);
    setAccAgentId(''); setAccDate(''); setAccLieu(''); setAccArretJours(0);
    fetchDonneesSociales();
  };

  const declarerAccidentCNAS = async (id) => {
    await supabase.from('accidents_travail').update({ declaration_cnas_faite: true }).eq('id', id);
    fetchDonneesSociales();
  };

  const demanderNouvelleATS = async (e) => {
    e.preventDefault();
    if (!atsAgentId) return;
    setChargement(true);
    await supabase.from('demandes_ats').insert([{ agent_id: atsAgentId, motif: atsMotif || 'Non précisé', date_demande: new Date().toISOString().split('T')[0], statut: 'EN ATTENTE' }]);
    setAfficherFormulaireAts(false);
    setAtsAgentId(''); setAtsMotif('');
    fetchDonneesSociales();
  };

  const genererATS = async (id, nomAgent) => {
    await supabase.from('demandes_ats').update({ statut: 'DELIVREE' }).eq('id', id);
    fetchDonneesSociales();
    alert(`Attestation de Travail et de Salaire (ATS) générée en PDF pour ${nomAgent}.`);
  };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🏥</span>
        <div>
          <h1 className="page-title">SERVICE SOCIAL</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Gestion des affiliations, paie, accidents de travail et délivrance d'ATS.</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('affiliation')} className={`nav-tab${sousMenu === 'affiliation' ? ' active' : ''}`} style={sousMenu === 'affiliation' ? { backgroundColor: colors.blue } : {}}>1. Affiliation des Agents</button>
        <button onClick={() => setSousMenu('paie')} className={`nav-tab${sousMenu === 'paie' ? ' active' : ''}`} style={sousMenu === 'paie' ? { backgroundColor: colors.green } : {}}>2. Élaboration de la Paye</button>
        <button onClick={() => setSousMenu('accidents')} className={`nav-tab${sousMenu === 'accidents' ? ' active' : ''}`} style={sousMenu === 'accidents' ? { backgroundColor: colors.red } : {}}>3. Accident de Travail</button>
        <button onClick={() => setSousMenu('ats')} className={`nav-tab${sousMenu === 'ats' ? ' active' : ''}`} style={sousMenu === 'ats' ? { backgroundColor: colors.dark } : {}}>4. Élaboration des ATS</button>
      </div>

      {sousMenu === 'affiliation' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <h3 className="section-title">Suivi des Affiliations (CNAS)</h3>
            <button onClick={exporterFichierCNAS} className="btn btn-dark btn-sm">📥 Exporter Fichier Télé-Déclaration CNAS</button>
          </div>
          <table className="table">
            <thead>
              <tr><th>Agent</th><th>Type de Contrat</th><th>N° Sécurité Sociale (CNAS)</th><th>Statut Affiliation</th></tr>
            </thead>
            <tbody>
              {agentsData.map((agent) => {
                const estAffilie = agent.numero_ss && agent.numero_ss !== 'NON_DECLARE' && agent.numero_ss.trim() !== '';
                return (
                  <tr key={agent.id}>
                    <td className="text-bold">{agent.nom}</td>
                    <td className="text-muted">{agent.type_contrat || 'CDD'}</td>
                    <td className="text-bold" style={{ color: estAffilie ? colors.green : colors.red }}>{agent.numero_ss || 'VIDE'}</td>
                    <td>{estAffilie ? <span className="badge badge-success">✅ AFFILIÉ</span> : <span className="badge badge-danger">⚠️ À DÉCLARER</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'paie' && (
        <div className="card card-green">
          <h3 className="section-title mb-10">Élaboration de la Paye (Génération Fichier)</h3>
          <p className="text-sm text-muted mb-20">Le transfert des variables de paie vers les logiciels comptables nécessite la validation des Attachements.</p>
          <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>💸</div>
            <h4 style={{ margin: '0 0 10px 0', color: '#166534' }}>Variables de Paie Prêtes</h4>
            <button onClick={() => alert("Fichier de paye généré ! (PCPAIE)")} className="btn btn-success">Générer le Fichier de Paye du Mois</button>
          </div>
        </div>
      )}

      {sousMenu === 'accidents' && (
        <div className="card card-red">
          <div className="flex-between mb-20">
            <h3 className="section-title">Registre des Accidents de Travail</h3>
            {!afficherFormulaireAccident && (
              <button onClick={() => setAfficherFormulaireAccident(true)} className="btn btn-danger btn-sm">+ Déclarer un Accident</button>
            )}
          </div>

          {afficherFormulaireAccident && (
            <form onSubmit={declarerNouvelAccident} className="form-section mb-20 flex-wrap" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label-sm" style={{ color: '#991b1b' }}>Agent Accidenté *</label>
                <select value={accAgentId} onChange={(e) => setAccAgentId(e.target.value)} required className="form-select" style={{ borderColor: '#fca5a5' }}>
                  <option value="">-- Sélectionner l'agent --</option>
                  {agentsData.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm" style={{ color: '#991b1b' }}>Date de l'accident *</label>
                <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} required className="form-input" style={{ borderColor: '#fca5a5' }} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm" style={{ color: '#991b1b' }}>Jours d'arrêt prescrits</label>
                <input type="number" min="0" value={accArretJours} onChange={(e) => setAccArretJours(e.target.value)} className="form-input" style={{ borderColor: '#fca5a5' }} />
              </div>
              <div style={{ flex: '2 1 300px' }}>
                <label className="form-label-sm" style={{ color: '#991b1b' }}>Lieu et Description sommaire</label>
                <input type="text" placeholder="Ex: Chute dans les escaliers du Siège BNA" value={accLieu} onChange={(e) => setAccLieu(e.target.value)} className="form-input" style={{ borderColor: '#fca5a5' }} />
              </div>
              <div className="flex-row-sm">
                <button type="button" onClick={() => setAfficherFormulaireAccident(false)} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-danger">Enregistrer dans le registre</button>
              </div>
            </form>
          )}

          {chargement ? <p>Chargement...</p> : (
            <table className="table">
              <thead>
                <tr><th>Date & Lieu</th><th>Agent Concerné</th><th>Arrêt Maladie</th><th className="text-center">Déclaration CNAS (48h)</th></tr>
              </thead>
              <tbody>
                {accidents.map(acc => {
                  const nomAgent = acc.agents ? (Array.isArray(acc.agents) ? acc.agents[0]?.nom : acc.agents.nom) : 'Agent Inconnu';
                  const numSS = acc.agents ? (Array.isArray(acc.agents) ? acc.agents[0]?.numero_ss : acc.agents.numero_ss) : '---';
                  return (
                    <tr key={acc.id}>
                      <td><strong>{new Date(acc.date_accident).toLocaleDateString('fr-FR')}</strong><br /><span className="text-xs text-muted">{acc.lieu_accident}</span></td>
                      <td className="text-bold" style={{ color: colors.blue }}>{nomAgent}<br /><span className="text-xs text-muted">N° SS: {numSS}</span></td>
                      <td className="text-bold" style={{ color: colors.red }}>{acc.arret_maladie_jours} jours</td>
                      <td className="text-center">
                        {acc.declaration_cnas_faite
                          ? <span className="badge badge-success">✅ DÉCLARÉ</span>
                          : <button onClick={() => declarerAccidentCNAS(acc.id)} className="btn btn-danger btn-xs">⚠️ À DÉCLARER !</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {sousMenu === 'ats' && (
        <div className="card card-dark">
          <div className="flex-between mb-20">
            <h3 className="section-title">Demandes d'Attestations (ATS)</h3>
            {!afficherFormulaireAts && (
              <button onClick={() => setAfficherFormulaireAts(true)} className="btn btn-dark btn-sm">+ Nouvelle Demande</button>
            )}
          </div>

          {afficherFormulaireAts && (
            <form onSubmit={demanderNouvelleATS} className="form-section mb-20 flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label-sm">Agent demandeur *</label>
                <select value={atsAgentId} onChange={(e) => setAtsAgentId(e.target.value)} required className="form-select">
                  <option value="">-- Sélectionner --</option>
                  {agentsData.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                </select>
              </div>
              <div style={{ flex: '2 1 300px' }}>
                <label className="form-label-sm">Motif (Optionnel)</label>
                <input type="text" placeholder="Ex: Renouvellement dossier CNL / AADL" value={atsMotif} onChange={(e) => setAtsMotif(e.target.value)} className="form-input" />
              </div>
              <button type="submit" className="btn btn-dark" style={{ height: '35px' }}>Enregistrer la demande</button>
            </form>
          )}

          {chargement ? <p>Chargement...</p> : (
            <table className="table">
              <thead>
                <tr><th>Date Demande</th><th>Agent</th><th>Motif (Justificatif)</th><th className="text-center">Génération ATS</th></tr>
              </thead>
              <tbody>
                {demandesAts.map(ats => {
                  const nomAgent = ats.agents ? (Array.isArray(ats.agents) ? ats.agents[0]?.nom : ats.agents.nom) : 'Inconnu';
                  return (
                    <tr key={ats.id}>
                      <td>{new Date(ats.date_demande).toLocaleDateString('fr-FR')}</td>
                      <td className="text-bold">{nomAgent}</td>
                      <td>{ats.motif || 'Non précisé'}</td>
                      <td className="text-center">
                        {ats.statut === 'DELIVREE'
                          ? <span className="badge badge-success">✅ DÉLIVRÉE</span>
                          : <button onClick={() => genererATS(ats.id, nomAgent)} className="btn btn-dark btn-xs">📄 Générer ATS</button>
                        }
                      </td>
                    </tr>
                  );
                })}
                {demandesAts.length === 0 && <tr><td colSpan="4" className="empty-state">Aucune demande d'ATS en cours.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default Social;
