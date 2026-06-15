import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Juridique() {
  const { agentsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('prudhommes');

  const [litiges, setLitiges] = useState([
    { id: 1, agent: 'M. Sofiane', type: 'Licenciement Abusif', date_audience: '2026-06-20', statut: 'EN INSTRUCTION' }
  ]);
  const [nouveauLitige, setNouveauLitige] = useState('');

  const ajouterLitige = (e) => {
    e.preventDefault();
    if (!nouveauLitige) return;
    setLitiges([...litiges, { id: Date.now(), agent: nouveauLitige, type: 'Litige Disciplinaire', date_audience: 'A définir', statut: 'NOUVEAU DOSSIER' }]);
    setNouveauLitige('');
  };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>⚖️</span>
        <div>
          <h1 className="page-title">SERVICE CONSEILLER JURIDIQUE</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Gestion du contentieux social (Prud'hommes) et commercial (Recouvrement forcé).</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('prudhommes')} className={`nav-tab${sousMenu === 'prudhommes' ? ' active' : ''}`} style={sousMenu === 'prudhommes' ? { backgroundColor: colors.red } : {}}>1. Contentieux Social (RH)</button>
        <button onClick={() => setSousMenu('commercial')} className={`nav-tab${sousMenu === 'commercial' ? ' active' : ''}`} style={sousMenu === 'commercial' ? { backgroundColor: colors.dark } : {}}>2. Contentieux Commercial (Avocats)</button>
      </div>

      {sousMenu === 'prudhommes' && (
        <div className="card card-red">
          <h3 className="section-title mb-20">Dossiers Prud'homaux & Inspection du Travail</h3>

          <form onSubmit={ajouterLitige} className="form-section mb-20" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5' }}>
            <div className="flex-row" style={{ alignItems: 'flex-end' }}>
              <div className="flex-1">
                <label className="form-label-sm" style={{ color: '#991b1b' }}>Agent en Litige (Ex-Employé)</label>
                <select value={nouveauLitige} onChange={(e) => setNouveauLitige(e.target.value)} className="form-select">
                  <option value="">Sélectionner un agent (Même archivé)...</option>
                  {agentsData.map(a => <option key={a.id} value={a.nom}>{a.nom} ({a.matricule})</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-danger">+ Ouvrir un Dossier Litige</button>
            </div>
          </form>

          <table className="table">
            <thead>
              <tr>
                <th>Ex-Agent / Plaignant</th>
                <th>Type de Litige</th>
                <th>Audience au Tribunal</th>
                <th>Statut Juridique</th>
              </tr>
            </thead>
            <tbody>
              {litiges.map(litige => (
                <tr key={litige.id}>
                  <td className="text-bold" style={{ color: colors.dark }}>{litige.agent}</td>
                  <td>{litige.type}</td>
                  <td className="text-bold" style={{ color: colors.red }}>📅 {litige.date_audience}</td>
                  <td><span className="badge badge-danger">{litige.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'commercial' && (
        <div className="card card-dark">
          <h3 className="section-title mb-10">Transfert du Service Recouvrement</h3>
          <p className="text-sm text-muted mb-20">Les factures marquées en "Contentieux Juridique" par le Service Recouvrement apparaissent ici pour traitement par l'avocat de l'entreprise.</p>
          <div className="empty-state-dashed">Aucun dossier commercial transmis à la justice pour l'instant.</div>
        </div>
      )}
    </div>
  );
}

export default Juridique;
