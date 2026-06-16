import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { colors } from '../constants';

function Prospection() {
  const [prospects, setProspects] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [nouvelleEntreprise, setNouvelleEntreprise] = useState('');
  const [nouveauSecteur, setNouveauSecteur] = useState('');
  const [nouveauTel, setNouveauTel] = useState('');
  const [typeProspection, setTypeProspection] = useState('EXTERNE');
  const [dateProchainContact, setDateProchainContact] = useState('');

  const fetchProspects = async () => {
    const { data, error } = await supabase.from('prospections').select('*').order('id', { ascending: false });
    if (!error) setProspects(data || []);
    setChargement(false);
  };

  useEffect(() => { fetchProspects(); }, []);

  const ajouterProspect = async (e) => {
    e.preventDefault();
    if (!nouvelleEntreprise) return;
    setChargement(true);
    await supabase.from('prospections').insert([{
      nom_entreprise: nouvelleEntreprise.toUpperCase(),
      secteur_activite: nouveauSecteur,
      contact_telephone: nouveauTel,
      type_prospection: typeProspection,
      etape_pipeline: 'A CONTACTER',
      date_prochain_contact: dateProchainContact || new Date().toISOString().split('T')[0]
    }]);
    setNouvelleEntreprise(''); setNouveauSecteur(''); setNouveauTel(''); setDateProchainContact('');
    fetchProspects();
  };

  const changerEtape = async (id, nouvelleEtape) => {
    await supabase.from('prospections').update({ etape_pipeline: nouvelleEtape }).eq('id', id);
    fetchProspects();
  };

  const formaterDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '---';

  const stats = {
    aContacter: prospects.filter(p => p.etape_pipeline === 'A CONTACTER').length,
    enNego: prospects.filter(p => p.etape_pipeline === 'EN NEGOCIATION' || p.etape_pipeline === 'DEVIS ENVOYE').length,
    gagnes: prospects.filter(p => p.etape_pipeline === 'GAGNE').length,
  };

  return (
    <div className="page-container">
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🎯</span>
        <div>
          <h1 className="page-title">4- SERVICE PROSPECTION</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Stratégie Avant-Vente, Prospection Interne/Externe et Contact Client.</p>
        </div>
      </div>

      <div className="flex-row mb-30">
        <div className="stat-card flex-1" style={{ borderLeft: `5px solid #9ca3af` }}>
          <div className="stat-card-label">Cibles à Contacter</div>
          <div className="stat-card-value">{stats.aContacter}</div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft: `5px solid #f59e0b` }}>
          <div className="stat-card-label">En Négociation / Devis</div>
          <div className="stat-card-value" style={{ color: '#f59e0b' }}>{stats.enNego}</div>
        </div>
        <div className="stat-card flex-1" style={{ borderLeft: `5px solid ${colors.green}` }}>
          <div className="stat-card-label">Marchés Gagnés</div>
          <div className="stat-card-value" style={{ color: colors.green }}>{stats.gagnes}</div>
        </div>
      </div>

      <div className="card card-blue mb-20">
        <h3 className="section-title mb-20">Identifier une nouvelle cible commerciale</h3>
        <form onSubmit={ajouterProspect} className="flex-wrap" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '2 1 200px' }}>
            <label className="form-label">Entreprise Prospect *</label>
            <input type="text" placeholder="Ex: Groupe Hasnaoui" required value={nouvelleEntreprise} onChange={(e) => setNouvelleEntreprise(e.target.value)} className="form-input" />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Secteur</label>
            <input type="text" placeholder="Ex: BTP, Santé..." value={nouveauSecteur} onChange={(e) => setNouveauSecteur(e.target.value)} className="form-input" />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Téléphone Standard</label>
            <input type="text" placeholder="021 XX XX XX" value={nouveauTel} onChange={(e) => setNouveauTel(e.target.value)} className="form-input" />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Type Prospection</label>
            <select value={typeProspection} onChange={(e) => setTypeProspection(e.target.value)} className="form-select">
              <option value="EXTERNE">À froid (Externe)</option>
              <option value="INTERNE">Réseau (Interne)</option>
            </select>
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Prochain Contact 📅</label>
            <input type="date" value={dateProchainContact} onChange={(e) => setDateProchainContact(e.target.value)} className="form-input" />
          </div>
          <button type="submit" disabled={chargement} className="btn btn-primary" style={{ height: '40px' }}>Ajouter au Pipeline</button>
        </form>
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', margin: '-20px -20px 20px -20px', padding: '20px' }}>
          <h3 className="section-title">Pipeline Commercial (Entonnoir de Vente)</h3>
          <p className="text-xs text-muted" style={{ marginTop: '5px' }}>Gérez l'avancement de vos contacts jusqu'à la signature du marché.</p>
        </div>

        {chargement ? <div className="empty-state">Chargement...</div> : (
          <table className="table">
            <thead>
              <tr>
                <th>Prospect / Client Potentiel</th>
                <th>Type & Secteur</th>
                <th>Prochain Contact</th>
                <th>Étape du Pipeline (Action)</th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p, index) => (
                <tr key={p.id} style={{ backgroundColor: p.etape_pipeline === 'GAGNE' ? '#f0fdf4' : (index % 2 === 0 ? 'white' : '#f8fafc') }}>
                  <td>
                    <strong style={{ color: colors.blue, fontSize: '14px' }}>{p.nom_entreprise}</strong><br />
                    <span className="text-muted">📞 {p.contact_telephone || '---'}</span>
                    {p.notes && <div className="text-xs text-muted" style={{ marginTop: '5px', fontStyle: 'italic' }}>Note: {p.notes}</div>}
                  </td>
                  <td>
                    <span className={`badge ${p.type_prospection === 'INTERNE' ? 'badge-success' : 'badge-info'}`}>{p.type_prospection}</span><br />
                    <span className="text-xs text-muted" style={{ display: 'inline-block', marginTop: '5px' }}>{p.secteur_activite}</span>
                  </td>
                  <td className="text-bold">{formaterDate(p.date_prochain_contact)}</td>
                  <td>
                    <select
                      value={p.etape_pipeline}
                      onChange={(e) => changerEtape(p.id, e.target.value)}
                      className="form-select"
                      style={{
                        fontWeight: 'bold',
                        backgroundColor: p.etape_pipeline === 'A CONTACTER' ? '#f3f4f6' : (p.etape_pipeline === 'EN NEGOCIATION' ? '#fef3c7' : (p.etape_pipeline === 'GAGNE' ? '#dcfce7' : 'white')),
                        color: p.etape_pipeline === 'GAGNE' ? '#166534' : '#374151'
                      }}
                    >
                      <option value="A CONTACTER">📞 À Contacter</option>
                      <option value="EN NEGOCIATION">💬 En Négociation (Contact établi)</option>
                      <option value="DEVIS ENVOYE">📄 Devis Envoyé</option>
                      <option value="GAGNE">✅ MARCHÉ GAGNÉ !</option>
                      <option value="PERDU">❌ Marché Perdu</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Prospection;
