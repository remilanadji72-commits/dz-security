import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// ── Données ────────────────────────────────────────────────────────────────────
const WILAYAS = [
  'Adrar','Chlef','Laghouat','Oum El Bouaghi','Batna','Béjaïa','Biskra','Béchar',
  'Blida','Bouira','Tamanrasset','Tébessa','Tlemcen','Tiaret','Tizi Ouzou','Alger',
  'Djelfa','Jijel','Sétif','Saïda','Skikda','Sidi Bel Abbès','Annaba','Guelma',
  'Constantine','Médéa','Mostaganem','M\'Sila','Mascara','Ouargla','Oran','El Bayadh',
  'Illizi','Bordj Bou Arréridj','Boumerdès','El Tarf','Tindouf','Tissemsilt','El Oued',
  'Khenchela','Souk Ahras','Tipaza','Mila','Aïn Defla','Naâma','Aïn Témouchent',
  'Ghardaïa','Relizane',
];

const PLANS = [
  {
    id: 'STARTER', icon: '🌱', label: 'Starter', prix: '3 000', agents: 30,
    color: '#10b981', bg: '#ecfdf5',
    features: ['Jusqu\'à 30 agents', 'Pointage & incidents', 'Exports PDF/Excel', 'Support par email'],
  },
  {
    id: 'PME', icon: '🚀', label: 'PME', prix: '7 500', agents: 100,
    color: '#3b82f6', bg: '#eff6ff', badge: 'POPULAIRE',
    features: ['Jusqu\'à 100 agents', 'Tout Starter', 'Armurerie & Logistique', 'Carte interactive OPS', 'Module Fiscal IRG', 'Support prioritaire'],
  },
  {
    id: 'PRO', icon: '🏢', label: 'Pro', prix: '15 000', agents: 300,
    color: '#7c3aed', bg: '#faf5ff',
    features: ['Jusqu\'à 300 agents', 'Tout PME', 'Multi-sites illimités', 'API & webhooks', 'Formation incluse', 'Account manager dédié'],
  },
];

// ── Styles ─────────────────────────────────────────────────────────────────────
const INP = {
  padding: '11px 14px', border: '1px solid #e5e7eb', borderRadius: '10px',
  fontSize: '14px', width: '100%', boxSizing: 'border-box',
  backgroundColor: '#f9fafb', outline: 'none', transition: 'border-color 0.2s',
};
const LBL = { fontSize: '12px', fontWeight: '700', color: '#374151', display: 'block', marginBottom: '5px', letterSpacing: '0.2px' };

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={LBL}>{label}</label>
      {children}
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function Onboarding() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const [ent, setEnt] = useState({
    nom: '', numero_agrement: '', wilaya: 'Alger', telephone: '', email_pro: '', adresse: '',
  });
  const [adm, setAdm] = useState({ nom_complet: '', email: '', password: '', confirm: '' });
  const [plan, setPlan] = useState('PME');

  const se = (k, v) => setEnt(p => ({ ...p, [k]: v }));
  const sa = (k, v) => setAdm(p => ({ ...p, [k]: v }));

  const canNext = () => {
    if (step === 1) return ent.nom.trim().length >= 2 && ent.telephone.trim().length >= 9;
    if (step === 2) {
      const emailOk = adm.email.includes('@') && adm.email.includes('.');
      const passOk  = adm.password.length >= 8 && adm.password === adm.confirm;
      return adm.nom_complet.trim().length >= 3 && emailOk && passOk;
    }
    if (step === 3) return !!plan;
    return false;
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      // 1 — Créer le compte Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: adm.email.trim(),
        password: adm.password,
        options: { data: { full_name: adm.nom_complet.trim() } },
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Compte non créé — réessayez ou vérifiez votre email.');

      // 2 — Enregistrer l'entreprise
      const planInfo = PLANS.find(p => p.id === plan);
      const { data: entData, error: entErr } = await supabase
        .from('entreprises')
        .insert([{
          nom:              ent.nom.trim(),
          email:            ent.email_pro.trim() || adm.email.trim(),
          telephone:        ent.telephone.trim(),
          wilaya:           ent.wilaya,
          adresse:          ent.adresse.trim(),
          numero_agrement:  ent.numero_agrement.trim(),
          plan,
          max_agents:       planInfo.agents,
          owner_id:         userId,
          statut:           'ESSAI',
        }])
        .select()
        .single();
      if (entErr) throw entErr;

      // 3 — Créer le profil admin
      await supabase.from('profils_admin').insert([{
        id:         userId,
        role:       'GERANT',
        company_id: entData.id,
        nom:        adm.nom_complet.trim(),
        email:      adm.email.trim(),
      }]);

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  // ── Écran de succès ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f1b2d 0%, #1a3a6b 50%, #0d2137 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '48px 40px', maxWidth: '460px', width: '100%', textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '900', color: '#1e3a8a' }}>Espace créé avec succès !</h2>
          <p style={{ color: '#6b7280', marginBottom: '8px', lineHeight: 1.6 }}>
            Bienvenue <strong style={{ color: '#374151' }}>{adm.nom_complet}</strong> — votre espace <strong>{ent.nom}</strong> est prêt.
          </p>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '28px' }}>
            Un email de confirmation a été envoyé à <strong>{adm.email}</strong>.<br />
            Confirmez votre email puis connectez-vous.
          </p>
          <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '14px', marginBottom: '24px', border: '1px solid #86efac' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: '700' }}>
              ✅ 30 jours d'essai gratuit — Formule {plan}<br />
              <span style={{ fontWeight: '400', color: '#374151' }}>Aucune carte bancaire requise</span>
            </p>
          </div>
          <button onClick={() => navigate('/')}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white', fontWeight: '800', fontSize: '15px', cursor: 'pointer' }}>
            Se connecter maintenant →
          </button>
        </div>
      </div>
    );
  }

  const planActif = PLANS.find(p => p.id === plan);
  const stepTitles = ['Votre entreprise', 'Compte administrateur', 'Choisir une formule', 'Récapitulatif'];

  // ── Rendu principal ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f1b2d 0%, #1a3a6b 50%, #0d2137 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '40px', marginBottom: '6px' }}>🛡️</div>
        <h1 style={{ margin: 0, color: 'white', fontSize: '22px', fontWeight: '900', letterSpacing: '1px' }}>DZ SECURITY ERP</h1>
        <p style={{ margin: '4px 0 0 0', color: '#93c5fd', fontSize: '13px' }}>Logiciel de gestion pour sociétés de gardiennage algériennes</p>
      </div>

      {/* Carte principale */}
      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '36px 32px', width: '100%', maxWidth: step === 3 ? '900px' : '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', transition: 'max-width 0.3s ease' }}>

        {/* Barre de progression */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px', gap: '0' }}>
          {[1, 2, 3, 4].map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: s < 4 ? '0 0 auto' : '0 0 auto' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '900', fontSize: '13px', transition: 'all 0.2s',
                  backgroundColor: s < step ? '#10b981' : s === step ? '#1e3a8a' : '#e5e7eb',
                  color: s <= step ? 'white' : '#9ca3af',
                }}>
                  {s < step ? '✓' : s}
                </div>
                <span style={{ fontSize: '10px', marginTop: '4px', color: s === step ? '#1e3a8a' : '#9ca3af', fontWeight: s === step ? '700' : '400', whiteSpace: 'nowrap' }}>
                  {stepTitles[s - 1]}
                </span>
              </div>
              {i < 3 && (
                <div style={{ flex: 1, height: '2px', backgroundColor: s < step ? '#10b981' : '#e5e7eb', margin: '0 6px', marginBottom: '18px', transition: 'background-color 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Entreprise ── */}
        {step === 1 && (
          <div>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>🏢 Informations sur votre entreprise</h2>
            <Field label="Nom de la société *">
              <input type="text" value={ent.nom} onChange={e => se('nom', e.target.value)} placeholder="Ex: Sécurité Algérienne SARL" style={INP} autoFocus />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="N° Agrément (Ministère Intérieur)">
                <input type="text" value={ent.numero_agrement} onChange={e => se('numero_agrement', e.target.value)} placeholder="Ex: 16/2024/AG/001" style={INP} />
              </Field>
              <Field label="Wilaya *">
                <select value={ent.wilaya} onChange={e => se('wilaya', e.target.value)} style={INP}>
                  {WILAYAS.map(w => <option key={w}>{w}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Téléphone *">
                <input type="tel" value={ent.telephone} onChange={e => se('telephone', e.target.value)} placeholder="0550 XX XX XX" style={INP} />
              </Field>
              <Field label="Email professionnel">
                <input type="email" value={ent.email_pro} onChange={e => se('email_pro', e.target.value)} placeholder="contact@masociete.dz" style={INP} />
              </Field>
            </div>
            <Field label="Adresse du siège">
              <input type="text" value={ent.adresse} onChange={e => se('adresse', e.target.value)} placeholder="N° rue, commune, wilaya" style={INP} />
            </Field>
          </div>
        )}

        {/* ── ÉTAPE 2 : Compte admin ── */}
        {step === 2 && (
          <div>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>👤 Votre compte administrateur</h2>
            <Field label="Nom complet *">
              <input type="text" value={adm.nom_complet} onChange={e => sa('nom_complet', e.target.value)} placeholder="Prénom & Nom" style={INP} autoFocus />
            </Field>
            <Field label="Adresse email (identifiant de connexion) *">
              <input type="email" value={adm.email} onChange={e => sa('email', e.target.value)} placeholder="vous@email.com" style={INP} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Mot de passe * (min. 8 caractères)">
                <input type="password" value={adm.password} onChange={e => sa('password', e.target.value)} placeholder="••••••••" style={INP} />
              </Field>
              <Field label="Confirmer le mot de passe *">
                <input type="password" value={adm.confirm} onChange={e => sa('confirm', e.target.value)} placeholder="••••••••"
                  style={{ ...INP, borderColor: adm.confirm && adm.confirm !== adm.password ? '#ef4444' : '' }} />
              </Field>
            </div>
            {adm.confirm && adm.confirm !== adm.password && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '-8px 0 12px 0' }}>⚠️ Les mots de passe ne correspondent pas</p>
            )}
            {adm.password && adm.password.length < 8 && (
              <p style={{ color: '#f59e0b', fontSize: '12px', margin: '-8px 0 12px 0' }}>⚠️ Minimum 8 caractères requis</p>
            )}
            <div style={{ backgroundColor: '#eff6ff', borderRadius: '10px', padding: '12px 14px', border: '1px solid #bfdbfe' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#1d4ed8', lineHeight: 1.5 }}>
                🔐 Ce compte aura le rôle <strong>GÉRANT</strong> — accès complet à tous les modules.<br />
                Vous pourrez créer d'autres comptes (RH, Opérations…) après connexion.
              </p>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : Formule ── */}
        {step === 3 && (
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>💼 Choisissez votre formule</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>30 jours d'essai gratuit — sans carte bancaire, annulation à tout moment</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {PLANS.map(p => (
                <div key={p.id} onClick={() => setPlan(p.id)}
                  style={{
                    border: `2px solid ${plan === p.id ? p.color : '#e5e7eb'}`,
                    borderRadius: '16px', padding: '20px', cursor: 'pointer', position: 'relative',
                    backgroundColor: plan === p.id ? p.bg : 'white',
                    transform: plan === p.id ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.2s', boxShadow: plan === p.id ? `0 8px 24px ${p.color}33` : 'none',
                  }}>
                  {p.badge && (
                    <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', backgroundColor: p.color, color: 'white', padding: '2px 12px', borderRadius: '20px', fontSize: '10px', fontWeight: '900', letterSpacing: '1px' }}>
                      {p.badge}
                    </div>
                  )}
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{p.icon}</div>
                  <div style={{ fontWeight: '900', fontSize: '16px', color: '#1e293b', marginBottom: '2px' }}>{p.label}</div>
                  <div style={{ fontSize: '22px', fontWeight: '900', color: p.color, marginBottom: '12px' }}>
                    {p.prix} DA<span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '400' }}>/mois</span>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                    {p.features.map(f => (
                      <li key={f} style={{ fontSize: '12px', color: '#374151', padding: '3px 0', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ color: p.color, fontWeight: '900', flexShrink: 0 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  {plan === p.id && (
                    <div style={{ marginTop: '12px', padding: '6px', backgroundColor: p.color, borderRadius: '8px', textAlign: 'center', color: 'white', fontSize: '12px', fontWeight: '800' }}>
                      ✓ Formule sélectionnée
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ÉTAPE 4 : Récapitulatif ── */}
        {step === 4 && (
          <div>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '900', color: '#1e3a8a' }}>✅ Récapitulatif avant création</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏢 Entreprise</p>
                <p style={{ margin: '3px 0', fontWeight: '800', fontSize: '14px', color: '#1e293b' }}>{ent.nom}</p>
                <p style={{ margin: '3px 0', fontSize: '12px', color: '#6b7280' }}>📍 {ent.wilaya}</p>
                {ent.numero_agrement && <p style={{ margin: '3px 0', fontSize: '12px', color: '#6b7280' }}>🪪 {ent.numero_agrement}</p>}
                <p style={{ margin: '3px 0', fontSize: '12px', color: '#6b7280' }}>📞 {ent.telephone}</p>
              </div>
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '11px', fontWeight: '900', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👤 Administrateur</p>
                <p style={{ margin: '3px 0', fontWeight: '800', fontSize: '14px', color: '#1e293b' }}>{adm.nom_complet}</p>
                <p style={{ margin: '3px 0', fontSize: '12px', color: '#6b7280' }}>✉️ {adm.email}</p>
                <p style={{ margin: '3px 0', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>🔑 Rôle GÉRANT</p>
              </div>
            </div>

            <div style={{ backgroundColor: planActif?.bg, border: `2px solid ${planActif?.color}`, borderRadius: '12px', padding: '16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '32px' }}>{planActif?.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '15px', color: planActif?.color }}>Formule {planActif?.label}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>
                  {planActif?.prix} DA/mois · jusqu'à {planActif?.agents} agents
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>30 jours d'essai gratuit inclus</p>
              </div>
            </div>

            {error && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          {step > 1 && (
            <button onClick={() => { setStep(s => s - 1); setError(''); }}
              style={{ flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: 'white', fontWeight: '700', cursor: 'pointer', color: '#374151', fontSize: '14px' }}>
              ← Retour
            </button>
          )}
          {step < 4 && (
            <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
              style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: canNext() ? 'pointer' : 'not-allowed', fontSize: '14px', transition: 'all 0.2s',
                background: canNext() ? 'linear-gradient(135deg, #1e3a8a, #3b82f6)' : '#e5e7eb',
                color: canNext() ? 'white' : '#9ca3af' }}>
              Continuer →
            </button>
          )}
          {step === 4 && (
            <button onClick={handleCreate} disabled={loading}
              style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: loading ? '#9ca3af' : 'white', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
              {loading ? '⏳ Création en cours…' : '🚀 Créer mon espace gratuit'}
            </button>
          )}
        </div>

        {/* Lien connexion */}
        <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: '#9ca3af' }}>
          Déjà client ?{' '}
          <Link to="/" style={{ color: '#3b82f6', fontWeight: '700', textDecoration: 'none' }}>Se connecter →</Link>
        </p>
      </div>

      {/* Footer */}
      <p style={{ marginTop: '20px', color: '#4b6a9b', fontSize: '11px', textAlign: 'center' }}>
        🔒 Données hébergées en Europe (Frankfurt) · Conforme RGPD · © 2026 DZ Security ERP
      </p>
    </div>
  );
}
