import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { colors } from '../constants';

// ── Styles helpers ──────────────────────────────────────────────────────────
const INP = { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#f9fafb' };
const LBL = { fontSize: '11px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const GRID = cols => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${cols}px, 1fr))`, gap: '16px' });

function SaveBar({ onSave, loading, saved }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
      <button onClick={onSave} disabled={loading}
        style={{ padding: '10px 22px', borderRadius: '9px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
        {loading ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
      </button>
      {saved === 'ok'  && <span style={{ color: '#15803d', fontWeight: '700', fontSize: '13px' }}>✅ Sauvegardé</span>}
      {saved === 'err' && <span style={{ color: '#991b1b', fontWeight: '700', fontSize: '13px' }}>❌ Erreur de sauvegarde</span>}
    </div>
  );
}

function ListEditor({ titre, icone, valeurs, onAdd, onDelete, placeholder, accentColor = '#1e3a8a' }) {
  const [nouvel, setNouvel] = useState('');
  const submit = e => { e.preventDefault(); if (nouvel.trim()) { onAdd(nouvel.trim()); setNouvel(''); } };
  return (
    <div className="card" style={{ border: `2px solid ${accentColor}22` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '22px' }}>{icone}</span>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '900', color: accentColor }}>{titre}</h3>
        <span style={{ marginLeft: 'auto', fontSize: '12px', padding: '2px 10px', borderRadius: '10px', backgroundColor: `${accentColor}18`, color: accentColor, fontWeight: '800' }}>{valeurs.length}</span>
      </div>
      <form onSubmit={submit} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input type="text" value={nouvel} onChange={e => setNouvel(e.target.value)} placeholder={placeholder} style={{ ...INP, flex: 1 }} />
        <button type="submit" style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', backgroundColor: accentColor, color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }}>+ Ajouter</button>
      </form>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', maxHeight: '220px', overflowY: 'auto' }}>
        {valeurs.length === 0
          ? <p style={{ margin: 0, padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Aucun élément — ajoutez-en via le champ ci-dessus.</p>
          : valeurs.map((v, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: i < valeurs.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>{v}</span>
              <button onClick={() => onDelete(v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: '900', fontSize: '16px', lineHeight: 1, padding: '0 4px' }} title="Supprimer">×</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function SeuilRow({ label, icone, value, onChange, unite = 'jours', help }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{icone}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151' }}>{label}</div>
        {help && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{help}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <input type="number" min="1" max="365" value={value} onChange={e => onChange(parseInt(e.target.value) || 1)}
          style={{ ...INP, width: '70px', textAlign: 'center', fontWeight: '800', fontSize: '14px' }} />
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600', minWidth: '35px' }}>{unite}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
const DEFAULTS = {
  // Profil
  nom_entreprise: 'DZ Security', adresse: '', telephone: '', email: '', nif: '', nis: '', rc: '', art: '',
  // Finance
  taux_facturation_moyen: '', prime_panier: '', tva: 19, prime_nuit: 0, prime_dimanche: 0, prime_risque: 0, charges_patronales: 26,
  // Listes
  wilayas:          ['16 - Alger', '06 - Bejaia', '31 - Oran', '30 - Ouargla', '33 - Illizi'],
  types_rotations:  ['Brigade 3x8', 'Brigade 2x12', 'Journée (08h-16h)'],
  types_postes:     ['Poste fixe', 'Patrouille mobile', 'Événementiel', 'Escorte VIP', 'Banque / CCP'],
  grades_agents:    ['Agent de sécurité', 'Chef d\'équipe', 'Superviseur', 'Chef de site', 'Inspecteur'],
  // Seuils (jours avant expiry pour déclencher alerte)
  seuil_nettoyage_pistolet: 7,
  seuil_nettoyage_fusil:    15,
  seuil_radio:              10,
  seuil_assurance:          30,
  seuil_vignette:           20,
  seuil_ct:                 30,
  seuil_contrat:            45,
};

function Parametres() {
  const [onglet, setOnglet] = useState('profil');
  const [params, setParams] = useState(DEFAULTS);
  const [saving, setSaving] = useState(null);
  const [savedState, setSavedState] = useState({});
  const [loadDone, setLoadDone] = useState(false);
  const [companyId, setCompanyId] = useState(null); // company_id du tenant connecté
  // Référence aux timers de feedback pour éviter l'accumulation si l'utilisateur clique vite
  const feedbackTimers = useRef({});

  const setP = (key, val) => setParams(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Récupérer le company_id de l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profil } = await supabase
        .from('profils_admin')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      const cid = profil?.company_id;
      if (!cid || cancelled) { setLoadDone(true); return; }
      if (!cancelled) setCompanyId(cid);

      // Charger les paramètres du tenant connecté (plus de .eq('id', 1) codé en dur)
      const { data } = await supabase
        .from('parametres_entreprise')
        .select('*')
        .eq('company_id', cid)
        .single();
      if (data) {
        setParams(prev => ({
          ...prev,
          ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && v !== undefined)),
          wilayas:         Array.isArray(data.wilayas)         ? data.wilayas         : prev.wilayas,
          types_rotations: Array.isArray(data.types_rotations) ? data.types_rotations : prev.types_rotations,
          types_postes:    Array.isArray(data.types_postes)    ? data.types_postes    : prev.types_postes,
          grades_agents:   Array.isArray(data.grades_agents)   ? data.grades_agents   : prev.grades_agents,
        }));
      }
      if (!cancelled) {
        setLoadDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // clearTimeout avant chaque nouveau timer pour éviter l'accumulation
  const feedback = useCallback((section, ok) => {
    if (feedbackTimers.current[section]) clearTimeout(feedbackTimers.current[section]);
    setSavedState(s => ({ ...s, [section]: ok ? 'ok' : 'err' }));
    feedbackTimers.current[section] = setTimeout(
      () => setSavedState(s => ({ ...s, [section]: null })),
      3000
    );
  }, []);

  const sauvegarder = useCallback(async (section, champs) => {
    if (!companyId) return;
    setSaving(section);
    const payload = Object.fromEntries(champs.map(k => [k, params[k]]));
    // company_id remplace .eq('id', 1) — chaque tenant ne peut modifier que ses propres paramètres
    const { error } = await supabase
      .from('parametres_entreprise')
      .update(payload)
      .eq('company_id', companyId);
    setSaving(null);
    feedback(section, !error);
  }, [params, companyId, feedback]);

  const ajouterItem = (cle, val) => setP(cle, [...(params[cle] || []), val]);
  const supprimerItem = (cle, val) => setP(cle, (params[cle] || []).filter(v => v !== val));

  const sauvegarderListes = useCallback(async () => {
    if (!companyId) return;
    setSaving('listes');
    const { error } = await supabase
      .from('parametres_entreprise')
      .update({
        wilayas: params.wilayas, types_rotations: params.types_rotations,
        types_postes: params.types_postes, grades_agents: params.grades_agents,
      })
      .eq('company_id', companyId);
    setSaving(null);
    feedback('listes', !error);
  }, [params, companyId, feedback]);

  if (!loadDone) return (
    <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
      <div style={{ textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
        <p style={{ margin: 0, fontWeight: '700' }}>Chargement des paramètres…</p>
      </div>
    </div>
  );

  return (
    <div className="page-container">
      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>⚙️</span>
        <div>
          <h1 className="page-title">PARAMÈTRES DU SYSTÈME</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Profil · Finance · Référentiels · Alertes · Système</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="nav-tabs mb-20">
        {[
          { key: 'profil',   label: '🏢 Profil Société'    },
          { key: 'finance',  label: '💰 Variables Financières' },
          { key: 'listes',   label: '🗂️ Référentiels'       },
          { key: 'alertes',  label: '🔔 Seuils d\'Alertes'  },
          { key: 'systeme',  label: '🗄️ Système'            },
        ].map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)} className={`nav-tab${onglet === t.key ? ' active' : ''}`}
            style={onglet === t.key ? { backgroundColor: '#1e3a8a' } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── PROFIL SOCIÉTÉ ─────────────────────────────────────────────── */}
      {onglet === 'profil' && (
        <div className="card" style={{ maxWidth: '860px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '22px' }}>
            <span style={{ fontSize: '24px' }}>🏢</span>
            <h3 style={{ margin: 0, fontWeight: '900', color: '#1e3a8a' }}>Informations légales & coordonnées</h3>
          </div>

          <div style={GRID(220)}>
            {[
              { key: 'nom_entreprise', label: 'Raison sociale',  ph: 'DZ Security SARL' },
              { key: 'telephone',      label: 'Téléphone',        ph: '+213 21 XX XX XX'  },
              { key: 'email',          label: 'Email',            ph: 'contact@dzsecurity.dz', type: 'email' },
            ].map(f => (
              <div key={f.key}>
                <label style={LBL}>{f.label}</label>
                <input type={f.type || 'text'} value={params[f.key] || ''} onChange={e => setP(f.key, e.target.value)} placeholder={f.ph} style={INP} />
              </div>
            ))}
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={LBL}>Adresse du siège social</label>
            <textarea rows={2} value={params.adresse || ''} onChange={e => setP('adresse', e.target.value)}
              placeholder="N° Rue, Cité, Wilaya" style={{ ...INP, resize: 'vertical' }} />
          </div>

          <div style={{ ...GRID(180), marginTop: '14px' }}>
            {[
              { key: 'nif', label: 'NIF', ph: 'Numéro d\'Identifiant Fiscal' },
              { key: 'nis', label: 'NIS', ph: 'N° d\'Identif. Statistique'  },
              { key: 'rc',  label: 'RC',  ph: 'Registre de Commerce'         },
              { key: 'art', label: 'Art', ph: 'Art. d\'Imposition'           },
            ].map(f => (
              <div key={f.key}>
                <label style={LBL}>{f.label}</label>
                <input type="text" value={params[f.key] || ''} onChange={e => setP(f.key, e.target.value)} placeholder={f.ph} style={INP} />
              </div>
            ))}
          </div>

          <SaveBar onSave={() => sauvegarder('profil', ['nom_entreprise', 'adresse', 'telephone', 'email', 'nif', 'nis', 'rc', 'art'])}
            loading={saving === 'profil'} saved={savedState.profil} />
        </div>
      )}

      {/* ─── VARIABLES FINANCIÈRES ─────────────────────────────────────── */}
      {onglet === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '860px' }}>

          <div className="card card-dark">
            <h3 style={{ margin: '0 0 18px 0', fontWeight: '900', color: 'white', fontSize: '14px' }}>💼 Facturation & Fiscalité</h3>
            <div style={GRID(180)}>
              {[
                { key: 'taux_facturation_moyen', label: 'Taux horaire moyen (DZD)', ph: '0', help: 'Tarif H/agent facturé au client' },
                { key: 'tva',                    label: 'TVA (%)',                   ph: '19' },
                { key: 'charges_patronales',      label: 'Charges patronales (%)',    ph: '26', help: 'Part employeur sécurité sociale' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ ...LBL, color: '#d1d5db' }}>{f.label}</label>
                  {f.help && <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#9ca3af' }}>{f.help}</p>}
                  <input type="number" value={params[f.key] || ''} onChange={e => setP(f.key, e.target.value)} placeholder={f.ph}
                    style={{ ...INP, backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card card-blue">
            <h3 style={{ margin: '0 0 18px 0', fontWeight: '900', color: '#1e3a8a', fontSize: '14px' }}>💵 Primes & Indemnités (DZD / jour)</h3>
            <div style={GRID(180)}>
              {[
                { key: 'prime_panier',    label: 'Prime panier',      ph: '0', help: 'Indemnité repas journalière'   },
                { key: 'prime_nuit',      label: 'Prime de nuit',     ph: '0', help: 'Supplément vacation nuit'     },
                { key: 'prime_dimanche',  label: 'Prime dimanche',    ph: '0', help: 'Supplément dimanche & fériés' },
                { key: 'prime_risque',    label: 'Prime de risque',   ph: '0', help: 'Sites classés dangereux'      },
              ].map(f => (
                <div key={f.key}>
                  <label style={LBL}>{f.label}</label>
                  {f.help && <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#9ca3af' }}>{f.help}</p>}
                  <input type="number" value={params[f.key] || ''} onChange={e => setP(f.key, e.target.value)} placeholder={f.ph} style={INP} />
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu coût agent */}
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '14px', padding: '18px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#15803d', fontWeight: '900' }}>📊 Aperçu — Coût journalier estimé (8h)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              {[
                { l: 'Facturation client (8h)', v: ((parseFloat(params.taux_facturation_moyen) || 0) * 8).toLocaleString('fr-DZ'), s: 'DZD HT' },
                { l: 'TVA', v: (((parseFloat(params.taux_facturation_moyen) || 0) * 8) * ((parseFloat(params.tva) || 0) / 100)).toLocaleString('fr-DZ'), s: 'DZD' },
                { l: 'Primes journalières', v: ((parseFloat(params.prime_panier) || 0) + (parseFloat(params.prime_nuit) || 0) + (parseFloat(params.prime_dimanche) || 0)).toLocaleString('fr-DZ'), s: 'DZD' },
              ].map(k => (
                <div key={k.l} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #d1fae5' }}>
                  <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>{k.l}</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#15803d' }}>{k.v} <span style={{ fontSize: '11px', fontWeight: '400' }}>{k.s}</span></div>
                </div>
              ))}
            </div>
          </div>

          <SaveBar onSave={() => sauvegarder('finance', ['taux_facturation_moyen', 'prime_panier', 'tva', 'prime_nuit', 'prime_dimanche', 'prime_risque', 'charges_patronales'])}
            loading={saving === 'finance'} saved={savedState.finance} />
        </div>
      )}

      {/* ─── RÉFÉRENTIELS ──────────────────────────────────────────────── */}
      {onglet === 'listes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fcd34d', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
            ⚠️ Ces listes alimentent les menus déroulants de toute l'application. Cliquez <strong>Sauvegarder</strong> après modification.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '14px' }}>
            <ListEditor titre="Wilayas / Zones d'intervention" icone="🗺️"
              valeurs={params.wilayas || []} onAdd={v => ajouterItem('wilayas', v)} onDelete={v => supprimerItem('wilayas', v)}
              placeholder="Ex: 39 - El Oued" accentColor="#1e3a8a" />
            <ListEditor titre="Types de Rotations / ODS" icone="⏱️"
              valeurs={params.types_rotations || []} onAdd={v => ajouterItem('types_rotations', v)} onDelete={v => supprimerItem('types_rotations', v)}
              placeholder="Ex: 48h/72h Base Sud" accentColor={colors.green} />
            <ListEditor titre="Types de Postes de Garde" icone="🏛️"
              valeurs={params.types_postes || []} onAdd={v => ajouterItem('types_postes', v)} onDelete={v => supprimerItem('types_postes', v)}
              placeholder="Ex: Escorte VIP" accentColor={colors.blue} />
            <ListEditor titre="Grades des Agents" icone="🎖️"
              valeurs={params.grades_agents || []} onAdd={v => ajouterItem('grades_agents', v)} onDelete={v => supprimerItem('grades_agents', v)}
              placeholder="Ex: Inspecteur Général" accentColor="#7c3aed" />
          </div>
          <SaveBar onSave={sauvegarderListes} loading={saving === 'listes'} saved={savedState.listes} />
        </div>
      )}

      {/* ─── SEUILS D'ALERTES ──────────────────────────────────────────── */}
      {onglet === 'alertes' && (
        <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#1d4ed8', fontWeight: '600' }}>
            ℹ️ Nombre de jours <strong>avant expiration</strong> à partir duquel une alerte est déclenchée dans les modules concernés.
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#7c3aed', fontSize: '14px' }}>🔫 Armement</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SeuilRow label="Alerte nettoyage — Pistolets" icone="🔫" help="Alerte si nettoyage non effectué dans X jours"
                value={params.seuil_nettoyage_pistolet || 7} onChange={v => setP('seuil_nettoyage_pistolet', v)} />
              <SeuilRow label="Alerte nettoyage — Fusils / Carabines" icone="🗡️" help="Délai avant alerte (fusils ont délai 90j)"
                value={params.seuil_nettoyage_fusil || 15} onChange={v => setP('seuil_nettoyage_fusil', v)} />
              <SeuilRow label="Contrôle Radios UHF/VHF" icone="📻" help="Alerte si contrôle non effectué dans 90j"
                value={params.seuil_radio || 10} onChange={v => setP('seuil_radio', v)} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#0369a1', fontSize: '14px' }}>🚗 Parc Roulant</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SeuilRow label="Fin d'assurance véhicule" icone="🛡️" value={params.seuil_assurance || 30} onChange={v => setP('seuil_assurance', v)} />
              <SeuilRow label="Expiration vignette" icone="📋" value={params.seuil_vignette || 20} onChange={v => setP('seuil_vignette', v)} />
              <SeuilRow label="Contrôle technique (CT)" icone="🔧" value={params.seuil_ct || 30} onChange={v => setP('seuil_ct', v)} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 14px 0', fontWeight: '900', color: '#15803d', fontSize: '14px' }}>📄 Contrats</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SeuilRow label="Fin de contrat client" icone="📄" help="Alerte X jours avant échéance contrat"
                value={params.seuil_contrat || 45} onChange={v => setP('seuil_contrat', v)} />
            </div>
          </div>

          <SaveBar onSave={() => sauvegarder('alertes', ['seuil_nettoyage_pistolet', 'seuil_nettoyage_fusil', 'seuil_radio', 'seuil_assurance', 'seuil_vignette', 'seuil_ct', 'seuil_contrat'])}
            loading={saving === 'alertes'} saved={savedState.alertes} />
        </div>
      )}

      {/* ─── SYSTÈME ───────────────────────────────────────────────────── */}
      {onglet === 'systeme' && (
        <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Infos application */}
          <div className="card card-dark">
            <h3 style={{ margin: '0 0 16px 0', fontWeight: '900', color: 'white', fontSize: '14px' }}>🖥️ Application DZ Security Fusion</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { l: 'Version',       v: '2.0.0'              },
                { l: 'Framework',     v: 'React 18 + Vite 5'  },
                { l: 'Backend',       v: 'Supabase (PostgreSQL)' },
                { l: 'Date de build', v: new Date().toLocaleDateString('fr-FR') },
                { l: 'Modules actifs', v: '14 modules'         },
                { l: 'RBAC',          v: '5 rôles (Gérant, Ops, RH, Commercial, Juridique)' },
              ].map(i => (
                <div key={i.l} style={{ padding: '10px 14px', backgroundColor: '#374151', borderRadius: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{i.l}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>{i.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Test connexion Supabase */}
          <TestSupabase />

          {/* SQL migration hint */}
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#e2e8f0', fontWeight: '900', fontSize: '13px' }}>
              🗄️ Migration SQL — Nouveaux champs Paramètres
            </h4>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#94a3b8' }}>
              Exécutez ce bloc dans Supabase → SQL Editor pour activer toutes les fonctionnalités de paramétrage :
            </p>
            <pre style={{ margin: 0, backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', fontSize: '11px', color: '#7dd3fc', overflowX: 'auto', lineHeight: 1.6 }}>{`ALTER TABLE parametres_entreprise
  ADD COLUMN IF NOT EXISTS nom_entreprise     TEXT    DEFAULT 'DZ Security',
  ADD COLUMN IF NOT EXISTS adresse            TEXT,
  ADD COLUMN IF NOT EXISTS telephone          TEXT,
  ADD COLUMN IF NOT EXISTS email              TEXT,
  ADD COLUMN IF NOT EXISTS nif                TEXT,
  ADD COLUMN IF NOT EXISTS nis                TEXT,
  ADD COLUMN IF NOT EXISTS rc                 TEXT,
  ADD COLUMN IF NOT EXISTS art                TEXT,
  ADD COLUMN IF NOT EXISTS wilayas            JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS types_rotations    JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS types_postes       JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS grades_agents      JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS prime_nuit         NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_dimanche     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prime_risque       NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_patronales NUMERIC DEFAULT 26,
  ADD COLUMN IF NOT EXISTS seuil_nettoyage_pistolet INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS seuil_nettoyage_fusil    INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS seuil_radio              INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS seuil_assurance          INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS seuil_vignette           INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS seuil_ct                 INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS seuil_contrat            INTEGER DEFAULT 45;`}</pre>
            <button onClick={() => navigator.clipboard.writeText(`ALTER TABLE parametres_entreprise\n  ADD COLUMN IF NOT EXISTS nom_entreprise TEXT DEFAULT 'DZ Security';\n-- (voir la fenêtre ci-dessus pour le SQL complet)`)}
              style={{ marginTop: '10px', padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
              📋 Copier le SQL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Test Supabase connection ─────────────────────────────────────────────────
function TestSupabase() {
  const [status, setStatus] = useState('idle');
  const [latence, setLatence] = useState(null);

  const tester = async () => {
    setStatus('loading');
    const t0 = performance.now();
    try {
      const { error } = await supabase.from('parametres_entreprise').select('id').limit(1);
      const ms = Math.round(performance.now() - t0);
      setLatence(ms);
      // PGRST116 = "no rows" — la connexion est OK, la table est vide
      const realError = error && error.code !== 'PGRST116';
      setStatus(realError ? 'error' : 'ok');
    } catch { setStatus('error'); }
  };

  return (
    <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ fontSize: '24px' }}>🔌</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '800', color: '#374151', marginBottom: '3px' }}>Connexion Supabase</div>
        <div style={{ fontSize: '12px', color: status === 'ok' ? '#15803d' : status === 'error' ? '#991b1b' : '#6b7280', fontWeight: '600' }}>
          {status === 'idle'    && 'Cliquez Tester pour vérifier la connexion'}
          {status === 'loading' && '⏳ Test en cours…'}
          {status === 'ok'     && `✅ Connecté — latence ${latence}ms`}
          {status === 'error'  && '❌ Connexion échouée — vérifiez .env'}
        </div>
      </div>
      <button onClick={tester} disabled={status === 'loading'}
        style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '800', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>
        🔍 Tester
      </button>
    </div>
  );
}

export default Parametres;
