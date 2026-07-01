import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useToastStore } from '../store/useToastStore';
import { esc } from '../utils/sanitize';

// ── Helpers ───────────────────────────────────────────────────────────────────
const DA = (n) =>
  new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n ?? 0) + ' DA';

const getMoisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const periodeDate = (ym) => `${ym}-01`;

const moisLabel = (ym) => {
  const [y, m] = ym.split('-');
  const d = new Date(+y, +m - 1, 1);
  return d.toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' });
};

// ── Statut badge ──────────────────────────────────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = {
    brouillon: { label: 'Brouillon', bg: '#FEF3C7', color: '#92400E' },
    valide:    { label: 'Validé',    bg: '#D1FAE5', color: '#065F46' },
    paye:      { label: 'Payé',      bg: '#DBEAFE', color: '#1E40AF' },
  }[statut] ?? { label: statut, bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB 1 — Tableau de bord paie
// ══════════════════════════════════════════════════════════════════════════════
function DashboardPaie({ dash, periode, totalAgents }) {
  if (!dash) return (
    <div className="empty-state"><span className="empty-state-icon">📊</span>
      Aucun bulletin calculé pour {moisLabel(periode)}.
    </div>
  );
  const nb = Number(dash.nb_bulletins ?? 0);
  const pct = nb > 0 ? Math.round((Number(dash.nb_valides) / nb) * 100) : 0;

  return (
    <div>
      {/* Stat cards */}
      <div className="flex-row mb-20" style={{ flexWrap: 'wrap', gap: 10 }}>
        {[
          { label: 'Masse salariale', value: DA(dash.masse_salariale), color: '#1B5299', icon: '💰' },
          { label: 'Total CNAS sal.', value: DA(dash.total_cnas_sal), color: '#7C3AED', icon: '🏦' },
          { label: 'Total CNAS pat.', value: DA(dash.total_cnas_pat), color: '#9D174D', icon: '🏢' },
          { label: 'Total IRG', value: DA(dash.total_irg), color: '#B45309', icon: '🧾' },
          { label: 'Total NET à payer', value: DA(dash.total_net_a_payer), color: '#065F46', icon: '✅' },
          { label: 'Salaire moyen', value: DA(dash.salaire_moyen), color: '#374151', icon: '📈' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ flex: '1 1 160px', maxWidth: 200, borderTop: `3px solid ${s.color}` }}>
            <div className="stat-card-label">{s.icon} {s.label}</div>
            <div className="stat-card-value" style={{ fontSize: 16, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progression */}
      <div className="card mb-20">
        <div className="flex-between mb-10">
          <strong style={{ fontSize: 13 }}>Avancement — {moisLabel(periode)}</strong>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{dash.nb_valides} / {nb} bulletins validés</span>
        </div>
        <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#1A7A4A', borderRadius: 4, transition: 'width .5s' }} />
        </div>
        <div className="flex-row mt-10" style={{ gap: 16, fontSize: 11, color: '#6B7280' }}>
          <span>🟡 Brouillons : {dash.nb_brouillons}</span>
          <span>✅ Validés : {dash.nb_valides}</span>
          <span>💳 Payés : {dash.nb_payes}</span>
          <span>👥 Agents actifs : {totalAgents}</span>
        </div>
      </div>

      {/* Charge patronale recap */}
      <div className="card" style={{ borderLeft: '4px solid #9D174D' }}>
        <div className="section-title" style={{ fontSize: 14 }}>Charge patronale totale du mois</div>
        <div className="flex-row mt-10" style={{ gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
          <span>CNAS patronal (25 %) : <strong>{DA(dash.total_cnas_pat)}</strong></span>
          <span>Masse salariale brute : <strong>{DA(dash.masse_salariale)}</strong></span>
          <span>Net à décaisser : <strong style={{ color: '#065F46' }}>{DA(dash.total_net_a_payer)}</strong></span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB 2 — Calcul du mois
// ══════════════════════════════════════════════════════════════════════════════
function CalcMois({ agents, bulletins, periode, calcLoading, onCalculer, onCalculerTous, globalLoading }) {
  const bulletinByAgent = Object.fromEntries(bulletins.map(b => [b.agent_id, b]));

  const nbCalc = Object.keys(bulletinByAgent).length;
  const nbRest = agents.length - nbCalc;

  return (
    <div>
      <div className="card flex-row mb-20" style={{ alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13 }}>
          <strong>{agents.length}</strong> agents actifs ·{' '}
          <span style={{ color: '#1A7A4A' }}>{nbCalc} calculés</span> ·{' '}
          <span style={{ color: '#DC2626' }}>{nbRest} restants</span>
        </div>
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={onCalculerTous}
          disabled={globalLoading || agents.length === 0}
        >
          {globalLoading ? '⏳ Calcul en cours…' : `⚡ Calculer tous les bulletins (${agents.length})`}
        </button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Matricule', 'Nom & Prénom', 'Qualification', 'Site', 'Salaire base', 'Statut', 'Action'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                  color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>
                Aucun agent actif trouvé.
              </td></tr>
            )}
            {agents.map((agent) => {
              const b = bulletinByAgent[agent.id];
              const loading = calcLoading[agent.id];
              return (
                <tr key={agent.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#6B7280' }}>
                    {agent.matricule ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                    {agent.nom} {agent.prenom}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#6B7280' }}>
                    {agent.qualification ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#6B7280' }}>
                    {agent.site_affecte ?? '—'}
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {DA(agent.salaire_brut)}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {b ? <StatutBadge statut={b.statut} /> : <span style={{ color: '#9CA3AF', fontSize: 10 }}>Non calculé</span>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      className="btn btn-xs"
                      style={{ background: b ? '#E5E7EB' : '#1B5299', color: b ? '#374151' : 'white', border: 'none' }}
                      onClick={() => onCalculer(agent.id)}
                      disabled={loading || globalLoading}
                    >
                      {loading ? '⏳' : b ? '↺ Recalculer' : '⚙️ Calculer'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB 3 — Liste des bulletins
// ══════════════════════════════════════════════════════════════════════════════
function ListeBulletins({ bulletins, loading, onSelect, onValider }) {
  const [filtre, setFiltre] = useState('');

  const liste = bulletins.filter(b => {
    const nom = `${b.agents?.nom ?? ''} ${b.agents?.prenom ?? ''}`.toLowerCase();
    return !filtre || nom.includes(filtre.toLowerCase()) || (b.agents?.matricule ?? '').includes(filtre);
  });

  if (loading) return <div className="empty-state"><span className="empty-state-icon">⏳</span>Chargement…</div>;
  if (!bulletins.length) return (
    <div className="empty-state">
      <span className="empty-state-icon">📄</span>
      Aucun bulletin pour cette période.<br />
      <small style={{ color: '#9CA3AF' }}>Utilisez l'onglet "Calcul du mois" pour générer les bulletins.</small>
    </div>
  );

  return (
    <div>
      <div className="card flex-row mb-10" style={{ padding: '10px 14px', alignItems: 'center', gap: 10 }}>
        <input
          className="form-input"
          style={{ marginBottom: 0, flex: 1 }}
          placeholder="Filtrer par nom ou matricule…"
          value={filtre}
          onChange={e => setFiltre(e.target.value)}
        />
        <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>{liste.length} bulletin(s)</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Agent', 'Brut', 'CNAS 9%', 'IRG', 'Net à payer', 'Congés', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                    fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                    color: '#6B7280', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liste.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                  onClick={() => onSelect(b)}>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{b.agents?.nom} {b.agents?.prenom}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{b.agents?.matricule}</div>
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{DA(b.salaire_brut)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#7C3AED' }}>{DA(b.cnas_sal)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#B45309' }}>{DA(b.irg)}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#065F46' }}>{DA(b.net_a_payer)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#1B5299', fontWeight: 700 }}>
                    {(b.conges_cumul + 2.5).toFixed(1)} j
                  </td>
                  <td style={{ padding: '8px 12px' }}><StatutBadge statut={b.statut} /></td>
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-xs" style={{ background: '#1B5299', color: 'white', border: 'none' }}
                        onClick={() => onSelect(b)}>👁 Voir</button>
                      {b.statut === 'brouillon' && (
                        <button className="btn btn-xs" style={{ background: '#1A7A4A', color: 'white', border: 'none' }}
                          onClick={() => onValider(b.id)}>✓ Valider</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB 4 — Paramètres paie
// ══════════════════════════════════════════════════════════════════════════════
function ParamsPaie({ params, onSaved }) {
  const { addToast } = useToastStore();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Init form même si params est null (table vide) — valeurs légales par défaut
    setForm({
      snmg:               params?.snmg             ?? 20000,
      prime_panier:       params?.prime_panier      ?? 0,
      prime_transport:    params?.prime_transport   ?? 0,
      prime_zone:         params?.prime_zone        ?? 0,
      prime_salissure:    params?.prime_salissure   ?? 0,
      prime_nuit:         params?.prime_nuit        ?? 0,
      prime_dimanche:     params?.prime_dimanche    ?? 0,
      nb_jours_mois:      params?.nb_jours_mois     ?? 26,
      secteur_activite:   params?.secteur_activite  ?? 'services',
      taux_cacobatph_sal: params?.taux_cacobatph_sal ?? 0.005,
    });
  }, [params]);

  const save = async () => {
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    let error;
    if (params?.id) {
      // Ligne existante — UPDATE par id
      ({ error } = await supabase
        .from('parametres_entreprise')
        .update(payload)
        .eq('id', params.id));
    } else {
      // Aucune ligne — INSERT (premier enregistrement des params paie)
      ({ error } = await supabase
        .from('parametres_entreprise')
        .insert([payload]));
    }
    setSaving(false);
    if (error) { addToast({ type: 'error', message: error.message }); return; }
    addToast({ type: 'success', message: 'Paramètres paie enregistrés.' });
    onSaved();
  };

  if (!form) return null;

  const F = ({ label, field, type = 'number', step = '1', note }) => (
    <div style={{ marginBottom: 14 }}>
      <label className="form-label-sm">{label}</label>
      {note && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{note}</span>}
      <input
        type={type}
        step={step}
        min={0}
        value={form[field] ?? ''}
        onChange={e => setForm(p => ({ ...p, [field]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
        className="form-input"
        style={{ fontFamily: 'monospace' }}
      />
    </div>
  );

  return (
    <div>
      <div className="alert" style={{ background: '#FFFBEB', borderLeft: '4px solid #C8871A', padding: '10px 14px', marginBottom: 20, fontSize: 12 }}>
        ⚠️ <strong>Les taux CNAS (9%) et le barème IRG sont fixes et légalement imposés.</strong>
        Seules les indemnités et le SNMG sont configurables ici.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>

        <div className="card">
          <div className="section-title" style={{ fontSize: 14, marginBottom: 16 }}>Base légale</div>
          <F label="SNMG (DA/mois)" field="snmg" note="Décret 2023" />
          <div style={{ marginBottom: 14 }}>
            <label className="form-label-sm">Secteur d'activité</label>
            <select value={form.secteur_activite} className="form-select"
              onChange={e => setForm(p => ({ ...p, secteur_activite: e.target.value }))}>
              <option value="services">Services / Gardiennage</option>
              <option value="btp">BTP / Construction</option>
              <option value="production">Production / Industrie</option>
              <option value="tourisme">Tourisme / Hôtellerie</option>
              <option value="liberal">Professions libérales</option>
              <option value="import_negoce">Import / Négoce</option>
            </select>
          </div>
          <F label="Nb jours travaillés/mois" field="nb_jours_mois" step="1" note="Std: 26" />
        </div>

        <div className="card">
          <div className="section-title" style={{ fontSize: 14, marginBottom: 16 }}>Indemnités (DA)</div>
          <F label="Prime de panier (DA/jour)" field="prime_panier" step="50" note="× nb jours" />
          <F label="Prime de transport (DA/mois)" field="prime_transport" note="Exonérée CNAS/IRG" />
          <F label="Prime de zone (DA/mois)" field="prime_zone" note="Soumise CNAS+IRG" />
          <F label="Prime de salissure (DA/mois)" field="prime_salissure" note="Soumise CNAS+IRG" />
        </div>

        <div className="card">
          <div className="section-title" style={{ fontSize: 14, marginBottom: 16 }}>Primes horaires (DA/mois)</div>
          <F label="Prime de nuit (DA/mois)" field="prime_nuit" step="100" />
          <F label="Prime de dimanche (DA/mois)" field="prime_dimanche" step="100" />
          {form.secteur_activite === 'btp' && (
            <>
              <hr style={{ margin: '12px 0', borderColor: '#E5E7EB' }} />
              <div style={{ fontSize: 11, color: '#B45309', marginBottom: 8, fontWeight: 600 }}>CACOBATPH (BTP)</div>
              <F label="Taux salarié CACOBATPH" field="taux_cacobatph_sal" step="0.001" note="Ex: 0.005 = 0,5%" />
            </>
          )}
        </div>

      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '⏳ Enregistrement…' : '💾 Enregistrer les paramètres'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODAL BULLETIN DÉTAIL — Vue & Impression
// ══════════════════════════════════════════════════════════════════════════════
function BulletinModal({ bulletin: b, params, onClose, onValider }) {
  const printRef = useRef();

  const imprimer = () => {
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Bulletin de paie — ${esc(b.agents?.nom)} ${esc(b.agents?.prenom)} — ${esc(b.periode)}</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:Arial,sans-serif;font-size:10pt;padding:20px;color:#000}
          .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1B5299}
          .company-name{font-size:16pt;font-weight:bold;color:#1B5299}
          .company-info{font-size:8pt;color:#555;margin-top:4px}
          .title{text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;
            letter-spacing:3px;border:2px solid #1B5299;padding:6px;margin:12px 0;color:#1B5299}
          .agent-box{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #ccc;margin-bottom:14px}
          .agent-field{padding:4px 8px;border-bottom:1px solid #eee;font-size:9pt}
          .agent-field:nth-child(odd){background:#F8FAFC;border-right:1px solid #ccc}
          .agent-label{font-size:8pt;color:#777;display:block}
          .agent-value{font-weight:600}
          table.items{width:100%;border-collapse:collapse;margin-bottom:10px}
          table.items th{background:#1B5299;color:white;padding:5px 8px;font-size:9pt;text-align:left}
          table.items td{padding:4px 8px;font-size:9pt;border-bottom:1px solid #F0F0F0}
          table.items tr.subtotal td{background:#F8F8F8;font-weight:600}
          table.items tr.retenue td{color:#7C3AED}
          table.items tr.total-net td{background:#1A1A2E;color:white;font-weight:bold;font-size:11pt;padding:7px 8px}
          .conges-box{border:1px solid #D1FAE5;background:#F0FDF4;padding:8px 12px;font-size:9pt;margin-bottom:10px}
          .footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;font-size:9pt}
          .sign-box{border:1px solid #ccc;height:60px;padding:6px;color:#999;text-align:center}
          .mention{font-size:7.5pt;color:#888;margin-top:10px;text-align:center;border-top:1px solid #eee;padding-top:6px}
          .sacred{font-size:8pt;color:#B45309;font-style:italic}
          @media print{body{padding:10px}}
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">${esc(params?.nom_entreprise ?? 'DZ SECURITY')}</div>
            <div class="company-info">
              NIF: ${esc(params?.nif ?? '—')} · NIS: ${esc(params?.nis ?? '—')} · RC: ${esc(params?.rc ?? '—')}<br>
              ${esc(params?.adresse ?? '')} · Tél: ${esc(params?.telephone ?? '—')}
            </div>
          </div>
          <div style="text-align:right;font-size:8pt;color:#555">
            <div style="font-weight:bold;font-size:10pt">Période : ${b.periode}</div>
            <div>Date d'émission : ${new Date().toLocaleDateString('fr-DZ')}</div>
          </div>
        </div>

        <div class="title">Bulletin de paie</div>

        <div class="agent-box">
          <div class="agent-field"><span class="agent-label">Nom &amp; Prénom</span><span class="agent-value">${esc(b.agents?.nom ?? '')} ${esc(b.agents?.prenom ?? '')}</span></div>
          <div class="agent-field"><span class="agent-label">Matricule</span><span class="agent-value">${esc(b.agents?.matricule ?? '—')}</span></div>
          <div class="agent-field"><span class="agent-label">Qualification</span><span class="agent-value">${esc(b.agents?.qualification ?? '—')}</span></div>
          <div class="agent-field"><span class="agent-label">Type contrat</span><span class="agent-value">${esc(b.agents?.type_contrat ?? '—')}</span></div>
          <div class="agent-field"><span class="agent-label">Site affecté</span><span class="agent-value">${esc(b.agents?.site_affecte ?? '—')}</span></div>
          <div class="agent-field"><span class="agent-label">Nb jours travaillés</span><span class="agent-value">${b.nb_jours_travailles} jours</span></div>
        </div>

        <table class="items">
          <thead><tr><th style="width:50%">Libellé</th><th style="width:15%;text-align:center">Base</th><th style="width:15%;text-align:center">Taux</th><th style="width:20%;text-align:right">Montant (DA)</th></tr></thead>
          <tbody>
            <tr><td>Salaire de base</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:right;font-family:monospace">${b.salaire_base?.toFixed(2)}</td></tr>
            ${b.ind_panier > 0 ? `<tr><td>Prime de panier</td><td style="text-align:center">${b.nb_jours_travailles} j</td><td style="text-align:center">${(b.ind_panier / b.nb_jours_travailles).toFixed(2)} DA/j</td><td style="text-align:right;font-family:monospace">${b.ind_panier?.toFixed(2)}</td></tr>` : ''}
            ${b.ind_transport > 0 ? `<tr><td>Prime de transport <span style="font-size:8pt;color:#888">(exon. CNAS/IRG)</span></td><td style="text-align:center">—</td><td style="text-align:center">Forfait</td><td style="text-align:right;font-family:monospace">${b.ind_transport?.toFixed(2)}</td></tr>` : ''}
            ${b.ind_zone > 0 ? `<tr><td>Prime de zone</td><td style="text-align:center">—</td><td style="text-align:center">Forfait</td><td style="text-align:right;font-family:monospace">${b.ind_zone?.toFixed(2)}</td></tr>` : ''}
            ${b.ind_salissure > 0 ? `<tr><td>Prime de salissure</td><td style="text-align:center">—</td><td style="text-align:center">Forfait</td><td style="text-align:right;font-family:monospace">${b.ind_salissure?.toFixed(2)}</td></tr>` : ''}
            ${b.ind_nuit > 0 ? `<tr><td>Prime de nuit</td><td style="text-align:center">—</td><td style="text-align:center">Forfait</td><td style="text-align:right;font-family:monospace">${b.ind_nuit?.toFixed(2)}</td></tr>` : ''}
            ${b.ind_dimanche > 0 ? `<tr><td>Prime de dimanche</td><td style="text-align:center">—</td><td style="text-align:center">Forfait</td><td style="text-align:right;font-family:monospace">${b.ind_dimanche?.toFixed(2)}</td></tr>` : ''}
            <tr class="subtotal"><td><strong>Salaire brut</strong></td><td></td><td></td><td style="text-align:right;font-family:monospace"><strong>${b.salaire_brut?.toFixed(2)}</strong></td></tr>
            <tr><td colspan="4" style="padding:4px 8px;font-size:8pt;color:#888;background:#FAFAFA">— RETENUES —</td></tr>
            <tr class="retenue"><td>CNAS salarié <span class="sacred">(SACRÉ — art. 16, loi 83-14)</span></td><td style="text-align:center;font-family:monospace">${b.assiette_cnas?.toFixed(2)}</td><td style="text-align:center">9,00 %</td><td style="text-align:right;font-family:monospace">${b.cnas_sal?.toFixed(2)}</td></tr>
            <tr class="retenue"><td>Abattement IRG <span class="sacred">(40% · min 1 000 · max 1 500 DA)</span></td><td style="text-align:center;font-family:monospace">${b.assiette_cnas?.toFixed(2)}</td><td style="text-align:center">40,00 %</td><td style="text-align:right;font-family:monospace">– ${b.abattement_irg?.toFixed(2)}</td></tr>
            <tr class="retenue"><td>IRG barème progressif <span class="sacred">(5 tranches 2024)</span></td><td style="text-align:center;font-family:monospace">${b.net_imposable?.toFixed(2)}</td><td style="text-align:center">Barème</td><td style="text-align:right;font-family:monospace">${b.irg?.toFixed(2)}</td></tr>
            ${b.cacobatph_sal > 0 ? `<tr class="retenue"><td>CACOBATPH salarié (BTP)</td><td style="text-align:center;font-family:monospace">${b.assiette_cnas?.toFixed(2)}</td><td style="text-align:center">0,50 %</td><td style="text-align:right;font-family:monospace">${b.cacobatph_sal?.toFixed(2)}</td></tr>` : ''}
            <tr class="total-net"><td><strong>NET À PAYER</strong></td><td colspan="2"></td><td style="text-align:right;font-family:monospace;font-size:13pt"><strong>${b.net_a_payer?.toFixed(2)}</strong></td></tr>
          </tbody>
        </table>

        <div class="conges-box">
          🌴 Congés payés — Loi 90-11, art. 26 (2,5 j/mois = 30 j/an)<br>
          Acquis ce mois : <strong>2,5 jours</strong> · Solde cumulé : <strong>${((b.conges_cumul ?? 0) + 2.5).toFixed(1)} jours</strong>
        </div>

        <div class="footer">
          <div>
            <div style="margin-bottom:6px;font-weight:600">Signature de l'employeur</div>
            <div class="sign-box">Cachet &amp; Signature</div>
          </div>
          <div>
            <div style="margin-bottom:6px;font-weight:600">Signature de l'employé</div>
            <div class="sign-box">Reçu la somme de ${b.net_a_payer?.toFixed(2)} DA</div>
          </div>
        </div>

        <div class="mention">
          Document généré par DZ SECURITY ERP · Conforme à la législation algérienne du travail (loi 90-11) ·
          IRG barème 2024 (art. 104bis CIDTA) · CNAS 9% (art. 16, loi 83-14) · Archivage légal : 10 ans
        </div>

        <script>window.onload = function(){ window.print(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: '20px 16px', overflowY: 'auto'
    }}>
      <div style={{ background: 'white', borderRadius: 8, width: '100%', maxWidth: 680,
        boxShadow: '0 24px 48px rgba(0,0,0,.3)', marginTop: 20 }} ref={printRef}>

        {/* Header modal */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Bulletin — {b.agents?.nom} {b.agents?.prenom}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>
              {b.periode} · Matricule {b.agents?.matricule ?? '—'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-xs" style={{ background: '#1B5299', color: 'white', border: 'none' }}
              onClick={imprimer}>🖨️ Imprimer / PDF</button>
            {b.statut === 'brouillon' && (
              <button className="btn btn-xs" style={{ background: '#1A7A4A', color: 'white', border: 'none' }}
                onClick={() => onValider(b.id)}>✓ Valider</button>
            )}
            <button className="btn btn-xs" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Corps bulletin */}
        <div style={{ padding: '20px' }}>
          {/* Infos agent */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
            border: '1px solid #E5E7EB', borderRadius: 4, overflow: 'hidden', marginBottom: 16, fontSize: 12 }}>
            {[
              ['Qualification', b.agents?.qualification ?? '—'],
              ['Type contrat',  b.agents?.type_contrat  ?? '—'],
              ['Site affecté',  b.agents?.site_affecte  ?? '—'],
              ['Jours travaillés', `${b.nb_jours_travailles} jours`],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '7px 12px', borderBottom: '1px solid #F0F0F0' }}>
                <span style={{ color: '#9CA3AF', fontSize: 10, display: 'block' }}>{k}</span>
                <span style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Tableau calcul */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: '#1A1A2E', color: 'white' }}>
                <th style={{ padding: '7px 12px', textAlign: 'left' }}>Libellé</th>
                <th style={{ padding: '7px 12px', textAlign: 'right' }}>Montant (DA)</th>
              </tr>
            </thead>
            <tbody>
              {/* Gains */}
              {[
                { label: 'Salaire de base', val: b.salaire_base },
                b.ind_panier    > 0 && { label: `Prime de panier (${b.nb_jours_travailles} j)`, val: b.ind_panier },
                b.ind_transport > 0 && { label: 'Prime de transport ⟨exon.⟩', val: b.ind_transport },
                b.ind_zone      > 0 && { label: 'Prime de zone', val: b.ind_zone },
                b.ind_salissure > 0 && { label: 'Prime de salissure', val: b.ind_salissure },
                b.ind_nuit      > 0 && { label: 'Prime de nuit', val: b.ind_nuit },
                b.ind_dimanche  > 0 && { label: 'Prime de dimanche', val: b.ind_dimanche },
              ].filter(Boolean).map(({ label, val }) => (
                <tr key={label} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '5px 12px' }}>{label}</td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                    {val.toFixed(2)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#EEF1F7' }}>
                <td style={{ padding: '6px 12px', fontWeight: 700 }}>= Salaire brut</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                  {b.salaire_brut?.toFixed(2)}
                </td>
              </tr>
              {/* Retenues */}
              <tr style={{ background: '#F9FAFB' }}>
                <td colSpan={2} style={{ padding: '5px 12px', fontSize: 10, color: '#9CA3AF', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                  Retenues obligatoires
                </td>
              </tr>
              <tr style={{ color: '#7C3AED' }}>
                <td style={{ padding: '5px 12px' }}>CNAS salarié <span style={{ fontSize: 10 }}>(9% × {b.assiette_cnas?.toFixed(2)} DA)</span></td>
                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>– {b.cnas_sal?.toFixed(2)}</td>
              </tr>
              <tr style={{ color: '#B45309' }}>
                <td style={{ padding: '5px 12px' }}>IRG barème progressif <span style={{ fontSize: 10 }}>(NI: {b.net_imposable?.toFixed(2)} DA)</span></td>
                <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>– {b.irg?.toFixed(2)}</td>
              </tr>
              {b.cacobatph_sal > 0 && (
                <tr style={{ color: '#9D174D' }}>
                  <td style={{ padding: '5px 12px' }}>CACOBATPH salarié (BTP 0,5%)</td>
                  <td style={{ padding: '5px 12px', textAlign: 'right', fontFamily: 'monospace' }}>– {b.cacobatph_sal?.toFixed(2)}</td>
                </tr>
              )}
              {/* Net */}
              <tr style={{ background: '#1A1A2E', color: 'white' }}>
                <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 14 }}>NET À PAYER</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>
                  {b.net_a_payer?.toFixed(2)} DA
                </td>
              </tr>
            </tbody>
          </table>

          {/* Détail IRG */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4,
            padding: '8px 12px', fontSize: 11, marginBottom: 12 }}>
            <strong>Détail IRG :</strong> Assiette {b.assiette_cnas?.toFixed(2)} DA →
            Abattement 40% = {b.abattement_irg?.toFixed(2)} DA →
            Net imposable = {b.net_imposable?.toFixed(2)} DA →
            IRG (barème 2024) = <strong>{b.irg?.toFixed(2)} DA</strong>
          </div>

          {/* Congés */}
          <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 4,
            padding: '8px 12px', fontSize: 11 }}>
            🌴 <strong>Congés payés (loi 90-11, art. 26) :</strong>
            Acquis ce mois : <strong>2,5 jours</strong> ·
            Solde total : <strong>{((b.conges_cumul ?? 0) + 2.5).toFixed(1)} jours</strong>
          </div>

          {/* Charge employeur */}
          {b.cnas_pat > 0 && (
            <div style={{ marginTop: 12, background: '#F3F4F6', borderRadius: 4,
              padding: '8px 12px', fontSize: 11, color: '#6B7280' }}>
              <strong>Information employeur :</strong>
              CNAS patronal (25%) = {b.cnas_pat?.toFixed(2)} DA ·
              {b.cacobatph_pat > 0 && ` CACOBATPH patronal (15%) = ${b.cacobatph_pat?.toFixed(2)} DA ·`}
              Charge totale employeur = {(b.net_a_payer + b.cnas_pat + (b.cacobatph_pat ?? 0)).toFixed(2)} DA
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  TAB 5 — Déclarations CNAS / DAS
// ══════════════════════════════════════════════════════════════════════════════
function StatutDeclBadge({ statut }) {
  const cfg = {
    brouillon: { label: 'Brouillon', bg: '#FEF3C7', color: '#92400E' },
    soumise:   { label: 'Soumise',   bg: '#DBEAFE', color: '#1E40AF' },
    validee:   { label: 'Validée',   bg: '#D1FAE5', color: '#065F46' },
  }[statut] ?? { label: statut, bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function DeclarationsTab({ periode, params, bulletins }) {
  const { addToast } = useToastStore();
  const [mode,       setMode]       = useState('g50');
  const [annee,      setAnnee]      = useState(String(new Date().getFullYear()));
  const [g50Data,    setG50Data]    = useState(null);
  const [dasData,    setDasData]    = useState(null);
  const [historique, setHistorique] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [refPaiement, setRefPaiement] = useState('');

  const nbValides = bulletins.filter(b => b.statut === 'valide' || b.statut === 'paye').length;

  const chargerHistorique = useCallback(async () => {
    const { data } = await supabase
      .from('declarations_cnas')
      .select('id,type_declaration,periode,statut,nb_employes,masse_salariale,total_a_verser,date_soumission,reference_paiement')
      .order('periode', { ascending: false })
      .limit(24);
    setHistorique(data ?? []);
  }, []);

  useEffect(() => { chargerHistorique(); }, [chargerHistorique]);

  const genererG50 = async () => {
    if (nbValides === 0) {
      addToast({ type: 'warning', message: 'Validez d\'abord les bulletins avant de générer le G50.' });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generer_g50', {
        p_periode:    periodeDate(periode),
        p_company_id: null,
      });
      if (error) throw error;
      setG50Data(data);
      await chargerHistorique();
      addToast({ type: 'success', message: `✅ G50 généré — ${data.nb_employes} employés · ${DA(data.total_a_verser)} à verser` });
    } catch (err) {
      addToast({ type: 'error', message: err.message ?? 'Erreur génération G50' });
    } finally {
      setGenerating(false);
    }
  };

  const genererDAS = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generer_das_annuelle', {
        p_annee:      parseInt(annee),
        p_company_id: null,
      });
      if (error) throw error;
      setDasData(data);
      await chargerHistorique();
      addToast({ type: 'success', message: `✅ DAS ${annee} générée — ${data.nb_employes} employés` });
    } catch (err) {
      addToast({ type: 'error', message: err.message ?? 'Erreur génération DAS' });
    } finally {
      setGenerating(false);
    }
  };

  const soumettre = async (declId) => {
    const { error } = await supabase.rpc('soumettre_declaration', {
      p_declaration_id:     declId,
      p_reference_paiement: refPaiement || null,
    });
    if (error) { addToast({ type: 'error', message: error.message }); return; }
    addToast({ type: 'success', message: '📤 Déclaration marquée soumise — immuable.' });
    await chargerHistorique();
    setG50Data(null);
    setDasData(null);
  };

  const imprimerG50 = (data) => {
    if (!data) return;
    const rows = (data.details ?? []).map(e =>
      `<tr>
        <td>${esc(e.matricule ?? '—')}</td>
        <td>${esc(e.nom)} ${esc(e.prenom)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.salaire_brut).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.assiette_cnas).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.cnas_sal).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.cnas_pat).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.irg).toFixed(2)}</td>
      </tr>`
    ).join('');

    const win = window.open('', '_blank', 'width=950,height=900');
    win.document.write(`
      <!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8">
      <title>G50 — ${data.periode}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:9pt;padding:20px;color:#000}
        .header{display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:2px solid #1B5299;margin-bottom:14px}
        .co{font-size:15pt;font-weight:bold;color:#1B5299}
        .title{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;
          letter-spacing:3px;border:2px solid #1B5299;padding:6px;margin:0 0 14px;color:#1B5299}
        .infos{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px}
        .info-box{border:1px solid #ccc;padding:6px 10px;font-size:9pt}
        .info-label{font-size:8pt;color:#888;display:block}
        .info-val{font-weight:700;font-size:11pt}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th{background:#1A1A2E;color:white;padding:5px 7px;font-size:8pt;text-align:left}
        td{padding:4px 7px;font-size:9pt;border-bottom:1px solid #F0F0F0}
        tr.total td{background:#1B5299;color:white;font-weight:bold;padding:6px 7px}
        .recap{border:2px solid #1B5299;padding:10px 14px;margin-bottom:12px;font-size:10pt}
        .recap-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #E5E7EB}
        .recap-row:last-child{border:none;font-weight:bold;font-size:12pt;margin-top:4px}
        .footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px;font-size:9pt}
        .sign{border:1px solid #ccc;height:55px;padding:6px;text-align:center;color:#999}
        .mention{font-size:7pt;color:#888;text-align:center;margin-top:10px;border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:8px}}
      </style></head><body>
      <div class="header">
        <div><div class="co">${esc(params?.nom_entreprise ?? 'DZ SECURITY')}</div>
          <div style="font-size:8pt;color:#555">NIF: ${esc(params?.nif ?? '—')} · RC: ${esc(params?.rc ?? '—')} · Tél: ${esc(params?.telephone ?? '—')}</div>
        </div>
        <div style="text-align:right;font-size:8pt;color:#555">
          <div style="font-weight:bold;font-size:10pt">Période : ${data.periode}</div>
          <div>Émis le : ${new Date().toLocaleDateString('fr-DZ')}</div>
        </div>
      </div>
      <div class="title">DÉCLARATION MENSUELLE G50 — CNAS / IRG</div>
      <div class="infos">
        <div class="info-box"><span class="info-label">Nb employés déclarés</span><span class="info-val">${data.nb_employes}</span></div>
        <div class="info-box"><span class="info-label">Masse salariale brute</span><span class="info-val">${Number(data.masse_salariale).toFixed(2)} DA</span></div>
        <div class="info-box" style="background:#FFF0F0"><span class="info-label">TOTAL À VERSER</span><span class="info-val" style="color:#DC2626">${Number(data.total_a_verser).toFixed(2)} DA</span></div>
      </div>
      <table>
        <thead><tr>
          <th>Matricule</th><th>Nom &amp; Prénom</th>
          <th style="text-align:right">Brut (DA)</th>
          <th style="text-align:right">Assiette CNAS</th>
          <th style="text-align:right">CNAS sal. 9%</th>
          <th style="text-align:right">CNAS pat. 25%</th>
          <th style="text-align:right">IRG</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total">
            <td colspan="2">TOTAUX</td>
            <td style="text-align:right;font-family:monospace">${Number(data.masse_salariale).toFixed(2)}</td>
            <td></td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_cnas_sal).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_cnas_pat).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_irg).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <div class="recap">
        <div class="recap-row"><span>CNAS part salariale (9%)</span><span style="font-family:monospace">${Number(data.total_cnas_sal).toFixed(2)} DA</span></div>
        <div class="recap-row"><span>CNAS part patronale (25%)</span><span style="font-family:monospace">${Number(data.total_cnas_pat).toFixed(2)} DA</span></div>
        <div class="recap-row"><span>Total cotisations CNAS</span><span style="font-family:monospace">${Number(data.total_cotisations_cnas).toFixed(2)} DA</span></div>
        <div class="recap-row"><span>IRG (barème progressif 2024)</span><span style="font-family:monospace">${Number(data.total_irg).toFixed(2)} DA</span></div>
        <div class="recap-row"><span>TOTAL À VERSER AU TRÉSOR</span><span style="font-family:monospace;color:#DC2626">${Number(data.total_a_verser).toFixed(2)} DA</span></div>
      </div>
      <div class="footer">
        <div><div style="margin-bottom:4px;font-weight:600">Cachet et signature de l'employeur</div><div class="sign"></div></div>
        <div><div style="margin-bottom:4px;font-weight:600">Réservé CNAS / DGI</div><div class="sign">N° récépissé : _______________</div></div>
      </div>
      <div class="mention">
        Document généré par DZ SECURITY ERP · Art. 24-26 loi 83-14 · IRG barème 2024 art. 104bis CIDTA ·
        Délai de dépôt : avant le 20 du mois suivant · Archivage légal : 10 ans
      </div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const imprimerDAS = (data) => {
    if (!data) return;
    const rows = (data.details ?? []).map(e =>
      `<tr>
        <td>${esc(e.matricule ?? '—')}</td>
        <td>${esc(e.nom)} ${esc(e.prenom)}</td>
        <td style="text-align:center">${e.nb_mois}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.salaire_brut_an).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.cnas_sal_an).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.cnas_pat_an).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.irg_an).toFixed(2)}</td>
        <td style="text-align:right;font-family:monospace">${Number(e.net_an).toFixed(2)}</td>
      </tr>`
    ).join('');

    const win = window.open('', '_blank', 'width=1050,height=900');
    win.document.write(`
      <!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8"><title>DAS ${data.annee}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;font-size:9pt;padding:20px;color:#000}
        .header{display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:2px solid #1B5299;margin-bottom:14px}
        .title{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;
          letter-spacing:3px;border:2px solid #1B5299;padding:6px;margin:0 0 14px;color:#1B5299}
        .infos{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
        .info-box{border:1px solid #ccc;padding:6px 10px}
        .info-label{font-size:8pt;color:#888;display:block}
        .info-val{font-weight:700;font-size:11pt}
        table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:8.5pt}
        th{background:#1A1A2E;color:white;padding:5px 6px;text-align:left}
        td{padding:3px 6px;border-bottom:1px solid #F0F0F0}
        tr.total td{background:#1B5299;color:white;font-weight:bold;padding:5px 6px}
        .footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px;font-size:9pt}
        .sign{border:1px solid #ccc;height:55px;padding:6px;text-align:center;color:#999}
        .mention{font-size:7pt;color:#888;text-align:center;margin-top:10px;border-top:1px solid #eee;padding-top:6px}
        @media print{body{padding:8px}}
      </style></head><body>
      <div class="header">
        <div><div style="font-size:15pt;font-weight:bold;color:#1B5299">${esc(params?.nom_entreprise ?? 'DZ SECURITY')}</div>
          <div style="font-size:8pt;color:#555">NIF: ${esc(params?.nif ?? '—')} · RC: ${esc(params?.rc ?? '—')}</div>
        </div>
        <div style="text-align:right;font-size:8pt;color:#555">
          <div style="font-weight:bold;font-size:11pt">Exercice : ${data.annee}</div>
          <div>Émis le : ${new Date().toLocaleDateString('fr-DZ')}</div>
        </div>
      </div>
      <div class="title">DÉCLARATION ANNUELLE DES SALAIRES (DAS) — EXERCICE ${data.annee}</div>
      <div class="infos">
        <div class="info-box"><span class="info-label">Effectif déclaré</span><span class="info-val">${data.nb_employes}</span></div>
        <div class="info-box"><span class="info-label">Masse salariale</span><span class="info-val">${Number(data.masse_salariale_an ?? 0).toFixed(2)} DA</span></div>
        <div class="info-box"><span class="info-label">Total cotis. CNAS</span><span class="info-val">${Number(data.total_cotisations_cnas ?? 0).toFixed(2)} DA</span></div>
        <div class="info-box" style="background:#FFF0F0"><span class="info-label">Total IRG annuel</span><span class="info-val" style="color:#DC2626">${Number(data.total_irg_an ?? 0).toFixed(2)} DA</span></div>
      </div>
      <table>
        <thead><tr>
          <th>Matricule</th><th>Nom &amp; Prénom</th><th style="text-align:center">Mois</th>
          <th style="text-align:right">Brut annuel</th>
          <th style="text-align:right">CNAS sal.</th>
          <th style="text-align:right">CNAS pat.</th>
          <th style="text-align:right">IRG annuel</th>
          <th style="text-align:right">Net annuel</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr class="total">
            <td colspan="3">TOTAUX</td>
            <td style="text-align:right;font-family:monospace">${Number(data.masse_salariale_an ?? 0).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_cnas_sal_an ?? 0).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_cnas_pat_an ?? 0).toFixed(2)}</td>
            <td style="text-align:right;font-family:monospace">${Number(data.total_irg_an ?? 0).toFixed(2)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        <div><div style="margin-bottom:4px;font-weight:600">Cachet et signature de l'employeur</div><div class="sign"></div></div>
        <div><div style="margin-bottom:4px;font-weight:600">Réservé CNAS</div><div class="sign">N° enregistrement DAS : ___________</div></div>
      </div>
      <div class="mention">
        DZ SECURITY ERP · Déclaration annuelle des salaires · Art. 26 loi 83-14 · Délai de dépôt : 30 avril N+1 · Archivage : 10 ans
      </div>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const activeData = mode === 'g50' ? g50Data : dasData;

  return (
    <div>
      {/* Avertissement bulletins non validés */}
      {mode === 'g50' && nbValides < bulletins.length && bulletins.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4,
          padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
          ⚠️ <strong>{bulletins.length - nbValides} bulletin(s) en brouillon</strong> ne seront pas inclus dans le G50.
          Validez-les d'abord via l'onglet "Bulletins émis".
        </div>
      )}

      {/* Sélecteur G50 / DAS */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <div className="flex-row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label-sm">Type de déclaration</label>
            <div className="flex-row" style={{ gap: 8 }}>
              <button
                className="btn btn-xs"
                style={{ background: mode === 'g50' ? '#1B5299' : '#E5E7EB', color: mode === 'g50' ? 'white' : '#374151', border: 'none', padding: '6px 14px', fontWeight: 600 }}
                onClick={() => setMode('g50')}>G50 Mensuel</button>
              <button
                style={{ background: mode === 'das' ? '#1B5299' : '#E5E7EB', color: mode === 'das' ? 'white' : '#374151', border: 'none', padding: '6px 14px', fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}
                onClick={() => setMode('das')}>DAS Annuelle</button>
            </div>
          </div>

          {mode === 'das' && (
            <div>
              <label className="form-label-sm">Exercice</label>
              <select value={annee} onChange={e => setAnnee(e.target.value)} className="form-select" style={{ width: 110 }}>
                {[2026,2025,2024,2023].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={mode === 'g50' ? genererG50 : genererDAS}
            disabled={generating}
          >
            {generating ? '⏳ Génération…' : mode === 'g50' ? `📋 Générer G50 — ${moisLabel(periode)}` : `📋 Générer DAS ${annee}`}
          </button>
        </div>
      </div>

      {/* Résultat généré */}
      {activeData && (
        <div className="card mb-16" style={{ borderLeft: '4px solid #1B5299' }}>
          <div className="flex-between mb-14">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {mode === 'g50' ? `G50 — ${activeData.periode}` : `DAS — Exercice ${activeData.annee}`}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                {activeData.nb_employes} employés déclarés
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-xs" style={{ background: '#1B5299', color: 'white', border: 'none' }}
                onClick={() => mode === 'g50' ? imprimerG50(activeData) : imprimerDAS(activeData)}>
                🖨️ Imprimer
              </button>
              {activeData.declaration_id && (
                <button className="btn btn-xs" style={{ background: '#1A7A4A', color: 'white', border: 'none' }}
                  onClick={() => soumettre(activeData.declaration_id)}>
                  📤 Soumettre
                </button>
              )}
            </div>
          </div>

          {/* Récap chiffres */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
            {(mode === 'g50' ? [
              { l: 'Masse salariale', v: DA(activeData.masse_salariale), c: '#374151' },
              { l: 'CNAS sal. (9%)', v: DA(activeData.total_cnas_sal), c: '#7C3AED' },
              { l: 'CNAS pat. (25%)', v: DA(activeData.total_cnas_pat), c: '#9D174D' },
              { l: 'IRG', v: DA(activeData.total_irg), c: '#B45309' },
              { l: 'TOTAL À VERSER', v: DA(activeData.total_a_verser), c: '#DC2626' },
            ] : [
              { l: 'Masse salariale', v: DA(activeData.masse_salariale_an), c: '#374151' },
              { l: 'CNAS sal. annuel', v: DA(activeData.total_cnas_sal_an), c: '#7C3AED' },
              { l: 'CNAS pat. annuel', v: DA(activeData.total_cnas_pat_an), c: '#9D174D' },
              { l: 'IRG annuel', v: DA(activeData.total_irg_an), c: '#B45309' },
              { l: 'TOTAL COTISATIONS', v: DA(activeData.total_a_verser_an), c: '#DC2626' },
            ]).map(s => (
              <div key={s.l} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: 4, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>{s.l}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Soumission : champ référence */}
          <div className="flex-row" style={{ gap: 10, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="N° référence paiement (optionnel)"
              value={refPaiement}
              onChange={e => setRefPaiement(e.target.value)}
              className="form-input"
              style={{ marginBottom: 0, flex: 1, maxWidth: 300 }}
            />
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Référence virement/chèque CNAS</span>
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="card">
        <div className="section-title" style={{ fontSize: 14, marginBottom: 12 }}>
          Historique des déclarations
        </div>
        {historique.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>
            Aucune déclaration générée.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Type', 'Période', 'Nb emp.', 'Masse sal.', 'Total à verser', 'Soumis le', 'Réf.', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600,
                      fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em',
                      color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historique.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontWeight: 600, fontSize: 11,
                        color: d.type_declaration === 'G50_MENSUEL' ? '#1B5299' : '#7C3AED' }}>
                        {d.type_declaration === 'G50_MENSUEL' ? 'G50' : 'DAS'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>
                      {new Date(d.periode + 'T00:00:00').toLocaleDateString('fr-DZ', {
                        month: d.type_declaration === 'DAS_ANNUEL' ? undefined : 'long',
                        year: 'numeric'
                      })}
                    </td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>{d.nb_employes}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{DA(d.masse_salariale)}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#DC2626' }}>{DA(d.total_a_verser)}</td>
                    <td style={{ padding: '7px 10px', fontSize: 11, color: '#6B7280' }}>
                      {d.date_soumission ? new Date(d.date_soumission).toLocaleDateString('fr-DZ') : '—'}
                    </td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{d.reference_paiement ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}><StatutDeclBadge statut={d.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mention légale */}
      <div style={{ marginTop: 14, fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
        G50 : dépôt avant le 20 du mois suivant · DAS : dépôt avant le 30 avril N+1 · Art. 24-26 loi 83-14
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function Paie() {
  const { addToast } = useToastStore();
  const [tab,      setTab]      = useState('dashboard');
  const [periode,  setPeriode]  = useState(getMoisCourant());
  const [agents,   setAgents]   = useState([]);
  const [bulletins,setBulletins]= useState([]);
  const [params,   setParams]   = useState(null);
  const [dash,     setDash]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [calcLoading, setCalcLoading] = useState({});
  const [selected, setSelected] = useState(null);

  // ── Chargement initial agents & params ──────────────────────────────────────
  useEffect(() => {
    supabase.from('agents')
      .select('id,matricule,nom,prenom,salaire_brut,site_affecte,qualification,type_contrat,statut')
      .eq('statut', 'ACTIF')
      .order('nom')
      .then(({ data }) => setAgents(data ?? []));

    supabase.from('parametres_entreprise')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setParams(data ?? {}));
  }, []);

  // ── Chargement bulletins + dashboard pour la période ────────────────────────
  const recharger = useCallback(async () => {
    const pd = periodeDate(periode);
    const [{ data: buls }, { data: dashData }] = await Promise.all([
      supabase
        .from('bulletins_paie')
        .select('*, agents(nom,prenom,matricule,site_affecte,qualification,type_contrat)')
        .eq('periode', pd)
        .order('created_at', { ascending: false }),
      supabase.rpc('tableau_bord_paie', { p_periode: pd }),
    ]);
    setBulletins(buls ?? []);
    setDash(dashData);
  }, [periode]);

  useEffect(() => { recharger(); }, [recharger]);

  // ── Calculer un bulletin ─────────────────────────────────────────────────────
  const calculer = useCallback(async (agentId) => {
    setCalcLoading(p => ({ ...p, [agentId]: true }));
    try {
      const { data, error } = await supabase.rpc('calculer_bulletin', {
        p_agent_id:   agentId,
        p_periode:    periodeDate(periode),
        p_company_id: null,
      });
      if (error) throw error;
      addToast({ type: 'success', message: `✅ Bulletin calculé — ${data.nom_complet}` });
      await recharger();
    } catch (err) {
      addToast({ type: 'error', message: err.message ?? 'Erreur de calcul' });
    } finally {
      setCalcLoading(p => ({ ...p, [agentId]: false }));
    }
  }, [periode, recharger, addToast]);

  // ── Calculer tous les bulletins ──────────────────────────────────────────────
  const calculerTous = useCallback(async () => {
    if (agents.length === 0) return;
    setLoading(true);
    let ok = 0, fail = 0;
    for (const agent of agents) {
      try {
        const { error } = await supabase.rpc('calculer_bulletin', {
          p_agent_id:   agent.id,
          p_periode:    periodeDate(periode),
          p_company_id: null,
        });
        if (error) throw error;
        ok++;
      } catch {
        fail++;
      }
    }
    setLoading(false);
    addToast({
      type: ok === agents.length ? 'success' : ok > 0 ? 'warning' : 'error',
      message: `${ok} bulletin(s) calculé(s)${fail > 0 ? ` · ${fail} erreur(s)` : ''}`,
    });
    await recharger();
  }, [agents, periode, recharger, addToast]);

  // ── Valider un bulletin ──────────────────────────────────────────────────────
  const valider = useCallback(async (bulletinId) => {
    const { error } = await supabase.rpc('valider_bulletin', { p_bulletin_id: bulletinId });
    if (error) { addToast({ type: 'error', message: error.message }); return; }
    addToast({ type: 'success', message: '✅ Bulletin validé — immuable (loi 90-11)' });
    setSelected(null);
    await recharger();
  }, [recharger, addToast]);

  const TABS = [
    { key: 'dashboard',     label: '📊 Tableau de bord' },
    { key: 'calcul',        label: '⚙️ Calcul du mois' },
    { key: 'bulletins',     label: `📄 Bulletins émis${bulletins.length > 0 ? ` (${bulletins.length})` : ''}` },
    { key: 'declarations',  label: '📋 Déclarations CNAS/DAS' },
    { key: 'params',        label: '🔧 Paramètres paie' },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">MODULE PAIE — الأجور</h1>
      <p className="page-subtitle">
        Calcul automatique · Loi 90-11 · IRG barème 2024 · CNAS 9% · CACOBATPH BTP · 2,5 j congés/mois
      </p>

      {/* Sélecteur de période */}
      <div className="card flex-row mb-20"
        style={{ alignItems: 'center', gap: 14, padding: '12px 16px', flexWrap: 'wrap' }}>
        <label className="form-label-sm" style={{ marginBottom: 0, fontWeight: 700 }}>Période :</label>
        <input
          type="month"
          value={periode}
          onChange={e => setPeriode(e.target.value)}
          className="form-input"
          style={{ width: 170, marginBottom: 0 }}
        />
        <span style={{ fontSize: 13, color: '#1B5299', fontWeight: 600 }}>{moisLabel(periode)}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 11, color: '#6B7280' }}>
          <span>👥 {agents.length} agents actifs</span>
          <span>📄 {bulletins.length} bulletins</span>
        </div>
      </div>

      {/* Onglets */}
      <div className="nav-tabs mb-20">
        {TABS.map(t => (
          <button key={t.key}
            className={`nav-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu des onglets */}
      {tab === 'dashboard' && (
        <DashboardPaie dash={dash} periode={periode} totalAgents={agents.length} />
      )}
      {tab === 'calcul' && (
        <CalcMois
          agents={agents}
          bulletins={bulletins}
          periode={periode}
          calcLoading={calcLoading}
          globalLoading={loading}
          onCalculer={calculer}
          onCalculerTous={calculerTous}
        />
      )}
      {tab === 'bulletins' && (
        <ListeBulletins
          bulletins={bulletins}
          loading={loading}
          onSelect={setSelected}
          onValider={valider}
        />
      )}
      {tab === 'declarations' && (
        <DeclarationsTab
          periode={periode}
          params={params}
          bulletins={bulletins}
        />
      )}
      {tab === 'params' && (
        <ParamsPaie
          params={params}
          onSaved={() =>
            supabase.from('parametres_entreprise').select('*').limit(1).maybeSingle()
              .then(({ data }) => setParams(data ?? {}))
          }
        />
      )}

      {/* Modal bulletin détail */}
      {selected && (
        <BulletinModal
          bulletin={selected}
          params={params}
          onClose={() => setSelected(null)}
          onValider={valider}
        />
      )}
    </div>
  );
}

export default Paie;
