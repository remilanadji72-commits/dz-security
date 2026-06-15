import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Planning() {
  const { contratsData } = useDataStore();
  const [siteSelectionne, setSiteSelectionne] = useState('');
  const [moisSelectionne, setMoisSelectionne] = useState('2026-09');
  const [groupe1, setGroupe1] = useState('');
  const [groupe2, setGroupe2] = useState('');
  const [groupe3, setGroupe3] = useState('');
  const [groupe4, setGroupe4] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const chargerPlanning = async () => {
      if (!siteSelectionne || !moisSelectionne) return;
      const { data } = await supabase.from('plannings').select('*').eq('site', siteSelectionne).eq('mois', moisSelectionne).single();
      if (data) { setGroupe1(data.groupe1 || ''); setGroupe2(data.groupe2 || ''); setGroupe3(data.groupe3 || ''); setGroupe4(data.groupe4 || ''); }
      else { setGroupe1(''); setGroupe2(''); setGroupe3(''); setGroupe4(''); }
    };
    chargerPlanning();
  }, [siteSelectionne, moisSelectionne]);

  const sauvegarderMatrice = async () => {
    if (!siteSelectionne || !moisSelectionne) return;
    setIsSaving(true);
    const { error } = await supabase.from('plannings').upsert({ site: siteSelectionne, mois: moisSelectionne, groupe1, groupe2, groupe3, groupe4 }, { onConflict: 'site,mois' });
    setIsSaving(false);
    if (!error) alert(`✅ Rotation enregistrée en base pour ${siteSelectionne}.`);
    else alert("Erreur lors de la sauvegarde.");
  };

  const genererJoursDuMois = () => {
    if (!moisSelectionne) return [];
    const [annee, mois] = moisSelectionne.split('-');
    const nbJours = new Date(annee, mois, 0).getDate();
    let jours = [];
    for (let i = 1; i <= nbJours; i++) {
      const j = i < 10 ? `0${i}` : i;
      const jS = (i + 1) > nbJours ? '01' : (i + 1 < 10 ? `0${i + 1}` : i + 1);
      jours.push({ type: 'JOUR', libelle: `${j} SEPT`, index: i });
      jours.push({ type: 'NUIT', libelle: `DU ${j} AU ${jS}`, index: i });
    }
    return jours;
  };

  const lignesPlanning = genererJoursDuMois();

  const determinerAffectation = (jourIndex, typeLigne, groupeIndex) => {
    const positionCycle = (jourIndex - 21 + 400) % 4;
    let decalageGroupe = [0, 3, 2, 1][groupeIndex];
    const etape = (positionCycle + decalageGroupe) % 4;
    if (typeLigne === 'JOUR') return etape === 0;
    if (typeLigne === 'NUIT') return etape === 3;
    return false;
  };

  return (
    <div className="page-container print-container">
      <div className="hide-on-print">
        <h1 className="page-title">MATRICE DE ROTATION (BRIGADES)</h1>
        <p className="page-subtitle mb-30">Génération automatique des plannings H24 par équipe.</p>

        <div className="card card-blue mb-20">
          <div className="flex-wrap" style={{ alignItems: 'flex-end' }}>
            <div className="flex-col">
              <label className="form-label">Sélectionner le Site</label>
              <select value={siteSelectionne} onChange={(e) => setSiteSelectionne(e.target.value)} className="form-select">
                <option value="">-- Site --</option>
                <option value="CRCC CHERAGA">CRCC CHERAGA</option>
                {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
              </select>
            </div>
            <div className="flex-col">
              <label className="form-label">Mois et Année</label>
              <input type="month" value={moisSelectionne} onChange={(e) => setMoisSelectionne(e.target.value)} className="form-input" />
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '10px 0', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Désignation des Chefs de Groupes (Brigades)</h4>
            <div className="flex-row-15">
              {[{ label: 'BRIGADE 01 (Chef)', val: groupe1, set: setGroupe1 }, { label: 'BRIGADE 02 (Chef)', val: groupe2, set: setGroupe2 }, { label: 'BRIGADE 03 (Chef)', val: groupe3, set: setGroupe3 }, { label: 'BRIGADE 04 (Chef)', val: groupe4, set: setGroupe4 }].map((g, i) => (
                <div key={i} style={{ flex: 1, backgroundColor: '#f9fafb', padding: '10px', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                  <label className="form-label-sm" style={{ color: colors.blue }}>{g.label}</label>
                  <input type="text" value={g.val} onChange={(e) => g.set(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid #ccc', background: 'transparent' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {siteSelectionne && moisSelectionne && (
        <div className="card print-planning" style={{ overflowX: 'auto' }}>
          <div className="flex-between mb-20">
            <h2 style={{ color: 'black', margin: 0, textTransform: 'uppercase' }}>ROTATION DU DISPOSITIF - {siteSelectionne}</h2>
            <h3 style={{ margin: 0 }}>MOIS DE {moisSelectionne.split('-')[1]} / {moisSelectionne.split('-')[0]}</h3>
            <div className="hide-on-print flex-row-sm">
              <button onClick={sauvegarderMatrice} disabled={isSaving} className="btn btn-success">{isSaving ? '💾 Sauvegarde...' : '💾 Enregistrer Rotation'}</button>
              <button onClick={() => window.print()} className="btn btn-danger">📄 Imprimer PDF</button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', border: '2px solid black' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ padding: '10px', border: '1px solid black', width: '200px' }}>DATE / VACATION</th>
                <th style={{ padding: '10px', border: '1px solid black' }}>GROUPE 01<br /><span style={{ fontSize: '14px', color: '#1e3a8a' }}>{groupe1 || '...'}</span></th>
                <th style={{ padding: '10px', border: '1px solid black' }}>GROUPE 02<br /><span style={{ fontSize: '14px', color: '#1e3a8a' }}>{groupe2 || '...'}</span></th>
                <th style={{ padding: '10px', border: '1px solid black' }}>GROUPE 03<br /><span style={{ fontSize: '14px', color: '#1e3a8a' }}>{groupe3 || '...'}</span></th>
                <th style={{ padding: '10px', border: '1px solid black' }}>GROUPE 04<br /><span style={{ fontSize: '14px', color: '#1e3a8a' }}>{groupe4 || '...'}</span></th>
              </tr>
            </thead>
            <tbody>
              {lignesPlanning.map((ligne, i) => (
                <tr key={i} style={{ backgroundColor: ligne.type === 'NUIT' ? '#f8fafc' : 'white' }}>
                  <td style={{ padding: '8px', border: '1px solid black', fontWeight: 'bold', textAlign: 'left', color: ligne.type === 'NUIT' ? '#475569' : 'black' }}>
                    {ligne.type === 'NUIT' ? '🌙 ' : '☀️ '}{ligne.libelle}
                  </td>
                  {[0, 1, 2, 3].map((gi) => (
                    <td key={gi} style={{ border: '1px solid black', fontWeight: 'bold', backgroundColor: determinerAffectation(ligne.index, ligne.type, gi) ? '#dcfce7' : 'transparent', color: 'black' }}>
                      {determinerAffectation(ligne.index, ligne.type, gi) ? [groupe1, groupe2, groupe3, groupe4][gi] : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', padding: '0 50px' }} className="show-only-on-print">
            <strong>Le Chef de Site</strong>
            <strong>La Direction des Opérations</strong>
          </div>
        </div>
      )}
    </div>
  );
}

export default Planning;
