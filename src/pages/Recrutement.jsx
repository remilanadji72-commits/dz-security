import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants';
import { Button, Badge, Card, Table, Modal, useModal } from '../components/ui';

function Recrutement() {
  const { agentsData, fetchToutesLesDonnees } = useDataStore();
  const { t } = useTranslation();
  const [sousMenu, setSousMenu] = useState('contrats');
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const deleteModal = useModal();

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

  const sitesUniques = useMemo(
    () => [...new Set(agentsData.map(a => a.site_affecte).filter(Boolean))].sort(),
    [agentsData]
  );

  const agentsFiltres = useMemo(
    () => agentsData.filter(a => {
      const matchNom = rechercheNom === '' ||
        (a.nom || '').toLowerCase().includes(rechercheNom.toLowerCase()) ||
        (a.matricule || '').toLowerCase().includes(rechercheNom.toLowerCase());
      const matchSite = rechercheSite === '' || (a.site_affecte || '') === rechercheSite;
      return matchNom && matchSite;
    }),
    [agentsData, rechercheNom, rechercheSite]
  );

  const agentsInactifs = useMemo(
    () => agentsData.filter(a => a.statut_agent === 'INACTIF'),
    [agentsData]
  );

  const sitesUniquesArchive = useMemo(
    () => [...new Set(agentsInactifs.map(a => a.site_affecte).filter(Boolean))].sort(),
    [agentsInactifs]
  );

  const agentsArchivesFiltres = useMemo(
    () => agentsInactifs.filter(a => {
      const matchNom = rechercheNomArchive === '' ||
        (a.nom || '').toLowerCase().includes(rechercheNomArchive.toLowerCase()) ||
        (a.matricule || '').toLowerCase().includes(rechercheNomArchive.toLowerCase());
      const matchSite = rechercheSiteArchive === '' || (a.site_affecte || '') === rechercheSiteArchive;
      return matchNom && matchSite;
    }),
    [agentsInactifs, rechercheNomArchive, rechercheSiteArchive]
  );

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
      alert(t('common.error_occurred'));
    } else {
      alert(`${t('common.success_saved')} — ${nom} ${prenom}`);
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
        <button onClick={() => setSousMenu('contrats')}   className={`nav-tab${sousMenu === 'contrats'   ? ' active' : ''}`} style={sousMenu === 'contrats'   ? { backgroundColor: colors.blue }   : {}}>{t('recrutement.tab_personnel')}</button>
        <button onClick={() => setSousMenu('organismes')} className={`nav-tab${sousMenu === 'organismes' ? ' active' : ''}`} style={sousMenu === 'organismes' ? { backgroundColor: colors.green }  : {}}>{t('recrutement.tab_organismes')}</button>
        <button onClick={() => setSousMenu('inspection')} className={`nav-tab${sousMenu === 'inspection' ? ' active' : ''}`} style={sousMenu === 'inspection' ? { backgroundColor: colors.dark }   : {}}>{t('recrutement.tab_inspection')}</button>
        <button onClick={() => setSousMenu('archives')}   className={`nav-tab${sousMenu === 'archives'   ? ' active' : ''}`} style={sousMenu === 'archives'   ? { backgroundColor: '#6b7280' } : {}}>{t('recrutement.tab_archives')}</button>
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

                <Button type="submit" variant="primary" size="full" loading={chargement} style={{ textTransform: 'uppercase' }}>
                  {t('recrutement.submit_btn')}
                </Button>
              </form>
            </div>
          )}

          <Card
            title={t('recrutement.register_title')}
            action={!afficherFormulaire && (
              <Button variant="primary" onClick={() => setAfficherFormulaire(true)}>
                {t('recrutement.add_recruit')}
              </Button>
            )}
          >

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
                <Button variant="secondary" size="sm"
                  onClick={() => { setRechercheNom(''); setRechercheSite(''); }}>
                  ✖ {t('common.reset')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
              {t('common.found_of', { found: agentsFiltres.length, total: agentsData.length })}
            </p>

            <Table
              size="xs"
              headers={[
                t('recrutement.col_matricule'),
                t('recrutement.col_agent'),
                t('recrutement.col_statut'),
                t('recrutement.col_carte'),
                t('recrutement.col_site'),
              ]}
              data={agentsFiltres}
              emptyMessage={t('common.no_results')}
              renderRow={(a) => {
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
                        <Badge variant="neutral" size="xs">{a.type_contrat || 'CDD'}</Badge>
                      </td>
                      <td>
                        <span className="text-bold">N° {a.num_carte_pro || '---'}</span>
                        {a.cqp_formation && <Badge variant="success" size="xs" style={{ marginInlineStart: '5px' }}>CQP ✓</Badge>}
                        <br />
                        {alerteCarte
                          ? <Badge variant="danger" size="xs">⚠️ Expire: {a.validite_carte_pro}</Badge>
                          : <span className="text-xxs text-muted">Valide: {a.validite_carte_pro || '---'}</span>
                        }
                      </td>
                      <td className="text-bold" style={{ color: colors.blue }}>{a.site_affecte || '---'}</td>
                    </tr>
                  );
              }}
            />
          </Card>
        </div>
      )}

      {sousMenu === 'organismes' && (
        <Card variant="green" title={t('recrutement.ext_dirs_title')}>
          <p>{t('recrutement.ext_dirs_title')}</p>
        </Card>
      )}

      {sousMenu === 'inspection' && (
        <Card variant="dark" title={t('recrutement.inspection_title')}>
          <p>Document légal tenu à la disposition des inspecteurs.</p>
        </Card>
      )}

      {sousMenu === 'archives' && (
        <div className="card" style={{ borderTop: '4px solid #6b7280' }}>
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title" style={{ color: '#374151' }}>Archives du Personnel (Sortant)</h3>
              <p className="text-xs text-muted" style={{ marginTop: '5px' }}>Historique légal des agents démissionnaires, licenciés ou retraités.</p>
            </div>
            <Button variant="secondary" size="sm">{t('recrutement.export_db')}</Button>
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
              <Button variant="secondary" size="sm"
                onClick={() => { setRechercheNomArchive(''); setRechercheSiteArchive(''); }}>
                ✖ {t('common.reset')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
            {t('common.found_of', { found: agentsArchivesFiltres.length, total: agentsInactifs.length })}
          </p>

          <Table
            size="xs"
            headers={['Agent', 'Dossier Physique', 'Motif de sortie', 'Statut BDD']}
            data={agentsInactifs.length === 0 ? [] : agentsArchivesFiltres}
            emptyMessage={agentsInactifs.length === 0
              ? t('recrutement.no_archives')
              : t('common.no_results')}
            renderRow={(a) => (
              <tr key={`arc-${a.id}`}>
                <td className="text-bold">
                  {a.nom}<br />
                  <span className="text-xxs text-muted">Mat: {a.matricule}</span>
                </td>
                <td><Badge variant="neutral">Dossier Archivé Box A-12</Badge></td>
                <td style={{ color: '#ef4444' }}>Fin de contrat (Non renouvelé)</td>
                <td><Badge variant="success">✓ Numérisé</Badge></td>
              </tr>
            )}
          />
        </div>
      )}

      {/* Modal de confirmation de suppression (démo Phase 2) */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.close}
        title={t('common.confirm_delete')}
        size="sm"
        danger
        confirmLabel={t('common.delete')}
        onConfirm={() => {
          // logique suppression à brancher en Phase 4
          deleteModal.close();
        }}
      >
        <p>{t('common.confirm_delete')}</p>
      </Modal>
    </div>
  );
}

export default Recrutement;
