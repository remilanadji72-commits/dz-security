import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function OdsMissions() {
  const { contratsData } = useDataStore();
  const [siteSelectionne, setSiteSelectionne] = useState('');
  const [effectifRequis, setEffectifRequis] = useState('');
  const [typeRotation, setTypeRotation] = useState('3x8');
  const [besoinArme, setBesoinArme] = useState(false);
  const [besoinChien, setBesoinChien] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`ODS de démarrage généré avec succès pour le site sélectionné.\nEffectif: ${effectifRequis} agents\nRotation: ${typeRotation}`);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Fiches Missions & ODS</h1>
      <p className="page-subtitle mb-30">Générer les Ordres de Service (ODS) de Démarrage ou de Suspension pour chaque site.</p>

      <div className="flex-row">
        <div className="flex-1 card card-blue">
          <h3 className="section-title mb-20">Créer un ODS de Démarrage</h3>

          <form onSubmit={handleSubmit} className="flex-col">
            <div>
              <label className="form-label">Sélectionner le Site / Contrat</label>
              <select value={siteSelectionne} onChange={(e) => setSiteSelectionne(e.target.value)} className="form-select" required>
                <option value="">-- Choisir un site actif --</option>
                {contratsData.map(c => <option key={c.id} value={c.id}>{c.nom_site} ({c.clients?.nom_entreprise})</option>)}
              </select>
            </div>

            <div className="flex-row-15">
              <div className="flex-1">
                <label className="form-label">Effectif Total Requis</label>
                <input type="number" min="1" value={effectifRequis} onChange={(e) => setEffectifRequis(e.target.value)} placeholder="Ex: 6" className="form-input" required />
              </div>
              <div className="flex-1">
                <label className="form-label">Système de Rotation</label>
                <select value={typeRotation} onChange={(e) => setTypeRotation(e.target.value)} className="form-select">
                  <option value="3x8">Brigades 3x8 (H24)</option>
                  <option value="2x12">Brigades 2x12 (H24)</option>
                  <option value="JourSeul">Jour uniquement (08h-16h)</option>
                  <option value="NuitSeule">Nuit uniquement (18h-06h)</option>
                </select>
              </div>
            </div>

            <div className="flex-row-sm" style={{ marginTop: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={besoinArme} onChange={(e) => setBesoinArme(e.target.checked)} />
                <span>🔫 Armement Obligatoire</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={besoinChien} onChange={(e) => setBesoinChien(e.target.checked)} />
                <span>🐕 Maître-Chien (Cynophile)</span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }}>
              Générer et Imprimer l'ODS PDF
            </button>
          </form>
        </div>

        <div className="flex-1 card">
          <h3 className="section-title mb-20">ODS Actifs (Archives)</h3>
          <div className="flex-col">
            <div style={{ border: '1px solid #e5e7eb', padding: '15px', borderRadius: '4px' }} className="flex-between">
              <div>
                <strong style={{ display: 'block', color: '#111827' }}>ODS-2026/045 - Banque BNA</strong>
                <span className="text-xs text-muted">Rotation: 3x8 | Effectif: 4 | Armé: Oui</span>
              </div>
              <span className="badge badge-success">EN COURS</span>
            </div>

            <div style={{ border: '1px solid #e5e7eb', padding: '15px', borderRadius: '4px' }} className="flex-between">
              <div>
                <strong style={{ display: 'block', color: '#111827' }}>ODS-2026/048 - Usine Cevital</strong>
                <span className="text-xs text-muted">Rotation: 2x12 | Effectif: 10 | Cynophile: Oui</span>
              </div>
              <span className="badge badge-success">EN COURS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OdsMissions;
