import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function MarchesContrats({ colors }) {
  const [contrats, setContrats] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    type_document: 'contrat',
    numero: '',
    titre: '',
    client_id: '',
    objet: '',
    montant: '',
    date_signature: '',
    date_debut: '',
    date_fin: '',
    statut: 'brouillon'
  });
  const [editingId, setEditingId] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const showNotif = (msg, type = 'success') => {
    setNotification({ show: true, message: msg, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const fetchContrats = async () => {
    const { data, error } = await supabase
      .from('contrats')
      .select('*, clients(raison_sociale)')
      .order('created_at', { ascending: false });
    if (!error) setContrats(data || []);
  };
  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('id, raison_sociale');
    if (data) setClients(data);
  };

  useEffect(() => {
    fetchContrats();
    fetchClients();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      montant: form.montant ? parseFloat(form.montant) : null
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from('contrats').update(payload).eq('id', editingId));
      if (!error) showNotif('✅ Contrat modifié');
    } else {
      ({ error } = await supabase.from('contrats').insert([payload]));
      if (!error) showNotif('✅ Contrat ajouté');
    }
    if (error) {
      showNotif('❌ Erreur : ' + error.message, 'error');
    } else {
      resetForm();
      fetchContrats();
    }
  };

  const resetForm = () => {
    setForm({
      type_document: 'contrat',
      numero: '',
      titre: '',
      client_id: '',
      objet: '',
      montant: '',
      date_signature: '',
      date_debut: '',
      date_fin: '',
      statut: 'brouillon'
    });
    setEditingId(null);
  };

  const editContrat = (c) => {
    setEditingId(c.id);
    setForm({
      type_document: c.type_document,
      numero: c.numero,
      titre: c.titre || '',
      client_id: c.client_id || '',
      objet: c.objet || '',
      montant: c.montant || '',
      date_signature: c.date_signature || '',
      date_debut: c.date_debut || '',
      date_fin: c.date_fin || '',
      statut: c.statut
    });
  };

  const deleteContrat = async (id, numero) => {
    if (window.confirm(`Supprimer le contrat ${numero} ?`)) {
      const { error } = await supabase.from('contrats').delete().eq('id', id);
      if (!error) {
        showNotif(`Contrat ${numero} supprimé`);
        fetchContrats();
      } else showNotif('Erreur suppression', 'error');
    }
  };

  const uploadPDF = async (file, contratId) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${contratId}_${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('contrats_pdf').upload(fileName, file);
    if (!error) {
      const { data: publicUrl } = supabase.storage.from('contrats_pdf').getPublicUrl(fileName);
      await supabase.from('contrats').update({ fichier_pdf: publicUrl.publicUrl }).eq('id', contratId);
      fetchContrats();
      showNotif('PDF uploadé');
    } else {
      showNotif('Erreur upload PDF', 'error');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {notification.show && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          backgroundColor: notification.type === 'error' ? '#ef4444' : '#10b981',
          color: 'white', padding: '12px 24px', borderRadius: '8px'
        }}>{notification.message}</div>
      )}

      <h2 style={{ color: colors.blue }}>📄 Marchés, contrats & conventions</h2>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderTop: `4px solid ${colors.blue}` }}>
        <h3>{editingId ? '✏️ Modifier' : '➕ Nouveau document'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            <select name="type_document" value={form.type_document} onChange={handleChange} required style={{ flex: 1, padding: '10px' }}>
              <option value="marche">Marché</option>
              <option value="contrat">Contrat</option>
              <option value="convention">Convention</option>
            </select>
            <input name="numero" placeholder="N° document *" value={form.numero} onChange={handleChange} required style={{ flex: 1, padding: '10px' }} />
            <input name="titre" placeholder="Titre" value={form.titre} onChange={handleChange} style={{ flex: 2, padding: '10px' }} />
            <select name="client_id" value={form.client_id} onChange={handleChange} style={{ flex: 1, padding: '10px' }}>
              <option value="">Client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
            <textarea name="objet" placeholder="Objet" value={form.objet} onChange={handleChange} rows="2" style={{ flex: 3, padding: '10px' }} />
            <input name="montant" type="number" placeholder="Montant (DA)" value={form.montant} onChange={handleChange} style={{ flex: 1, padding: '10px' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
            <input type="date" name="date_signature" value={form.date_signature} onChange={handleChange} style={{ flex: 1, padding: '10px' }} />
            <input type="date" name="date_debut" value={form.date_debut} onChange={handleChange} style={{ flex: 1, padding: '10px' }} />
            <input type="date" name="date_fin" value={form.date_fin} onChange={handleChange} style={{ flex: 1, padding: '10px' }} />
            <select name="statut" value={form.statut} onChange={handleChange} style={{ flex: 1, padding: '10px' }}>
              <option value="brouillon">Brouillon</option>
              <option value="en_cours">En cours</option>
              <option value="signe">Signé</option>
              <option value="expire">Expiré</option>
            </select>
            <button type="submit" style={{ backgroundColor: colors.blue, color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px' }}>
              {editingId ? 'Mettre à jour' : 'Créer'}
            </button>
            {editingId && <button type="button" onClick={resetForm} style={{ backgroundColor: 'gray', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px' }}>Annuler</button>}
          </div>
        </form>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h3 style={{ padding: '15px' }}>📋 Liste des documents</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th style={{ padding: '12px' }}>Type</th><th>N°</th><th>Titre</th><th>Client</th><th>Montant</th><th>Dates</th><th>Statut</th><th>PDF</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contrats.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '10px' }}>{c.type_document}</td>
                <td>{c.numero}</td>
                <td>{c.titre}</td>
                <td>{c.clients?.raison_sociale || '-'}</td>
                <td>{c.montant?.toLocaleString()} DA</td>
                <td style={{ fontSize: '12px' }}>Sign.: {c.date_signature}<br/>Début: {c.date_debut}<br/>Fin: {c.date_fin}</td>
                <td>
                  <span style={{
                    padding: '4px 8px', borderRadius: '12px',
                    backgroundColor: c.statut === 'signe' ? '#dcfce7' : c.statut === 'en_cours' ? '#dbeafe' : c.statut === 'expire' ? '#fee2e2' : '#fef3c7',
                    color: c.statut === 'signe' ? '#166534' : c.statut === 'en_cours' ? '#1e40af' : '#92400e'
                  }}>{c.statut}</span>
                </td>
                <td>
                  {c.fichier_pdf ? <a href={c.fichier_pdf} target="_blank" rel="noreferrer">📄 Voir</a> :
                    <input type="file" accept="application/pdf" onChange={(e) => e.target.files[0] && uploadPDF(e.target.files[0], c.id)} style={{ width: '80px' }} />}
                </td>
                <td>
                  <button onClick={() => editContrat(c)} style={{ background: colors.green, color: 'white', border: 'none', padding: '5px 10px', marginRight: '5px', borderRadius: '4px' }}>✏️</button>
                  <button onClick={() => deleteContrat(c.id, c.numero)} style={{ background: colors.red, color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MarchesContrats;