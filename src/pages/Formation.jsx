import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Formation() {
  const { agentsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('initiale');

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🎓</span>
        <div>
          <h1 className="page-title">SERVICE FORMATION</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Gestion des sessions d'intégration à la DG et de la formation continue sur site.</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('initiale')} className={`nav-tab${sousMenu === 'initiale' ? ' active' : ''}`} style={sousMenu === 'initiale' ? { backgroundColor: colors.blue } : {}}>1. FORMATION INITIALE A LA DG</button>
        <button onClick={() => setSousMenu('continue')} className={`nav-tab${sousMenu === 'continue' ? ' active' : ''}`} style={sousMenu === 'continue' ? { backgroundColor: colors.green } : {}}>2. FORMATION CONTINUE SUR SITE</button>
      </div>

      {sousMenu === 'initiale' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Programme d'Intégration (Nouvelles recrues)</h3>
              <p className="text-sm text-muted" style={{ marginTop: '5px' }}>Formation de base dispensée au Siège (Direction Générale) avant déploiement.</p>
            </div>
            <button className="btn btn-primary btn-sm">+ Planifier Session</button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Session & Date</th>
                <th>Instructeur</th>
                <th>Effectif (Agents)</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Cohorte Mai 2026</strong><br />
                  <span className="text-xs text-muted">Règlement intérieur & Secourisme</span>
                </td>
                <td>M. Formateur Principal</td>
                <td className="text-bold" style={{ color: colors.blue }}>12 agents</td>
                <td><span className="badge badge-success">✅ CLÔTURÉE</span></td>
              </tr>
              <tr>
                <td>
                  <strong>Cohorte Juin 2026</strong><br />
                  <span className="text-xs text-muted">Manipulation extincteurs & Self-défense</span>
                </td>
                <td>M. Formateur Principal</td>
                <td className="text-bold" style={{ color: colors.blue }}>8 agents</td>
                <td><span className="badge badge-danger">⏳ EN PLANIFICATION</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'continue' && (
        <div className="card card-green">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Suivi des Formations Continues (Recyclage)</h3>
              <p className="text-sm text-muted" style={{ marginTop: '5px' }}>Maintien des acquis et sensibilisation spécifique aux risques de chaque site client.</p>
            </div>
            <button className="btn btn-success btn-sm">Exporter Tableau Excel</button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Dernière Formation Continue</th>
                <th>Site Actuel</th>
                <th>Validité / Recyclage</th>
              </tr>
            </thead>
            <tbody>
              {agentsData.map((a, i) => (
                <tr key={i}>
                  <td className="text-bold">{a.nom}</td>
                  <td>Mise à jour des consignes d'évacuation</td>
                  <td style={{ color: colors.dark }}>{a.site_affecte || '---'}</td>
                  <td>
                    {i % 3 === 0
                      ? <span className="badge badge-danger">⚠️ RECYCLAGE REQUIS</span>
                      : <span className="text-bold" style={{ color: colors.green }}>✅ À JOUR</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Formation;
