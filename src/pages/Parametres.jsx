import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { colors } from '../constants';

function Parametres() {
  const [wilayas, setWilayas] = useState(['16 - Alger', '06 - Bejaia', '31 - Oran', '30 - Ouargla', '33 - Illizi']);
  const [nouvelleWilaya, setNouvelleWilaya] = useState('');
  const [typesRotations, setTypesRotations] = useState(['Brigade 3x8', 'Brigade 2x12', 'Journée (08h-16h)']);
  const [nouvelleRotation, setNouvelleRotation] = useState('');
  const [tauxFacturation, setTauxFacturation] = useState('');
  const [primePanier, setPrimePanier] = useState('');
  const [tva, setTva] = useState('');

  useEffect(() => {
    const fetchParams = async () => {
      const { data } = await supabase.from('parametres_entreprise').select('*').eq('id', 1).single();
      if (data) {
        setTauxFacturation(data.taux_facturation_moyen);
        setPrimePanier(data.prime_panier);
        setTva(data.tva);
      }
    };
    fetchParams();
  }, []);

  const sauvegarderVariablesFinance = async () => {
    const { error } = await supabase.from('parametres_entreprise').update({
      taux_facturation_moyen: tauxFacturation,
      prime_panier: primePanier,
      tva: tva
    }).eq('id', 1);
    if (!error) alert(`✅ Variables sauvegardées dans le Cloud !`);
    else alert("Erreur de sauvegarde.");
  };

  const ajouterWilaya = (e) => { e.preventDefault(); if (nouvelleWilaya) { setWilayas([...wilayas, nouvelleWilaya]); setNouvelleWilaya(''); } };
  const ajouterRotation = (e) => { e.preventDefault(); if (nouvelleRotation) { setTypesRotations([...typesRotations, nouvelleRotation]); setNouvelleRotation(''); } };
  const supprimerItem = (liste, setListe, item) => setListe(liste.filter(i => i !== item));

  return (
    <div className="page-container">
      <h1 className="page-title">Paramètres du Système</h1>
      <p className="page-subtitle mb-30">Configurez les listes déroulantes et les paramètres globaux de votre environnement DzSecurity.</p>

      <div className="flex-wrap">
        <div style={{ flex: '1 1 400px' }} className="card card-blue">
          <div className="page-header mb-20">
            <span style={{ fontSize: '24px' }}>🗺️</span>
            <h3 className="section-title" style={{ margin: 0 }}>Zones / Wilayas d'intervention</h3>
          </div>
          <form onSubmit={ajouterWilaya} className="flex-row-sm mb-20">
            <input type="text" placeholder="Ex: 39 - El Oued" value={nouvelleWilaya} onChange={(e) => setNouvelleWilaya(e.target.value)} className="form-input flex-1" />
            <button type="submit" className="btn btn-primary">Ajouter</button>
          </form>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
            {wilayas.map((w, index) => (
              <div key={index} className="flex-between" style={{ padding: '12px 15px', borderBottom: index === wilayas.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                <span>{w}</span>
                <button onClick={() => supprimerItem(wilayas, setWilayas, w)} style={{ color: colors.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 400px' }} className="card card-green">
          <div className="page-header mb-20">
            <span style={{ fontSize: '24px' }}>⏱️</span>
            <h3 className="section-title" style={{ margin: 0 }}>Types de Rotations (ODS)</h3>
          </div>
          <form onSubmit={ajouterRotation} className="flex-row-sm mb-20">
            <input type="text" placeholder="Ex: 48h / 72h (Base Sud)" value={nouvelleRotation} onChange={(e) => setNouvelleRotation(e.target.value)} className="form-input flex-1" />
            <button type="submit" className="btn btn-success">Ajouter</button>
          </form>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px' }}>
            {typesRotations.map((r, index) => (
              <div key={index} className="flex-between" style={{ padding: '12px 15px', borderBottom: index === typesRotations.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
                <span>{r}</span>
                <button onClick={() => supprimerItem(typesRotations, setTypesRotations, r)} style={{ color: colors.red, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 100%' }} className="card card-dark">
          <div className="page-header mb-20">
            <span style={{ fontSize: '24px' }}>⚙️</span>
            <h3 className="section-title" style={{ margin: 0 }}>Variables Financières (DZD)</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <label className="form-label">Taux de facturation moyen (par Heure)</label>
              <input type="number" value={tauxFacturation} onChange={(e) => setTauxFacturation(e.target.value)} className="form-input" style={{ backgroundColor: '#f9fafb' }} />
            </div>
            <div>
              <label className="form-label">Prime de Panier (Journalière)</label>
              <input type="number" value={primePanier} onChange={(e) => setPrimePanier(e.target.value)} className="form-input" style={{ backgroundColor: '#f9fafb' }} />
            </div>
            <div>
              <label className="form-label">TVA (%)</label>
              <input type="number" value={tva} onChange={(e) => setTva(e.target.value)} className="form-input" style={{ backgroundColor: '#f9fafb' }} />
            </div>
          </div>
          <div className="text-right" style={{ marginTop: '20px' }}>
            <button onClick={sauvegarderVariablesFinance} className="btn btn-dark">
              💾 Sauvegarder les variables
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Parametres;
