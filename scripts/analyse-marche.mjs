#!/usr/bin/env node
/**
 * analyse-marche.mjs — Extraction IA de marchés/contrats (DZ Security)
 *
 * Usage :
 *   node scripts/analyse-marche.mjs <fichier.pdf|jpg|png> [options]
 *   npm run analyse-marche -- fichier.pdf
 *
 * Options :
 *   --modele <nom>   Modèle Ollama  (défaut: llama3.2)
 *   --url <url>      URL Ollama     (défaut: http://localhost:11434)
 *   --langue <str>   Langues OCR    (défaut: fra+ara+eng)
 *   --page <n>       Page PDF seule (défaut: toutes)
 *   --supabase       Sauvegarder dans Supabase après confirmation
 */

import fs   from 'fs';
import path from 'path';
import { spawnSync }     from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.join(__dirname, '..');
const cjsReq     = createRequire(import.meta.url);

// ── ANSI ─────────────────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', bold:'\x1b[1m', red:'\x1b[31m', green:'\x1b[32m',
  yellow:'\x1b[33m', cyan:'\x1b[36m', gray:'\x1b[90m', white:'\x1b[37m' };
const c    = (col, t) => `${C[col]}${t}${C.reset}`;
const bold = t => `${C.bold}${t}${C.reset}`;
const log  = (...a) => console.error(...a);   // stderr → progress visible
const out  = (...a) => console.log(...a);     // stdout → données pures

// ── Args ──────────────────────────────────────────────────────────────────────
const argv   = process.argv.slice(2);
const getArg = (f, d) => { const i = argv.indexOf(f); return i !== -1 ? argv[i+1] : d; };
const FICHIER = argv.find(a => !a.startsWith('-'));
const MODELE  = getArg('--modele', 'llama3.2');
const OLL_URL = getArg('--url',    'http://localhost:11434');
const LANGUE  = getArg('--langue', 'fra+ara+eng');
const PAGE    = getArg('--page',   null);
const SUPA    = argv.includes('--supabase');

if (!FICHIER || argv.includes('--help')) {
  out(`
${bold('DZ Security — Analyseur IA de marchés / contrats')}

${c('cyan','Usage:')}
  node scripts/analyse-marche.mjs <fichier> [options]
  npm run analyse-marche -- <fichier> [options]

${c('cyan','Options:')}
  --modele <nom>    Modèle Ollama      (défaut: ${c('yellow','llama3.2')})
  --url    <url>    URL Ollama         (défaut: ${c('yellow','http://localhost:11434')})
  --langue <str>    Langues OCR        (défaut: ${c('yellow','fra+ara+eng')})
  --page   <n>      Page PDF uniquement
  --supabase        Enregistrer dans Supabase après confirmation

${c('cyan','Exemples:')}
  npm run analyse-marche -- marche.pdf
  npm run analyse-marche -- scan.jpg --modele mistral
  npm run analyse-marche -- contrat.pdf --page 1 --supabase
`);
  process.exit(0);
}

// ── Auto-install helper ───────────────────────────────────────────────────────
function ensureDep(pkg) {
  const mark = path.join(ROOT, 'node_modules', pkg.split('/')[0], 'package.json');
  if (fs.existsSync(mark)) return true;
  log(c('yellow', `  📦 Installation de ${pkg}...`));
  const r = spawnSync('npm', ['install', '--no-save', pkg], {
    cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32',
  });
  return r.status === 0;
}

// ── pdfjs-dist v6 loader (ESM, cached) ───────────────────────────────────────
let _pdfjs = null;
async function loadPdfjs() {
  if (_pdfjs) return _pdfjs;
  if (!ensureDep('pdfjs-dist')) return null;

  // Chemins relatifs à ROOT (pas au script)
  const relPdfs = [
    'node_modules/pdfjs-dist/legacy/build/pdf.mjs',
    'node_modules/pdfjs-dist/build/pdf.mjs',
  ];
  const relWorkers = [
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    'node_modules/pdfjs-dist/build/pdf.worker.mjs',
  ];

  for (let i = 0; i < relPdfs.length; i++) {
    const absPdf    = path.join(ROOT, relPdfs[i]);
    const absWorker = path.join(ROOT, relWorkers[i]);
    if (!fs.existsSync(absPdf)) continue;
    try {
      // file: URL pour dynamic import sur Windows
      const fileUrl = 'file:///' + absPdf.replace(/\\/g, '/');
      const mod = await import(fileUrl);
      _pdfjs = mod.default || mod;
      if (_pdfjs.GlobalWorkerOptions && fs.existsSync(absWorker)) {
        _pdfjs.GlobalWorkerOptions.workerSrc =
          'file:///' + absWorker.replace(/\\/g, '/');
      }
      log(c('gray', `  pdfjs: ${relPdfs[i]}`));
      return _pdfjs;
    } catch (e) {
      log(c('yellow', `  ⚠ pdfjs import échoué (${relPdfs[i]}): ${e.message}`));
    }
  }
  return null;
}

// ── PDF text extraction ────────────────────────────────────────────────────────
async function extractPdfText(filePath, pageNum = null) {
  const pdfjs = await loadPdfjs();
  if (!pdfjs) { log(c('yellow','  ⚠ pdfjs-dist non disponible')); return ''; }

  const data = new Uint8Array(fs.readFileSync(filePath));
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
      useWorkerFetch: false,
    }).promise;
  } catch (e) {
    log(c('yellow', `  ⚠ pdfjs getDocument: ${e.message}`));
    return '';
  }

  log(c('gray', `  PDF: ${doc.numPages} page(s)`));
  const pages = pageNum
    ? [parseInt(pageNum)]
    : Array.from({ length: doc.numPages }, (_, i) => i + 1);

  let allText = '';
  for (const n of pages) {
    if (n > doc.numPages) continue;
    try {
      const page    = await doc.getPage(n);
      const content = await page.getTextContent();
      const txt     = content.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (txt) allText += (allText ? `\n\n--- PAGE ${n} ---\n\n` : '') + txt;
    } catch { /* page skip */ }
  }
  return allText;
}

// ── PDF → image buffers (pdfjs-dist + @napi-rs/canvas) ───────────────────────
async function renderPdfPages(filePath, pageNum = null) {
  // @napi-rs/canvas est CJS → createRequire
  ensureDep('@napi-rs/canvas');
  let createCanvas;
  try {
    const mod = cjsReq(path.join(ROOT, 'node_modules/@napi-rs/canvas/index.js'));
    createCanvas = (mod.default || mod).createCanvas;
  } catch (e) {
    log(c('red', `  ✗ @napi-rs/canvas: ${e.message}`));
    log(c('yellow','  → Convertissez le PDF en JPG dans votre lecteur PDF puis relancez'));
    return [];
  }

  const pdfjs = await loadPdfjs();
  if (!pdfjs) return [];

  const data = new Uint8Array(fs.readFileSync(filePath));
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, useWorkerFetch: false }).promise;
  } catch (e) {
    log(c('yellow', `  ⚠ Rendu PDF: ${e.message}`)); return [];
  }

  const pages   = pageNum ? [parseInt(pageNum)] : Array.from({ length: doc.numPages }, (_, i) => i+1);
  const buffers = [];

  for (const n of pages) {
    if (n > doc.numPages) continue;
    log(c('gray', `  Rendu page ${n}/${doc.numPages}...`));
    try {
      const page     = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas   = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx      = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      buffers.push(canvas.toBuffer('image/png'));
    } catch (e) {
      log(c('yellow', `  ⚠ Rendu page ${n}: ${e.message}`));
    }
  }
  return buffers;
}

// ── OCR (tesseract.js) ─────────────────────────────────────────────────────────
async function ocrInput(input, lang) {
  let createWorker;
  try {
    const mod = await import('tesseract.js');
    createWorker = (mod.default || mod).createWorker;
  } catch (e) {
    log(c('red', `  ✗ tesseract.js: ${e.message}`)); return '';
  }

  process.stderr.write(c('gray','  OCR: 0%'));
  const worker = await createWorker(lang, 1, {
    logger: m => {
      if (m.status === 'recognizing text')
        process.stderr.write(`\r  OCR: ${Math.round(m.progress * 100).toString().padStart(3)}%`);
    },
  });
  const { data: { text } } = await worker.recognize(input);
  await worker.terminate();
  process.stderr.write('\r  OCR: 100% ✓\n');
  return text;
}

// ── Ollama AI extraction ───────────────────────────────────────────────────────
async function extractWithOllama(texte, modele, baseUrl) {
  const PROMPT = `Tu es un expert en marchés publics et contrats de gardiennage en Algérie.
Analyse le texte suivant extrait d'un document officiel et extrais les informations structurées.

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant/après). Mets "" si absent.

{
  "nouveauClient":  "Raison sociale complète du client",
  "adresseSiege":   "Adresse du siège social",
  "contactNom":     "Nom du représentant légal / responsable",
  "contactTel":     "Téléphone (05/06/07XXXXXXXX)",
  "rc":             "Registre de commerce",
  "nif":            "NIF",
  "nis":            "NIS",
  "art":            "Article d'imposition",
  "nouveauSite":    "Nom et adresse du site à protéger",
  "reference":      "Référence officielle du document",
  "typeDoc":        "CONTRAT ou MARCHE ou CONVENTION ou AVENANT",
  "dateSignature":  "Date signature AAAA-MM-JJ",
  "dateDebut":      "Date début AAAA-MM-JJ",
  "dateFin":        "Date fin AAAA-MM-JJ",
  "montantTotal":   "Montant en chiffres uniquement sans DA",
  "objet":          "Objet du marché",
  "clauses":        "Clauses spécifiques importantes",
  "creePar":        "Nom du signataire / personne ayant saisi"
}

TEXTE DU DOCUMENT :
${texte.slice(0, 8000)}`;

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modele,
      prompt: PROMPT,
      stream: false,
      format: 'json',
      options: { temperature: 0.05, top_p: 0.9, num_predict: 1024 },
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);

  const json = await res.json();
  const raw  = json.response || '';
  const m    = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse non-JSON');
  return JSON.parse(m[0]);
}

// ── Fallback regex ────────────────────────────────────────────────────────────
function fallbackExtract(text) {
  const m = (...pp) => {
    for (const p of pp) { const x = text.match(p); if (x?.[1]) return x[1].trim(); }
    return '';
  };
  return {
    nouveauClient: m(/(?:NOM DU CLIENT|CLIENT|RAISON SOCIALE)\s*[:\-]?\s*([^\r\n]+)/i),
    adresseSiege:  m(/(?:ADRESSE DU SI[EÈ]GE|ADRESSE)\s*[:\-]?\s*([^\r\n]+)/i),
    contactNom:    m(/(?:CONTACT\s*\(Nom\)|CONTACT|RESPONSABLE)\s*[:\-]?\s*([^\r\n]+)/i),
    contactTel:    m(/(0[5-7]\d{8})/),
    rc:            m(/RC\s*[:\-]?\s*([^\r\n]+)/i),
    nif:           m(/NIF\s*[:\-]?\s*([^\r\n]+)/i),
    nis:           m(/NIS\s*[:\-]?\s*([^\r\n]+)/i),
    art:           m(/ART\s*[:\-]?\s*([^\r\n]+)/i),
    nouveauSite:   m(/(?:NOM DU SITE|SITE)\s*[:\-]?\s*([^\r\n]+)/i),
    reference:     m(/R[ÉE]F[ÉE]RENCE\s*[:\-]?\s*([^\r\n]+)/i),
    typeDoc:       /MARCH[ÉE]/i.test(text) ? 'MARCHE' : /AVENANT/i.test(text) ? 'AVENANT'
                 : /CONVENTION/i.test(text) ? 'CONVENTION' : 'CONTRAT',
    dateSignature: '', dateDebut: '', dateFin: '',
    montantTotal:  (m(/MONTANT\s*[:\-]?\s*([\d\s.,]+)/i)||'').replace(/[^\d.]/g,''),
    objet:         m(/OBJET\s*[:\-]?\s*([^\r\n]+)/i),
    clauses:       m(/CLAUSES?\s*SPECIFIQUES?\s*[:\-]?\s*([^\r\n]+)/i, /CLAUSES?\s*[:\-]?\s*([^\r\n]+)/i),
    creePar:       m(/SAISI\s*PAR\s*[:\-]?\s*([^\r\n]+)/i),
  };
}

// ── Display ───────────────────────────────────────────────────────────────────
function displayResults(data, file, chars, modele) {
  const FIELDS = [
    ['Client',          'nouveauClient'],
    ['Adresse siège',   'adresseSiege'],
    ['Contact',         'contactNom'],
    ['Téléphone',       'contactTel'],
    ['RC',              'rc'],
    ['NIF',             'nif'],
    ['NIS',             'nis'],
    ['ART',             'art'],
    ['Site protégé',    'nouveauSite'],
    ['Référence',       'reference'],
    ['Type document',   'typeDoc'],
    ['Date signature',  'dateSignature'],
    ['Date début',      'dateDebut'],
    ['Date fin',        'dateFin'],
    ['Montant (DA)',    'montantTotal'],
    ['Objet',          'objet'],
    ['Clauses',         'clauses'],
    ['Saisi par',       'creePar'],
  ];

  const LW = 16, VW = 55;
  const HR  = c('cyan','├' + '─'.repeat(LW+2) + '┼' + '─'.repeat(VW+2) + '┤');
  const TOP = c('cyan','┌' + '─'.repeat(LW+2) + '┬' + '─'.repeat(VW+2) + '┐');
  const BOT = c('cyan','└' + '─'.repeat(LW+2) + '┴' + '─'.repeat(VW+2) + '┘');

  const row = (l, v, hdr) => {
    const lp = l.padEnd(LW), vp = v.slice(0,VW).padEnd(VW);
    const lc = hdr ? c('white', bold(lp)) : lp;
    const vc = hdr ? c('white', bold(vp)) : (v ? c('green', vp) : c('gray','—'.padEnd(VW)));
    return c('cyan','│ ') + lc + c('cyan',' │ ') + vc + c('cyan',' │');
  };

  out('');
  out(bold(c('cyan','╔══════════════════════════════════════════════════════════════════╗')));
  out(bold(c('cyan','║  DZ Security  ·  SERVICE DES MARCHÉS  ·  Extraction IA          ║')));
  out(bold(c('cyan','╚══════════════════════════════════════════════════════════════════╝')));
  out('');
  out(c('gray',`  ${path.basename(file)}  │  ${chars} car.  │  ${modele}`));
  out('');
  out(TOP);
  out(row('Champ','Valeur extraite', true));
  out(HR);
  for (const [label, key] of FIELDS) {
    const val = (data[key] || '').toString();
    if (!val && key !== 'typeDoc') continue;
    out(row(label, val || '—'));
  }
  out(BOT);

  const empty = FIELDS.filter(([,k]) => !data[k]).map(([l]) => l);
  if (empty.length)
    out('');
  if (empty.length)
    out(c('yellow',`  ⚠ Non détecté (${empty.length}): `) + c('gray', empty.join(', ')));

  out('');
  out(c('gray','─── JSON à copier dans le formulaire ────────────────────────────────'));
  out(JSON.stringify(data, null, 2));
  out(c('gray','─────────────────────────────────────────────────────────────────────'));
}

// ── Supabase save ──────────────────────────────────────────────────────────────
async function saveToSupabase(data) {
  let SB_URL = '', SB_KEY = '';
  try {
    fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq+1).trim().replace(/^['"]|['"]$/g, '');
      if (k === 'VITE_SUPABASE_URL')      SB_URL = v;
      if (k === 'VITE_SUPABASE_ANON_KEY') SB_KEY = SB_KEY || v;
      if (k === 'VITE_SUPABASE_KEY')      SB_KEY = v;
    });
  } catch { log(c('red','  ✗ .env introuvable')); return; }

  if (!SB_URL || !SB_KEY) { log(c('red','  ✗ Variables Supabase manquantes dans .env')); return; }
  const H = { 'Content-Type':'application/json', apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=representation' };

  const cRes = await fetch(`${SB_URL}/rest/v1/clients`, { method:'POST', headers:H,
    body: JSON.stringify({ nom_entreprise: data.nouveauClient||'', adresse_siege: data.adresseSiege||'',
      contact_nom: data.contactNom||'', contact_telephone: data.contactTel||'',
      rc: data.rc||'', nif: data.nif||'', nis: data.nis||'', art: data.art||'' }) });
  if (!cRes.ok) { log(c('red',`  ✗ Client: ${(await cRes.text()).slice(0,200)}`)); return; }
  const [client] = await cRes.json();
  log(c('green',`  ✓ Client: ${client.id} — ${client.nom_entreprise}`));

  const montant = data.montantTotal ? parseFloat(String(data.montantTotal).replace(/[^\d.]/g,'')) || null : null;
  const ctRes = await fetch(`${SB_URL}/rest/v1/contrats`, { method:'POST', headers:H,
    body: JSON.stringify({ client_id: client.id, nom_site: data.nouveauSite||'',
      date_signature: data.dateSignature||null, date_debut: data.dateDebut||null,
      date_fin: data.dateFin||null, montant_total: montant,
      clauses_specifiques: data.clauses||'', cree_par: data.creePar||'',
      type_document: data.typeDoc||'CONTRAT', reference_document: data.reference||'',
      plan_defense_valide: false }) });
  if (!ctRes.ok) { log(c('red',`  ✗ Contrat: ${(await ctRes.text()).slice(0,200)}`)); return; }
  const [ct] = await ctRes.json();
  log(c('green',`  ✓ Marché créé: ID ${ct.id}`));
  log(c('green','  ✓ Enregistrement Supabase complet ✓'));
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  log('');
  log(bold(c('cyan','  ╔═══════════════════════════════════════════╗')));
  log(bold(c('cyan','  ║  DZ Security — Analyse IA Marchés        ║')));
  log(bold(c('cyan','  ╚═══════════════════════════════════════════╝')));
  log('');

  if (!fs.existsSync(FICHIER)) {
    log(c('red',`✗ Fichier introuvable: ${FICHIER}`)); process.exit(1);
  }

  const ext   = path.extname(FICHIER).toLowerCase().slice(1);
  const isPDF = ext === 'pdf';
  const isImg = ['jpg','jpeg','png','tiff','tif','bmp','webp'].includes(ext);

  if (!isPDF && !isImg) {
    log(c('red',`✗ Format non supporté: .${ext}`));
    log(c('yellow','  Formats: pdf, jpg, png, tiff')); process.exit(1);
  }

  log(c('gray',`  Fichier : ${c('white', FICHIER)}`));
  log(c('gray',`  Modèle  : ${c('yellow', MODELE)}`));
  log(c('gray',`  Ollama  : ${OLL_URL}`));
  log(c('gray',`  Langues : ${LANGUE}`));
  log('');

  // Vérifier Ollama
  log(c('gray','  Vérification Ollama...'));
  try {
    const ping = await fetch(`${OLL_URL}/api/version`, { signal: AbortSignal.timeout(4000) });
    const { version } = await ping.json();
    log(c('green',`  ✓ Ollama ${version}`));
  } catch {
    log(c('red',  '  ✗ Ollama inaccessible'));
    log(c('yellow','  → ollama serve'));
    log(c('yellow',`  → ollama pull ${MODELE}`));
    process.exit(1);
  }

  // Vérifier modèle
  try {
    const r = await fetch(`${OLL_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const { models = [] } = await r.json();
    const found = models.some(m => m.name === MODELE || m.name.startsWith(MODELE+':'));
    if (!found) {
      const names = models.map(m => m.name).join(', ') || '(aucun)';
      log(c('yellow',`  ⚠ "${MODELE}" absent. Disponibles: ${names}`));
      log(c('yellow',`  → ollama pull ${MODELE}`));
      process.exit(1);
    }
    log(c('green',`  ✓ Modèle ${MODELE}`));
  } catch { log(c('yellow','  ⚠ Vérification modèle ignorée')); }

  log('');

  // ── Extraction texte ───────────────────────────────────────────────────────
  let texte = '', mode = '';

  if (isImg) {
    log(bold('  1. OCR image'));
    texte = await ocrInput(FICHIER, LANGUE);
    mode  = 'image-ocr';
  } else {
    log(bold('  1. Extraction texte natif PDF'));
    const pdfText = await extractPdfText(FICHIER, PAGE);

    if (pdfText && pdfText.trim().length > 150) {
      log(c('green',`  ✓ ${pdfText.length} caractères extraits`));
      texte = pdfText; mode = 'pdf-text';
    } else {
      log(c('yellow',`  ⚠ PDF scanné détecté (${(pdfText||'').length} car.)`));
      log(bold('  2. Rendu pages + OCR'));
      const bufs = await renderPdfPages(FICHIER, PAGE);

      if (!bufs.length) {
        log(c('red','  ✗ Rendu impossible'));
        log(c('yellow','  → Ouvrez le PDF dans Chrome/Edge → Win+Shift+S → Enregistrez en JPG'));
        log(c('yellow',`  → node scripts/analyse-marche.mjs page.jpg`));
        process.exit(1);
      }

      for (let i = 0; i < bufs.length; i++) {
        log(c('gray',`  OCR page ${i+1}/${bufs.length}`));
        texte += (i ? `\n\n--- PAGE ${i+1} ---\n\n` : '') + await ocrInput(bufs[i], LANGUE);
      }
      mode = 'pdf-ocr';
    }
  }

  if (texte.trim().length < 20) {
    log(c('red','  ✗ Aucun texte. Vérifiez la qualité du document.')); process.exit(1);
  }
  log(c('green',`  ✓ ${texte.length} caractères (${mode})`));
  log('');

  // ── IA ─────────────────────────────────────────────────────────────────────
  log(bold(`  2. Extraction IA — ${MODELE}`));
  let extracted;
  try {
    extracted = await extractWithOllama(texte, MODELE, OLL_URL);
    log(c('green','  ✓ Extraction IA réussie'));
  } catch (e) {
    log(c('yellow',`  ⚠ Ollama: ${e.message} — extraction regex de secours`));
    extracted = fallbackExtract(texte);
  }

  log('');
  displayResults(extracted, FICHIER, texte.length, MODELE);

  // ── Supabase ───────────────────────────────────────────────────────────────
  if (SUPA) {
    if (!extracted.nouveauClient) {
      log(c('yellow','  ⚠ Client non identifié — sauvegarde annulée'));
    } else {
      log('');
      log(c('yellow',`  Sauvegarder "${bold(extracted.nouveauClient)}" dans Supabase ?`));
      const rl = createInterface({ input: process.stdin, output: process.stderr });
      const rep = await new Promise(r => rl.question(c('cyan','  (o/N) : '), r));
      rl.close();
      if (/^o(ui)?$/i.test(rep.trim())) await saveToSupabase(extracted);
      else log(c('gray','  Annulé.'));
    }
  }

  log('');
  log(c('green','  ✓ Terminé'));
  if (!SUPA)
    log(c('gray','  Copiez le JSON ci-dessus dans le formulaire "SERVICE DES MARCHÉS"'));
  log('');
}

main().catch(e => {
  log(c('red',`\n✗ Erreur: ${e.message}`));
  if (process.env.DEBUG) log(c('gray', e.stack));
  process.exit(1);
});
