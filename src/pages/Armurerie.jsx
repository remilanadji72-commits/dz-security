import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Armurerie() {
  const { armesData, agentsData, fetchToutesLesDonnees } = useDataStore();
  const [armeSelectionnee, setArmeSelectionnee] = useState('');
  const [agentSelectionne, setAgentSelectionne] = useState('');
  const [loading, setLoading] = useState(false);
  const [sousMenu, setSousMenu] = useState('verification');

  const affecterArme = async (e) => {
    e.preventDefault();
    if (!armeSelectionnee || !agentSelectionne) {
      alert("Veuillez sélectionner une arme et un agent.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('armes').update({ statut: 'DEPLOYEE', agent_id: agentSelectionne }).eq('id', armeSelectionnee);
      if (error) throw error;
      setArmeSelectionnee('');
      setAgentSelectionne('');
      fetchToutesLesDonnees();
      alert("✅ Arme sortie du coffre avec succès !");
    } catch (_err) {
      alert("❌ Erreur réseau lors de la sortie de l'arme.");
    } finally {
      setLoading(false);
    }
  };

  const restituerArme = async (idArme, numeroSerie) => {
    if (window.confirm(`Confirmez-vous le retour au coffre de l'arme ${numeroSerie} ?`)) {
      try {
        const { error } = await supabase.from('armes').update({ statut: 'AU_COFFRE', agent_id: null }).eq('id', idArme);
        if (error) throw error;
        fetchToutesLesDonnees();
      } catch (_err) {
        alert("❌ Erreur lors de la restitution.");
      }
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">SERVICE ARMEMENT ET TRANSMISSION</h1>
      <p className="page-subtitle">Gestion stricte des armes à feu, munitions et équipements radio (UHF/VHF).</p>

      {/* NAVIGATION INTERNE */}
      <div className="nav-tabs">
        <button onClick={() => setSousMenu('verification')} className={`nav-tab${sousMenu === 'verification' ? ' active' : ''}`} style={sousMenu === 'verification' ? { backgroundColor: colors.red } : {}}>1. Vérification & Déploiement</button>
        <button onClick={() => setSousMenu('acheminement')} className={`nav-tab${sousMenu === 'acheminement' ? ' active' : ''}`} style={sousMenu === 'acheminement' ? { backgroundColor: colors.blue } : {}}>2. Acheminement des Armes</button>
        <button onClick={() => setSousMenu('maintenance')} className={`nav-tab${sousMenu === 'maintenance' ? ' active' : ''}`} style={sousMenu === 'maintenance' ? { backgroundColor: '#f59e0b' } : {}}>3. Maintenance & Nettoyage</button>
        <button onClick={() => setSousMenu('uhf')} className={`nav-tab${sousMenu === 'uhf' ? ' active' : ''}`} style={sousMenu === 'uhf' ? { backgroundColor: colors.dark } : {}}>4. Vérification Matériel UHF</button>
      </div>

      {/* 1. VÉRIFICATION ET DÉPLOIEMENT */}
      {sousMenu === 'verification' && (
        <>
          <div className="card card-red mb-20">
            <h3 style={{ marginTop: 0 }}>Sortie d'Arme (Prise de Service)</h3>
            <form onSubmit={affecterArme} className="flex-row">
              <select value={armeSelectionnee} onChange={(e) => setArmeSelectionnee(e.target.value)} className="form-select flex-1">
                <option value="">-- Sélectionner arme --</option>
                {armesData.filter(a => a.statut === 'AU_COFFRE').map(arme =>
                  <option key={arme.id} value={arme.id}>{arme.numero_serie} (Coffre: {arme.contrats ? arme.contrats.nom_site : 'Siège'})</option>
                )}
              </select>
              <select value={agentSelectionne} onChange={(e) => setAgentSelectionne(e.target.value)} className="form-select flex-1">
                <option value="">-- Sélectionner agent --</option>
                {agentsData.map(agent => <option key={agent.id} value={agent.id}>{agent.nom}</option>)}
              </select>
              <button type="submit" className="btn btn-danger" disabled={loading}>Valider Sortie</button>
            </form>
          </div>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Série</th><th>Coffre (Site)</th><th>Statut</th><th>Détenue par</th>
                </tr>
              </thead>
              <tbody>
                {armesData.map((arme) => (
                  <tr key={arme.id}>
                    <td className="text-bold">{arme.numero_serie}</td>
                    <td style={{ color: colors.dark }}>📍 {arme.contrats ? arme.contrats.nom_site : 'Siège'}</td>
                    <td>
                      {arme.statut === 'AU_COFFRE'
                        ? <span className="badge badge-success">🔐 COFFRE</span>
                        : <span className="badge badge-danger">🔥 DÉPLOYÉE</span>
                      }
                    </td>
                    <td>
                      <div className="flex-between">
                        <span className="text-bold" style={{ color: colors.blue }}>{arme.agents ? arme.agents.nom : ''}</span>
                        {arme.statut === 'DEPLOYEE' && (
                          <button onClick={() => restituerArme(arme.id, arme.numero_serie)} className="btn btn-outline-success btn-xs">
                            📥 Restituer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 2. ACHEMINEMENT */}
      {sousMenu === 'acheminement' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <h3 className="section-title">Ordres d'Acheminement (Transport)</h3>
            <button className="btn btn-primary btn-sm">+ Éditer Ordre de Mission</button>
          </div>
          <p className="page-subtitle">Traçabilité légale des déplacements d'armes entre l'Armurerie Centrale (Siège) et les Coffres Décentralisés (Sites).</p>
          <div className="empty-state-dashed">Aucun acheminement en cours de transit.</div>
        </div>
      )}

      {/* 3. MAINTENANCE */}
      {sousMenu === 'maintenance' && (
        <div className="card card-yellow">
          <h3 style={{ marginTop: 0 }} className="section-title">Registre de Maintenance & Nettoyage</h3>
          <p className="page-subtitle mb-20">Historique des entretiens périodiques et tirs d'essai des armes à feu.</p>
          <table className="table table-sm">
            <thead>
              <tr><th>Arme (Série)</th><th>Dernier Nettoyage</th><th>Responsable (Armurier)</th><th>Statut Tir</th></tr>
            </thead>
            <tbody>
              <tr><td colSpan="4" className="empty-state">Sélectionnez une arme pour ajouter un rapport de maintenance.</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 4. UHF */}
      {sousMenu === 'uhf' && (
        <div className="card card-dark">
          <div className="flex-between mb-20">
            <h3 className="section-title">Parc Transmissions (Radios UHF / VHF)</h3>
            <button className="btn btn-dark btn-sm">+ Ajouter Matériel Radio</button>
          </div>
          <p className="page-subtitle">Gestion des dotations radios, fréquences autorisées (ARPT) et état des batteries.</p>
          <div className="empty-state-dashed">Registre des transmissions en cours de synchronisation...</div>
        </div>
      )}
    </div>
  );
}

export default Armurerie;
