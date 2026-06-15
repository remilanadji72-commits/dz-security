import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Recrutement() {
  const { agentsData, fetchToutesLesDonnees } = useDataStore();
  const [sousMenu, setSousMenu] = useState('contrats');
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
  const [rechercheNom, setRechercheNom] = useState('');
  const [rechercheSite, setRechercheSite] = useState('');
  const [rechercheNomArchive, setRechercheNomArchive] = useState('');
  const [rechercheSiteArchive, setRechercheSiteArchive] = useState('');

  const sitesUniques = [...new Set(agentsData.map(a => a.site_affecte).filter(Boolean))].sort();

  const agentsFiltres = agentsData.filter(a => {
    const matchNom = rechercheNom === '' ||
      (a.nom || '').toLowerCase().includes(rechercheNom.toLowerCase()) ||
      (a.matricule || '').toLowerCase().includes(rechercheNom.toLowerCase());
    const matchSite = rechercheSite === '' || (a.site_affecte || '') === rechercheSite;
    return matchNom && matchSite;
  });

  const agentsInactifs = agentsData.filter(a => a.statut_agent === 'INACTIF');
  const sitesUniquesArchive = [...new Set(agentsInactifs.map(a => a.site_affecte).filter(Boolean))].sort();
  const agentsArchivesFiltres = agentsInactifs.filter(a => {
    const matchNom = rechercheNomArchive === '' ||
      (a.nom || '').toLowerCase().includes(rechercheNomArchive.toLowerCase()) ||
      (a.matricule || '').toLowerCase().includes(rechercheNomArchive.toLowerCase());
    const matchSite = rechercheSiteArchive === '' || (a.site_affecte || '') === rechercheSiteArchive;
    return matchNom && matchSite;
  });

  const getJoursRestantsCartePro = (dateStr) => {
    if (!dateStr) return 999;
    return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const recruterAgent = async (e) => {
    e.preventDefault();
    if (!nom || !prenom || !dateEmbauche || !typeContrat) {
      alert("Veuillez remplir les champs obligatoires (Nom, Prénom, Embauche, Contrat).");
      return;
    }
    setChargement(true);
    const { error } = await supabase.from('agents').insert([{
      matricule: matricule || `AG-${Math.floor(Math.random() * 10000)}`,
      nom: nom.toUpperCase() + ' ' + prenom.toUpperCase(),
      prenom: prenom.toUpperCase(),
      date_naissance: dateNaissance || null,
      carte_identite_num: numCin, telephone, wilaya,
      date_recrutement: dateEmbauche, type_contrat: typeContrat,
      date_fin_contrat: typeContrat === 'CDI' ? null : dateFin,
      numero_anem: numAnem, qualification,
      cqp_formation: cqp === 'OUI',
      num_carte_pro: numCartePro,
      validite_carte_pro: validiteCartePro || null,
      site_affecte: siteAffecte || 'En attente',
      statut_agent: 'ACTIF', heure_pointage: '00:00:00'
    }]);
    if (error) {
      alert("Erreur lors de l'enregistrement de la recrue.");
    } else {
      alert(`Agent ${nom} ${prenom} recruté avec succès !`);
      setAfficherFormulaire(false);
      setMatricule(''); setNom(''); setPrenom(''); setDateNaissance(''); setNumCin('');
      setTelephone(''); setWilaya(''); setDateEmbauche(''); setQualification('Agent Simple');
      setCqp('NON'); setNumCartePro(''); setValiditeCartePro('');
      setSiteAffecte(''); setTypeContrat('CDD'); setDateFin(''); setNumAnem('');
      if (fetchToutesLesDonnees) fetchToutesLesDonnees();
    }
    setChargement(false);
  };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>📝</span>
        <div>
          <h1 className="page-title">SERVICE RECRUTEMENT & CARRIÈRE</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Gestion administrative complète : Habilitations, Contrats, Cartes Professionnelles.</p>
        </div>
      </div>

      <div className="nav-tabs">
        <button onClick={() => setSousMenu('contrats')} className={`nav-tab${sousMenu === 'contrats' ? ' active' : ''}`} style={sousMenu === 'contrats' ? { backgroundColor: colors.blue } : {}}>Fiches Personnel & Contrats</button>
        <button onClick={() => setSousMenu('organismes')} className={`nav-tab${sousMenu === 'organismes' ? ' active' : ''}`} style={sousMenu === 'organismes' ? { backgroundColor: colors.green } : {}}>Directions Externes</button>
        <button onClick={() => setSousMenu('inspection')} className={`nav-tab${sousMenu === 'inspection' ? ' active' : ''}`} style={sousMenu === 'inspection' ? { backgroundColor: colors.dark } : {}}>Inspection du Travail</button>
        <button onClick={() => setSousMenu('archives')} className={`nav-tab${sousMenu === 'archives' ? ' active' : ''}`} style={sousMenu === 'archives' ? { backgroundColor: '#6b7280' } : {}}>Archives Personnel</button>
      </div>

      {/* 1. FICHES ET CONTRATS */}
      {sousMenu === 'contrats' && (
        <div className="flex-col">
          {afficherFormulaire && (
            <div className="card card-blue" style={{ boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
              <div className="flex-between mb-20" style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h2 className="section-title">Dossier de Recrutement Complet</h2>
                <button onClick={() => setAfficherFormulaire(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#ef4444' }}>✖ Fermer</button>
              </div>

              <form onSubmit={recruterAgent}>
                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>1. ÉTAT CIVIL & COORDONNÉES</h4>
                <div className="form-section flex-wrap mb-20">
                  {[
                    { label: 'Matricule (الرقم الوظيفي)', val: matricule, set: setMatricule, ph: 'Auto-généré si vide' },
                    { label: 'Nom (اللقب) *', val: nom, set: setNom, req: true },
                    { label: 'Prénom (الاسم) *', val: prenom, set: setPrenom, req: true },
                    { label: 'Date naissance (تاريخ الميلاد)', val: dateNaissance, set: setDateNaissance, type: 'date' },
                    { label: 'N° CIN (رقم البطاقة الوطنية)', val: numCin, set: setNumCin },
                    { label: 'Téléphone (الهاتف)', val: telephone, set: setTelephone },
                    { label: 'Wilaya résidence (ولاية الإقامة)', val: wilaya, set: setWilaya, ph: 'Ex: 16 - Alger' },
                  ].map(({ label, val, set, req, ph, type }) => (
                    <div key={label} style={{ flex: '1 1 150px' }}>
                      <label className="form-label">{label}</label>
                      <input type={type || 'text'} value={val} onChange={(e) => set(e.target.value)} placeholder={ph} required={req} className="form-input" />
                    </div>
                  ))}
                </div>

                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>2. QUALIFICATIONS & HABILITATIONS LÉGALES</h4>
                <div className="form-section form-section-green flex-wrap mb-20">
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label" style={{ color: '#166534' }}>Qualification (المؤهل)</label>
                    <select value={qualification} onChange={(e) => setQualification(e.target.value)} className="form-select">
                      <option value="Agent Simple">Agent Simple</option>
                      <option value="Chef de Groupe">Chef de Groupe</option>
                      <option value="Maître-Chien">Maître-Chien</option>
                      <option value="Convoyeur de Fonds">Convoyeur de Fonds</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label" style={{ color: '#166534' }}>CQP / Formation (شهادة الكفاءة)</label>
                    <select value={cqp} onChange={(e) => setCqp(e.target.value)} className="form-select">
                      <option value="NON">NON OBTENUE</option>
                      <option value="OUI">OUI - CERTIFIÉ</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label" style={{ color: '#166534' }}>N° Carte Pro (رقم البطاقة المهنية)</label>
                    <input type="text" value={numCartePro} onChange={(e) => setNumCartePro(e.target.value)} placeholder="Ex: CP-2025-102" className="form-input" />
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label" style={{ color: '#166534' }}>Validité Carte Pro (صلاحية البطاقة)</label>
                    <input type="date" value={validiteCartePro} onChange={(e) => setValiditeCartePro(e.target.value)} className="form-input" />
                  </div>
                </div>

                <h4 style={{ color: colors.blue, marginBottom: '10px' }}>3. CONTRAT ET AFFECTATION</h4>
                <div className="form-section flex-wrap mb-20" style={{ backgroundColor: '#fdf4ff', borderColor: '#fbcfe8' }}>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label">Date embauche (تاريخ التوظيف) *</label>
                    <input type="date" value={dateEmbauche} onChange={(e) => setDateEmbauche(e.target.value)} required className="form-input" />
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label className="form-label">Type de Contrat *</label>
                    <select value={typeContrat} onChange={(e) => setTypeContrat(e.target.value)} className="form-select">
                      <option value="CDD">CDD</option>
                      <option value="CDI">CDI</option>
                      <option value="CTA (ANEM)">CTA (ANEM)</option>
                    </select>
                  </div>
                  {typeContrat !== 'CDI' && (
                    <div style={{ flex: '1 1 150px' }}>
                      <label className="form-label" style={{ color: '#ef4444' }}>Fin de Contrat *</label>
                      <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required className="form-input" />
                    </div>
                  )}
                  {typeContrat === 'CTA (ANEM)' && (
                    <div style={{ flex: '1 1 150px' }}>
                      <label className="form-label" style={{ color: '#ca8a04' }}>N° ANEM *</label>
                      <input type="text" value={numAnem} onChange={(e) => setNumAnem(e.target.value)} required className="form-input" />
                    </div>
                  )}
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="form-label">Site affecté (الموقع المخصص)</label>
                    <input type="text" value={siteAffecte} onChange={(e) => setSiteAffecte(e.target.value)} placeholder="Ex: Banque BNA" className="form-input" />
                  </div>
                </div>

                <button type="submit" disabled={chargement} className="btn btn-primary btn-full" style={{ textTransform: 'uppercase' }}>
                  💾 Valider et Créer le Dossier Agent
                </button>
              </form>
            </div>
          )}

          <div className="card">
            <div className="flex-between mb-20">
              <h3 className="section-title">Registre Complet du Personnel</h3>
              {!afficherFormulaire && (
                <button onClick={() => setAfficherFormulaire(true)} className="btn btn-primary">
                  ➕ Ajouter une Nouvelle Recrue
                </button>
              )}
            </div>

            {/* BARRE DE RECHERCHE */}
            <div className="flex-row mb-20" style={{ flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label-sm">Nom / Matricule</label>
                <input
                  type="text"
                  value={rechercheNom}
                  onChange={e => setRechercheNom(e.target.value)}
                  placeholder="Rechercher par nom ou matricule..."
                  className="form-input"
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label className="form-label-sm">Site affecté</label>
                <select
                  value={rechercheSite}
                  onChange={e => setRechercheSite(e.target.value)}
                  className="form-select"
                >
                  <option value="">— Tous les sites —</option>
                  {sitesUniques.map(site => (
                    <option key={site} value={site}>{site}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setRechercheNom(''); setRechercheSite(''); }}
                  className="btn btn-secondary btn-sm"
                >
                  ✖ Réinitialiser
                </button>
              </div>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
              {agentsFiltres.length} agent(s) trouvé(s) sur {agentsData.length} au total
            </p>

            <table className="table table-xs">
              <thead>
                <tr>
                  <th>Matricule<br />الرقم الوظيفي</th>
                  <th>Agent & Contact</th>
                  <th>Statut & Contrat<br />الحالة</th>
                  <th>Carte Pro (CQP)<br />تنبيه البطاقة</th>
                  <th>Site affecté<br />الموقع</th>
                </tr>
              </thead>
              <tbody>
                {agentsFiltres.length === 0
                  ? <tr><td colSpan="5" className="empty-state">Aucun agent ne correspond à votre recherche.</td></tr>
                  : agentsFiltres.map((a) => {
                  const joursRestantsCarte = getJoursRestantsCartePro(a.validite_carte_pro);
                  const alerteCarte = joursRestantsCarte <= 60 && a.validite_carte_pro;
                  return (
                    <tr key={`ct-${a.id}`}>
                      <td className="text-bold text-muted">{a.matricule || '---'}</td>
                      <td>
                        <strong style={{ fontSize: '14px', color: colors.dark }}>{a.nom}</strong><br />
                        <span style={{ color: '#4b5563' }}>📞 {a.telephone || '---'}</span>
                      </td>
                      <td>
                        {a.statut_agent === 'ACTIF'
                          ? <span style={{ color: colors.green, fontWeight: 'bold' }}>✅ ACTIF</span>
                          : <span style={{ color: colors.red, fontWeight: 'bold' }}>❌ INACTIF</span>
                        }<br />
                        <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{a.type_contrat || 'CDD'}</span>
                      </td>
                      <td>
                        <span className="text-bold">N° {a.num_carte_pro || '---'}</span>
                        {a.cqp_formation && <span className="badge badge-success" style={{ marginLeft: '5px', fontSize: '9px' }}>CQP OK</span>}<br />
                        {alerteCarte
                          ? <span className="badge badge-danger" style={{ fontSize: '10px' }}>⚠️ Expire: {a.validite_carte_pro}</span>
                          : <span className="text-xxs text-muted">Valide: {a.validite_carte_pro || '---'}</span>
                        }
                      </td>
                      <td className="text-bold" style={{ color: colors.blue }}>{a.site_affecte || '---'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sousMenu === 'organismes' && (
        <div className="card">
          <h3 style={{ marginTop: 0, color: colors.green }}>Directions Externes (ANEM/Santé)</h3>
          <p>Voir le tableau de bord global pour les déclarations ANEM et visites médicales.</p>
        </div>
      )}

      {sousMenu === 'inspection' && (
        <div className="card card-dark">
          <h3 style={{ marginTop: 0, color: colors.dark }}>Registre de l'Inspection du Travail</h3>
          <p>Document légal tenu à la disposition des inspecteurs.</p>
        </div>
      )}

      {sousMenu === 'archives' && (
        <div className="card" style={{ borderTop: '4px solid #6b7280' }}>
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title" style={{ color: '#374151' }}>Archives du Personnel (Sortant)</h3>
              <p className="text-xs text-muted" style={{ marginTop: '5px' }}>Historique légal des agents démissionnaires, licenciés ou retraités.</p>
            </div>
            <button className="btn btn-secondary btn-sm">📥 Exporter Base de Données Globale</button>
          </div>

          {/* BARRE DE RECHERCHE ARCHIVES */}
          <div className="flex-row mb-20" style={{ flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label className="form-label-sm">Nom / Matricule</label>
              <input
                type="text"
                value={rechercheNomArchive}
                onChange={e => setRechercheNomArchive(e.target.value)}
                placeholder="Rechercher par nom ou matricule..."
                className="form-input"
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label className="form-label-sm">Site affecté</label>
              <select
                value={rechercheSiteArchive}
                onChange={e => setRechercheSiteArchive(e.target.value)}
                className="form-select"
              >
                <option value="">— Tous les sites —</option>
                {sitesUniquesArchive.map(site => (
                  <option key={site} value={site}>{site}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setRechercheNomArchive(''); setRechercheSiteArchive(''); }}
                className="btn btn-secondary btn-sm"
              >
                ✖ Réinitialiser
              </button>
            </div>
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
            {agentsArchivesFiltres.length} agent(s) trouvé(s) sur {agentsInactifs.length} archivé(s)
          </p>

          <table className="table table-xs">
            <thead>
              <tr><th>Agent</th><th>Dossier Physique</th><th>Motif de sortie</th><th>Statut Base de données</th></tr>
            </thead>
            <tbody>
              {agentsInactifs.length === 0
                ? <tr><td colSpan="4" className="empty-state">Aucun agent inactif dans les archives.</td></tr>
                : agentsArchivesFiltres.length === 0
                  ? <tr><td colSpan="4" className="empty-state">Aucun agent ne correspond à votre recherche.</td></tr>
                  : agentsArchivesFiltres.map(a => (
                    <tr key={`arc-${a.id}`}>
                      <td className="text-bold">{a.nom}<br /><span style={{ fontSize: '10px', color: '#9ca3af' }}>Mat: {a.matricule}</span></td>
                      <td><span className="badge badge-neutral">Dossier Archivé Box A-12</span></td>
                      <td style={{ color: '#ef4444' }}>Fin de contrat (Non renouvelé)</td>
                      <td style={{ color: '#166534', fontWeight: 'bold' }}>✓ Numérisé et Sauvegardé</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Recrutement;
