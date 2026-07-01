/**
 * markitdown.js — Conversion de documents en Markdown (côté navigateur)
 *
 * Inspiré de Microsoft MarkItDown — fonctionne sans serveur.
 *
 * Formats supportés :
 *   .txt  .md   → texte brut / markdown natif
 *   .csv        → tableau Markdown
 *   .xlsx .xls  → un tableau Markdown par feuille (via xlsx)
 *   .docx       → Markdown via mammoth (DOCX → HTML → MD)
 *   .html .htm  → HTML → Markdown (regex DOM-walking)
 *   .json       → bloc de code JSON formaté
 *   images      → MESSAGE_OCR (délégué à l'utilitaire OCR existant)
 */

// ── Référentiels formats ──────────────────────────────────────────────────────

export const SUPPORTED = {
  txt:  { label: 'Texte brut',    icon: '📄', color: '#6b7280' },
  md:   { label: 'Markdown',      icon: '📝', color: '#7c3aed' },
  csv:  { label: 'CSV',           icon: '📊', color: '#059669' },
  xlsx: { label: 'Excel',         icon: '📗', color: '#15803d' },
  xls:  { label: 'Excel (xls)',   icon: '📗', color: '#15803d' },
  docx: { label: 'Word',          icon: '📘', color: '#1d4ed8' },
  html: { label: 'HTML',          icon: '🌐', color: '#d97706' },
  htm:  { label: 'HTML',          icon: '🌐', color: '#d97706' },
  json: { label: 'JSON',          icon: '🔧', color: '#dc2626' },
};

const OCR_EXTS = new Set(['jpg','jpeg','png','webp','gif','bmp','tiff','tif']);

export function getFormatInfo(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  return SUPPORTED[ext] || null;
}

export function isOCRFormat(filename = '') {
  return OCR_EXTS.has(filename.split('.').pop().toLowerCase());
}

// ── Point d'entrée principal ─────────────────────────────────────────────────

/**
 * Convertit un fichier en Markdown.
 *
 * @param {File}       file       - Fichier sélectionné
 * @param {Function}  [onProgress]  - (step: string, pct: number) => void
 * @returns {Promise<string>}     - Texte Markdown résultant
 * @throws {Error} 'IMAGE_USE_OCR' si c'est une image
 * @throws {Error} message d'erreur si format inconnu ou conversion échouée
 */
export async function convertToMarkdown(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase();
  onProgress?.('Lecture du fichier…', 5);

  if (OCR_EXTS.has(ext)) throw new Error('IMAGE_USE_OCR');

  switch (ext) {
    case 'md':   return handleMarkdown(file, onProgress);
    case 'txt':  return handleText(file, onProgress);
    case 'csv':  return handleCSV(file, onProgress);
    case 'xlsx':
    case 'xls':  return handleExcel(file, onProgress);
    case 'docx': return handleDocx(file, onProgress);
    case 'html':
    case 'htm':  return handleHTML(file, onProgress);
    case 'json': return handleJSON(file, onProgress);
    default:
      throw new Error(`Format non supporté : .${ext} — formats acceptés : ${Object.keys(SUPPORTED).join(', ')}`);
  }
}

// ── Handlers par format ──────────────────────────────────────────────────────

async function handleMarkdown(file, onProgress) {
  onProgress?.('Lecture…', 50);
  const text = await file.text();
  onProgress?.('Terminé', 100);
  return text;
}

async function handleText(file, onProgress) {
  onProgress?.('Lecture…', 50);
  const text = await file.text();
  onProgress?.('Terminé', 100);
  const name = file.name.replace(/\.[^.]+$/, '');
  return `# ${name}\n\n${text}`;
}

async function handleCSV(file, onProgress) {
  onProgress?.('Lecture CSV…', 20);
  const text = await file.text();
  onProgress?.('Analyse…', 50);

  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return '';

  // Détection du séparateur (virgule ou point-virgule)
  const firstLine = lines[0];
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';

  const parseCSVRow = (line) => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const rows = lines.map(parseCSVRow);
  const headers = rows[0];
  const totalCols = Math.max(...rows.map(r => r.length));

  // Padder les cellules manquantes
  const pad = (row) => [...row, ...Array(totalCols - row.length).fill('')];

  const sanitizeCell = (c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const mdRow = (cells) => `| ${cells.map(sanitizeCell).join(' | ')} |`;
  const sepRow = Array(totalCols).fill('---');

  onProgress?.('Terminé', 100);

  const name = file.name.replace(/\.[^.]+$/, '');
  return [
    `# ${name}`,
    '',
    `> ${rows.length - 1} ligne(s) · ${totalCols} colonne(s) · séparateur : \`${sep}\``,
    '',
    mdRow(pad(headers)),
    mdRow(sepRow),
    ...rows.slice(1).map(r => mdRow(pad(r))),
  ].join('\n');
}

async function handleExcel(file, onProgress) {
  onProgress?.('Chargement xlsx…', 15);
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();

  onProgress?.('Analyse…', 40);
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });

  const sections = [`# ${file.name.replace(/\.[^.]+$/, '')}`, ''];
  const sanitizeCell = (c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const mdRow = (cells) => `| ${cells.map(sanitizeCell).join(' | ')} |`;

  let pct = 40;
  const step = 50 / wb.SheetNames.length;

  for (const sheetName of wb.SheetNames) {
    pct += step;
    onProgress?.(`Feuille : ${sheetName}…`, Math.round(pct));

    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (!data.length || (data.length === 1 && data[0].every(c => c === ''))) continue;

    const totalCols = Math.max(...data.map(r => r.length));
    const pad = (row) => [...row, ...Array(Math.max(0, totalCols - row.length)).fill('')];

    sections.push(`## ${sheetName}`);
    sections.push('');

    if (data.length >= 1) {
      const headers = data[0].map(c => String(c || ''));
      const sepRow = Array(totalCols).fill('---');
      sections.push(mdRow(pad(headers)));
      sections.push(mdRow(sepRow));
      data.slice(1).forEach(r => sections.push(mdRow(pad(r))));
    }
    sections.push('');
  }

  onProgress?.('Terminé', 100);
  return sections.join('\n');
}

async function handleDocx(file, onProgress) {
  onProgress?.('Chargement mammoth…', 10);
  const mammoth = await import('mammoth');
  const buffer = await file.arrayBuffer();

  onProgress?.('Conversion DOCX → HTML…', 35);

  // mammoth convertit le DOCX en HTML propre
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title']     => h1:fresh",
        "p[style-name='Subtitle']  => h2:fresh",
        "r[style-name='Strong']    => strong",
      ],
    }
  );

  if (result.messages?.length) {
    console.info('[markitdown] Mammoth messages:', result.messages.map(m => m.message).join('; '));
  }

  onProgress?.('HTML → Markdown…', 70);
  const md = htmlToMarkdown(result.value);

  onProgress?.('Terminé', 100);

  const name = file.name.replace(/\.[^.]+$/, '');
  return `# ${name}\n\n${md}`;
}

async function handleHTML(file, onProgress) {
  onProgress?.('Lecture HTML…', 30);
  const html = await file.text();
  onProgress?.('Conversion…', 60);
  const md = htmlToMarkdown(html);
  onProgress?.('Terminé', 100);
  const name = file.name.replace(/\.[^.]+$/, '');
  return `# ${name}\n\n${md}`;
}

async function handleJSON(file, onProgress) {
  onProgress?.('Lecture JSON…', 40);
  const text = await file.text();
  onProgress?.('Formatage…', 70);
  let pretty = text;
  try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* JSON invalide → garder brut */ }
  onProgress?.('Terminé', 100);
  const name = file.name.replace(/\.[^.]+$/, '');
  return `# ${name}\n\n\`\`\`json\n${pretty}\n\`\`\``;
}

// ── Convertisseur HTML → Markdown ────────────────────────────────────────────

/**
 * Convertit du HTML (issu de mammoth ou d'un fichier .html) en Markdown.
 * Utilise DOMParser du navigateur pour une conversion fidèle et sans regex fragile.
 */
function htmlToMarkdown(html) {
  // Utiliser DOMParser pour obtenir un vrai arbre DOM
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body || doc.documentElement;
  return nodeToMarkdown(body).trim().replace(/\n{3,}/g, '\n\n');
}

function nodeToMarkdown(node, ctx = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    // Ignorer les nœuds texte vides sauf dans les contextes inline
    return ctx.inline ? text : text.trim();
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const children = () => Array.from(node.childNodes)
    .map(n => nodeToMarkdown(n, { ...ctx, inline: true }))
    .join('');
  const block = (md) => `\n\n${md}\n\n`;

  switch (tag) {
    case 'script':
    case 'style':
    case 'head':
    case 'nav':
    case 'iframe':
      return '';

    case 'h1': return block(`# ${children()}`);
    case 'h2': return block(`## ${children()}`);
    case 'h3': return block(`### ${children()}`);
    case 'h4': return block(`#### ${children()}`);
    case 'h5': return block(`##### ${children()}`);
    case 'h6': return block(`###### ${children()}`);

    case 'p':          return block(children());
    case 'br':         return '\n';
    case 'hr':         return block('---');
    case 'blockquote': return block(
      children().trim().split('\n').map(l => `> ${l}`).join('\n')
    );

    case 'strong':
    case 'b':  return `**${children()}**`;
    case 'em':
    case 'i':  return `*${children()}*`;
    case 'del':
    case 's':  return `~~${children()}~~`;
    case 'code':
      return ctx.inPre ? children() : `\`${children()}\``;
    case 'pre': {
      const inner = nodeToMarkdown(node.firstChild || node, { ...ctx, inPre: true });
      return block('```\n' + inner.trim() + '\n```');
    }

    case 'a': {
      const href = node.getAttribute('href') || '';
      const text = children();
      return href ? `[${text}](${href})` : text;
    }

    case 'img': {
      const alt = node.getAttribute('alt') || 'image';
      const src = node.getAttribute('src') || '';
      return src.startsWith('data:') ? `![${alt}]` : `![${alt}](${src})`;
    }

    case 'ul': {
      const items = Array.from(node.querySelectorAll(':scope > li'))
        .map(li => `- ${nodeToMarkdown(li, { ...ctx, inline: true }).trim()}`)
        .join('\n');
      return block(items);
    }

    case 'ol': {
      const items = Array.from(node.querySelectorAll(':scope > li'))
        .map((li, i) => `${i + 1}. ${nodeToMarkdown(li, { ...ctx, inline: true }).trim()}`)
        .join('\n');
      return block(items);
    }

    case 'li': return children();

    case 'table': {
      const rows = Array.from(node.querySelectorAll('tr'));
      if (!rows.length) return '';

      const parseRow = (tr) =>
        Array.from(tr.querySelectorAll('th,td'))
          .map(td => nodeToMarkdown(td, { ...ctx, inline: true }).trim().replace(/\|/g, '\\|'));

      const head = parseRow(rows[0]);
      const sep  = head.map(() => '---');
      const body = rows.slice(1).map(parseRow);

      const mdRow = (cells) => `| ${cells.join(' | ')} |`;
      return block([mdRow(head), mdRow(sep), ...body.map(mdRow)].join('\n'));
    }

    case 'th':
    case 'td': return children();

    case 'body':
    case 'div':
    case 'article':
    case 'section':
    case 'main': {
      const inner = Array.from(node.childNodes)
        .map(n => nodeToMarkdown(n, ctx))
        .join('');
      return ctx.inline ? inner : block(inner);
    }

    case 'span': return children();

    default:
      return children();
  }
}

// ── Rendu Markdown → HTML (preview) ─────────────────────────────────────────

/**
 * Convertit du Markdown en HTML sûr pour l'affichage en prévisualisation.
 * Gère : titres, gras, italique, code, listes, tableaux, liens, hr, blockquote.
 *
 * @param {string} markdown
 * @returns {string} HTML échappé (sûr à injecter via innerHTML)
 */
export function markdownToHTML(markdown) {
  const escape = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Traiter les blocs de code avant tout (protège le contenu des substitutions inline)
  const codeBlocks = [];
  let md = markdown.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(`<pre><code>${escape(code.trim())}</code></pre>`);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  // Inline code
  md = md.replace(/`([^`]+)`/g, (_, code) => `<code>${escape(code)}</code>`);

  // Tableaux Markdown
  md = md.replace(/((?:\|.+\|\n?)+)/g, (block) => {
    const lines = block.trim().split('\n').filter(Boolean);
    if (lines.length < 2) return block;
    const isSep = (l) => /^\|[\s\-|:]+\|$/.test(l.trim());
    const toRow = (line, tag) =>
      '<tr>' +
      line.split('|').slice(1, -1)
        .map(c => `<${tag}>${escape(c.trim())}</${tag}>`)
        .join('') +
      '</tr>';
    const head = isSep(lines[1])
      ? `<thead>${toRow(lines[0], 'th')}</thead>`
      : '';
    const bodyLines = head ? lines.slice(2) : lines;
    const body = `<tbody>${bodyLines.filter(l => !isSep(l)).map(l => toRow(l, 'td')).join('')}</tbody>`;
    return `<table class="md-table">${head}${body}</table>`;
  });

  // Titres
  md = md
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm,  '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm,   '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,    '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,     '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,      '<h1>$1</h1>');

  // Séparateur horizontal
  md = md.replace(/^---$/gm, '<hr>');

  // Blockquote
  md = md.replace(/(^> .+(\n> .+)*)/gm, (block) => {
    const inner = block.replace(/^> ?/gm, '').trim();
    return `<blockquote>${inner}</blockquote>`;
  });

  // Listes non ordonnées
  md = md.replace(/(^[-*] .+(\n[-*] .+)*)/gm, (block) => {
    const items = block.split('\n').filter(Boolean)
      .map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Listes ordonnées
  md = md.replace(/(^\d+\. .+(\n\d+\. .+)*)/gm, (block) => {
    const items = block.split('\n').filter(Boolean)
      .map(l => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Formatage inline
  md = md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/~~(.+?)~~/g,     '<del>$1</del>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphes (double saut de ligne)
  md = md.replace(/\n\n+/g, '</p><p>');
  md = `<p>${md}</p>`;

  // Réinjecter les blocs de code
  codeBlocks.forEach((block, i) => {
    md = md.replace(`\x00CODE${i}\x00`, block);
  });

  return md;
}
