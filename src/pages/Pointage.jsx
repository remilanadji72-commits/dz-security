import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Pointage() {
  const { agentsData } = useDataStore();
  const [rechercheNom, setRechercheNom] = useState('');
  const [filtreDate, setFiltreDate] = useState('');

  const exporterPointages = () => {
    let csvContent = "data:text/csv;charset=utf-8,﻿";
    csvContent += "ID;Nom Agent;Site;Heure de Pointage;Statut\n";
    agentsData.forEach(agent => {
      const nom = agent.nom.replace(/;/g, ',');
      const site = agent.site_affecte ? agent.site_affecte.replace(/;/g, ',') : '';
      csvContent += `${agent.id};${nom};${site};${agent.heure_pointage};Validé par GPS\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `registre_pointage_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Registre des Pointages Mensuels</h1>
      <p className="page-subtitle mb-30">Historique complet des prises de service (Check-in) remontées par les applications mobiles des agents.</p>

      <div className="card card-blue flex-row mb-20" style={{ alignItems: 'center' }}>
        <div className="flex-1">
          <label className="form-label">Rechercher un Agent (Nom ou Matricule)</label>
          <input
            type="text"
            placeholder="Ex: Karim Benali"
            value={rechercheNom}
            onChange={(e) => setRechercheNom(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="flex-1">
          <label className="form-label">Filtrer par Date</label>
          <input
            type="date"
            value={filtreDate}
            onChange={(e) => setFiltreDate(e.target.value)}
            className="form-input"
          />
        </div>
        <div style={{ marginTop: '20px' }}>
          <button onClick={exporterPointages} className="btn btn-success">
            ⬇️ Exporter (Excel/CSV)
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID Transaction</th>
              <th>Nom & Prénom</th>
              <th>Site Affecté</th>
              <th>Heure de Pointage</th>
              <th>Méthode de Validation</th>
            </tr>
          </thead>
          <tbody>
            {agentsData
              .filter(agent => {
                const matchNom = agent.nom.toLowerCase().includes(rechercheNom.toLowerCase());
                const matchDate = filtreDate === '' || true;
                return matchNom && matchDate;
              })
              .map((agent) => (
                <tr key={agent.id}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>
                  <td className="text-xs text-muted">#TRX-{agent.id}-2026</td>
                  <td className="text-bold">{agent.nom}</td>
                  <td style={{ color: colors.dark }}>📍 {agent.site_affecte || 'Non assigné'}</td>
                  <td className="text-bold" style={{ color: colors.blue }}>{agent.heure_pointage}</td>
                  <td><span className="badge badge-success">✅ GEOFENCE (GPS)</span></td>
                </tr>
              ))}
          </tbody>
        </table>

        {agentsData.filter(agent => agent.nom.toLowerCase().includes(rechercheNom.toLowerCase())).length === 0 && (
          <div className="empty-state">Aucun pointage trouvé pour cette recherche.</div>
        )}
      </div>
    </div>
  );
}

export default Pointage;
