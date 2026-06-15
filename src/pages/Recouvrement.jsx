import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { colors } from '../constants';

function Recouvrement() {
  const [facturesImpayees, setFacturesImpayees] = useState([]);
  const [facturesEncaissees, setFacturesEncaissees] = useState([]);
  const [chargement, setChargement] = useState(true);

  const fetchFactures = async () => {
    const { data: impayees } = await supabase.from('factures').select('*').neq('statut_paiement', 'PAYEE').order('date_facturation', { ascending: true });
    const { data: encaissees } = await supabase.from('factures').select('*').eq('statut_paiement', 'PAYEE').order('date_encaissement', { ascending: false });
    if (impayees) setFacturesImpayees(impayees);
    if (encaissees) setFacturesEncaissees(encaissees);
    setChargement(false);
  };

  useEffect(() => { fetchFactures(); }, []);

  const encaisserFacture = async (id, client) => {
    if (window.confirm(`Confirmez-vous l'encaissement de la facture pour le client ${client} ?`)) {
      const today = new Date().toISOString().split('T')[0];
      await supabase.from('factures').update({ statut_paiement: 'PAYEE', date_encaissement: today, etape_recouvrement: 'CLOTURE' }).eq('id', id);
      fetchFactures();
      alert("✅ Encaissement validé. Le Chiffre d'Affaires a été mis à jour.");
    }
  };

  const changerEtapeRecouvrement = async (id, nouvelleEtape) => {
    await supabase.from('factures').update({ etape_recouvrement: nouvelleEtape }).eq('id', id);
    fetchFactures();
  };

  const sauvegarderNoteRecouvrement = async (id, noteTexte) => {
    await supabase.from('factures').update({ notes_recouvrement: noteTexte }).eq('id', id);
    fetchFactures();
  };

  const formaterMontantDZ = (montant) => new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(montant);
  const totalImpaye = facturesImpayees.reduce((acc, f) => acc + Number(f.montant), 0);
  const totalEncaisse = facturesEncaissees.reduce((acc, f) => acc + Number(f.montant), 0);

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>📉</span>
        <div>
          <h1 className="page-title">3- SERVICE RECOUVREMENT</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Stratégie, Suivi des impayés et Encaissements.</p>
        </div>
      </div>

      <div className="flex-row mb-30">
        <div className="stat-card flex-1" style={{ borderLeft: `5px solid ${colors.red}` }}>
          <div className="stat-card-label">Créances Clients (Impayés)</div>
          <div className="stat-card-value" style={{ color: colors.red }}>{formaterMontantDZ(totalImpaye)} <span style={{ fontSize: '16px' }}>DA</span></div>
          <div className="text-xs" style={{ color: '#991b1b', marginTop: '5px' }}>⚠️ {facturesImpayees.length} facture(s) en souffrance.</div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft: `5px solid ${colors.green}` }}>
          <div className="stat-card-label">Trésorerie (Encaissé)</div>
          <div className="stat-card-value" style={{ color: colors.green }}>{formaterMontantDZ(totalEncaisse)} <span style={{ fontSize: '16px' }}>DA</span></div>
          <div className="text-xs" style={{ color: '#166534', marginTop: '5px' }}>✅ {facturesEncaissees.length} facture(s) soldée(s).</div>
        </div>
      </div>

      <div className="card mb-30" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fef2f2' }}>
          <h3 className="section-title" style={{ color: '#991b1b' }}>Dossiers de Recouvrement (Factures Non Payées)</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Facture & Client</th>
              <th className="text-right">Montant</th>
              <th>Stratégie de Recouvrement (Action)</th>
              <th className="text-center">Encaissement</th>
            </tr>
          </thead>
          <tbody>
            {facturesImpayees.map((f) => (
              <tr key={f.id}>
                <td>
                  <span className="text-bold" style={{ color: colors.blue }}>N° {f.numero_facture}</span><br />
                  <strong>{f.client}</strong><br />
                  <span className="text-xs text-muted">Émise le : {new Date(f.date_facturation).toLocaleDateString('fr-FR')}</span>
                </td>
                <td className="text-right text-bold" style={{ fontSize: '14px' }}>{formaterMontantDZ(f.montant)} DA</td>
                <td>
                  <select
                    value={f.etape_recouvrement || 'NON ECHUE'}
                    onChange={(e) => changerEtapeRecouvrement(f.id, e.target.value)}
                    className="form-select"
                    style={{
                      fontWeight: 'bold',
                      border: f.etape_recouvrement === 'CONTENTIEUX JURIDIQUE' ? '2px solid #ef4444' : '1px solid #d1d5db',
                      backgroundColor: f.etape_recouvrement === 'CONTENTIEUX JURIDIQUE' ? '#fef2f2' : 'white',
                      color: f.etape_recouvrement === 'CONTENTIEUX JURIDIQUE' ? '#ef4444' : '#374151'
                    }}
                  >
                    <option value="NON ECHUE">Paiement dans les délais (Non échue)</option>
                    <option value="RELANCE TELEPHONIQUE">📞 Relance Téléphonique en cours</option>
                    <option value="MISE EN DEMEURE">✉️ Mise en Demeure envoyée</option>
                    <option value="CONTENTIEUX JURIDIQUE">⚖️ Contentieux Juridique (Avocat)</option>
                  </select>
                  <div className="flex-row-sm" style={{ marginTop: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Note (Ex: Client injoignable, Promesse de chèque...)"
                      defaultValue={f.notes_recouvrement || ''}
                      onBlur={(e) => { if (e.target.value !== f.notes_recouvrement) sauvegarderNoteRecouvrement(f.id, e.target.value); }}
                      className="form-input flex-1"
                      style={{ fontSize: '11px', fontStyle: 'italic', backgroundColor: '#f9fafb' }}
                    />
                    <span className="text-xs text-muted" title="Cliquez à l'extérieur pour sauvegarder automatiquement">💾</span>
                  </div>
                </td>
                <td className="text-center">
                  <button onClick={() => encaisserFacture(f.id, f.client)} className="btn btn-success btn-sm">💰 Encaisser</button>
                </td>
              </tr>
            ))}
            {facturesImpayees.length === 0 && <tr><td colSpan="4" className="empty-state" style={{ color: '#166534' }}>Aucune créance en souffrance. Tout est payé !</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f0fdf4' }}>
          <h3 className="section-title" style={{ color: '#166534' }}>Historique des Encaissements</h3>
        </div>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Facture</th>
              <th>Client</th>
              <th>Date Encaissement</th>
              <th className="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {facturesEncaissees.map((f) => (
              <tr key={f.id}>
                <td className="text-bold">{f.numero_facture}</td>
                <td>{f.client}</td>
                <td className="text-bold" style={{ color: '#166534' }}>✅ {new Date(f.date_encaissement).toLocaleDateString('fr-FR')}</td>
                <td className="text-right text-bold">{formaterMontantDZ(f.montant)} DA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Recouvrement;
