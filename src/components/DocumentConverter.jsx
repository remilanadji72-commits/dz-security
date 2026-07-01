import React, { useState, useRef, useCallback, useEffect } from 'react';
import { convertToMarkdown, getFormatInfo, isOCRFormat, markdownToHTML, SUPPORTED } from '../utils/markitdown';
import { toast } from '../store/useToastStore';

// ── Styles constants ──────────────────────────────────────────────────────────
const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 10000,
  backgroundColor: 'rgba(7,16,31,0.75)',
  display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
};
const PANEL = {
  width: '680px', maxWidth: '100vw',
  backgroundColor: '#0c1829',
  display: 'flex', flexDirection: 'column',
  boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
  animation: 'slideIn 0.22s ease-out',
};
const HDR = {
  padding: '16px 20px',
  borderBottom: '1px solid #12243a',
  display: 'flex', alignItems: 'center', gap: '12px',
  background: 'linear-gradient(135deg, #0a1628 0%, #0f1e38 100%)',
  flexShrink: 0,
};
const BTN = (bg, hover) => ({
  padding: '7px 14px', border: 'none', borderRadius: '6px',
  backgroundColor: bg, color: 'white', fontWeight: '700',
  cursor: 'pointer', fontSize: '12px', transition: 'opacity 0.15s',
  display: 'inline-flex', alignItems: 'center', gap: '5px',
});

const SUPPORTED_LIST = Object.entries(SUPPORTED).map(
  ([ext, { label, icon }]) => ({ ext, label, icon })
);

// ── Composant principal ───────────────────────────────────────────────────────

export default function DocumentConverter({ onClose }) {
  const [file,     setFile]     = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [progress, setProgress] = useState({ step: '', pct: 0 });
  const [tab,      setTab]      = useState('raw');   // 'raw' | 'preview'
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const fmt  = file ? getFormatInfo(file.name) : null;
  const ext  = file?.name.split('.').pop().toLowerCase();
  const lines = markdown.split('\n').length;
  const words = markdown.split(/\s+/).filter(Boolean).length;

  // Fermer avec Échap
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Conversion ────────────────────────────────────────────────────────────
  const runConvert = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setMarkdown('');
    setLoading(true);
    setProgress({ step: 'Démarrage…', pct: 0 });

    try {
      if (isOCRFormat(f.name)) {
        toast.info('Pour les images, utilisez l\'outil OCR dans le module Recrutement.');
        setLoading(false);
        return;
      }
      const md = await convertToMarkdown(f, (step, pct) => setProgress({ step, pct }));
      setMarkdown(md);
      setTab('raw');
      toast.success(`Converti en Markdown · ${md.split('\n').length} lignes`);
    } catch (err) {
      toast.error('Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) runConvert(f);
  }, [runConvert]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(markdown);
    toast.success('Markdown copié dans le presse-papiers');
  };

  const handleDownload = () => {
    const name = file?.name.replace(/\.[^.]+$/, '') || 'document';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframe animation */}
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .mid-preview h1,.mid-preview h2,.mid-preview h3,.mid-preview h4,.mid-preview h5,.mid-preview h6
          { color:#c8d8f0; margin:12px 0 6px; line-height:1.3; }
        .mid-preview h1 { font-size:1.3em; border-bottom:1px solid #1e3060; padding-bottom:4px; }
        .mid-preview h2 { font-size:1.15em; }
        .mid-preview h3 { font-size:1.05em; }
        .mid-preview p  { margin:6px 0; color:#a8c0d8; line-height:1.65; }
        .mid-preview strong { color:#e8e4da; }
        .mid-preview em { color:#a8d8c8; font-style:italic; }
        .mid-preview code { background:#050c18; color:#5ea898; font-family:'Courier New',monospace; font-size:12px; padding:2px 6px; border-radius:3px; }
        .mid-preview pre { background:#050c18; padding:12px 14px; border-radius:6px; overflow-x:auto; margin:8px 0; border-left:2px solid #c8a84a; }
        .mid-preview pre code { background:none; padding:0; color:#7aa8c8; font-size:11px; }
        .mid-preview ul,.mid-preview ol { padding-left:22px; margin:6px 0; color:#a8c0d8; }
        .mid-preview li { margin:3px 0; }
        .mid-preview blockquote { border-left:3px solid #c8a84a; margin:8px 0; padding:6px 12px; color:#8090a8; font-style:italic; }
        .mid-preview hr { border:none; border-top:1px solid #1e3060; margin:12px 0; }
        .mid-preview a { color:#7eaed4; text-underline-offset:2px; }
        .mid-preview del { color:#6b7280; }
        .mid-preview .md-table { border-collapse:collapse; width:100%; margin:8px 0; font-size:12px; }
        .mid-preview .md-table th { background:#0f1e38; color:#c8a84a; padding:7px 10px; text-align:left; border:1px solid #1e3060; font-size:11px; }
        .mid-preview .md-table td { padding:7px 10px; border:1px solid #1a2e4a; color:#8fa8c8; }
        .mid-preview .md-table tr:nth-child(even) td { background:#0b1829; }
      `}</style>

      <div style={OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div style={PANEL}>

          {/* ── En-tête ── */}
          <div style={HDR}>
            <span style={{ fontSize: '22px' }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: '11px', color: '#c8a84a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
                MarkItDown
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#d0dced' }}>
                Convertisseur de documents → Markdown
                <span style={{ marginLeft: '6px', fontWeight: '400', color: '#5a7aa0', fontSize: '11px' }}>· تحويل المستندات</span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', width: '30px', height: '30px', cursor: 'pointer', color: '#5a7aa0', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>

          {/* ── Corps scrollable ── */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* ── Zone de dépôt ── */}
            <div style={{ padding: '16px 20px', flexShrink: 0 }}>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragging ? '#c8a84a' : '#1e3060'}`,
                  borderRadius: '10px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragging ? '#0f1e38' : '#070f1c',
                  transition: 'all 0.15s',
                }}>

                {loading ? (
                  /* Progression */
                  <div>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                    <div style={{ fontSize: '12px', color: '#c8a84a', fontFamily: "'Courier New', monospace", marginBottom: '10px' }}>
                      {progress.step}
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#0f1e38', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress.pct}%`, backgroundColor: '#c8a84a', borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                ) : file && fmt ? (
                  /* Fichier chargé */
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '24px' }}>{fmt.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#c8d8f0', fontFamily: "'Courier New', monospace" }}>{file.name}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                        <span style={{ backgroundColor: fmt.color + '22', color: fmt.color, border: `1px solid ${fmt.color}44`, borderRadius: '3px', padding: '1px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {fmt.label}
                        </span>
                        <span style={{ fontSize: '11px', color: '#4a6a88' }}>
                          {(file.size / 1024).toFixed(1)} Ko — cliquer pour changer
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* État initial */
                  <div>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#6a88a8', marginBottom: '6px' }}>
                      Déposer un document ici · أو انقر للاختيار
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
                      {SUPPORTED_LIST.map(({ ext: e, icon, label, color }) => (
                        <span key={e} style={{ backgroundColor: '#0f1e38', color: '#5a7aa0', border: '1px solid #1e3060', borderRadius: '3px', padding: '2px 7px', fontSize: '10px', fontFamily: "'Courier New', monospace" }}>
                          {icon} .{e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <input ref={inputRef} type="file"
                  accept={Object.keys(SUPPORTED).map(e => `.${e}`).join(',')}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) runConvert(f); e.target.value = ''; }}
                  style={{ display: 'none' }} />
              </div>
            </div>

            {/* ── Résultat Markdown ── */}
            {markdown && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 20px 20px' }}>

                {/* Barre d'outils résultat */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {/* Infos */}
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#3d5070', letterSpacing: '0.06em' }}>
                    {lines} lignes · {words} mots
                  </span>
                  <span style={{ flex: 1 }} />
                  {/* Onglets vue */}
                  {[
                    { k: 'raw',     label: '{ } Markdown brut' },
                    { k: 'preview', label: '👁 Aperçu rendu' },
                  ].map(t => (
                    <button key={t.k} onClick={() => setTab(t.k)}
                      style={{ padding: '5px 12px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', backgroundColor: tab === t.k ? '#c8a84a' : '#0f1e38', color: tab === t.k ? '#07101f' : '#5a7aa0', transition: 'all 0.15s' }}>
                      {t.label}
                    </button>
                  ))}
                  <button onClick={handleCopy} style={BTN('#1d4ed8')}>📋 Copier</button>
                  <button onClick={handleDownload} style={BTN('#059669')}>💾 .md</button>
                </div>

                {/* Zone d'affichage */}
                {tab === 'raw' ? (
                  <textarea
                    readOnly value={markdown} spellCheck={false}
                    style={{
                      flex: 1, width: '100%', minHeight: '350px', resize: 'none',
                      background: '#050c18', color: '#7aa8c8', border: '1px solid #122040',
                      borderRadius: '6px', padding: '14px 16px',
                      fontFamily: "'Courier New', Courier, monospace", fontSize: '11.5px',
                      lineHeight: '1.65', outline: 'none',
                    }}
                  />
                ) : (
                  <div
                    className="mid-preview"
                    style={{
                      flex: 1, minHeight: '350px', overflowY: 'auto',
                      background: '#050c18', border: '1px solid #122040', borderRadius: '6px',
                      padding: '16px 20px', fontSize: '13px', lineHeight: '1.65',
                    }}
                    dangerouslySetInnerHTML={{ __html: markdownToHTML(markdown) }}
                  />
                )}
              </div>
            )}

            {/* ── Guide formats (si aucun fichier) ── */}
            {!file && (
              <div style={{ padding: '0 20px 24px', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: '#2d4260', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Formats &amp; capacités
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { exts: ['txt','md'],    desc: 'Lecture directe, formatage préservé' },
                    { exts: ['docx'],        desc: 'Titres, listes, tableaux, gras, italique (via mammoth)' },
                    { exts: ['xlsx','xls'],  desc: 'Un tableau Markdown par feuille de classeur' },
                    { exts: ['csv'],         desc: 'Tableau Markdown, auto-détection séparateur (,/;)' },
                    { exts: ['html','htm'],  desc: 'Extraction du contenu, suppression des scripts/styles' },
                    { exts: ['json'],        desc: 'Bloc de code formaté et indenté' },
                  ].map(({ exts, desc }) => (
                    <div key={exts[0]} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 10px', background: '#070f1c', borderRadius: '5px', border: '1px solid #0f1e30' }}>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {exts.map(e => {
                          const f = SUPPORTED[e];
                          return (
                            <span key={e} style={{ fontFamily: "'Courier New', monospace", fontSize: '10px', color: f?.color || '#5a7aa0', backgroundColor: (f?.color || '#1d4ed8') + '18', padding: '1px 6px', borderRadius: '2px', border: `1px solid ${(f?.color || '#1d4ed8')}33` }}>
                              .{e}
                            </span>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#4a6a88' }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
