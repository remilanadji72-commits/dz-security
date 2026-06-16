import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';

function Incidents() {
  const { incidentsData, contratsData, resoudreIncident } = useDataStore();
  const [filtreSite, setFiltreSite] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('tous');
  const [incidentsResolus, setIncidentsResolus] = useState([]);
  const [loadingResolus, setLoadingResolus] = useState(false);

  useEffect(() => {
    if (filtreStatut !== 'resolus') return;
    setLoadingResolus(true);
    supabase.from('incidents').select('*').eq('resolu', true).order('id', { ascending: false })
      .then(({ data }) => { if (data) setIncidentsResolus(data); setLoadingResolus(false); });
  }, [filtreStatut]);

  return (
    <div className="page-container">
      <h1 className="page-title">Main Courante & Historique des Incidents</h1>
      <p className="page-subtitle">Registre électronique centralisé de tous les événements, signalements et urgences remontés par les agents depuis le terrain.</p>

      {/* FILTRES */}
      <div className="card flex-row mb-20" style={{ alignItems: 'center' }}>
        <div className="flex-1">
          <label className="form-label-sm">Filtrer par Site</label>
          <select value={filtreSite} onChange={(e) => setFiltreSite(e.target.value)} className="form-select">
            <option value="">Tous les sites du réseau</option>
            {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="form-label-sm">Niveau de Gravité / Statut</label>
          <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="form-select">
            <option value="tous">Tous les événements</option>
            <option value="actifs">🚨 Urgences Non Résolues Uniquement</option>
            <option value="resolus">✅ Incidents Clôturés</option>
          </select>
        </div>
        <div style={{ marginTop: '20px' }} className="hide-on-print">
          <button onClick={() => window.print()} className="btn btn-dark">
            📥 Exporter Registre (PDF)
          </button>
        </div>
      </div>

      {/* LISTE DES INCIDENTS */}
      <div className="card">
        {loadingResolus ? (
          <div className="empty-state"><span className="empty-state-icon">⏳</span>Chargement des incidents clôturés...</div>
        ) : (() => {
          const source = filtreStatut === 'resolus' ? incidentsResolus : incidentsData;
          const liste = source.filter(incident => filtreSite === '' || (incident.site || '').includes(filtreSite));
          return liste.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">🛡️</span>
              {filtreStatut === 'resolus' ? 'Aucun incident clôturé.' : 'Aucun incident actif. Le réseau est sécurisé.'}
            </div>
          ) : (
          <div className="flex-col">
            {liste
              .map((incident) => (
                <div key={incident.id} style={{
                  border: `1px solid ${incident.resolu ? '#e5e7eb' : '#fca5a5'}`,
                  backgroundColor: incident.resolu ? 'white' : '#fef2f2',
                  padding: '20px',
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '20px',
                  borderLeft: `5px solid ${incident.resolu ? '#10b981' : '#ef4444'}`
                }}>
                  {/* Date/Heure */}
                  <div style={{ width: '100px', borderRight: '1px solid #e5e7eb', paddingRight: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <span className="text-xs text-muted text-bold">Aujourd'hui</span>
                    <span style={{ fontSize: '24px', fontWeight: '900', color: incident.resolu ? '#1f2937' : '#ef4444' }}>{incident.heure_incident}</span>
                  </div>

                  {/* Détails */}
                  <div className="flex-1">
                    <div className="flex-between mb-10">
                      <h3 className="section-title">
                        {incident.resolu ? 'Rapport de routine' : '🚨 DÉCLENCHEMENT SOS (BOUTON PANIQUE)'}
                      </h3>
                      {!incident.resolu && (
                        <button onClick={() => resoudreIncident(incident.id)} className="btn btn-danger btn-xs" style={{ boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}>
                          Clôturer l'urgence
                        </button>
                      )}
                    </div>

                    <div className="alert-message mb-10">
                      <strong>Message de l'agent :</strong> {incident.description || 'Aucune description fournie.'}
                    </div>
                    <p className="text-sm mb-10" style={{ color: '#4b5563' }}>
                      L'agent <strong>{incident.nom_agent}</strong> a remonté un événement critique depuis son terminal mobile.
                    </p>

                    <div className="flex-row-sm text-xs">
                      <span className="badge badge-neutral"><strong>📍 Site :</strong> {incident.site}</span>
                      <span className="badge badge-neutral"><strong>📡 Source :</strong> Application Mobile DzSecurity</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}

export default Incidents;
