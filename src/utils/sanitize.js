/**
 * esc(s) — échappe une valeur avant injection dans du HTML brut.
 * À utiliser dans toute fonction qui construit du HTML via des template literals
 * (window.open + document.write, innerHTML, etc.).
 *
 * Couvre : & < > " '
 * N'échappe PAS les valeurs numériques issues de .toFixed() — elles sont toujours sûres.
 *
 * @param {*} s  valeur à échapper (string, number, null, undefined)
 * @returns {string}
 */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
