import React, { useState } from 'react';

/**
 * Aperçu des lignes parsées avant confirmation de l'import.
 *
 * Props :
 *  rows     {Object[]}  — lignes valides prêtes à insérer
 *  errors   {Array}     — erreurs de validation [{line, msg}]
 *  colDefs  {Array}     — définitions de colonnes (du même excelUtils)
 *  label    {string}    — titre affiché (ex: "Import Agents")
 *  onConfirm(rows)      — async callback : effectue le vrai upsert, ferme la modal
 *  onCancel()           — ferme la modal sans insérer
 */
export default function ImportPreviewModal({ rows, errors, colDefs, label, onConfirm, onCancel }) {
  const [tab, setTab]           = useState('valides');
  const [confirming, setConfirming] = useState(false);

  // Max 7 colonnes affichées dans le tableau (évite le défilement horizontal excessif)
  const visibleCols = (colDefs || []).filter(c => !c.skipImport).slice(0, 7);

  const handleConfirm = async () => {
    setConfirming(true);
    try { await onConfirm(rows); }
    finally { setConfirming(false); }
  };

  return (
    // ── Overlay ───────────────────────────────────────────────────────────────
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(15,23,42,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      {/* ── Boîte modale ──────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '16px',
        width: '100%', maxWidth: '960px', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>

        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
        }}>
          <span style={{ fontSize: '26px' }}>📊</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'white' }}>
              {label} — Aperçu avant import
              <span style={{ fontWeight: '400', opacity: 0.8, marginLeft: '8px', fontSize: '13px' }}>· معاينة قبل الاستيراد</span>
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
              Vérifiez les données avant de les insérer en base
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7', fontSize: '12px', fontWeight: '800' }}>
              ✅ {rows.length} valide{rows.length > 1 ? 's' : ''}
            </span>
            {errors.length > 0 && (
              <span style={{ padding: '4px 10px', borderRadius: '20px', backgroundColor: 'rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: '12px', fontWeight: '800' }}>
                ❌ {errors.length} erreur{errors.length > 1 ? 's' : ''}
              </span>
            )}
            <button onClick={onCancel}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', color: 'white', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Onglets ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '2px', padding: '10px 24px 0', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
          {[
            { key: 'valides', label: `✅ Données valides (${rows.length})` },
            ...(errors.length > 0 ? [{ key: 'erreurs', label: `❌ Erreurs (${errors.length})` }] : []),
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '7px 18px', border: 'none', borderRadius: '8px 8px 0 0',
                cursor: 'pointer', fontWeight: '700', fontSize: '12px', transition: 'all 0.15s',
                backgroundColor: tab === t.key ? '#1e3a8a' : 'transparent',
                color: tab === t.key ? 'white' : '#6b7280',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contenu ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>

          {/* Tableau des lignes valides */}
          {tab === 'valides' && (
            rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <p style={{ fontSize: '14px', fontWeight: '600' }}>Aucune ligne valide détectée dans ce fichier.</p>
                <p style={{ fontSize: '12px' }}>Téléchargez le modèle et remplissez-le correctement.</p>
              </div>
            ) : (
              <>
                {visibleCols.length < (colDefs || []).filter(c => !c.skipImport).length && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
                    ℹ️ Aperçu limité aux {visibleCols.length} premières colonnes — toutes les colonnes seront importées.
                  </p>
                )}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '9px 10px', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap', width: '36px' }}>#</th>
                        {visibleCols.map(c => (
                          <th key={c.key} style={{ padding: '9px 12px', backgroundColor: '#1e3a8a', color: 'white', fontWeight: '700', textAlign: 'left', whiteSpace: 'nowrap', minWidth: '110px' }}>
                            {c.label}
                            {c.labelAr && <span style={{ display: 'block', fontWeight: '400', opacity: 0.7, fontSize: '10px' }}>{c.labelAr}</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : 'white' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#f8fafc' : 'white')}>
                          <td style={{ padding: '7px 10px', color: '#9ca3af', fontWeight: '700', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>{i + 1}</td>
                          {visibleCols.map(c => {
                            const val = row[c.key];
                            const display = c.type === 'boolean'
                              ? (val ? 'OUI' : 'NON')
                              : (val !== null && val !== undefined ? String(val) : '—');
                            return (
                              <td key={c.key} style={{
                                padding: '7px 12px', borderBottom: '1px solid #f1f5f9',
                                maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                color: val === null || val === undefined ? '#d1d5db' : '#1e293b',
                              }}
                                title={display}>
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          )}

          {/* Liste des erreurs */}
          {tab === 'erreurs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>
                Ces lignes ne seront <strong>pas importées</strong>. Corrigez-les dans votre fichier et relancez l'import.
              </p>
              {errors.map((err, i) => (
                <div key={i} style={{
                  backgroundColor: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: '8px', padding: '10px 14px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>❌</span>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#991b1b' }}>
                      {err.line === 0 ? 'Fichier' : `Ligne ${err.line}`}
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#7f1d1d', lineHeight: '1.5' }}>{err.msg}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pied de page ────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc',
        }}>
          <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
            {rows.length > 0 && errors.length > 0
              ? `⚠️ ${errors.length} ligne(s) ignorée(s) — seules les ${rows.length} lignes valides seront insérées.`
              : rows.length > 0
              ? `✅ Toutes les lignes sont valides. Prêt pour l'import.`
              : `❌ Aucune ligne valide. Corrigez le fichier avant de réessayer.`}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onCancel}
              style={{ padding: '10px 22px', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#374151' }}>
              Annuler · إلغاء
            </button>
            <button onClick={handleConfirm} disabled={confirming || rows.length === 0}
              style={{
                padding: '10px 22px', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '13px',
                cursor: rows.length === 0 || confirming ? 'not-allowed' : 'pointer',
                backgroundColor: rows.length === 0 || confirming ? '#9ca3af' : '#059669',
                color: 'white', minWidth: '200px',
              }}>
              {confirming
                ? '⏳ Import en cours…'
                : `✅ Confirmer l'import (${rows.length} ligne${rows.length > 1 ? 's' : ''}) · تأكيد`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
