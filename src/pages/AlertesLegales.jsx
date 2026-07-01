import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore';

// ── Config types d'alertes ───────────────────────────────────────────────────
const TYPE_CONFIG = {
  CNAS_J5: {
    fr: 'CNAS – Déclaration J-5',
    ar: 'الضمان الاجتماعي CNAS – 5 أيام',
    icon: '🏛️',
    badgeColor: '#dc2626',
    ref: 'Décret 94-11',
  },
  CNAS_J1: {
    fr: 'CNAS – URGENT J-1',
    ar: 'الضمان الاجتماعي CNAS – عاجل',
    icon: '🚨',
    badgeColor: '#7f1d1d',
    ref: 'Décret 94-11',
  },
  FIN_ABATTEMENT_ANEM: {
    fr: 'Fin abattement ANEM',
    ar: 'نهاية الإعفاء ANEM',
    icon: '📋',
    badgeColor: '#d97706',
    ref: 'Loi 04-19',
  },
  EXPIRATION_CARTE_PRO: {
    fr: 'Carte pro expire',
    ar: 'انتهاء البطاقة المهنية',
    icon: '🪪',
    badgeColor: '#dc2626',
    ref: 'Loi 06-03',
  },
  EXPIRATION_CQ: {
    fr: 'CQ expire',
    ar: 'انتهاء شهادة المؤهل',
    icon: '🎓',
    badgeColor: '#d97706',
    ref: 'Arrêté 21/01/2008',
  },
  MINISTERE_INTERIEUR: {
    fr: 'Déclaration Ministère Intérieur',
    ar: 'التصريح بوزارة الداخلية',
    icon: '🏛️',
    badgeColor: '#1d4ed8',
    ref: 'Loi 06-03',
  },
};

const PRIORITE = {
  HAUTE:   { bg: '#fee2e2', c: '#991b1b', icon: '🔴', label: 'Haute',   labelAr: 'عالية'   },
  MOYENNE: { bg: '#fef3c7', c: '#92400e', icon: '🟡', label: 'Moyenne', labelAr: 'متوسطة'  },
  BASSE:   { bg: '#f0fdf4', c: '#15803d', icon: '🟢', label: 'Basse',   labelAr: 'منخفضة'  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

function JoursBadge({ date }) {
  const j = date ? Math.ceil((new Date(date) - new Date()) / 86400000) : null;
  if (j === null) return <span style={{ color: '#9ca3af' }}>—</span>;
  const { bg, c } =
    j <= 0  ? { bg: '#fecaca', c: '#991b1b' } :
    j <= 1  ? { bg: '#fee2e2', c: '#7f1d1d' } :
    j <= 5  ? { bg: '#fef2f2', c: '#dc2626' } :
    j <= 15 ? { bg: '#fef3c7', c: '#d97706' } :
              { bg: '#f0fdf4', c: '#15803d' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: '20px', backgroundColor: bg, color: c, fontWeight: '800', fontSize: '11px', whiteSpace: 'nowrap' }}>
      {j <= 0 ? '⚠️ Dépassée' : `J-${j}`}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
function AlertesLegales() {
  const { alertesData, marquerAlerteLue, ignorerAlerte, fetchAlertes } = useDataStore();

  const [filtreType,     setFiltreType]     = useState('');
  const [filtrePriorite, setFiltrePriorite] = useState('');
  const [lang,           setLang]           = useState('fr');
  const [loading,        setLoading]        = useState({});

  // ── Données dérivées ──────────────────────────────────────────────────────
  const alertesFiltrees = useMemo(() =>
    alertesData.filter(a =>
      (!filtreType      || a.type_alerte === filtreType) &&
      (!filtrePriorite  || a.priorite    === filtrePriorite)
    ),
    [alertesData, filtreType, filtrePriorite]);

  const stats = useMemo(() => ({
    total:   alertesData.length,
    haute:   alertesData.filter(a => a.priorite === 'HAUTE').length,
    moyenne: alertesData.filter(a => a.priorite === 'MOYENNE').length,
    basse:   alertesData.filter(a => a.priorite === 'BASSE').length,
  }), [alertesData]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleLue = async (id) => {
    setLoading(l => ({ ...l, [id]: true }));
    await marquerAlerteLue(id);
    setLoading(l => ({ ...l, [id]: false }));
  };

  const handleIgnorer = async (id) => {
    setLoading(l => ({ ...l, [id]: true }));
    await ignorerAlerte(id);
    setLoading(l => ({ ...l, [id]: false }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* En-tête */}
      <div className="page-header mb-20">
        <span style={{ fontSize: '32px' }}>🔔</span>
        <div>
          <h1 className="page-title">ALERTES LÉGALES — تنبيهات قانونية</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            {stats.total} alertes actives · {stats.haute} urgentes · Conformité ANEM / CNAS / loi 06-03
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setLang(l => l === 'fr' ? 'ar' : 'fr')}
            style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '13px' }}>
            {lang === 'fr' ? 'عربي' : 'Français'}
          </button>
          <button
            onClick={fetchAlertes}
            style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { l: 'Actives',  v: stats.total,   bg: '#dbeafe', c: '#1d4ed8', icon: '🔔' },
          { l: 'Urgentes', v: stats.haute,   bg: '#fee2e2', c: '#991b1b', icon: '🔴' },
          { l: 'Moyennes', v: stats.moyenne, bg: '#fef3c7', c: '#92400e', icon: '🟡' },
          { l: 'Basses',   v: stats.basse,   bg: '#f0fdf4', c: '#15803d', icon: '🟢' },
        ].map(k => (
          <div key={k.l} style={{ backgroundColor: k.bg, borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icon}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{k.l}</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filtreType}
          onChange={e => setFiltreType(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white' }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.fr}</option>
          ))}
        </select>
        <select
          value={filtrePriorite}
          onChange={e => setFiltrePriorite(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', backgroundColor: 'white' }}>
          <option value="">Toutes priorités</option>
          <option value="HAUTE">🔴 Haute</option>
          <option value="MOYENNE">🟡 Moyenne</option>
          <option value="BASSE">🟢 Basse</option>
        </select>
        {(filtreType || filtrePriorite) && (
          <button
            onClick={() => { setFiltreType(''); setFiltrePriorite(''); }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            ✕ Réinitialiser
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
          {alertesFiltrees.length} résultat{alertesFiltrees.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau / État vide */}
      {alertesFiltrees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontWeight: '900' }}>Aucune alerte active</h3>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>Toutes les obligations légales sont à jour.</p>
          <p style={{ color: '#9ca3af', fontSize: '12px', margin: '8px 0 0 0', direction: 'rtl', fontFamily: 'serif' }}>
            لا توجد تنبيهات قانونية معلقة — جميع الالتزامات محدّثة
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  {['Priorité', 'Type', 'Référence', 'Agent', 'Message', 'Échéance', 'Délai', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: '800', fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alertesFiltrees.map((alerte, i) => {
                  const p   = PRIORITE[alerte.priorite] || PRIORITE.BASSE;
                  const tc  = TYPE_CONFIG[alerte.type_alerte] || {};
                  const nom = alerte.agents?.nom || '—';
                  const msg = lang === 'ar' ? alerte.message_ar : alerte.message_fr;
                  const busy = !!loading[alerte.id];
                  return (
                    <tr key={alerte.id}
                      style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '20px', backgroundColor: p.bg, color: p.c, fontWeight: '800', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {p.icon} {lang === 'ar' ? p.labelAr : p.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: tc.badgeColor || '#374151', fontWeight: '700', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {tc.icon} {lang === 'ar' ? (tc.ar || tc.fr) : tc.fr}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#9ca3af', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {tc.ref || '—'}
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: '700', color: '#1e3a8a', whiteSpace: 'nowrap' }}>{nom}</td>
                      <td style={{ padding: '11px 14px', color: '#374151', maxWidth: '260px' }}>
                        <span style={{ direction: lang === 'ar' ? 'rtl' : 'ltr', display: 'block', lineHeight: '1.5' }}>
                          {msg}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {dateFr(alerte.date_echeance)}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <JoursBadge date={alerte.date_echeance} />
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleLue(alerte.id)}
                            disabled={busy}
                            title="Marquer comme traitée"
                            style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#dcfce7', color: '#15803d', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '11px', opacity: busy ? 0.6 : 1 }}>
                            ✓
                          </button>
                          <button
                            onClick={() => handleIgnorer(alerte.id)}
                            disabled={busy}
                            title="Ignorer"
                            style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#6b7280', cursor: busy ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '11px', opacity: busy ? 0.6 : 1 }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Référence légale */}
      <div style={{ marginTop: '24px', padding: '16px 20px', backgroundColor: '#eff6ff', borderRadius: '10px', borderLeft: '4px solid #3b82f6' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e40af', fontWeight: '800' }}>
          📜 Base légale · الأساس القانوني
        </p>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: '12px', color: '#374151', lineHeight: '2' }}>
          <li>
            <strong>Décret exécutif 94-11</strong> — Délai de déclaration CNAS : 10 jours ouvrables après recrutement (loi 83-14 art. 13)
          </li>
          <li>
            <strong>Loi n°04-19</strong> — Placement des travailleurs : déclaration obligatoire auprès de l'ANEM avant recrutement
          </li>
          <li>
            <strong>Loi 06-03 du 15 juillet 2006</strong> — Activités de gardiennage : agrément + déclaration auprès du Ministère de l'Intérieur
          </li>
          <li>
            <strong>Arrêté du 21 janvier 2008</strong> — Certificat de Qualification (CQ) obligatoire pour tout agent de gardiennage
          </li>
          <li>
            <strong>SMIG gardiennage 2026</strong> : 24 000 DA (janvier 2026) · Abattement ANEM : 25 % / 15 % / 5 % / 2,5 % selon type · Durée : 3 ans renouvelable
          </li>
        </ul>
      </div>

    </div>
  );
}

export default AlertesLegales;
