import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

// ── Constantes ─────────────────────────────────────────────────────────────────
const TAILLES       = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const ETATS         = ['BON', 'USÉ', 'DÉTRUIT', 'PERDU'];
const ETAT_STYLE    = {
  BON:      { bg: '#dcfce7', color: '#15803d', icon: '✅' },
  'USÉ':    { bg: '#fef9c3', color: '#854d0e', icon: '⚠️' },
  DÉTRUIT:  { bg: '#fee2e2', color: '#991b1b', icon: '❌' },
  PERDU:    { bg: '#f1f5f9', color: '#475569', icon: '🔍' },
};

const FORM_ARTICLE_VIDE = {
  code_article: '', designation: '', taille: 'L',
  prix_unitaire: '', duree_vie_mois: 24, stock_minimum: 5,
};

const FORM_EXEMPLAIRE_VIDE  = { article_id: '', quantite: 1, date_reception: '' };
const FORM_ATTRIBUTION_VIDE = { exemplaire_id: '', agent_id: '', notes: '' };
const FORM_RETOUR_VIDE      = { etat_retour: 'BON', notes: '' };

// ── Helpers ────────────────────────────────────────────────────────────────────
const dateAuj = () => new Date().toISOString().split('T')[0];
const dateFr  = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function joursRestants(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function BadgeEtat({ etat }) {
  const s = ETAT_STYLE[etat] || { bg: '#f1f5f9', color: '#6b7280', icon: '❓' };
  return (
    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '700',
      backgroundColor: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.icon} {etat}
    </span>
  );
}

// ── Génération matricule automatique T-AAAA-NNN ────────────────────────────────
async function genererMatricule() {
  const year   = new Date().getFullYear();
  const prefix = `T-${year}-`;
  const { data } = await supabase
    .from('exemplaires_tenues')
    .select('matricule')
    .ilike('matricule', `${prefix}%`)
    .order('matricule', { ascending: false })
    .limit(1);
  const lastNum = data?.length ? parseInt(data[0].matricule.split('-')[2]) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`;
}

// ════════════════════════════════════════════════════════════════════════════════
export default function Tenues() {
  const { agentsData } = useDataStore();

  const [onglet, setOnglet]       = useState('catalogue');
  const [loading, setLoading]     = useState(false);
  const [recherche, setRecherche] = useState('');

  // Données DB
  const [articles,   setArticles]   = useState([]);
  const [exemplaires,setExemplaires]= useState([]);
  const [historique, setHistorique] = useState([]);

  // Formulaires
  const [showFrmA, setShowFrmA]   = useState(false);
  const [frmA, setFrmA]           = useState(FORM_ARTICLE_VIDE);

  const [showFrmE, setShowFrmE]   = useState(false);
  const [frmE, setFrmE]           = useState(FORM_EXEMPLAIRE_VIDE);

  const [articleFiltreAttrib, setArticleFiltreAttrib] = useState('');
  const [frmAttrib, setFrmAttrib] = useState(FORM_ATTRIBUTION_VIDE);

  const [exemplaireRetour, setExemplaireRetour] = useState(null); // exemplaire en cours de retour
  const [frmRetour, setFrmRetour] = useState(FORM_RETOUR_VIDE);

  // ── Fetchers ─────────────────────────────────────────────────────────────────
  const fetchArticles = async () => {
    const { data } = await supabase.from('articles_tenues').select('*').order('designation');
    if (data) setArticles(data);
  };

  const fetchExemplaires = async () => {
    const { data } = await supabase
      .from('exemplaires_tenues')
      .select('*, articles_tenues(designation, taille, duree_vie_mois), agents(nom, matricule, site_affecte)')
      .order('matricule', { ascending: false });
    if (data) setExemplaires(data);
  };

  const fetchHistorique = async () => {
    const { data } = await supabase
      .from('attributions_tenues')
      .select('*, exemplaires_tenues(matricule, articles_tenues(designation)), agents(nom, matricule)')
      .order('date_attribution', { ascending: false });
    if (data) setHistorique(data);
  };

  const rafraichir = async () => {
    setLoading(true);
    await Promise.all([fetchArticles(), fetchExemplaires(), fetchHistorique()]);
    setLoading(false);
  };

  useEffect(() => { rafraichir(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPI ──────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => ({
    total:      exemplaires.length,
    attribues:  exemplaires.filter(e => e.agent_id).length,
    disponibles:exemplaires.filter(e => !e.agent_id && e.etat === 'BON').length,
    alerteVie:  exemplaires.filter(e => { const j = joursRestants(e.date_fin_vie); return j !== null && j <= 30 && j >= 0; }).length,
    stockBas:   articles.filter(a => {
      const dispo = exemplaires.filter(e => e.article_id === a.id && !e.agent_id && e.etat === 'BON').length;
      return dispo < (a.stock_minimum || 5);
    }).length,
  }), [exemplaires, articles]);

  // ── Exemplaires filtrés (recherche) ──────────────────────────────────────────
  const exemplairesFiltes = useMemo(() => {
    if (!recherche.trim()) return exemplaires;
    const q = recherche.toLowerCase();
    return exemplaires.filter(e =>
      e.matricule?.toLowerCase().includes(q) ||
      e.articles_tenues?.designation?.toLowerCase().includes(q) ||
      e.agents?.nom?.toLowerCase().includes(q) ||
      e.agents?.matricule?.toLowerCase().includes(q)
    );
  }, [exemplaires, recherche]);

  // ── Exemplaires disponibles pour attribution ──────────────────────────────────
  const exemplairesDispo = useMemo(() =>
    exemplaires.filter(e =>
      !e.agent_id &&
      e.etat === 'BON' &&
      (!articleFiltreAttrib || e.article_id === parseInt(articleFiltreAttrib))
    ), [exemplaires, articleFiltreAttrib]);

  // ── Alertes ───────────────────────────────────────────────────────────────────
  const alertesStockBas = useMemo(() =>
    articles.map(a => {
      const dispo = exemplaires.filter(e => e.article_id === a.id && !e.agent_id && e.etat === 'BON').length;
      return { ...a, dispo, alerte: dispo < (a.stock_minimum || 5) };
    }).filter(a => a.alerte),
    [articles, exemplaires]
  );

  const alertesFinVie = useMemo(() =>
    exemplaires
      .map(e => ({ ...e, jr: joursRestants(e.date_fin_vie) }))
      .filter(e => e.jr !== null && e.jr <= 30),
    [exemplaires]
  );

  // ── Actions ───────────────────────────────────────────────────────────────────
  const ajouterArticle = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('articles_tenues').insert([{
      ...frmA,
      prix_unitaire:  parseFloat(frmA.prix_unitaire) || 0,
      duree_vie_mois: parseInt(frmA.duree_vie_mois)  || 24,
      stock_minimum:  parseInt(frmA.stock_minimum)   || 5,
    }]);
    if (error) { alert('Erreur : ' + (error.message || 'code article peut-être déjà utilisé.')); }
    else { setFrmA(FORM_ARTICLE_VIDE); setShowFrmA(false); await fetchArticles(); }
    setLoading(false);
  };

  const ajouterExemplaires = async (ev) => {
    ev.preventDefault();
    setLoading(true);
    const qty          = parseInt(frmE.quantite) || 1;
    const art          = articles.find(a => a.id === parseInt(frmE.article_id));
    const dureeVie     = art?.duree_vie_mois || 24;
    const dateRecep    = frmE.date_reception || dateAuj();
    const dateFinVie   = new Date(dateRecep);
    dateFinVie.setMonth(dateFinVie.getMonth() + dureeVie);

    let ok = 0;
    for (let i = 0; i < qty; i++) {
      const matricule = await genererMatricule();
      const { error } = await supabase.from('exemplaires_tenues').insert([{
        matricule,
        article_id:     parseInt(frmE.article_id),
        date_reception: dateRecep,
        etat:           'BON',
        date_fin_vie:   dateFinVie.toISOString().split('T')[0],
      }]);
      if (!error) ok++;
    }
    alert(`✅ ${ok}/${qty} exemplaire(s) créé(s) avec matricule T-AAAA-NNN automatique.`);
    setFrmE(FORM_EXEMPLAIRE_VIDE);
    setShowFrmE(false);
    await fetchExemplaires();
    setLoading(false);
  };

  const attribuerTenue = async (ev) => {
    ev.preventDefault();
    if (!frmAttrib.exemplaire_id || !frmAttrib.agent_id) return;
    setLoading(true);
    const today = dateAuj();
    // Enregistrer l'attribution dans l'historique
    const { error: errH } = await supabase.from('attributions_tenues').insert([{
      exemplaire_id:   parseInt(frmAttrib.exemplaire_id),
      agent_id:        parseInt(frmAttrib.agent_id),
      date_attribution: today,
      notes:           frmAttrib.notes || null,
    }]);
    if (errH) { alert('Erreur historique : ' + errH.message); setLoading(false); return; }
    // Mettre à jour l'exemplaire
    const { error: errE } = await supabase.from('exemplaires_tenues')
      .update({ agent_id: parseInt(frmAttrib.agent_id), date_attribution: today })
      .eq('id', parseInt(frmAttrib.exemplaire_id));
    if (errE) { alert('Erreur exemplaire : ' + errE.message); }
    else { alert('✅ Tenue attribuée avec succès !'); setFrmAttrib(FORM_ATTRIBUTION_VIDE); setArticleFiltreAttrib(''); }
    await rafraichir();
    setLoading(false);
  };

  const ouvrirRetour = (ex) => {
    setExemplaireRetour(ex);
    setFrmRetour(FORM_RETOUR_VIDE);
  };

  const validerRetour = async (ev) => {
    ev.preventDefault();
    if (!exemplaireRetour) return;
    setLoading(true);
    const today = dateAuj();
    // Mettre à jour l'enregistrement historique ouvert (sans date_retour)
    await supabase.from('attributions_tenues')
      .update({ date_retour: today, etat_retour: frmRetour.etat_retour, notes: frmRetour.notes || null })
      .eq('exemplaire_id', exemplaireRetour.id)
      .is('date_retour', null);
    // Remettre l'exemplaire en stock
    await supabase.from('exemplaires_tenues')
      .update({ agent_id: null, date_attribution: null, etat: frmRetour.etat_retour })
      .eq('id', exemplaireRetour.id);
    setExemplaireRetour(null);
    alert('✅ Tenue retournée — état enregistré.');
    await rafraichir();
    setLoading(false);
  };

  const majEtatExemplaire = async (id, etat) => {
    await supabase.from('exemplaires_tenues').update({ etat }).eq('id', id);
    await fetchExemplaires();
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  const INPUT  = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
  const LABEL  = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase' };
  const TH     = (bg = '#1e3a8a') => ({ padding: '10px 14px', backgroundColor: bg, color: 'white', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', textAlign: 'left' });
  const TD     = { padding: '10px 14px', fontSize: '13px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
  const GRID   = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px' };
  const PANEL_FRM = { backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' };

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>👕</span>
        <div>
          <h1 className="page-title">GESTION DES TENUES</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Catalogue · Exemplaires (matricule T-AAAA-NNN) · Attributions · Historique · Alertes
          </p>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total exemplaires', value: kpi.total,       icon: '👕', bg: '#dbeafe', color: '#1d4ed8' },
          { label: 'Attribués',         value: kpi.attribues,   icon: '🧍', bg: '#dcfce7', color: '#15803d' },
          { label: 'En stock (BON)',    value: kpi.disponibles, icon: '📦', bg: '#f0fdf4', color: '#166534' },
          { label: 'Fin de vie <30j',  value: kpi.alerteVie,   icon: '⏳', bg: '#fef9c3', color: '#854d0e' },
          { label: 'Stock bas',        value: kpi.stockBas,    icon: '🔴', bg: '#fee2e2', color: '#991b1b' },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{k.icon}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>{k.label}</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barre de recherche rapide */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}>🔍</span>
          <input
            type="text"
            placeholder="Recherche rapide : matricule tenue (T-2025-001), nom agent, matricule agent, désignation…"
            value={recherche}
            onChange={e => { setRecherche(e.target.value); setOnglet('exemplaires'); }}
            style={{ ...INPUT, paddingLeft: '38px', fontSize: '13px' }}
          />
        </div>
        {recherche && (
          <button onClick={() => setRecherche('')}
            style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>
            ✕ Effacer
          </button>
        )}
        <button onClick={rafraichir} style={{ padding: '9px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}>
          🔄
        </button>
      </div>

      {/* Onglets */}
      <div className="nav-tabs">
        {[
          { key: 'catalogue',   label: '📂 Catalogue',         bg: colors.blue },
          { key: 'exemplaires', label: `📦 Exemplaires (${exemplaires.length})`, bg: colors.dark },
          { key: 'attribution', label: '🤝 Attribution',        bg: colors.green },
          { key: 'historique',  label: '📜 Historique',         bg: '#8b5cf6' },
          { key: 'alertes',     label: `🔔 Alertes (${kpi.alerteVie + kpi.stockBas})`, bg: colors.red },
        ].map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)}
            className={`nav-tab${onglet === t.key ? ' active' : ''}`}
            style={onglet === t.key ? { backgroundColor: t.bg } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════ ONGLET 1 : CATALOGUE ════════════ */}
      {onglet === 'catalogue' && (
        <div className="card card-blue">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Catalogue des Articles</h3>
              <p className="text-sm text-muted" style={{ marginTop: '4px' }}>Référentiel des tenues (code, désignation, taille, prix, durée de vie).</p>
            </div>
            <button onClick={() => setShowFrmA(v => !v)}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              {showFrmA ? '✕ Annuler' : '＋ Nouvel article'}
            </button>
          </div>

          {showFrmA && (
            <form onSubmit={ajouterArticle} style={{ ...PANEL_FRM, border: '1px solid #bfdbfe', backgroundColor: '#f0f7ff' }}>
              <div style={GRID}>
                {[
                  { k: 'code_article',   l: 'Code article',     t: 'text',   req: true, ph: 'VH-001' },
                  { k: 'designation',    l: 'Désignation',      t: 'text',   req: true, ph: 'Veste Hiver' },
                  { k: 'prix_unitaire',  l: 'Prix unitaire (DA)', t: 'number', ph: '0' },
                  { k: 'duree_vie_mois', l: 'Durée de vie (mois)', t: 'number', ph: '24' },
                  { k: 'stock_minimum',  l: 'Stock minimum alerte', t: 'number', ph: '5' },
                ].map(f => (
                  <div key={f.k}>
                    <label style={LABEL}>{f.l}{f.req && <span style={{ color: '#ef4444' }}> *</span>}</label>
                    <input type={f.t} required={!!f.req} placeholder={f.ph}
                      value={frmA[f.k]} onChange={e => setFrmA(p => ({ ...p, [f.k]: e.target.value }))} style={INPUT} />
                  </div>
                ))}
                <div>
                  <label style={LABEL}>Taille <span style={{ color: '#ef4444' }}>*</span></label>
                  <select value={frmA.taille} onChange={e => setFrmA(p => ({ ...p, taille: e.target.value }))} style={INPUT} required>
                    {TAILLES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowFrmA(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" disabled={loading}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1d4ed8', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  💾 Enregistrer
                </button>
              </div>
            </form>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Code article', 'Désignation', 'Taille', 'Prix (DA)', 'Durée vie', 'Stock min', 'En stock BON', 'Attribués'].map(h => (
                    <th key={h} style={TH()}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {articles.length === 0 ? (
                  <tr><td colSpan="8" className="empty-state">Aucun article dans le catalogue.</td></tr>
                ) : articles.map((a, i) => {
                  const enStock   = exemplaires.filter(e => e.article_id === a.id && !e.agent_id && e.etat === 'BON').length;
                  const attribues = exemplaires.filter(e => e.article_id === a.id && !!e.agent_id).length;
                  const alerte    = enStock < (a.stock_minimum || 5);
                  return (
                    <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '700', color: '#1e3a8a' }}>{a.code_article}</td>
                      <td style={{ ...TD, fontWeight: '600' }}>{a.designation}</td>
                      <td style={TD}><span style={{ padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: '700' }}>{a.taille}</span></td>
                      <td style={{ ...TD, textAlign: 'right' }}>{a.prix_unitaire ? Number(a.prix_unitaire).toLocaleString('fr-FR') + ' DA' : '—'}</td>
                      <td style={TD}>{a.duree_vie_mois} mois</td>
                      <td style={{ ...TD, textAlign: 'center' }}>{a.stock_minimum}</td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: '800', color: alerte ? '#991b1b' : '#15803d', backgroundColor: alerte ? '#fff5f5' : '#f0fdf4' }}>
                        {alerte && '⚠️ '}{enStock}
                      </td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: '700', color: '#1d4ed8' }}>{attribues}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ ONGLET 2 : EXEMPLAIRES ════════════ */}
      {onglet === 'exemplaires' && (
        <div className="card card-neutral">
          <div className="flex-between mb-20">
            <div>
              <h3 className="section-title">Exemplaires — Inventaire individuel</h3>
              <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
                Chaque exemplaire a un matricule unique format <strong>T-AAAA-NNN</strong>.
                {recherche && <span style={{ color: '#1d4ed8' }}> — Filtre actif : « {recherche} »</span>}
              </p>
            </div>
            <button onClick={() => setShowFrmE(v => !v)}
              style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: colors.dark, color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              {showFrmE ? '✕ Annuler' : '＋ Réceptionner des exemplaires'}
            </button>
          </div>

          {showFrmE && (
            <form onSubmit={ajouterExemplaires} style={PANEL_FRM}>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#6b7280' }}>
                Les matricules <strong>T-AAAA-NNN</strong> sont générés automatiquement à la réception.
              </p>
              <div style={GRID}>
                <div>
                  <label style={LABEL}>Article <span style={{ color: '#ef4444' }}>*</span></label>
                  <select required value={frmE.article_id} onChange={e => setFrmE(p => ({ ...p, article_id: e.target.value }))} style={INPUT}>
                    <option value="">— Choisir un article —</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{a.code_article} — {a.designation} ({a.taille})</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Quantité réceptionnée <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="number" min="1" max="100" required value={frmE.quantite}
                    onChange={e => setFrmE(p => ({ ...p, quantite: e.target.value }))} style={INPUT} />
                </div>
                <div>
                  <label style={LABEL}>Date de réception</label>
                  <input type="date" value={frmE.date_reception} onChange={e => setFrmE(p => ({ ...p, date_reception: e.target.value }))} style={INPUT} />
                </div>
              </div>
              <div style={{ marginTop: '14px', padding: '10px 14px', backgroundColor: '#fef9c3', borderRadius: '8px', fontSize: '12px', color: '#92400e', border: '1px solid #fcd34d' }}>
                💡 La date de fin de vie sera calculée automatiquement : date réception + durée de vie de l'article.
              </div>
              <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowFrmE(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" disabled={loading}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: colors.dark, color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                  📥 Réceptionner {frmE.quantite > 1 ? `(${frmE.quantite} ex.)` : ''}
                </button>
              </div>
            </form>
          )}

          {/* Modal retour */}
          {exemplaireRetour && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', width: '90%', maxWidth: '420px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '17px' }}>📥 Retour de tenue</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#6b7280' }}>
                  Matricule : <strong>{exemplaireRetour.matricule}</strong><br />
                  Agent : <strong>{exemplaireRetour.agents?.nom}</strong>
                </p>
                <form onSubmit={validerRetour} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={LABEL}>État de retour <span style={{ color: '#ef4444' }}>*</span></label>
                    <select required value={frmRetour.etat_retour}
                      onChange={e => setFrmRetour(p => ({ ...p, etat_retour: e.target.value }))} style={INPUT}>
                      {ETATS.map(et => <option key={et}>{et}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Notes / Observations</label>
                    <textarea rows="2" placeholder="R.A.S" value={frmRetour.notes}
                      onChange={e => setFrmRetour(p => ({ ...p, notes: e.target.value }))}
                      style={{ ...INPUT, resize: 'vertical', minHeight: '60px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => setExemplaireRetour(null)}
                      style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>Annuler</button>
                    <button type="submit" disabled={loading}
                      style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                      ✅ Valider le retour
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Matricule', 'Article', 'Taille', 'Date réception', 'Fin de vie', 'État', 'Agent actuel', 'Depuis', 'Actions'].map(h => (
                    <th key={h} style={TH('#374151')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exemplairesFiltes.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state">
                    {recherche ? `Aucun résultat pour « ${recherche} ».` : 'Aucun exemplaire enregistré.'}
                  </td></tr>
                ) : exemplairesFiltes.map((ex, i) => {
                  const jr        = joursRestants(ex.date_fin_vie);
                  const alerteVie = jr !== null && jr <= 30;
                  return (
                    <tr key={ex.id} style={{ backgroundColor: alerteVie ? '#fffbeb' : i % 2 === 0 ? 'white' : '#f8fafc' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '800', color: '#1e3a8a', fontSize: '14px' }}>
                        {ex.matricule}
                      </td>
                      <td style={{ ...TD, fontWeight: '600' }}>{ex.articles_tenues?.designation || '—'}</td>
                      <td style={TD}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '700' }}>
                          {ex.articles_tenues?.taille || ex.taille || '—'}
                        </span>
                      </td>
                      <td style={TD}>{dateFr(ex.date_reception)}</td>
                      <td style={{ ...TD, color: alerteVie ? '#991b1b' : 'inherit', fontWeight: alerteVie ? '700' : 'normal' }}>
                        {dateFr(ex.date_fin_vie)}
                        {alerteVie && <span style={{ fontSize: '11px', display: 'block', color: '#991b1b' }}>⏳ {jr}j restant(s)</span>}
                      </td>
                      <td style={TD}>
                        <select value={ex.etat} onChange={e => majEtatExemplaire(ex.id, e.target.value)}
                          style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '800',
                            backgroundColor: (ETAT_STYLE[ex.etat] || ETAT_STYLE.BON).bg,
                            color: (ETAT_STYLE[ex.etat] || ETAT_STYLE.BON).color }}>
                          {ETATS.map(et => <option key={et}>{et}</option>)}
                        </select>
                      </td>
                      <td style={TD}>
                        {ex.agents ? (
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '13px' }}>{ex.agents.nom}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{ex.agents.matricule} · {ex.agents.site_affecte}</div>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>Stock — disponible</span>}
                      </td>
                      <td style={TD}>{ex.date_attribution ? dateFr(ex.date_attribution) : '—'}</td>
                      <td style={TD}>
                        {ex.agent_id && (
                          <button onClick={() => ouvrirRetour(ex)}
                            style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fff5f5', color: '#991b1b', cursor: 'pointer', fontWeight: '700', whiteSpace: 'nowrap' }}>
                            📥 Retour
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ ONGLET 3 : ATTRIBUTION ════════════ */}
      {onglet === 'attribution' && (
        <div className="card card-green">
          <h3 className="section-title mb-20">🤝 Attribuer une tenue à un agent</h3>

          <form onSubmit={attribuerTenue} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Étape 1 : Filtrer par article */}
            <div style={{ ...PANEL_FRM, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
              <p style={{ margin: '0 0 12px 0', fontWeight: '700', fontSize: '13px', color: '#166534' }}>
                Étape 1 — Sélectionner l'article (optionnel, pour filtrer les exemplaires disponibles)
              </p>
              <div style={GRID}>
                <div>
                  <label style={LABEL}>Filtrer par article</label>
                  <select value={articleFiltreAttrib} onChange={e => { setArticleFiltreAttrib(e.target.value); setFrmAttrib(p => ({ ...p, exemplaire_id: '' })); }} style={INPUT}>
                    <option value="">— Tous les articles —</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{a.code_article} — {a.designation} ({a.taille})</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Étape 2 : Sélectionner exemplaire et agent */}
            <div style={{ ...PANEL_FRM, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4' }}>
              <p style={{ margin: '0 0 12px 0', fontWeight: '700', fontSize: '13px', color: '#166534' }}>
                Étape 2 — Sélectionner l'exemplaire et l'agent
              </p>
              <div style={GRID}>
                <div>
                  <label style={LABEL}>Exemplaire disponible (BON) <span style={{ color: '#ef4444' }}>*</span></label>
                  <select required value={frmAttrib.exemplaire_id} onChange={e => setFrmAttrib(p => ({ ...p, exemplaire_id: e.target.value }))} style={INPUT}>
                    <option value="">— {exemplairesDispo.length} disponible(s) —</option>
                    {exemplairesDispo.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.matricule} · {ex.articles_tenues?.designation} ({ex.articles_tenues?.taille})
                      </option>
                    ))}
                  </select>
                  {exemplairesDispo.length === 0 && (
                    <p style={{ fontSize: '12px', color: '#991b1b', margin: '6px 0 0 0' }}>⚠️ Aucun exemplaire BON disponible pour cet article.</p>
                  )}
                </div>
                <div>
                  <label style={LABEL}>Agent bénéficiaire <span style={{ color: '#ef4444' }}>*</span></label>
                  <select required value={frmAttrib.agent_id} onChange={e => setFrmAttrib(p => ({ ...p, agent_id: e.target.value }))} style={INPUT}>
                    <option value="">— Choisir un agent —</option>
                    {agentsData.filter(a => a.statut_agent === 'ACTIF').map(a => (
                      <option key={a.id} value={a.id}>{a.nom} {a.prenom} — {a.matricule} ({a.site_affecte})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Notes</label>
                  <input type="text" placeholder="Ex : Prise de poste, renouvellement…" value={frmAttrib.notes}
                    onChange={e => setFrmAttrib(p => ({ ...p, notes: e.target.value }))} style={INPUT} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={loading || !frmAttrib.exemplaire_id || !frmAttrib.agent_id}
                style={{ padding: '12px 28px', borderRadius: '10px', border: 'none', backgroundColor: '#15803d', color: 'white', fontWeight: '800', fontSize: '15px', cursor: 'pointer', opacity: (!frmAttrib.exemplaire_id || !frmAttrib.agent_id) ? 0.5 : 1 }}>
                ✅ Valider l'attribution
              </button>
            </div>
          </form>

          {/* Tenues actuellement attribuées */}
          <div style={{ marginTop: '28px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <h3 className="section-title mb-10">Liste des tenues attribuées</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Matricule tenue', 'Article', 'Agent', 'Site', 'Attribuée le', 'Fin de vie', 'Retour'].map(h => (
                      <th key={h} style={TH('#166534')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exemplaires.filter(e => !!e.agent_id).length === 0 ? (
                    <tr><td colSpan="7" className="empty-state">Aucune tenue actuellement attribuée.</td></tr>
                  ) : exemplaires.filter(e => !!e.agent_id).map((ex, i) => (
                    <tr key={ex.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f0fdf4' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '800', color: '#166534' }}>{ex.matricule}</td>
                      <td style={TD}>{ex.articles_tenues?.designation}</td>
                      <td style={{ ...TD, fontWeight: '700' }}>{ex.agents?.nom}<br /><span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{ex.agents?.matricule}</span></td>
                      <td style={TD}>{ex.agents?.site_affecte}</td>
                      <td style={TD}>{dateFr(ex.date_attribution)}</td>
                      <td style={{ ...TD, color: joursRestants(ex.date_fin_vie) !== null && joursRestants(ex.date_fin_vie) <= 30 ? '#991b1b' : 'inherit', fontWeight: joursRestants(ex.date_fin_vie) !== null && joursRestants(ex.date_fin_vie) <= 30 ? '700' : 'normal' }}>
                        {dateFr(ex.date_fin_vie)}
                      </td>
                      <td style={TD}>
                        <button onClick={() => ouvrirRetour(ex)}
                          style={{ fontSize: '11px', padding: '5px 10px', borderRadius: '8px', border: '1px solid #fca5a5', backgroundColor: '#fff5f5', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                          📥 Retour
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ ONGLET 4 : HISTORIQUE ════════════ */}
      {onglet === 'historique' && (
        <div className="card" style={{ borderTop: '4px solid #8b5cf6' }}>
          <h3 className="section-title mb-20" style={{ color: '#6d28d9' }}>📜 Historique complet des attributions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Matricule tenue', 'Article', 'Agent', 'Date attribution', 'Date retour', 'État retour', 'Notes'].map(h => (
                    <th key={h} style={TH('#6d28d9')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historique.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">Aucun historique d'attribution.</td></tr>
                ) : historique.map((h, i) => (
                  <tr key={h.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#faf5ff' }}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '700', color: '#6d28d9' }}>
                      {h.exemplaires_tenues?.matricule}
                    </td>
                    <td style={TD}>{h.exemplaires_tenues?.articles_tenues?.designation || '—'}</td>
                    <td style={{ ...TD, fontWeight: '600' }}>
                      {h.agents?.nom}<br />
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{h.agents?.matricule}</span>
                    </td>
                    <td style={TD}>{dateFr(h.date_attribution)}</td>
                    <td style={{ ...TD, color: h.date_retour ? '#166534' : '#9ca3af' }}>
                      {h.date_retour ? dateFr(h.date_retour) : <span style={{ fontStyle: 'italic' }}>En cours</span>}
                    </td>
                    <td style={TD}>
                      {h.etat_retour ? <BadgeEtat etat={h.etat_retour} /> : '—'}
                    </td>
                    <td style={{ ...TD, color: '#6b7280', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════ ONGLET 5 : ALERTES ════════════ */}
      {onglet === 'alertes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Alertes stock bas */}
          <div className="card card-red">
            <h3 className="section-title mb-10">🔴 Stock bas (en-dessous du minimum)</h3>
            {alertesStockBas.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#15803d', fontSize: '15px', fontWeight: '700' }}>
                ✅ Tous les stocks sont suffisants.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Article', 'Taille', 'Stock minimum', 'Stock BON disponible', 'Écart', 'Action'].map(h => (
                      <th key={h} style={TH(colors.red)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertesStockBas.map((a, i) => (
                    <tr key={a.id} style={{ backgroundColor: i % 2 === 0 ? '#fff5f5' : '#fff' }}>
                      <td style={{ ...TD, fontWeight: '700' }}>{a.designation}</td>
                      <td style={TD}>{a.taille}</td>
                      <td style={{ ...TD, textAlign: 'center' }}>{a.stock_minimum}</td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: '900', color: '#991b1b' }}>{a.dispo}</td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: '800', color: '#991b1b' }}>−{a.stock_minimum - a.dispo}</td>
                      <td style={TD}>
                        <button
                          onClick={() => { setOnglet('exemplaires'); setShowFrmE(true); setFrmE(p => ({ ...p, article_id: String(a.id) })); }}
                          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fee2e2', color: '#991b1b', cursor: 'pointer', fontWeight: '700' }}>
                          + Réceptionner des exemplaires
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Alertes fin de vie */}
          <div className="card card-yellow">
            <h3 className="section-title mb-10">⏳ Fin de vie dans moins de 30 jours</h3>
            {alertesFinVie.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#15803d', fontSize: '15px', fontWeight: '700' }}>
                ✅ Aucun exemplaire en fin de vie imminente.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Matricule', 'Article', 'Jours restants', 'Date fin de vie', 'Agent actuel', 'État'].map(h => (
                      <th key={h} style={TH('#b45309')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {alertesFinVie.map((ex, i) => (
                    <tr key={ex.id} style={{ backgroundColor: ex.jr <= 0 ? '#fee2e2' : i % 2 === 0 ? '#fffbeb' : 'white' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: '800', color: '#b45309' }}>{ex.matricule}</td>
                      <td style={TD}>{ex.articles_tenues?.designation}</td>
                      <td style={{ ...TD, textAlign: 'center', fontWeight: '900', color: ex.jr <= 0 ? '#991b1b' : '#b45309' }}>
                        {ex.jr <= 0 ? `Expiré (${Math.abs(ex.jr)}j)` : `${ex.jr}j`}
                      </td>
                      <td style={TD}>{dateFr(ex.date_fin_vie)}</td>
                      <td style={{ ...TD, fontWeight: '600' }}>
                        {ex.agents ? `${ex.agents.nom} · ${ex.agents.matricule}` : <span style={{ color: '#9ca3af' }}>En stock</span>}
                      </td>
                      <td style={TD}><BadgeEtat etat={ex.etat} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
