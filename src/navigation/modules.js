export const MODULES = [
  { _section: 'direction' },
  { id: 'kpi',          icon: '📊', roles: ['GERANT', 'SUPER_ADMIN'] },
  { id: 'statistiques', icon: '📈', roles: ['GERANT'] },
  { id: 'parametres',   icon: '⚙️', roles: ['GERANT'] },
  { id: 'fiscal',       icon: '🧾', roles: ['GERANT'] },
  { id: 'superadmin',   icon: '👑', roles: ['SUPER_ADMIN'] },

  { _section: 'operations' },
  { id: 'tenues',     icon: '👕', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'salleops',   icon: '🖥️', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'inspection', icon: '🕵️', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'logistique', icon: '🚙', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'armurerie',  icon: '🔫', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'formation',  icon: '🎓', roles: ['GERANT', 'OPERATIONS'] },
  { id: 'planning',   icon: '⏱️', roles: ['GERANT', 'OPERATIONS', 'RH'] },
  { id: 'incidents',  icon: '🚨', roles: ['GERANT', 'OPERATIONS'] },

  { _section: 'commercial' },
  { id: 'marches',      icon: '📄', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'facturation',  icon: '💰', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'recouvrement', icon: '🏦', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'prospection',  icon: '🎯', roles: ['GERANT', 'COMMERCIAL'] },
  { id: 'garanties',    icon: '🔒', roles: ['GERANT', 'COMMERCIAL', 'JURIDIQUE'] },

  { _section: 'rh' },
  { id: 'paie',         icon: '💳', roles: ['GERANT', 'RH'] },
  { id: 'recrutement',  icon: '📝', roles: ['GERANT', 'RH'] },
  { id: 'alertes',      icon: '🔔', roles: ['GERANT', 'RH'] },
  { id: 'social',       icon: '🏥', roles: ['GERANT', 'RH'] },
  { id: 'pointage',     icon: '⏰', roles: ['GERANT', 'RH', 'OPERATIONS'] },
  { id: 'attachements', icon: '📑', roles: ['GERANT', 'RH', 'COMMERCIAL'] },
  { id: 'archives',     icon: '📂', roles: ['GERANT', 'RH'] },

  { _section: 'juridique' },
  { id: 'juridique', icon: '⚖️', roles: ['GERANT', 'JURIDIQUE'] },
];

export const MODULES_FLAT = MODULES.filter(m => !m._section);

export function getMenuForRole(roleAdmin) {
  const sections = [];
  let current = null;

  for (const item of MODULES) {
    if (item._section) {
      current = { sectionKey: item._section, items: [] };
      sections.push(current);
    } else if (current && item.roles.includes(roleAdmin)) {
      current.items.push(item);
    }
  }

  return sections.filter(s => s.items.length > 0);
}
