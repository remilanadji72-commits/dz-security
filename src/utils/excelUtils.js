/**
 * excelUtils.js — Import / Export Excel générique pour DzSecurity-Fusion
 *
 * Fonctionne avec n'importe quel module via des "définitions de colonnes" (ColDef).
 *
 * @typedef {Object} ColDef
 * @property {string}    key          - Clé JS / nom de colonne DB
 * @property {string}    label        - En-tête français (affiché dans Excel)
 * @property {string}   [labelAr]     - En-tête arabe (optionnel, ajouté après "|")
 * @property {'text'|'date'|'number'|'boolean'|'enum'} [type] - default: 'text'
 * @property {boolean}  [required]    - Champ obligatoire à l'import
 * @property {string[]} [enumValues]  - Valeurs autorisées (type 'enum')
 * @property {any}      [example]     - Valeur d'exemple dans le modèle
 * @property {boolean}  [skipExport]  - Exclure de l'export
 * @property {boolean}  [skipImport]  - Exclure de l'import (champ généré/calculé)
 * @property {Function} [exportFn]    - (value, row) => cellule affichée
 * @property {Function} [importFn]    - (rawValue) => valeur DB
 */

// ── Chargeur xlsx dynamique (évite d'alourdir le bundle initial) ──────────────
async function loadXLSX() {
  return import('xlsx');
}

// ── Helpers internes ──────────────────────────────────────────────────────────

function buildHeader(c) {
  return c.labelAr ? `${c.label} | ${c.labelAr}` : c.label;
}

function xlsxSerialToISO(serial) {
  if (typeof serial !== 'number') return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  if (isNaN(d)) return null;
  return d.toISOString().split('T')[0];
}

function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return xlsxSerialToISO(raw);
  const str = String(raw).trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
  const d = new Date(str);
  return isNaN(d) ? str : d.toISOString().split('T')[0];
}

function parseCell(raw, colDef) {
  if (colDef.importFn) return colDef.importFn(raw);

  const isEmpty = raw === null || raw === undefined || raw === '';
  if (isEmpty) return null;

  const str = String(raw).trim();

  switch (colDef.type) {
    case 'number': {
      const n = parseFloat(str.replace(/\s/g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    }
    case 'boolean':
      return ['OUI', 'YES', 'TRUE', '1', 'VRAI', 'نعم'].includes(str.toUpperCase());
    case 'date':
      return parseDate(raw);
    case 'enum': {
      const found = (colDef.enumValues || []).find(
        v => v.toLowerCase() === str.toLowerCase()
      );
      return found !== undefined ? found : str;
    }
    default:
      return str;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporte un tableau d'objets vers un fichier Excel (.xlsx).
 *
 * @param {Object[]} data     - Tableau d'objets à exporter
 * @param {ColDef[]} colDefs  - Définitions de colonnes
 * @param {string}   filename - Nom du fichier (sans extension)
 */
export async function exportToExcel(data, colDefs, filename = 'export') {
  const XLSX = await loadXLSX();
  const exportable = colDefs.filter(c => !c.skipExport);

  const headers = exportable.map(buildHeader);

  const rows = data.map(row =>
    exportable.map(c => {
      const val = row[c.key];
      if (c.exportFn) return c.exportFn(val, row);
      if (val === null || val === undefined) return '';
      if (c.type === 'boolean') return val ? 'OUI' : 'NON';
      if (c.type === 'date' && val) {
        try { return String(val).split('T')[0]; } catch { return val; }
      }
      return val;
    })
  );

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = exportable.map((_, i) => ({
    wch: Math.max(
      String(headers[i]).length,
      ...rows.map(r => String(r[i] ?? '').length),
      12
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Données');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// MODÈLE (template vierge à télécharger)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un fichier Excel vierge prêt à remplir :
 * - Ligne 1 : en-têtes FR | AR
 * - Ligne 2 : indication OBLIGATOIRE / optionnel
 * - Ligne 3 : exemple de valeur
 *
 * @param {ColDef[]} colDefs  - Définitions de colonnes
 * @param {string}   filename - Nom du fichier (sans extension)
 */
export async function generateTemplate(colDefs, filename = 'modele') {
  const XLSX = await loadXLSX();
  const importable = colDefs.filter(c => !c.skipImport);

  const headers  = importable.map(buildHeader);
  const hints    = importable.map(c => c.required ? '* OBLIGATOIRE' : '(optionnel)');
  const examples = importable.map(c => (c.example !== undefined ? String(c.example) : ''));

  const wsData = [headers, hints, examples];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = importable.map((_, i) => ({
    wch: Math.max(String(headers[i]).length, String(examples[i]).length, 14),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import — Modèle');
  XLSX.writeFile(wb, `MODELE_${filename}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit un fichier Excel et retourne les lignes valides + les erreurs.
 *
 * - Ignore les lignes de description du modèle (contenant "OBLIGATOIRE")
 * - Mappe les colonnes par leur label FR (partie avant le "|")
 * - Valide : champs requis, types enum
 *
 * @param {File}     file    - Fichier .xlsx/.xls sélectionné par l'utilisateur
 * @param {ColDef[]} colDefs - Définitions de colonnes
 * @returns {Promise<{ rows: Object[], errors: {line:number, msg:string}[] }>}
 */
export async function importFromExcel(file, colDefs) {
  const XLSX = await loadXLSX();

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!raw || raw.length < 2) {
    return { rows: [], errors: [{ line: 0, msg: 'Fichier vide ou format non reconnu (xlsx / xls requis)' }] };
  }

  // En-têtes : ligne 1
  const headerRow = raw[0].map(h => String(h).trim());

  // Sauter les lignes de description du modèle (contenant "OBLIGATOIRE" ou "optionnel")
  let dataStart = 1;
  while (
    dataStart < raw.length &&
    raw[dataStart].some(v => /OBLIGATOIRE|optionnel/i.test(String(v)))
  ) dataStart++;

  // Mapper en-têtes → colDefs par label FR (avant le "|")
  const importable = colDefs.filter(c => !c.skipImport);
  const colMap = {}; // colDef.key → index dans le fichier

  headerRow.forEach((h, i) => {
    const frPart = h.split('|')[0].trim().toLowerCase();
    const def = importable.find(c => c.label.toLowerCase() === frPart);
    if (def) colMap[def.key] = i;
  });

  // Vérifier les colonnes obligatoires présentes
  const globalErrors = [];
  for (const c of importable.filter(cd => cd.required)) {
    if (colMap[c.key] === undefined) {
      globalErrors.push({
        line: 0,
        msg: `Colonne obligatoire absente du fichier : "${c.label}"`,
      });
    }
  }
  if (globalErrors.length) return { rows: [], errors: globalErrors };

  const rows   = [];
  const errors = [];

  for (let li = dataStart; li < raw.length; li++) {
    const rawRow = raw[li];
    // Ignorer lignes vides
    if (rawRow.every(v => v === '' || v === null || v === undefined)) continue;

    const obj     = {};
    const rowErrs = [];

    for (const c of importable) {
      const idx = colMap[c.key];
      if (idx === undefined) continue; // colonne absente du fichier → on l'ignore

      const val = parseCell(rawRow[idx], c);

      if (c.required && (val === null || val === '')) {
        rowErrs.push(`"${c.label}" obligatoire`);
      } else if (c.type === 'enum' && val && c.enumValues && !c.enumValues.includes(val)) {
        rowErrs.push(`"${c.label}" : "${val}" ∉ [${c.enumValues.join(', ')}]`);
      } else {
        obj[c.key] = val;
      }
    }

    if (rowErrs.length) {
      errors.push({ line: li + 1, msg: rowErrs.join(' | ') });
    } else {
      rows.push(obj);
    }
  }

  return { rows, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formate un résumé d'import pour l'affichage dans un toast ou une div.
 *
 * @param {{ total?:number, inserted?:number, updated?:number, skipped?:number, errorsCount?:number }} stats
 * @returns {string}
 */
export function buildReport({ total = 0, inserted = 0, updated = 0, skipped = 0, errorsCount = 0 } = {}) {
  const parts = [];
  if (inserted   > 0) parts.push(`✅ ${inserted} ajouté(s)`);
  if (updated    > 0) parts.push(`🔄 ${updated} mis à jour`);
  if (skipped    > 0) parts.push(`⏭️ ${skipped} ignoré(s)`);
  if (errorsCount > 0) parts.push(`❌ ${errorsCount} erreur(s)`);
  return parts.length ? parts.join(' · ') : `${total} ligne(s) traitée(s)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// UPSERT GÉNÉRIQUE (helper pour éviter la répétition dans chaque page)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insère / met à jour des lignes dans Supabase par lots de 50.
 *
 * @param {Object}   supabase       - Client Supabase
 * @param {string}   table          - Nom de la table
 * @param {Object[]} rows           - Lignes valides (issues d'importFromExcel)
 * @param {string}   conflictCol    - Colonne de clé unique pour upsert
 * @param {Object}   [defaults={}]  - Valeurs par défaut à fusionner dans chaque ligne
 * @returns {Promise<{ inserted:number, errorsCount:number }>}
 */
export async function upsertRows(supabase, table, rows, conflictCol, defaults = {}) {
  let inserted = 0;
  let errorsCount = 0;

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50).map(r => ({ ...defaults, ...r }));
    const { data, error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictCol })
      .select('id');

    if (error) {
      errorsCount += batch.length;
      console.error(`[upsertRows] ${table}:`, error.message);
    } else {
      inserted += data?.length ?? batch.length;
    }
  }

  return { inserted, errorsCount };
}
