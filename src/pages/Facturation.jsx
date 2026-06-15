import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';
import { exportInvoiceToPDF, exportTableToPDF } from '../utils/export';

function Facturation() {
  const { agentsData } = useDataStore();
  const [factures, setFactures] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [sousMenu, setSousMenu] = useState('verification');
  const [nouvelleFacture, setNouvelleFacture] = useState({ numero: '', client: '', mois: 'JANVIER', designation: '', date: '', montant: '' });
  const [attachementBnaSigne, setAttachementBnaSigne] = useState(false);

  const fetchFactures = async () => {
    const { data, error } = await supabase.from('factures').select('*').order('id', { ascending: false });
    if (!error) setFactures(data || []);
    setChargement(false);
  };

  useEffect(() => { fetchFactures(); }, []);

  const creerFacture = async (e) => {
    e.preventDefault();
    if (!nouvelleFacture.numero || !nouvelleFacture.client || !nouvelleFacture.montant) return;
    setChargement(true);
    const { error } = await supabase.from('factures').insert([{
      numero_facture: nouvelleFacture.numero, mois: nouvelleFacture.mois,
      designation: nouvelleFacture.designation.toUpperCase(), client: nouvelleFacture.client.toUpperCase(),
      date_facturation: nouvelleFacture.date, montant: parseFloat(nouvelleFacture.montant), statut_paiement: 'EN ATTENTE'
    }]);
    if (!error) {
      setNouvelleFacture({ numero: '', client: '', mois: 'JANVIER', designation: '', date: '', montant: '' });
      fetchFactures(); alert("Facture éditée avec succès !");
    } else { alert("Erreur : Ce numéro existe déjà."); }
    setChargement(false);
  };

  const encaisserFacture = async (id) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('factures').update({ statut_paiement: 'PAYEE', date_encaissement: today }).eq('id', id);
    fetchFactures();
    alert("Enregistrement comptable : Facture encaissée !");
  };

  const signerAttachement = async (contratId, nomSite) => {
    if (window.confirm(`Confirmez-vous que le client a signé l'attachement mensuel pour le site : ${nomSite} ?`)) {
      if (nomSite && nomSite.includes("BNA")) setAttachementBnaSigne(true);
      alert(`✅ L'attachement pour ${nomSite} a été enregistré comme SIGNÉ.`);
    }
  };

  const formaterMontantDZ = (montant) => new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(montant);
  const forfaitJourDA = 3000;
  const pointagesBNA = agentsData.filter(a => a.site_affecte && a.site_affecte.includes("BNA")).length;
  const montantEstimeBNA = pointagesBNA * forfaitJourDA;
  const pointagesCevital = agentsData.filter(a => a.site_affecte && a.site_affecte.includes("Cevital")).length;
  const montantEstimeCevital = pointagesCevital * forfaitJourDA;

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>💰</span>
        <div>
          <h1 className="page-title">2- SERVICE FACTURATION</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Vérification, Attachements, Édition et Recouvrement.</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('verification')} className={`nav-tab${sousMenu === 'verification' ? ' active' : ''}`} style={sousMenu === 'verification' ? { backgroundColor: colors.blue } : {}}>2-1. Vérification des Pointages</button>
        <button onClick={() => setSousMenu('attachements')} className={`nav-tab${sousMenu === 'attachements' ? ' active' : ''}`} style={sousMenu === 'attachements' ? { backgroundColor: colors.blue } : {}}>2-2. Élaboration des Attachements</button>
        <button onClick={() => setSousMenu('facturation')} className={`nav-tab${sousMenu === 'facturation' ? ' active' : ''}`} style={sousMenu === 'facturation' ? { backgroundColor: colors.green } : {}}>2-3. Facturation (Édition)</button>
        <button onClick={() => setSousMenu('encaissement')} className={`nav-tab${sousMenu === 'encaissement' ? ' active' : ''}`} style={sousMenu === 'encaissement' ? { backgroundColor: colors.dark } : {}}>2-4 & 2-5. Suivi et Encaissement</button>
      </div>

      {sousMenu === 'verification' && (
        <div className="card">
          <h3 className="section-title mb-20">Vérification des Remontées Terrain</h3>
          <table className="table">
            <thead>
              <tr><th>Agent</th><th>Site</th><th>Heure Pointage</th><th>Statut Jours</th></tr>
            </thead>
            <tbody>
              {agentsData.map((a, i) => (
                <tr key={i}>
                  <td className="text-bold">{a.nom}</td>
                  <td>{a.site_affecte}</td>
                  <td className="text-bold" style={{ color: colors.blue }}>{a.heure_pointage}</td>
                  <td><span className="badge badge-success">✅ JOUR VALIDÉ</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'attachements' && (
        <div className="card">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Attachements de fin de mois</h3>
              <p className="text-xs text-muted" style={{ marginTop: '5px' }}>Bilan des jours de travail consolidés par site, prêt à la signature client.</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => exportTableToPDF({
                title: 'ATTACHEMENTS MENSUELS — BILAN DES POINTAGES',
                subtitle: `Édité le ${new Date().toLocaleDateString('fr-DZ')}`,
                headers: ['Site Client', 'Jours Validés', 'Montant Estimé HT', 'Statut'],
                rows: [
                  ['Banque BNA - Alger Centre', `${pointagesBNA} Jours`, `${new Intl.NumberFormat('fr-DZ').format(montantEstimeBNA)} DA`, attachementBnaSigne ? 'SIGNÉ ✓' : 'EN ATTENTE'],
                  ['Usine Cevital - Bejaia', `${pointagesCevital} Jours`, `${new Intl.NumberFormat('fr-DZ').format(montantEstimeCevital)} DA`, 'SIGNÉ ✓'],
                ],
                filename: `Attachements_${new Date().toISOString().slice(0, 7)}`,
                orientation: 'portrait',
              })}
            >
              📄 Générer Attachement PDF
            </button>
          </div>
          <table className="table">
            <thead>
              <tr><th>Site Client</th><th>Total Jours Validés</th><th>Taux Base (Estimé)</th><th>Signature Client</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-bold">Banque BNA - Alger Centre</td>
                <td className="text-bold" style={{ color: colors.blue, fontSize: '15px' }}>{pointagesBNA} Jours</td>
                <td className="text-muted">~ {formaterMontantDZ(montantEstimeBNA)} DA HT</td>
                <td>
                  {attachementBnaSigne
                    ? <span className="badge badge-success">✅ ATTACHEMENT SIGNÉ</span>
                    : <button onClick={() => signerAttachement('Banque BNA', 'Banque BNA')} className="btn btn-warning btn-xs">Attente de validation (Cliquez pour signer)</button>
                  }
                </td>
              </tr>
              <tr>
                <td className="text-bold">Usine Cevital - Bejaia</td>
                <td className="text-bold" style={{ color: colors.blue, fontSize: '15px' }}>{pointagesCevital} Jours</td>
                <td className="text-muted">~ {formaterMontantDZ(montantEstimeCevital)} DA HT</td>
                <td><span className="badge badge-success">✅ ATTACHEMENT SIGNÉ</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'facturation' && (
        <div className="card card-green">
          <h3 className="section-title mb-10">Édition d'une Nouvelle Facture</h3>
          <p className="text-xs text-muted mb-20">Une facture ne doit être éditée que si l'attachement (jours travaillés) a été validé et signé par le client.</p>
          <form onSubmit={creerFacture} className="flex-wrap" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 120px' }}><label className="form-label-sm">N° FACTURE *</label><input type="text" placeholder="Ex: 006/2026" required value={nouvelleFacture.numero} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, numero: e.target.value })} className="form-input" /></div>
            <div style={{ flex: '2 1 200px' }}><label className="form-label-sm">CLIENT *</label><input type="text" placeholder="Nom de l'entreprise" required value={nouvelleFacture.client} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, client: e.target.value })} className="form-input" /></div>
            <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">MOIS</label>
              <select value={nouvelleFacture.mois} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, mois: e.target.value })} className="form-select">
                <option value="JANVIER">JANVIER</option><option value="FEVRIER">FEVRIER</option><option value="MARS">MARS</option><option value="AVRIL">AVRIL</option><option value="MAI">MAI</option><option value="JUIN">JUIN</option>
              </select>
            </div>
            <div style={{ flex: '2 1 200px' }}><label className="form-label-sm">DÉSIGNATION</label><input type="text" placeholder="Ex: Prestation Gardiennage 31 Jours" value={nouvelleFacture.designation} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, designation: e.target.value })} className="form-input" /></div>
            <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">DATE D'ÉDITION *</label><input type="date" required value={nouvelleFacture.date} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, date: e.target.value })} className="form-input" /></div>
            <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#166534' }}>MONTANT HT (DZD) *</label><input type="number" step="0.01" required value={nouvelleFacture.montant} onChange={(e) => setNouvelleFacture({ ...nouvelleFacture, montant: e.target.value })} className="form-input" style={{ backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 'bold' }} /></div>
            <button type="submit" disabled={chargement} className="btn btn-success" style={{ height: '40px' }}>Éditer et Enregistrer</button>
          </form>
        </div>
      )}

      {sousMenu === 'encaissement' && (
        <div className="card card-dark" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '0 0 15px 0', marginBottom: '20px', borderBottom: '1px solid #e5e7eb' }}>
            <h3 className="section-title">Registre des Encaissements</h3>
          </div>
          {chargement ? <div className="empty-state">Chargement...</div> : (
            <table className="table">
              <thead>
                <tr><th>N° Facture</th><th>Client / Désignation</th><th className="text-right">Montant (DA)</th><th className="text-center">Statut</th><th className="text-center">Action</th></tr>
              </thead>
              <tbody>
                {factures.map((f, index) => (
                  <tr key={f.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td className="text-bold" style={{ color: colors.blue }}>{f.numero_facture}<br /><span className="text-xs text-muted">{f.mois}</span></td>
                    <td><strong>{f.client}</strong><br />{f.designation}</td>
                    <td className="text-right text-bold">{formaterMontantDZ(f.montant)}</td>
                    <td className="text-center">
                      {f.statut_paiement === 'PAYEE' ? <span className="badge badge-success">✅ PAYÉE</span> : <span className="badge badge-danger">⏳ EN ATTENTE</span>}
                    </td>
                    <td className="text-center flex-row-sm" style={{ justifyContent: 'center' }}>
                      <button onClick={() => exportInvoiceToPDF(f)} className="btn btn-danger btn-xs">📄 PDF</button>
                      {f.statut_paiement !== 'PAYEE' && <button onClick={() => encaisserFacture(f.id)} className="btn btn-dark btn-xs">💰 Encaisser</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default Facturation;
