import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function RessourcesHumaines() {
  const { agentsData, fetchToutesLesDonnees } = useDataStore();
  const [sousMenu, setSousMenu] = useState('contrats');
  const [rechercheAgent, setRechercheAgent] = useState('');
  const [rechercheSite, setRechercheSite] = useState('');

  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [matricule, setMatricule] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [dateNaissance, setDateNaissance] = useState('');
  const [numCin, setNumCin] = useState('');
  const [telephone, setTelephone] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [dateEmbauche, setDateEmbauche] = useState('');
  const [qualification, setQualification] = useState('Agent Simple');
  const [cqp, setCqp] = useState('NON');
  const [numCartePro, setNumCartePro] = useState('');
  const [validiteCartePro, setValiditeCartePro] = useState('');
  const [siteAffecte, setSiteAffecte] = useState('');
  const [typeContrat, setTypeContrat] = useState('CDD');
  const [dateFin, setDateFin] = useState('');
  const [numAnem, setNumAnem] = useState('');
  const [chargement, setChargement] = useState(false);

  const [agentSelectionneRH, setAgentSelectionneRH] = useState(null);
  const [vueImpression, setVueImpression] = useState('fiche');

  const getJoursRestantsCartePro = (dateStr) => {
    if (!dateStr) return 999;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const getAlertesDRH = () => {
    const aujourdhui = new Date();
    let alertesContrats = 0;
    let alertesMedecine = 0;
    agentsData.forEach(agent => {
      if (agent.date_fin_contrat && new Date(agent.date_fin_contrat) - aujourdhui < 15 * 24 * 60 * 60 * 1000) alertesContrats++;
      if (agent.dossier_medical_valide === false) alertesMedecine++;
    });
    return { alertesContrats, alertesMedecine };
  };

  const alertes = getAlertesDRH();

  const recruterAgent = async (e) => {
    e.preventDefault();
    if (!nom || !prenom || !dateEmbauche || !typeContrat) { alert("Remplissez les champs obligatoires."); return; }
    setChargement(true);
    const { error } = await supabase.from('agents').insert([{
      matricule: matricule || `AG-${Math.floor(Math.random() * 10000)}`,
      nom: nom.toUpperCase() + ' ' + prenom.toUpperCase(), prenom: prenom.toUpperCase(), date_naissance: dateNaissance || null,
      carte_identite_num: numCin, telephone: telephone, wilaya: wilaya, date_recrutement: dateEmbauche, type_contrat: typeContrat,
      date_fin_contrat: typeContrat === 'CDI' ? null : dateFin, numero_anem: numAnem, qualification: qualification,
      cqp_formation: cqp === 'OUI', num_carte_pro: numCartePro, validite_carte_pro: validiteCartePro || null, site_affecte: siteAffecte || 'En attente',
      statut_agent: 'ACTIF', heure_pointage: '00:00:00'
    }]);
    if (error) { alert("Erreur."); console.error(error); }
    else {
      alert(`Agent recruté avec succès !`);
      setAfficherFormulaire(false);
      setMatricule(''); setNom(''); setPrenom(''); setDateNaissance(''); setNumCin(''); setTelephone(''); setWilaya('');
      setDateEmbauche(''); setQualification('Agent Simple'); setCqp('NON'); setNumCartePro(''); setValiditeCartePro('');
      setSiteAffecte(''); setTypeContrat('CDD'); setDateFin(''); setNumAnem('');
      if (fetchToutesLesDonnees) fetchToutesLesDonnees();
    }
    setChargement(false);
  };

  const archiverAgent = async (id, nomAgent) => {
    const motif = prompt(`Quel est le motif de départ pour ${nomAgent} ?\n(Ex: Fin de contrat, Démission, Faute grave)`);
    if (!motif) return;
    if (window.confirm(`Confirmez-vous l'archivage définitif de ${nomAgent} ?`)) {
      const { error } = await supabase.from('agents').update({ statut_agent: 'INACTIF', motif_sortie: motif, date_sortie: new Date().toISOString().split('T')[0] }).eq('id', id);
      if (!error) { alert(`✅ Le dossier de ${nomAgent} a été clos et archivé.`); setAgentSelectionneRH(null); if (fetchToutesLesDonnees) fetchToutesLesDonnees(); }
      else { alert("❌ Erreur BDD."); }
    }
  };

  const imprimerDocument = (typeDoc) => { setVueImpression(typeDoc); setTimeout(() => window.print(), 100); };

  return (
    <div className="page-container print-container">
      <div className="hide-on-print">
        <div className="page-header mb-20">
          <span style={{ fontSize: '32px' }}>📝</span>
          <div>
            <h1 className="page-title">SERVICE RECRUTEMENT & CARRIÈRE</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>Gestion administrative complète.</p>
          </div>
        </div>

        {(alertes.alertesContrats > 0 || alertes.alertesMedecine > 0) && (
          <div className="alert alert-danger flex-row mb-20">
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <strong style={{ color: '#991b1b', display: 'block', marginBottom: '5px' }}>ACTIONS REQUISES (CONFORMITÉ LÉGALE)</strong>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#7f1d1d', fontSize: '13px' }}>
                {alertes.alertesContrats > 0 && <li><strong>{alertes.alertesContrats} Agent(s)</strong> ont un CDD qui arrive à expiration.</li>}
                {alertes.alertesMedecine > 0 && <li><strong>{alertes.alertesMedecine} Agent(s)</strong> doivent passer la Médecine du Travail.</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="nav-tabs mb-20">
          <button onClick={() => setSousMenu('contrats')} className={`nav-tab${sousMenu === 'contrats' ? ' active' : ''}`} style={sousMenu === 'contrats' ? { backgroundColor: colors.blue } : {}}>Fiches Personnel & Contrats</button>
          <button onClick={() => setSousMenu('organismes')} className={`nav-tab${sousMenu === 'organismes' ? ' active' : ''}`} style={sousMenu === 'organismes' ? { backgroundColor: colors.green } : {}}>Directions Externes</button>
          <button onClick={() => setSousMenu('inspection')} className={`nav-tab${sousMenu === 'inspection' ? ' active' : ''}`} style={sousMenu === 'inspection' ? { backgroundColor: colors.dark } : {}}>Inspection du Travail</button>
          <button onClick={() => setSousMenu('archives')} className={`nav-tab${sousMenu === 'archives' ? ' active' : ''}`} style={sousMenu === 'archives' ? { backgroundColor: '#6b7280' } : {}}>Archives Personnel</button>
        </div>
      </div>

      {sousMenu === 'contrats' && (
        <div className="flex-col">
          {/* BARRE RECHERCHE + BOUTON EMBAUCHE */}
          <div className="hide-on-print card flex-between mb-10">
            <div className="flex-row-15" style={{ flex: 1 }}>
              <div style={{ flex: 1, maxWidth: '300px' }}>
                <label className="form-label-sm">Recherche par Nom</label>
                <input type="text" placeholder="Ex: Karim Benali" value={rechercheAgent} onChange={(e) => setRechercheAgent(e.target.value)} className="form-input" />
              </div>
              <div style={{ flex: 1, maxWidth: '300px' }}>
                <label className="form-label-sm">Recherche par Site</label>
                <input type="text" placeholder="Ex: Banque BNA" value={rechercheSite} onChange={(e) => setRechercheSite(e.target.value)} className="form-input" />
              </div>
            </div>
            {!afficherFormulaire && (
              <button onClick={() => setAfficherFormulaire(true)} className="btn btn-primary" style={{ height: '40px' }}>➕ Nouvelle Recrue</button>
            )}
          </div>

          {/* FORMULAIRE RECRUTEMENT */}
          {afficherFormulaire && (
            <div className="hide-on-print card card-blue mb-20">
              <div className="flex-between mb-20" style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h2 className="section-title" style={{ margin: 0 }}>Dossier de Recrutement</h2>
                <button onClick={() => setAfficherFormulaire(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#ef4444' }}>✖</button>
              </div>
              <form onSubmit={recruterAgent}>
                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>1. ÉTAT CIVIL & COORDONNÉES</h4>
                <div className="flex-wrap mb-20" style={{ backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ flex: '1 1 120px' }}><label className="form-label-sm">Matricule</label><input type="text" value={matricule} onChange={(e) => setMatricule(e.target.value)} placeholder="Auto" className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Nom *</label><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} required className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Prénom *</label><input type="text" value={prenom} onChange={(e) => setPrenom(e.target.value)} required className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Date naissance</label><input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">N° CIN</label><input type="text" value={numCin} onChange={(e) => setNumCin(e.target.value)} className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Téléphone</label><input type="text" value={telephone} onChange={(e) => setTelephone(e.target.value)} className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Wilaya</label><input type="text" value={wilaya} onChange={(e) => setWilaya(e.target.value)} className="form-input" /></div>
                </div>

                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>2. QUALIFICATIONS LÉGALES</h4>
                <div className="flex-wrap mb-20" style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#166534' }}>Qualification</label><select value={qualification} onChange={(e) => setQualification(e.target.value)} className="form-select"><option value="Agent Simple">Agent Simple</option><option value="Chef de Groupe">Chef de Groupe</option><option value="Maître-Chien">Maître-Chien</option><option value="Convoyeur de Fonds">Convoyeur de Fonds</option></select></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#166534' }}>CQP / Formation</label><select value={cqp} onChange={(e) => setCqp(e.target.value)} className="form-select"><option value="NON">NON OBTENUE</option><option value="OUI">OUI - CERTIFIÉ</option></select></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#166534' }}>N° Carte Pro</label><input type="text" value={numCartePro} onChange={(e) => setNumCartePro(e.target.value)} className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#166534' }}>Validité Carte Pro</label><input type="date" value={validiteCartePro} onChange={(e) => setValiditeCartePro(e.target.value)} className="form-input" /></div>
                </div>

                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>3. CONTRAT ET AFFECTATION</h4>
                <div className="flex-wrap mb-20" style={{ backgroundColor: '#fdf4ff', padding: '15px', borderRadius: '8px', border: '1px solid #fbcfe8' }}>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Date embauche *</label><input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} required className="form-input" /></div>
                  <div style={{ flex: '1 1 150px' }}><label className="form-label-sm">Type de Contrat *</label><select value={typeContrat} onChange={(e) => setTypeContrat(e.target.value)} className="form-select"><option value="CDD">CDD</option><option value="CDI">CDI</option><option value="CTA (ANEM)">CTA (ANEM)</option></select></div>
                  {typeContrat !== 'CDI' && <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#ef4444' }}>Fin de Contrat *</label><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className="form-input" style={{ borderColor: '#fca5a5' }} /></div>}
                  {typeContrat === 'CTA (ANEM)' && <div style={{ flex: '1 1 150px' }}><label className="form-label-sm" style={{ color: '#ca8a04' }}>N° ANEM *</label><input type="text" value={numAnem} onChange={(e) => setNumAnem(e.target.value)} required className="form-input" style={{ borderColor: '#fde047' }} /></div>}
                  <div style={{ flex: '1 1 200px' }}><label className="form-label-sm">Site affecté</label><input type="text" value={siteAffecte} onChange={(e) => setSiteAffecte(e.target.value)} className="form-input" /></div>
                </div>
                <button type="submit" disabled={chargement} className="btn btn-primary btn-full" style={{ fontSize: '16px' }}>💾 Valider et Créer le Dossier</button>
              </form>
            </div>
          )}

          <div className="flex-row">
            {/* TABLEAU GAUCHE : LISTE ACTIVE */}
            <div className="flex-1 card hide-on-print" style={{ overflowX: 'auto' }}>
              <h3 className="section-title mb-20">Registre Complet du Personnel</h3>
              <table className="table table-xs">
                <thead>
                  <tr><th>Matricule</th><th>Agent</th><th>Statut</th><th>Carte Pro</th><th className="text-center">Action</th></tr>
                </thead>
                <tbody>
                  {agentsData
                    .filter(a => {
                      const actif = a.statut_agent !== 'INACTIF';
                      const matchNom = a.nom.toLowerCase().includes(rechercheAgent.toLowerCase());
                      const matchSite = a.site_affecte ? a.site_affecte.toLowerCase().includes(rechercheSite.toLowerCase()) : (rechercheSite === '');
                      return actif && matchNom && matchSite;
                    })
                    .map((a) => {
                      const alerteCarte = getJoursRestantsCartePro(a.validite_carte_pro) <= 60 && a.validite_carte_pro;
                      return (
                        <tr key={`ct-${a.id}`} style={{ backgroundColor: agentSelectionneRH?.id === a.id ? '#eff6ff' : 'white' }}>
                          <td className="text-bold text-muted">{a.matricule || '---'}</td>
                          <td><strong style={{ fontSize: '14px' }}>{a.nom}</strong></td>
                          <td><span style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '3px', fontWeight: 'bold' }}>{a.type_contrat || 'CDD'}</span></td>
                          <td>{alerteCarte ? <span style={{ color: '#ef4444', fontWeight: 'bold', backgroundColor: '#fef2f2', padding: '2px 5px', fontSize: '10px' }}>⚠️ Expire</span> : <span className="text-muted">Valide</span>}</td>
                          <td className="text-center">
                            <button onClick={() => setAgentSelectionneRH(a)} className="btn btn-xs" style={{ backgroundColor: agentSelectionneRH?.id === a.id ? colors.dark : colors.blue, color: 'white' }}>
                              {agentSelectionneRH?.id === a.id ? 'Dossier Ouvert' : 'Ouvrir Dossier'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* PANNEAU DROITE : DOSSIER AGENT (print docs conservés inline) */}
            <div style={{ width: '500px', flexShrink: 0 }} className="print-full-width">
              {agentSelectionneRH ? (
                <div style={{ position: 'relative' }}>
                  <div className="hide-on-print flex-row-sm mb-15">
                    <button onClick={() => imprimerDocument('fiche')} className="btn btn-dark flex-1" style={{ fontSize: '11px' }}>🖨️ Fiche</button>
                    <button onClick={() => imprimerDocument('pv')} className="btn btn-success flex-1" style={{ fontSize: '11px' }}>📜 PV</button>
                    <button onClick={() => archiverAgent(agentSelectionneRH.id, agentSelectionneRH.nom)} className="btn btn-danger flex-1" style={{ fontSize: '11px' }}>🚫 Archiver</button>
                  </div>

                  {/* FICHE SIGNALÉTIQUE - styles inline conservés pour impression */}
                  <div className={`printable-doc ${vueImpression === 'fiche' ? 'show-print' : 'hide-print'}`} style={{ backgroundColor: 'white', padding: '40px', border: '1px solid #ccc', display: vueImpression === 'fiche' ? 'block' : 'none', minHeight: '600px' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '15px', marginBottom: '20px' }}>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>GUARDING AND SECURITY COMPANY ALGERIA</h3>
                      <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', textDecoration: 'underline' }}>FICHE SIGNALITIQUE</h2>
                    </div>
                    <div style={{ width: '90px', height: '110px', border: '1px solid black', position: 'absolute', top: '150px', right: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ccc', fontSize: '10px' }}>PHOTO</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                      <div><strong>NOM :</strong> {agentSelectionneRH.nom?.split(' ')[0] || ''}</div>
                      <div><strong>PRENOM :</strong> {agentSelectionneRH.nom?.split(' ').slice(1).join(' ') || ''}</div>
                      <div><strong>N° CIN :</strong> {agentSelectionneRH.carte_identite_num || '...............'}</div>
                      <div><strong>FONCTION :</strong> {agentSelectionneRH.fonction || 'APS'}</div>
                      <div><strong>RECRUTEMENT :</strong> {agentSelectionneRH.date_recrutement || '...............'}</div>
                    </div>
                    <div style={{ marginTop: '50px', textAlign: 'right' }}><strong>Cachet et Signature</strong></div>
                  </div>

                  {/* PV - styles inline conservés pour impression */}
                  <div className={`printable-doc ${vueImpression === 'pv' ? 'show-print' : 'hide-print'}`} style={{ backgroundColor: 'white', padding: '40px', border: '1px solid #ccc', display: vueImpression === 'pv' ? 'block' : 'none', minHeight: '600px' }}>
                    <div style={{ textAlign: 'center', borderTop: '2px solid black', borderBottom: '2px solid black', padding: '10px 0', margin: '20px 0' }}><h1 style={{ margin: 0, fontSize: '22px' }}>Procès-Verbal de Nomination</h1></div>
                    <p><strong>Article 1 :</strong> L'agent <strong>{agentSelectionneRH.nom}</strong> est nommé au poste de <strong>{agentSelectionneRH.fonction || 'APS'}</strong>.</p>
                    <div style={{ marginTop: '50px', textAlign: 'right' }}><strong>Le Directeur Général</strong></div>
                  </div>
                </div>
              ) : (
                <div className="hide-on-print empty-state-dashed" style={{ height: '100%' }}>
                  Cliquez sur "Ouvrir Dossier" pour gérer un agent.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {sousMenu === 'organismes' && (<div className="card"><h3 className="section-title">Directions Externes (ANEM/Santé)</h3><p>Voir le tableau de bord global.</p></div>)}
      {sousMenu === 'inspection' && (<div className="card"><h3 className="section-title">Registre de l'Inspection du Travail</h3><p>Document légal.</p></div>)}

      {sousMenu === 'archives' && (
        <div className="card card-dark">
          <h3 className="section-title mb-20">Archives du Personnel (Sortant)</h3>
          <table className="table table-xs">
            <thead>
              <tr><th>Agent</th><th>Date de Sortie</th><th>Motif de sortie</th></tr>
            </thead>
            <tbody>
              {agentsData.filter(a => a.statut_agent === 'INACTIF').length > 0 ? (
                agentsData.filter(a => a.statut_agent === 'INACTIF').map(a => (
                  <tr key={`arc-${a.id}`}>
                    <td className="text-bold">{a.nom}<br /><span className="text-xs text-muted">Mat: {a.matricule}</span></td>
                    <td>{a.date_sortie || 'Non renseignée'}</td>
                    <td className="text-bold" style={{ color: '#ef4444' }}>{a.motif_sortie}</td>
                  </tr>
                ))
              ) : (<tr><td colSpan="3" className="empty-state">Aucun agent inactif.</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RessourcesHumaines;
