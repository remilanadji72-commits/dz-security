/**
 * mask.js — Masquage des données sensibles selon le rôle utilisateur
 *
 * Règle générale :
 *   superadmin, admin, rh → accès complet
 *   ops, comptable         → accès partiel (certaines fonctions)
 *   agent, mobile, anon    → vue minimale
 *
 * Utilisation :
 *   import { maskCIN, maskPhone, maskSerie, maskSalaire } from '../utils/mask';
 *
 *   // Dans un composant React
 *   const { role } = useAuthStore();   // ou useDataStore()
 *   <td>{maskCIN(agent.carte_identite_num, role)}</td>
 */

// ── Hiérarchie des accès ─────────────────────────────────────────────────────

const ACCES_COMPLET  = ['superadmin', 'admin', 'rh'];
const ACCES_PARTIEL  = ['ops', 'comptable'];

/** Retourne true si le rôle a accès complet aux données sensibles. */
export function hasFullAccess(role) {
  return ACCES_COMPLET.includes(role);
}

/** Retourne true si le rôle a un accès partiel. */
export function hasPartialAccess(role) {
  return ACCES_PARTIEL.includes(role);
}

// ── Helpers internes ─────────────────────────────────────────────────────────

function guard(value, role, allowedRoles, masked) {
  if (!value) return '—';
  return allowedRoles.includes(role) ? value : masked;
}

// ── Fonctions de masquage ────────────────────────────────────────────────────

/**
 * Numéro CIN / Carte nationale d'identité algérienne (18 chiffres).
 *   superadmin, admin, rh → complet
 *   autres                → 3 premiers + 6 points + 3 derniers
 *
 * @example maskCIN('123456789012345678', 'agent') → '123 •••••••••• 678'
 */
export function maskCIN(cin, role) {
  if (!cin) return '—';
  if (hasFullAccess(role)) return cin;
  const s = String(cin).replace(/\s/g, '');
  if (s.length < 6) return '•••';
  return `${s.slice(0, 3)} •••••••••• ${s.slice(-3)}`;
}

/**
 * Numéro de téléphone algérien.
 *   superadmin, admin, rh → complet
 *   ops, comptable        → masqué au milieu
 *   autres                → 4 premiers + ••• uniquement
 *
 * @example maskPhone('0555123456', 'agent') → '0555 ••••••'
 */
export function maskPhone(tel, role) {
  if (!tel) return '—';
  const s = String(tel).replace(/[\s\-]/g, '');
  if (hasFullAccess(role)) return tel;
  if (hasPartialAccess(role)) {
    // Affiche début et fin : 0555 •••• 56
    return s.length >= 8
      ? `${s.slice(0, 4)} •••• ${s.slice(-2)}`
      : `${s.slice(0, 2)} ••••`;
  }
  // Agents / anon : affiche seulement l'indicatif réseau
  return `${s.slice(0, 4)} ••••••`;
}

/**
 * Numéro de série d'arme ou de radio UHF.
 *   superadmin uniquement → complet
 *   admin                 → 3 premiers + ••• + 3 derniers
 *   autres                → ••••••••
 *
 * @example maskSerie('FR123456', 'admin') → 'FR1•••456'
 */
export function maskSerie(serie, role) {
  if (!serie) return '—';
  const s = String(serie).trim();
  if (role === 'superadmin') return s;
  if (role === 'admin') {
    if (s.length < 6) return '•••';
    return `${s.slice(0, 3)}•••${s.slice(-3)}`;
  }
  return '••••••••';
}

/**
 * Matricule d'arme (ARM-YYYY-NNN) ou de radio (RAD-YYYY-NNN).
 * Le matricule est moins sensible que le numéro de série.
 *   superadmin, admin, rh, ops → complet
 *   autres                     → préfixe + •••
 *
 * @example maskMatriculeArme('ARM-2025-042', 'agent') → 'ARM-••••'
 */
export function maskMatriculeArme(matricule, role) {
  if (!matricule) return '—';
  if ([...ACCES_COMPLET, 'ops'].includes(role)) return matricule;
  const parts = String(matricule).split('-');
  return parts.length >= 1 ? `${parts[0]}-••••` : '••••';
}

/**
 * Montant de salaire / paie.
 *   superadmin, admin, rh, comptable → complet avec DA
 *   autres                           → ••• DA
 *
 * @example maskSalaire(85000, 'agent') → '••• DA'
 * @example maskSalaire(85000, 'rh')    → '85 000 DA'
 */
export function maskSalaire(montant, role) {
  if (montant === null || montant === undefined) return '—';
  if ([...ACCES_COMPLET, 'comptable'].includes(role)) {
    return new Intl.NumberFormat('fr-DZ').format(Number(montant)) + ' DA';
  }
  return '••• DA';
}

/**
 * Numéro ANEM (enregistrement Agence Nationale de l'Emploi).
 *   superadmin, admin, rh → complet
 *   autres                → masqué
 */
export function maskAnem(numero, role) {
  return guard(numero, role, ACCES_COMPLET, '••••••••');
}

/**
 * Date de naissance — donnée PII.
 *   superadmin, admin, rh → complète (JJ/MM/AAAA)
 *   ops, comptable        → année seulement
 *   autres                → ••/••/AAAA
 *
 * @example maskDateNaissance('1990-05-15', 'agent') → '••/••/1990'
 */
export function maskDateNaissance(dateIso, role) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  if (isNaN(d)) return '—';

  const jour  = String(d.getDate()).padStart(2, '0');
  const mois  = String(d.getMonth() + 1).padStart(2, '0');
  const annee = d.getFullYear();

  if (hasFullAccess(role)) return `${jour}/${mois}/${annee}`;
  if (hasPartialAccess(role)) return String(annee);
  return `••/••/${annee}`;
}

/**
 * Numéro de carte professionnelle agent de sécurité.
 *   superadmin, admin, rh, ops → complet
 *   autres                     → masqué (seuls les 3 derniers caractères visibles)
 */
export function maskCartePro(num, role) {
  if (!num) return '—';
  if ([...ACCES_COMPLET, 'ops'].includes(role)) return num;
  const s = String(num).trim();
  return s.length > 3 ? `••••••${s.slice(-3)}` : '•••';
}

// ── Export groupé (pour import * as mask) ───────────────────────────────────
export default {
  hasFullAccess,
  hasPartialAccess,
  maskCIN,
  maskPhone,
  maskSerie,
  maskMatriculeArme,
  maskSalaire,
  maskAnem,
  maskDateNaissance,
  maskCartePro,
};
