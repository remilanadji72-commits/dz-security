import { describe, it, expect } from 'vitest';
import { MODULES, MODULES_FLAT, getMenuForRole } from '../../navigation/modules';

describe('MODULES', () => {
  it('contient des marqueurs de section et des modules', () => {
    const sections  = MODULES.filter(m => m._section);
    const items     = MODULES.filter(m => !m._section);
    expect(sections.length).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('MODULES_FLAT', () => {
  it('ne contient aucun marqueur de section', () => {
    expect(MODULES_FLAT.every(m => !m._section)).toBe(true);
  });

  it('chaque module a un id, icon et un tableau roles non vide', () => {
    MODULES_FLAT.forEach(m => {
      expect(typeof m.id).toBe('string');
      expect(typeof m.icon).toBe('string');
      expect(Array.isArray(m.roles)).toBe(true);
      expect(m.roles.length).toBeGreaterThan(0);
    });
  });
});

describe('getMenuForRole', () => {
  it('GERANT voit autant de modules que MODULES_FLAT', () => {
    const sections = getMenuForRole('GERANT');
    const total    = sections.reduce((n, s) => n + s.items.length, 0);
    expect(total).toBe(MODULES_FLAT.length);
  });

  it('COMMERCIAL ne voit pas recrutement ni social', () => {
    const ids = getMenuForRole('COMMERCIAL').flatMap(s => s.items.map(m => m.id));
    expect(ids).not.toContain('recrutement');
    expect(ids).not.toContain('social');
  });

  it('RH ne voit pas facturation ni prospection', () => {
    const ids = getMenuForRole('RH').flatMap(s => s.items.map(m => m.id));
    expect(ids).not.toContain('facturation');
    expect(ids).not.toContain('prospection');
  });

  it('JURIDIQUE ne voit que juridique', () => {
    const ids = getMenuForRole('JURIDIQUE').flatMap(s => s.items.map(m => m.id));
    expect(ids).toEqual(['juridique']);
  });

  it('aucune section retournée n\'est vide', () => {
    ['GERANT', 'OPERATIONS', 'COMMERCIAL', 'RH', 'JURIDIQUE'].forEach(role => {
      const sections = getMenuForRole(role);
      expect(sections.every(s => s.items.length > 0)).toBe(true);
    });
  });

  it('chaque section retournée a une sectionKey', () => {
    getMenuForRole('GERANT').forEach(s => {
      expect(typeof s.sectionKey).toBe('string');
    });
  });
});
