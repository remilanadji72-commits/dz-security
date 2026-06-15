import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Logistique() {
  const { agentsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('parc');
  const [vehicules, setVehicules] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [nouvelleMatricule, setNouvelleMatricule] = useState('');
  const [nouveauModele, setNouveauModele] = useState('');
  const [typeV, setTypeV] = useState('Patrouille');
  const [dateAssurance, setDateAssurance] = useState('');
  const [commandes, setCommandes] = useState([]);
  const [chargementCommandes, setChargementCommandes] = useState(false);
  const [nouveauFournisseur, setNouveauFournisseur] = useState('');
  const [nouvelArticle, setNouvelArticle] = useState('');
  const [nouvelleQuantite, setNouvelleQuantite] = useState('');
  const [nouvelleDateCommande, setNouvelleDateCommande] = useState('');
  const [nouveauStatutCommande, setNouveauStatutCommande] = useState('En attente');
  const [afficherFormUniforme, setAfficherFormUniforme] = useState(false);
  const [agentDotation, setAgentDotation] = useState('');
  const [articleDotation, setArticleDotation] = useState('');
  const [tailleDotation, setTailleDotation] = useState('L');
  const [dotations, setDotations] = useState([]);

  const fetchVehicules = async () => {
    const { data, error } = await supabase.from('vehicules').select('*').order('id', { ascending: false });
    if (!error) setVehicules(data || []);
    setChargement(false);
  };

  const fetchCommandes = async () => {
    const { data, error } = await supabase.from('commandes_logistique').select('*').order('id', { ascending: false });
    if (!error) setCommandes(data || []);
  };

  const fetchDotations = async () => {
    try {
      const { data, error } = await supabase.from('dotations_uniformes').select('*, agents(nom, matricule, site_affecte)').order('id', { ascending: false });
      if (!error) setDotations(data || []);
    } catch (e) {}
  };

  useEffect(() => { fetchVehicules(); fetchCommandes(); fetchDotations(); }, []);

  const ajouterVehicule = async (e) => {
    e.preventDefault();
    if (!nouvelleMatricule || !nouveauModele) return;
    setChargement(true);
    const { error } = await supabase.from('vehicules').insert([{ immatriculation: nouvelleMatricule, marque_modele: nouveauModele, type_vehicule: typeV, date_assurance: dateAssurance || null, site_actuel: 'Siège', statut: 'OPERATIONNEL' }]);
    if (!error) { setNouvelleMatricule(''); setNouveauModele(''); setDateAssurance(''); fetchVehicules(); }
    else { alert("Erreur (Cette immatriculation existe peut-être déjà)."); }
    setChargement(false);
  };

  const changerStatut = async (id, nouveauStatut) => { await supabase.from('vehicules').update({ statut: nouveauStatut }).eq('id', id); fetchVehicules(); };
  const isAlerteDate = (dateStr) => { if (!dateStr) return false; return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)) <= 30; };

  const ajouterCommande = async (e) => {
    e.preventDefault();
    if (!nouveauFournisseur || !nouvelArticle || !nouvelleQuantite) return;
    setChargementCommandes(true);
    const { error } = await supabase.from('commandes_logistique').insert([{ fournisseur: nouveauFournisseur, article: nouvelArticle, quantite: parseInt(nouvelleQuantite), date_commande: nouvelleDateCommande || new Date().toISOString().split('T')[0], statut: nouveauStatutCommande }]);
    if (!error) { setNouveauFournisseur(''); setNouvelArticle(''); setNouvelleQuantite(''); setNouvelleDateCommande(''); setNouveauStatutCommande('En attente'); fetchCommandes(); }
    else { alert("Erreur lors de l'ajout."); }
    setChargementCommandes(false);
  };

  const changerStatutCommande = async (id, s) => { await supabase.from('commandes_logistique').update({ statut: s }).eq('id', id); fetchCommandes(); };
  const supprimerCommande = async (id, article) => { if (window.confirm(`Supprimer la commande : ${article} ?`)) { await supabase.from('commandes_logistique').delete().eq('id', id); fetchCommandes(); } };

  const ajouterDotation = async (e) => {
    e.preventDefault();
    if (!agentDotation || !articleDotation) return;
    const unAnPlusTard = new Date(); unAnPlusTard.setFullYear(unAnPlusTard.getFullYear() + 1);
    try {
      const { error } = await supabase.from('dotations_uniformes').insert([{ agent_id: agentDotation, article: articleDotation, taille: tailleDotation, renouvellement_prevu: unAnPlusTard.toISOString().split('T')[0] }]);
      if (error) throw error;
      setAgentDotation(''); setArticleDotation(''); setAfficherFormUniforme(false);
      fetchDotations(); alert("Dotation enregistrée.");
    } catch (err) { alert("Erreur BDD."); }
  };

  const changerStatutUniforme = async (id, s) => { await supabase.from('dotations_uniformes').update({ statut: s }).eq('id', id); fetchDotations(); };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🚙</span>
        <div>
          <h1 className="page-title">SERVICE LOGISTIQUE</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Gestion du parc roulant, approvisionnements, maintenance et contrôle des biens.</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('parc')} className={`nav-tab${sousMenu === 'parc' ? ' active' : ''}`} style={sousMenu === 'parc' ? { backgroundColor: colors.blue } : {}}>1. Parc Roulant</button>
        <button onClick={() => setSousMenu('approvisionnement')} className={`nav-tab${sousMenu === 'approvisionnement' ? ' active' : ''}`} style={sousMenu === 'approvisionnement' ? { backgroundColor: colors.green } : {}}>2. Approvisionnement</button>
        <button onClick={() => setSousMenu('maintenance')} className={`nav-tab${sousMenu === 'maintenance' ? ' active' : ''}`} style={sousMenu === 'maintenance' ? { backgroundColor: colors.red } : {}}>3. Maintenance</button>
        <button onClick={() => setSousMenu('controle')} className={`nav-tab${sousMenu === 'controle' ? ' active' : ''}`} style={sousMenu === 'controle' ? { backgroundColor: colors.dark } : {}}>4. Contrôle des Biens (Uniformes)</button>
      </div>

      {sousMenu === 'parc' && (
        <>
          <div className="card card-blue mb-20">
            <h3 className="section-title mb-20">+ Enregistrer un Véhicule</h3>
            <form onSubmit={ajouterVehicule} className="flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 150px' }}><label className="form-label">Immatriculation *</label><input type="text" placeholder="12345 119 16" required value={nouvelleMatricule} onChange={(e) => setNouvelleMatricule(e.target.value)} className="form-input" /></div>
              <div style={{ flex: '1 1 200px' }}><label className="form-label">Marque & Modèle *</label><input type="text" placeholder="Dacia Logan" required value={nouveauModele} onChange={(e) => setNouveauModele(e.target.value)} className="form-input" /></div>
              <div style={{ flex: '1 1 150px' }}><label className="form-label">Type</label>
                <select value={typeV} onChange={(e) => setTypeV(e.target.value)} className="form-select">
                  <option value="Patrouille">Patrouille</option><option value="Véhicule de Liaison">Liaison</option><option value="Fourgon Blindé">Fourgon Blindé</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}><label className="form-label">Fin Assurance</label><input type="date" value={dateAssurance} onChange={(e) => setDateAssurance(e.target.value)} className="form-input" /></div>
              <button type="submit" disabled={chargement} className="btn btn-primary">Ajouter</button>
            </form>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="section-title">État de la Flotte</h3>
              <span className="badge badge-neutral">Total : {vehicules.length} véhicules</span>
            </div>
            <table className="table">
              <thead>
                <tr><th>Immatriculation</th><th>Modèle</th><th>Affectation</th><th>Fin Assurance</th><th>Statut & Action</th></tr>
              </thead>
              <tbody>
                {vehicules.map((v, index) => (
                  <tr key={v.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                    <td style={{ fontSize: '14px', letterSpacing: '1px' }}><span style={{ border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px', backgroundColor: 'white' }}>{v.immatriculation}</span></td>
                    <td><strong>{v.marque_modele}</strong><br />{v.type_vehicule}</td>
                    <td className="text-bold" style={{ color: colors.dark }}>📍 {v.site_actuel || 'Siège'}</td>
                    <td>
                      {isAlerteDate(v.date_assurance)
                        ? <span className="badge badge-danger">⚠ {v.date_assurance}</span>
                        : <span style={{ color: colors.green }}>✅ {v.date_assurance || 'N/A'}</span>
                      }
                    </td>
                    <td>
                      {v.statut === 'OPERATIONNEL'
                        ? <button onClick={() => changerStatut(v.id, 'EN PANNE')} className="btn btn-xs" style={{ backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #22c55e' }}>✅ OPÉRATIONNEL</button>
                        : <button onClick={() => changerStatut(v.id, 'OPERATIONNEL')} className="btn btn-xs" style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444' }}>❌ EN PANNE</button>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sousMenu === 'approvisionnement' && (
        <>
          <div className="card card-green mb-20">
            <h3 className="section-title mb-20">📦 + Nouvelle Commande</h3>
            <form onSubmit={ajouterCommande} className="flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}><label className="form-label">Fournisseur *</label>
                <select value={nouveauFournisseur} onChange={(e) => setNouveauFournisseur(e.target.value)} required className="form-select">
                  <option value="">Sélectionner</option><option value="Naftal">Naftal</option><option value="Uniform Factory">Uniform Factory</option><option value="SecurTech">SecurTech</option><option value="AutoParts">AutoParts</option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}><label className="form-label">Article *</label><input type="text" required value={nouvelArticle} onChange={(e) => setNouvelArticle(e.target.value)} className="form-input" /></div>
              <div style={{ flex: '1 1 120px' }}><label className="form-label">Quantité *</label><input type="number" required value={nouvelleQuantite} onChange={(e) => setNouvelleQuantite(e.target.value)} min="1" className="form-input" /></div>
              <div style={{ flex: '1 1 150px' }}><label className="form-label">Date</label><input type="date" value={nouvelleDateCommande} onChange={(e) => setNouvelleDateCommande(e.target.value)} className="form-input" /></div>
              <div style={{ flex: '1 1 140px' }}><label className="form-label">Statut</label>
                <select value={nouveauStatutCommande} onChange={(e) => setNouveauStatutCommande(e.target.value)} className="form-select">
                  <option value="En attente">⏳ En attente</option><option value="Validée">✅ Validée</option><option value="Livrée">🚚 Livrée</option><option value="Annulée">❌ Annulée</option>
                </select>
              </div>
              <button type="submit" disabled={chargementCommandes} className="btn btn-success" style={{ height: '40px' }}>✅ Ajouter</button>
            </form>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: '15px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 className="section-title">📋 Commandes</h3>
              <button onClick={fetchCommandes} className="btn btn-secondary btn-xs">🔄 Rafraîchir</button>
            </div>
            <table className="table table-sm">
              <thead>
                <tr><th>Fournisseur</th><th>Article</th><th>Qté</th><th>Date</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {commandes.length === 0 ? (<tr><td colSpan="6" className="empty-state">Aucune commande</td></tr>) : (
                  commandes.map((c, index) => {
                    const stObj = { 'En attente': { bg: '#fef3c7', c: '#92400e', i: '⏳' }, 'Validée': { bg: '#dbeafe', c: '#1e40af', i: '✅' }, 'Livrée': { bg: '#dcfce7', c: '#166534', i: '🚚' }, 'Annulée': { bg: '#fee2e2', c: '#991b1b', i: '❌' } }[c.statut];
                    return (
                      <tr key={c.id} style={{ backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td>{c.fournisseur}</td><td><strong>{c.article}</strong></td><td>{c.quantite}</td><td>{c.date_commande}</td>
                        <td><span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', backgroundColor: stObj?.bg, color: stObj?.c }}>{stObj?.i} {c.statut}</span></td>
                        <td>
                          <div className="flex-row-sm">
                            {c.statut === 'En attente' && <button onClick={() => changerStatutCommande(c.id, 'Validée')} className="btn btn-xs" style={{ background: '#dbeafe' }}>Valider</button>}
                            {c.statut === 'Validée' && <button onClick={() => changerStatutCommande(c.id, 'Livrée')} className="btn btn-xs" style={{ background: '#dcfce7' }}>Livrer</button>}
                            <button onClick={() => supprimerCommande(c.id, c.article)} className="btn btn-xs" style={{ background: '#fef2f2' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sousMenu === 'maintenance' && (
        <div className="card card-red">
          <h3 className="section-title mb-10">Suivi de la Maintenance</h3>
          <p className="text-muted">Registre des réparations.</p>
        </div>
      )}

      {sousMenu === 'controle' && (
        <div className="flex-col">
          <div className="card card-dark">
            <div className="flex-between mb-20">
              <h3 className="section-title">👕 Dotation Uniformes</h3>
              {!afficherFormUniforme && <button onClick={() => setAfficherFormUniforme(true)} className="btn btn-dark btn-sm">+ Nouvelle Dotation</button>}
            </div>

            {afficherFormUniforme && (
              <form onSubmit={ajouterDotation} className="form-section mb-20 flex-wrap" style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 200px' }}><label className="form-label-sm">Agent *</label>
                  <select value={agentDotation} onChange={(e) => setAgentDotation(e.target.value)} required className="form-select">
                    <option value="">-- Choisir Agent --</option>
                    {agentsData?.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Article *</label>
                  <select value={articleDotation} onChange={(e) => setArticleDotation(e.target.value)} required className="form-select">
                    <option value="">-- Article --</option><option value="Veste Hiver">Veste Hiver</option><option value="Pantalon">Pantalon</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 100px' }}><label className="form-label-sm">Taille</label>
                  <select value={tailleDotation} onChange={(e) => setTailleDotation(e.target.value)} className="form-select"><option value="L">L</option><option value="XL">XL</option></select>
                </div>
                <button type="submit" className="btn btn-dark">Valider la remise</button>
              </form>
            )}

            <table className="table">
              <thead>
                <tr><th>Agent</th><th>Dotation</th><th>Date</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {dotations.map((dot) => {
                  const agentNom = dot.agents ? (Array.isArray(dot.agents) ? dot.agents[0]?.nom : dot.agents.nom) : '---';
                  return (
                    <tr key={dot.id}>
                      <td><strong>{agentNom}</strong></td>
                      <td><strong>{dot.article}</strong> (Taille: {dot.taille})</td>
                      <td style={{ color: colors.blue }}>{new Date(dot.date_distribution).toLocaleDateString('fr-FR')}</td>
                      <td>
                        <select value={dot.statut} onChange={(e) => changerStatutUniforme(dot.id, e.target.value)} className="form-select" style={{ fontWeight: 'bold' }}>
                          <option value="EN POSSESSION">✅ En Possession</option><option value="RETOURNE">🔄 Retourné</option><option value="PERDU">❌ Perdu</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3 className="section-title mb-20">📦 Suivi des Stocks (Alertes)</h3>
            <div className="flex-row">
              <div style={{ flex: 1, backgroundColor: '#fef2f2', padding: '15px', borderRadius: '4px', borderLeft: '4px solid #ef4444' }}>
                <strong style={{ color: '#991b1b' }}>⚠️ Rupture de Stock (Taille XL)</strong>
                <p className="text-xs" style={{ margin: '5px 0 0 0' }}>
                  Vestes Hiver (XL) &lt; 5 unités.{' '}
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from('commandes_logistique').insert([{ fournisseur: 'Uniform Factory', article: 'Veste Hiver (XL)', quantite: 10, date_commande: new Date().toISOString().split('T')[0], statut: 'En attente' }]);
                      if (!error) { alert("✅ Commande automatique de 10 Vestes (XL) ajoutée aux Achats."); fetchCommandes(); }
                    }}
                    style={{ border: 'none', background: 'none', color: colors.blue, cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                  >
                    Générer Commande Auto
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Logistique;
