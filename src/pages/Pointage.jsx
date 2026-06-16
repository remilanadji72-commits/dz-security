import React, { useMemo, useCallback } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Pointage() {
  const { historiquePointages } = useDataStore();
  const [rechercheNom, setRechercheNom] = React.useState('');
  const [filtreDate, setFiltreDate] = React.useState('');

  const pointagesFiltres = useMemo(() => {
    return historiquePointages.filter(p => {
      const matchNom = !rechercheNom ||
        (p.nom_agent || '').toLowerCase().includes(rechercheNom.toLowerCase());
      const matchDate = !filtreDate || p.date_pointage === filtreDate;
      return matchNom && matchDate;
    });
  }, [historiquePointages, rechercheNom, filtreDate]);

  const exporterPointages = useCallback(() => {
    let csvContent = 'data:text/csv;charset=utf-8,﻿';
    csvContent += 'ID;Nom Agent;Site;Date;Heure d\'arrivée;Type Vacation;Statut\n';
    pointagesFiltres.forEach(p => {
      const nom  = (p.nom_agent || '').replace(/;/g, ',');
      const site = (p.site_affecte || '').replace(/;/g, ',');
      csvContent += `${p.id};${nom};${site};${p.date_pointage};${p.heure_arrivee};${p.type_vacation};${p.statut_validation}\n`;
    });
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `registre_pointage_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pointagesFiltres]);

  return (
    <div className="page-container">
      <h1 className="page-title">Registre des Pointages Mensuels</h1>
      <p className="page-subtitle mb-30">Historique complet des prises de service (Check-in) remontées par les applications mobiles des agents.</p>

      <div className="card card-blue flex-row mb-20" style={{ alignItems: 'center' }}>
        <div className="flex-1">
          <label className="form-label">Rechercher un Agent (Nom)</label>
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
            ⬇️ Exporter (CSV)
          </button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom Agent</th>
              <th>Site Affecté</th>
              <th>Date</th>
              <th>Heure d'arrivée</th>
              <th>Vacation</th>
              <th>Statut Validation</th>
            </tr>
          </thead>
          <tbody>
            {pointagesFiltres.map((p) => (
              <tr key={p.id}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}>
                <td className="text-xs text-muted">#TRX-{p.id}</td>
                <td className="text-bold">{p.nom_agent}</td>
                <td style={{ color: colors.dark }}>📍 {p.site_affecte || 'Non assigné'}</td>
                <td className="text-bold" style={{ color: colors.dark }}>{p.date_pointage}</td>
                <td className="text-bold" style={{ color: colors.blue }}>{p.heure_arrivee}</td>
                <td>
                  <span className={`badge ${p.type_vacation === 'NUIT' ? 'badge-info' : 'badge-neutral'}`}>
                    {p.type_vacation === 'NUIT' ? '🌙 NUIT' : '☀️ JOUR'}
                  </span>
                </td>
                <td>
                  {p.statut_validation === 'VALIDE'
                    ? <span className="badge badge-success">✅ VALIDÉ</span>
                    : <span className="badge badge-warning">⏳ EN ATTENTE</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pointagesFiltres.length === 0 && (
          <div className="empty-state">
            {historiquePointages.length === 0
              ? 'Aucun pointage enregistré pour le moment.'
              : 'Aucun pointage trouvé pour cette recherche.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default Pointage;
