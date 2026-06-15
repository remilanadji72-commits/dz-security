import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Inspection() {
  const { contratsData, incidentsData } = useDataStore();
  const [sousMenu, setSousMenu] = useState('visites');
  const [afficherFormulaireAudit, setAfficherFormulaireAudit] = useState(false);
  const [dateAudit, setDateAudit] = useState('');
  const [siteAudit, setSiteAudit] = useState('');
  const [auditsProgrammes, setAuditsProgrammes] = useState([]);
  const [siteVisite, setSiteVisite] = useState(null);
  const [afficherFormControle, setAfficherFormulaireControle] = useState(false);
  const [controleSuperviseur, setControleSuperviseur] = useState('');
  const [controleSite, setControleSite] = useState('');
  const [controleHeure, setControleHeure] = useState('');
  const [controleStatut, setControleStatut] = useState('✅ R.A.S');
  const [controles, setControles] = useState([{ id: 1, superviseur: 'Inspecteur Chef', site: 'Site Principal', heure: '02h30', statut: '✅ R.A.S (Tenue OK)' }]);
  const [afficherFormulaireEscorte, setAfficherFormulaireEscorte] = useState(false);
  const [itineraireDepart, setItineraireDepart] = useState('');
  const [itineraireArrivee, setItineraireArrivee] = useState('');
  const [vehiculeEscorte, setVehiculeEscorte] = useState('');
  const [escortesProgrammees, setEscortesProgrammees] = useState([]);

  const programmerAudit = (e) => {
    e.preventDefault();
    if (!dateAudit || !siteAudit) return;
    setAuditsProgrammes([...auditsProgrammes, { date: dateAudit, site: siteAudit, type: 'AUDIT DE SÉCURITÉ' }]);
    setAfficherFormulaireAudit(false); setDateAudit(''); setSiteAudit('');
  };

  const sauvegarderFicheVisite = (e) => { e.preventDefault(); alert(`Fiche de visite pour ${siteVisite} enregistrée avec succès !`); setSiteVisite(null); };

  const ajouterControle = (e) => {
    e.preventDefault();
    if (!controleSuperviseur || !controleSite || !controleHeure) return;
    setControles([{ id: Date.now(), superviseur: controleSuperviseur, site: controleSite, heure: controleHeure, statut: controleStatut }, ...controles]);
    setAfficherFormulaireControle(false);
    setControleSuperviseur(''); setControleSite(''); setControleHeure(''); setControleStatut('✅ R.A.S');
  };

  const creerOrdreEscorte = (e) => {
    e.preventDefault();
    if (!itineraireDepart || !itineraireArrivee || !vehiculeEscorte) return;
    const ref = `ESC-${Math.floor(Math.random() * 10000)}-2026`;
    setEscortesProgrammees([{ reference: ref, depart: itineraireDepart, arrivee: itineraireArrivee, vehicule: vehiculeEscorte, statut: 'EN PRÉPARATION' }, ...escortesProgrammees]);
    setAfficherFormulaireEscorte(false);
    setItineraireDepart(''); setItineraireArrivee(''); setVehiculeEscorte('');
  };

  const incidentsDuJour = incidentsData ? incidentsData.slice(0, 10) : [];
  const dateRapport = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page-container">
      <div className="hide-on-print page-header mb-20">
        <span style={{ fontSize: '32px' }}>🕵️‍♂️</span>
        <div>
          <h1 className="page-title">SERVICE INSPECTION & AUDIT</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Supervision terrain, Contrôles Jour/Nuit, Rapports d'événements et Escortes.</p>
        </div>
      </div>

      <div className="hide-on-print nav-tabs">
        <button onClick={() => setSousMenu('visites')} className={`nav-tab${sousMenu === 'visites' ? ' active' : ''}`} style={sousMenu === 'visites' ? { backgroundColor: colors.blue } : {}}>Visites & Audits de Sites</button>
        <button onClick={() => setSousMenu('controles')} className={`nav-tab${sousMenu === 'controles' ? ' active' : ''}`} style={sousMenu === 'controles' ? { backgroundColor: colors.dark } : {}}>Contrôle Jour / Nuit</button>
        <button onClick={() => setSousMenu('rapports')} className={`nav-tab${sousMenu === 'rapports' ? ' active' : ''}`} style={sousMenu === 'rapports' ? { backgroundColor: colors.red } : {}}>Rapports des Événements</button>
        <button onClick={() => setSousMenu('escortes')} className={`nav-tab${sousMenu === 'escortes' ? ' active' : ''}`} style={sousMenu === 'escortes' ? { backgroundColor: '#f59e0b' } : {}}>Escorte Produits Sensibles</button>
      </div>

      {sousMenu === 'visites' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <h3 className="section-title">Planification des Visites et Audits DIT</h3>
            {!afficherFormulaireAudit && !siteVisite && (
              <button onClick={() => setAfficherFormulaireAudit(true)} className="btn btn-primary btn-sm">+ Programmer un Audit</button>
            )}
          </div>

          {afficherFormulaireAudit && (
            <form onSubmit={programmerAudit} className="form-section mb-20 flex-row" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', alignItems: 'flex-end' }}>
              <div className="flex-1">
                <label className="form-label-sm">Date Prévue</label>
                <input type="date" value={dateAudit} onChange={(e) => setDateAudit(e.target.value)} required className="form-input" />
              </div>
              <div style={{ flex: 2 }}>
                <label className="form-label-sm">Site à Auditer</label>
                <select value={siteAudit} onChange={(e) => setSiteAudit(e.target.value)} required className="form-select">
                  <option value="">-- Sélectionner un site actif --</option>
                  {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-dark">Valider la Date</button>
            </form>
          )}

          {siteVisite ? (
            <div className="form-section">
              <div className="flex-between mb-15">
                <h3 className="section-title">Rapport de Visite : {siteVisite}</h3>
                <button onClick={() => setSiteVisite(null)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}>✖ Fermer</button>
              </div>
              <form onSubmit={sauvegarderFicheVisite} className="flex-col">
                <div className="flex-row-15">
                  <div className="flex-1">
                    <label className="form-label">Superviseur Inspecteur *</label>
                    <input type="text" placeholder="Nom du contrôleur" required className="form-input" />
                  </div>
                  <div className="flex-1">
                    <label className="form-label">Heure de contrôle *</label>
                    <input type="time" required className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">État de la tenue vestimentaire des agents</label>
                  <select className="form-select">
                    <option value="Conforme">✅ Conforme (Complète et propre)</option>
                    <option value="Non Conforme">❌ Non Conforme (Incomplète)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Présence sur site (Registre & Pointage)</label>
                  <select className="form-select">
                    <option value="Conforme">✅ Conforme au Planning</option>
                    <option value="Absence">❌ Absence constatée</option>
                    <option value="Retard">⚠️ Retard constaté</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Observations générales / Consignes laissées</label>
                  <textarea rows="3" placeholder="Détails de l'inspection..." className="form-input" style={{ fontFamily: 'inherit' }}></textarea>
                </div>
                <button type="submit" className="btn btn-primary btn-full">💾 Sauvegarder la Fiche</button>
              </form>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Date Prévue</th><th>Site (Client)</th><th>Type d'Inspection</th><th className="text-right">Document</th></tr>
              </thead>
              <tbody>
                {auditsProgrammes.map((a, i) => (
                  <tr key={`new-${i}`} style={{ backgroundColor: '#f0fdf4' }}>
                    <td className="text-bold" style={{ color: '#166534' }}>{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                    <td className="text-bold">{a.site}</td>
                    <td><span className="badge badge-info">{a.type}</span></td>
                    <td className="text-right"><button onClick={() => setSiteVisite(a.site)} className="btn btn-outline-success btn-xs">📝 Remplir Fiche</button></td>
                  </tr>
                ))}
                {contratsData.slice(0, 2).map((c, i) => (
                  <tr key={i}>
                    <td className="text-bold">{i === 0 ? "Aujourd'hui" : 'Prochainement'}</td>
                    <td>{c.nom_site}</td>
                    <td><span className="badge badge-info">AUDIT DE SÉCURITÉ</span></td>
                    <td className="text-right"><button onClick={() => setSiteVisite(c.nom_site)} className="btn btn-outline-success btn-xs">📝 Remplir Fiche</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {sousMenu === 'controles' && (
        <div className="card card-dark">
          <div className="flex-between mb-20">
            <h3 className="section-title">Registre des Contrôles Continus (Superviseurs)</h3>
            {!afficherFormControle && (
              <button onClick={() => setAfficherFormulaireControle(true)} className="btn btn-dark btn-sm">+ Saisir un Contrôle</button>
            )}
          </div>

          {afficherFormControle && (
            <form onSubmit={ajouterControle} className="form-section mb-20 flex-wrap" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm">Superviseur *</label>
                <input type="text" placeholder="Ex: Chef de Zone Centre" value={controleSuperviseur} onChange={(e) => setControleSuperviseur(e.target.value)} required className="form-input" />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm">Site Contrôlé *</label>
                <select value={controleSite} onChange={(e) => setControleSite(e.target.value)} required className="form-select">
                  <option value="">-- Site --</option>
                  {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label className="form-label-sm">Heure *</label>
                <input type="time" value={controleHeure} onChange={(e) => setControleHeure(e.target.value)} required className="form-input" />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm">Anomalie Détectée</label>
                <select value={controleStatut} onChange={(e) => setControleStatut(e.target.value)} className="form-select" style={{ fontWeight: 'bold', color: controleStatut.includes('❌') || controleStatut.includes('⚠️') ? '#991b1b' : '#166534', backgroundColor: controleStatut.includes('❌') || controleStatut.includes('⚠️') ? '#fef2f2' : '#f0fdf4' }}>
                  <option value="✅ R.A.S">✅ R.A.S (Tout est conforme)</option>
                  <option value="⚠️ TENUE NON CONFORME">⚠️ Tenue non conforme</option>
                  <option value="❌ ABSENCE CONSTATÉE">❌ Absence constatée</option>
                  <option value="❌ DORTOIR">❌ Agent endormi</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </form>
          )}

          <table className="table">
            <thead>
              <tr><th>Superviseur</th><th>Site Contrôlé</th><th>Heure Passage</th><th>Anomalie Détectée</th></tr>
            </thead>
            <tbody>
              {controles.map((ctrl) => (
                <tr key={ctrl.id}>
                  <td className="text-bold">{ctrl.superviseur}</td>
                  <td>{ctrl.site}</td>
                  <td className="text-bold" style={{ color: colors.blue }}>{ctrl.heure}</td>
                  <td className="text-bold" style={{ color: ctrl.statut.includes('✅') ? '#166534' : '#991b1b' }}>{ctrl.statut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sousMenu === 'rapports' && (
        <div className="card card-red print-planning">
          <div className="hide-on-print flex-between mb-20">
            <h3 className="section-title">Génération des Rapports d'Événements (DG)</h3>
            <button onClick={() => window.print()} className="btn btn-danger btn-sm">🖨️ Imprimer Rapport Journalier (PDF)</button>
          </div>

          <div style={{ border: '2px solid black', padding: '30px', fontFamily: '"Times New Roman", Times, serif' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '20px' }}>
              <h2 style={{ margin: '0 0 5px 0', textTransform: 'uppercase' }}>Direction des Opérations - Synthèse Journalière</h2>
              <h3 style={{ margin: 0, color: '#4b5563' }}>Rapport d'activité du : <span style={{ color: 'black' }}>{dateRapport}</span></h3>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p><strong>À l'attention de :</strong> Monsieur le Directeur Général</p>
              <p><strong>Objet :</strong> Bilan des événements et anomalies remontés par les sites sur les dernières 24h.</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', marginBottom: '30px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '10px', border: '1px solid black', width: '80px' }}>Heure</th>
                  <th style={{ padding: '10px', border: '1px solid black' }}>Site Concerné</th>
                  <th style={{ padding: '10px', border: '1px solid black' }}>Agent / Déclarant</th>
                  <th style={{ padding: '10px', border: '1px solid black' }}>Description de l'anomalie / Incident</th>
                  <th style={{ padding: '10px', border: '1px solid black', width: '100px' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {incidentsDuJour.length > 0 ? incidentsDuJour.map(inc => (
                  <tr key={inc.id}>
                    <td style={{ padding: '10px', border: '1px solid black', fontWeight: 'bold' }}>{inc.heure_incident}</td>
                    <td style={{ padding: '10px', border: '1px solid black', fontWeight: 'bold' }}>{inc.site}</td>
                    <td style={{ padding: '10px', border: '1px solid black' }}>{inc.nom_agent}</td>
                    <td style={{ padding: '10px', border: '1px solid black' }}>{inc.description || 'Appel SOS sans description.'}</td>
                    <td style={{ padding: '10px', border: '1px solid black', fontWeight: 'bold', color: inc.resolu ? 'green' : 'red' }}>{inc.resolu ? 'Traitée' : 'En cours'}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" style={{ padding: '20px', border: '1px solid black', textAlign: 'center', fontStyle: 'italic' }}>Aucun incident significatif à signaler pour cette période (R.A.S sur l'ensemble du réseau).</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }} className="show-only-on-print">
              <div style={{ textAlign: 'center', width: '250px' }}>
                <strong style={{ textDecoration: 'underline' }}>Le Responsable des Opérations</strong>
                <div style={{ height: '80px' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {sousMenu === 'escortes' && (
        <div className="card card-yellow">
          <div className="flex-between mb-20">
            <h3 className="section-title">Missions d'Escorte (Produits Sensibles / Fonds)</h3>
            {!afficherFormulaireEscorte && (
              <button onClick={() => setAfficherFormulaireEscorte(true)} className="btn btn-warning btn-sm">+ Nouvel Ordre d'Escorte</button>
            )}
          </div>

          {afficherFormulaireEscorte && (
            <form onSubmit={creerOrdreEscorte} className="form-section mb-20 flex-wrap" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label-sm" style={{ color: '#b45309' }}>Point de Départ *</label>
                <input type="text" placeholder="Ex: Banque Centrale (Alger)" value={itineraireDepart} onChange={(e) => setItineraireDepart(e.target.value)} required className="form-input" />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label-sm" style={{ color: '#b45309' }}>Point d'Arrivée (Destination) *</label>
                <input type="text" placeholder="Ex: Succursale Oran" value={itineraireArrivee} onChange={(e) => setItineraireArrivee(e.target.value)} required className="form-input" />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label className="form-label-sm" style={{ color: '#b45309' }}>Véhicule Blindé Assigné *</label>
                <input type="text" placeholder="Ex: Matricule ou Code radio" value={vehiculeEscorte} onChange={(e) => setVehiculeEscorte(e.target.value)} required className="form-input" />
              </div>
              <div className="flex-row-sm">
                <button type="button" onClick={() => setAfficherFormulaireEscorte(false)} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-warning">Créer l'Ordre</button>
              </div>
            </form>
          )}

          <table className="table">
            <thead>
              <tr><th>Référence Mission</th><th>Itinéraire (Départ ➔ Arrivée)</th><th>Véhicule Assigné</th><th className="text-right">Statut Escorte</th></tr>
            </thead>
            <tbody>
              {escortesProgrammees.length > 0 ? escortesProgrammees.map((esc, index) => (
                <tr key={index}>
                  <td className="text-bold" style={{ color: '#1e3a8a' }}>{esc.reference}</td>
                  <td><strong>{esc.depart}</strong><br /><span className="text-xs text-muted">Vers: {esc.arrivee}</span></td>
                  <td>{esc.vehicule}</td>
                  <td className="text-right"><span className="badge badge-warning">{esc.statut}</span></td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="empty-state">Aucune mission d'escorte en cours.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Inspection;
