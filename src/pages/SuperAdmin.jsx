import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from '../store/useToastStore';

const PLAN_COLORS = {
  STARTER:    { bg: '#ecfdf5', c: '#10b981', label: '🌱 Starter',  prix: 3000  },
  PME:        { bg: '#eff6ff', c: '#3b82f6', label: '🚀 PME',      prix: 7500  },
  PRO:        { bg: '#faf5ff', c: '#7c3aed', label: '🏢 Pro',      prix: 15000 },
  ENTREPRISE: { bg: '#fff7ed', c: '#ea580c', label: '🏛️ Entreprise', prix: 0   },
};

const STATUT_COLORS = {
  ACTIF:    { bg: '#dcfce7', c: '#15803d', label: '✅ Actif'     },
  ESSAI:    { bg: '#fef3c7', c: '#92400e', label: '⏳ Essai'     },
  SUSPENDU: { bg: '#fee2e2', c: '#991b1b', label: '🚫 Suspendu'  },
};

const fmt = n => typeof n === 'number' ? n.toLocaleString('fr-DZ') : '—';

export default function SuperAdmin() {
  const [onglet,       setOnglet]       = useState('dashboard');
  const [entreprises,  setEntreprises]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [filterPlan,   setFilterPlan]   = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [actionId,     setActionId]     = useState(null);

  const fetchEntreprises = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('entreprises')
      .select('*, profils_admin(count)')
      .order('created_at', { ascending: false });
    if (data) setEntreprises(data);
    setLoading(false);
  };

  useEffect(() => { fetchEntreprises(); }, []);

  const changeStatut = async (id, statut) => {
    setActionId(id);
    const { error } = await supabase.from('entreprises').update({ statut }).eq('id', id);
    if (error) {
      toast.error(error.code === '42501'
        ? 'Accès refusé — seul le SUPER_ADMIN peut modifier le statut.'
        : `Erreur : ${error.message}`);
    } else {
      toast.success(`Statut mis à jour → ${statut}`);
    }
    await fetchEntreprises();
    setActionId(null);
  };

  const changePlan = async (id, plan) => {
    const maxAgents = { STARTER: 30, PME: 100, PRO: 300, ENTREPRISE: 9999 }[plan];
    const { error } = await supabase.from('entreprises').update({ plan, max_agents: maxAgents }).eq('id', id);
    if (error) {
      toast.error(error.code === '42501'
        ? 'Accès refusé — seul le SUPER_ADMIN peut changer de formule.'
        : `Erreur : ${error.message}`);
    } else {
      toast.success(`Formule mise à jour → ${plan}`);
    }
    fetchEntreprises();
  };

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total    = entreprises.length;
    const actifs   = entreprises.filter(e => e.statut === 'ACTIF').length;
    const essais   = entreprises.filter(e => e.statut === 'ESSAI').length;
    const suspendus = entreprises.filter(e => e.statut === 'SUSPENDU').length;
    const mrr      = entreprises
      .filter(e => e.statut === 'ACTIF')
      .reduce((s, e) => s + (PLAN_COLORS[e.plan]?.prix || 0), 0);
    const wilayas  = [...new Set(entreprises.map(e => e.wilaya))].length;
    return { total, actifs, essais, suspendus, mrr, wilayas };
  }, [entreprises]);

  // ── Filtres ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = entreprises;
    if (search)       list = list.filter(e => e.nom?.toLowerCase().includes(search.toLowerCase()) || e.wilaya?.toLowerCase().includes(search.toLowerCase()));
    if (filterPlan)   list = list.filter(e => e.plan === filterPlan);
    if (filterStatut) list = list.filter(e => e.statut === filterStatut);
    return list;
  }, [entreprises, search, filterPlan, filterStatut]);

  // ── Répartition par plan (pour graphique simple) ─────────────────────────────
  const repartition = useMemo(() => {
    return Object.entries(PLAN_COLORS).map(([k, v]) => ({
      plan: k, label: v.label,
      count: entreprises.filter(e => e.plan === k).length,
      color: v.c,
      mrr: entreprises.filter(e => e.plan === k && e.statut === 'ACTIF').length * v.prix,
    }));
  }, [entreprises]);

  const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: '#f9fafb', width: '100%', boxSizing: 'border-box' };

  return (
    <div className="page-container">
      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>👑</span>
        <div>
          <h1 className="page-title">SUPER ADMIN — GESTION TENANTS</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Vue globale de toutes les sociétés de gardiennage clientes</p>
        </div>
        <button onClick={fetchEntreprises} style={{ marginLeft: 'auto', padding: '9px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
          🔄 Actualiser
        </button>
      </div>

      {/* Onglets */}
      <div className="nav-tabs mb-20">
        {[
          { k: 'dashboard', l: '📊 Dashboard' },
          { k: 'clients',   l: `🏢 Clients (${entreprises.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setOnglet(t.k)} className={`nav-tab${onglet === t.k ? ' active' : ''}`}
            style={onglet === t.k ? { backgroundColor: '#1e3a8a' } : {}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════════ DASHBOARD ════════════════════════════════════════════════ */}
      {onglet === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {[
              { l: 'Total clients',   v: kpis.total,    bg: '#dbeafe', c: '#1d4ed8', i: '🏢' },
              { l: 'Actifs (payants)', v: kpis.actifs,   bg: '#dcfce7', c: '#15803d', i: '✅' },
              { l: 'En essai',         v: kpis.essais,   bg: '#fef3c7', c: '#92400e', i: '⏳' },
              { l: 'Suspendus',        v: kpis.suspendus,bg: '#fee2e2', c: '#991b1b', i: '🚫' },
              { l: 'MRR (DA)',         v: `${fmt(kpis.mrr)} DA`, bg: '#f0fdf4', c: '#15803d', i: '💰' },
              { l: 'Wilayas couvertes',v: kpis.wilayas,  bg: '#ede9fe', c: '#7c3aed', i: '📍' },
            ].map(k => (
              <div key={k.l} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.i}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
                <div style={{ fontSize: k.l === 'MRR (DA)' ? '14px' : '22px', fontWeight: '900', color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Répartition par plan */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '900', color: '#1e3a8a', fontSize: '14px' }}>📊 Répartition par formule</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {repartition.map(r => (
                <div key={r.plan} style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', borderLeft: `4px solid ${r.color}` }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>{r.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '26px', fontWeight: '900', color: r.color }}>{r.count}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>client{r.count > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#15803d' }}>{fmt(r.mrr)} DA</div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>MRR actifs</div>
                    </div>
                  </div>
                  {/* Barre de proportion */}
                  <div style={{ marginTop: '10px', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', backgroundColor: r.color, width: kpis.total > 0 ? `${(r.count / kpis.total) * 100}%` : '0%', borderRadius: '4px', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
                    {kpis.total > 0 ? Math.round((r.count / kpis.total) * 100) : 0}% du parc
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tableau des dernières inscriptions */}
          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#1e3a8a', fontSize: '14px' }}>🆕 Dernières inscriptions</h3>
            {entreprises.length === 0 ? (
              loading ? <p style={{ color: '#9ca3af', textAlign: 'center' }}>Chargement…</p>
                : <p style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>Aucun client enregistré.<br /><span style={{ fontSize: '12px' }}>Partagez le lien /register pour démarrer.</span></p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    {['Société', 'Wilaya', 'Formule', 'Statut', 'Date inscription'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {entreprises.slice(0, 10).map((e, i) => {
                      const pl = PLAN_COLORS[e.plan] || PLAN_COLORS.STARTER;
                      const st = STATUT_COLORS[e.statut] || STATUT_COLORS.ESSAI;
                      return (
                        <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: '#1e293b' }}>{e.nom}</td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>📍 {e.wilaya}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', backgroundColor: pl.bg, color: pl.c }}>{pl.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', backgroundColor: st.bg, color: st.c }}>{st.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{new Date(e.created_at).toLocaleDateString('fr-DZ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ CLIENTS ══════════════════════════════════════════════════ */}
      {onglet === 'clients' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Filtres */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
            <input type="text" placeholder="🔍 Rechercher par nom ou wilaya…" value={search} onChange={e => setSearch(e.target.value)} style={INP} />
            <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} style={INP}>
              <option value="">Toutes les formules</option>
              {Object.entries(PLAN_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} style={INP}>
              <option value="">Tous les statuts</option>
              {Object.entries(STATUT_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div style={{ color: '#6b7280', fontSize: '12px' }}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</div>

          {/* Table clients */}
          <div style={{ overflowX: 'auto' }} className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Société', 'Wilaya', 'Email', 'Téléphone', 'Formule', 'Agents max', 'Statut', 'Inscription', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', backgroundColor: '#1e3a8a', color: 'white', fontSize: '11px', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>⏳ Chargement…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state">Aucun client trouvé.</td></tr>
                ) : filtered.map((e, i) => {
                  const pl = PLAN_COLORS[e.plan] || PLAN_COLORS.STARTER;
                  const st = STATUT_COLORS[e.statut] || STATUT_COLORS.ESSAI;
                  const isBusy = actionId === e.id;
                  return (
                    <tr key={e.id} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #f1f5f9', opacity: isBusy ? 0.6 : 1 }}>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#1e293b', minWidth: '160px' }}>
                        {e.nom}
                        {e.numero_agrement && <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '400' }}>🪪 {e.numero_agrement}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>📍 {e.wilaya}</td>
                      <td style={{ padding: '10px 12px', fontSize: '11px', color: '#374151', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.email}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>{e.telephone || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <select value={e.plan} onChange={ev => changePlan(e.id, ev.target.value)}
                          style={{ padding: '4px 8px', borderRadius: '8px', border: `1px solid ${pl.c}`, backgroundColor: pl.bg, color: pl.c, fontWeight: '800', fontSize: '11px', cursor: 'pointer' }}>
                          {Object.entries(PLAN_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>{e.max_agents}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', backgroundColor: st.bg, color: st.c, whiteSpace: 'nowrap' }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(e.created_at).toLocaleDateString('fr-DZ')}
                        {e.date_fin_essai && e.statut === 'ESSAI' && (
                          <div style={{ color: '#f59e0b', fontWeight: '700', fontSize: '10px' }}>
                            Essai → {new Date(e.date_fin_essai).toLocaleDateString('fr-DZ')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {e.statut !== 'ACTIF' && (
                            <button disabled={isBusy} onClick={() => changeStatut(e.id, 'ACTIF')}
                              style={{ padding: '5px 9px', borderRadius: '7px', border: 'none', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              ✅ Activer
                            </button>
                          )}
                          {e.statut !== 'SUSPENDU' && (
                            <button disabled={isBusy} onClick={() => changeStatut(e.id, 'SUSPENDU')}
                              style={{ padding: '5px 9px', borderRadius: '7px', border: 'none', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              🚫 Suspendre
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#1e3a8a' }}>
                    <td colSpan="5" style={{ padding: '9px 12px', color: 'white', fontWeight: '900', fontSize: '12px' }}>
                      TOTAL — {filtered.length} client{filtered.length > 1 ? 's' : ''}
                    </td>
                    <td colSpan="4" style={{ padding: '9px 12px', textAlign: 'right', color: '#93c5fd', fontWeight: '800', fontSize: '12px' }}>
                      MRR total :{' '}
                      {fmt(filtered.filter(e => e.statut === 'ACTIF').reduce((s, e) => s + (PLAN_COLORS[e.plan]?.prix || 0), 0))} DA/mois
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* SQL Migration hint */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '18px' }}>
            <h4 style={{ color: '#f8fafc', fontWeight: '900', margin: '0 0 10px 0', fontSize: '13px' }}>🗄️ Table requise dans Supabase</h4>
            <pre style={{ margin: 0, backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', fontSize: '10.5px', color: '#7dd3fc', overflowX: 'auto', lineHeight: 1.65 }}>{`CREATE TABLE IF NOT EXISTS entreprises (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT NOT NULL,
  email            TEXT UNIQUE,
  telephone        TEXT,
  wilaya           TEXT,
  adresse          TEXT,
  numero_agrement  TEXT,
  plan             TEXT DEFAULT 'STARTER',
  statut           TEXT DEFAULT 'ESSAI',
  max_agents       INTEGER DEFAULT 30,
  date_fin_essai   DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  owner_id         UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter company_id aux profils admin (isolation multi-tenant)
ALTER TABLE profils_admin
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES entreprises(id),
  ADD COLUMN IF NOT EXISTS nom TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- RLS : chaque admin ne voit que son entreprise
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_all" ON entreprises
  USING (auth.uid() IN (
    SELECT id FROM profils_admin WHERE role = 'SUPER_ADMIN'
  ));
CREATE POLICY "owner_own_company" ON entreprises
  USING (owner_id = auth.uid());`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
