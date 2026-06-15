import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors, getJoursRestants } from '../constants';

function Contrats() {
  const { contratsData, fetchToutesLesDonnees } = useDataStore();

  const [nouveauClient, setNouveauClient] = useState('');
  const [adresseSiege, setAdresseSiege] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [contactTel, setContactTel] = useState('');
  const [rc, setRc] = useState('');
  const [nif, setNif] = useState('');
  const [nis, setNis] = useState('');
  const [art, setArt] = useState('');
  const [nouveauSite, setNouveauSite] = useState('');
  const [siteLat, setSiteLat] = useState('');
  const [siteLng, setSiteLng] = useState('');
  const [typeDoc, setTypeDoc] = useState('CONTRAT');
  const [reference, setReference] = useState('');
  const [dateSignature, setDateSignature] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [montantTotal, setMontantTotal] = useState('');
  const [clauses, setClauses] = useState('');
  const [creePar, setCreePar] = useState('');
  const [contratPourAvenant, setContratPourAvenant] = useState('');
  const [refAvenant, setRefAvenant] = useState('');
  const [nouvelleDateFin, setNouvelleDateFin] = useState('');
  const [objetAvenant, setObjetAvenant] = useState('Prolongation de délai');
  const [listeContrats, setListeContrats] = useState(contratsData || []);

  useEffect(() => { setListeContrats(contratsData || []); }, [contratsData]);

  const creerMarche = async (e) => {
    e.preventDefault();
    if (!nouveauClient || !nouveauSite || !dateDebut || !dateFin) {
      alert("Remplissez au moins le Nom du client, le Site et les dates.");
      return;
    }
    const { data: cData, error: clientErr } = await supabase.from('clients').insert([{
      nom_entreprise: nouveauClient, adresse_siege: adresseSiege,
      contact_nom: contactNom, contact_telephone: contactTel,
      rc, nif, nis, art
    }]).select();
    if (clientErr) { alert("Erreur d'insertion du client."); return; }

    let safeLat = null, safeLng = null;
    if (siteLat) { const p = parseFloat(siteLat.replace(',', '.')); if (!isNaN(p)) safeLat = p; }
    if (siteLng) { const p = parseFloat(siteLng.replace(',', '.')); if (!isNaN(p)) safeLng = p; }

    const { error: contratErr } = await supabase.from('contrats').insert([{
      client_id: cData[0].id, nom_site: nouveauSite,
      site_gps_lat: safeLat, site_gps_lng: safeLng,
      date_signature: dateSignature || null, date_debut: dateDebut, date_fin: dateFin,
      montant_total: montantTotal ? parseFloat(montantTotal) : null,
      clauses_specifiques: clauses, cree_par: creePar,
      type_document: typeDoc, reference_document: reference,
      plan_defense_valide: false
    }]);
    if (contratErr) { alert("Erreur d'insertion du marché."); return; }

    alert(`${typeDoc} enregistré avec succès !`);
    setNouveauClient(''); setAdresseSiege(''); setContactNom(''); setContactTel('');
    setRc(''); setNif(''); setNis(''); setArt('');
    setNouveauSite(''); setSiteLat(''); setSiteLng('');
    setDateSignature(''); setDateDebut(''); setDateFin(''); setReference('');
    setMontantTotal(''); setClauses(''); setCreePar('');
    if (fetchToutesLesDonnees) fetchToutesLesDonnees();
  };

  const creerAvenant = async (e) => {
    e.preventDefault();
    if (!contratPourAvenant || !nouvelleDateFin || !refAvenant) return;
    await supabase.from('avenants').insert([{ contrat_id: contratPourAvenant, reference_avenant: refAvenant, date_signature: new Date().toISOString().split('T')[0], nouvelle_date_fin: nouvelleDateFin, objet: objetAvenant }]);
    await supabase.from('contrats').update({ date_fin: nouvelleDateFin }).eq('id', contratPourAvenant);
    alert(`Avenant enregistré. Nouvelle échéance : ${nouvelleDateFin}.`);
    setContratPourAvenant(''); setRefAvenant(''); setNouvelleDateFin('');
    if (fetchToutesLesDonnees) fetchToutesLesDonnees();
  };

  const formaterMontantDZ = (montant) => {
    if (!montant) return '---';
    return new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(montant);
  };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🤝</span>
        <div>
          <h1 className="page-title">SERVICE DES MARCHÉS</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Élaboration et Suivi des Marchés, Contrats, Conventions et Avenants.</p>
        </div>
      </div>

      {/* FORMULAIRE ÉLABORATION */}
      <div className="card card-blue mb-20">
        <h3 style={{ marginTop: 0, color: '#1f2937' }}>1-2. Nouvelle Élaboration</h3>
        <form onSubmit={creerMarche}>

          <div className="flex-row-15 mb-15">
            <div className="flex-1">
              <label className="form-label">NATURE DU DOCUMENT</label>
              <select value={typeDoc} onChange={(e) => setTypeDoc(e.target.value)} className="form-select">
                <option value="CONTRAT">CONTRAT COMMERCIAL</option>
                <option value="MARCHE">MARCHÉ PUBLIC</option>
                <option value="CONVENTION">CONVENTION</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="form-label">RÉFÉRENCE LÉGALE</label>
              <input type="text" placeholder="Ex: N° 45/DAP/2026" value={reference} onChange={(e) => setReference(e.target.value)} className="form-input" />
            </div>
            <div className="flex-1">
              <label className="form-label">DATE DE SIGNATURE</label>
              <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-section mb-15">
            <div className="flex-row-15">
              <div style={{ flex: 2 }}>
                <label className="form-label">NOM DU CLIENT / RAISON SOCIALE *</label>
                <input type="text" placeholder="Ex: Sonatrach" value={nouveauClient} onChange={(e) => setNouveauClient(e.target.value)} className="form-input" required />
              </div>
              <div style={{ flex: 2 }}>
                <label className="form-label">ADRESSE DU SIÈGE SOCIAL</label>
                <input type="text" placeholder="Ex: Djenane El Malik, Hydra" value={adresseSiege} onChange={(e) => setAdresseSiege(e.target.value)} className="form-input" />
              </div>
            </div>
            <div className="flex-row-sm">
              <input type="text" placeholder="N° RC" value={rc} onChange={(e) => setRc(e.target.value)} className="form-input-sm flex-1" title="Registre de Commerce" />
              <input type="text" placeholder="NIF" value={nif} onChange={(e) => setNif(e.target.value)} className="form-input-sm flex-1" title="Numéro d'Identification Fiscale" />
              <input type="text" placeholder="NIS" value={nis} onChange={(e) => setNis(e.target.value)} className="form-input-sm flex-1" title="Numéro d'Identification Statistique" />
              <input type="text" placeholder="ART" value={art} onChange={(e) => setArt(e.target.value)} className="form-input-sm flex-1" title="Article d'Imposition" />
            </div>
            <div className="flex-row-sm">
              <input type="text" placeholder="Contact (Nom)" value={contactNom} onChange={(e) => setContactNom(e.target.value)} className="form-input-sm flex-1" />
              <input type="text" placeholder="Téléphone Contact" value={contactTel} onChange={(e) => setContactTel(e.target.value)} className="form-input-sm flex-1" />
            </div>
          </div>

          <div className="form-section form-section-green mb-15">
            <div className="flex-row-15">
              <div style={{ flex: 2 }}>
                <label className="form-label" style={{ color: '#166534' }}>DÉSIGNATION DU SITE À PROTÉGER *</label>
                <input type="text" placeholder="Ex: Base de Vie" value={nouveauSite} onChange={(e) => setNouveauSite(e.target.value)} className="form-input" required />
              </div>
              <div className="flex-1">
                <label className="form-label" style={{ color: '#166534' }}>DATE DE DÉBUT *</label>
                <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="form-input" required />
              </div>
              <div className="flex-1">
                <label className="form-label" style={{ color: '#ef4444' }}>DATE DE FIN *</label>
                <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="form-input" style={{ borderColor: '#ef4444' }} required />
              </div>
            </div>
          </div>

          <div className="flex-row-15 mb-20">
            <div className="flex-1">
              <label className="form-label">MONTANT GLOBAL (DZD)</label>
              <input type="number" step="0.01" placeholder="Montant du marché" value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} className="form-input text-bold" style={{ color: '#10b981' }} />
            </div>
            <div style={{ flex: 2 }}>
              <label className="form-label">CLAUSES SPÉCIFIQUES</label>
              <input type="text" placeholder="Ex: Armement Cat. 4 exigé, Pénalité de 5000 DA" value={clauses} onChange={(e) => setClauses(e.target.value)} className="form-input" />
            </div>
            <div className="flex-1">
              <label className="form-label">SAISI PAR (TRAÇABILITÉ)</label>
              <input type="text" placeholder="Nom du Commercial" value={creePar} onChange={(e) => setCreePar(e.target.value)} className="form-input" style={{ backgroundColor: '#f3f4f6' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            📥 ENREGISTRER DANS LA BASE COMMERCIALE
          </button>
        </form>
      </div>

      {/* AVENANTS + SUIVI */}
      <div className="flex-wrap">

        <div style={{ flex: '1 1 300px' }} className="card card-green">
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>1-3. Élaboration d'Avenants</h3>
          <form onSubmit={creerAvenant} className="flex-col">
            <select onChange={(e) => setContratPourAvenant(e.target.value)} className="form-select" required>
              <option value="">-- Sélectionner le marché à prolonger --</option>
              {listeContrats.map(c => <option key={c.id} value={c.id}>{c.type_document} : {c.clients?.nom_entreprise} ({c.nom_site})</option>)}
            </select>
            <div className="flex-row-sm">
              <input type="text" placeholder="Réf Avenant" value={refAvenant} onChange={(e) => setRefAvenant(e.target.value)} className="form-input flex-1" required />
              <select value={objetAvenant} onChange={(e) => setObjetAvenant(e.target.value)} className="form-select" style={{ flex: 2 }}>
                <option value="Prolongation de délai">Prolongation de délai</option>
                <option value="Révision des prix">Révision des prix</option>
              </select>
            </div>
            <div>
              <label className="form-label">Nouvelle Date de Fin</label>
              <input type="date" value={nouvelleDateFin} onChange={(e) => setNouvelleDateFin(e.target.value)} className="form-input" required />
            </div>
            <button type="submit" disabled={!contratPourAvenant} className="btn btn-success">Valider l'Avenant</button>
          </form>
        </div>

        <div style={{ flex: '2 1 600px' }} className="card">
          <h3 style={{ marginTop: 0, color: '#1f2937' }}>1-4. Suivi et Alertes d'Expiration</h3>
          <table className="table table-xs">
            <thead>
              <tr>
                <th>Contrat / Traçabilité</th>
                <th>Infos Client</th>
                <th>Conditions</th>
                <th>Statut & Échéance</th>
              </tr>
            </thead>
            <tbody>
              {listeContrats.map((contrat) => {
                const joursRestants = getJoursRestants(contrat.date_fin);
                const alerteRouge = joursRestants <= 30;
                return (
                  <tr key={contrat.id}>
                    <td>
                      <span className="badge badge-dark" style={{ fontSize: '10px' }}>{contrat.type_document || 'CONTRAT'}</span><br />
                      <span className="text-xxs text-muted">Réf: {contrat.reference_document || '---'}</span><br />
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>Saisi par : {contrat.cree_par || 'Admin'}</span>
                    </td>
                    <td>
                      <strong style={{ color: colors.blue }}>{contrat.clients ? contrat.clients.nom_entreprise : 'Inconnu'}</strong><br />
                      <span style={{ fontSize: '10px', color: '#6b7280' }}>RC: {contrat.clients?.rc || '---'} | NIF: {contrat.clients?.nif || '---'}</span>
                    </td>
                    <td>
                      <strong style={{ color: '#166534' }}>{contrat.nom_site}</strong><br />
                      <span className="text-xs text-bold" style={{ color: '#10b981' }}>{formaterMontantDZ(contrat.montant_total)} DA</span>
                    </td>
                    <td>
                      {alerteRouge ? (
                        <div className="alert alert-danger">
                          <strong style={{ color: '#ef4444' }}>Fin : {contrat.date_fin}</strong><br />
                          <span style={{ color: '#991b1b', fontSize: '10px' }}>⚠️ {joursRestants} jours restants.</span>
                        </div>
                      ) : (
                        <div className="alert alert-success">
                          <strong style={{ color: '#166534' }}>Jusqu'au {contrat.date_fin}</strong>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Contrats;
