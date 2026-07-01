import { describe, it, expect } from 'vitest';
import { parseContractData, summarizeContractText } from '../../src/utils/ocr.js';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.resolve('./tests/ocr/fixtures');

describe('parseContractData fixtures', () => {
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.txt'));
  if (files.length === 0) {
    it('no fixtures found', () => {
      throw new Error('Aucun fixture trouvé dans tests/ocr/fixtures');
    });
    return;
  }

  for (const f of files) {
    it(`parses fixture ${f}`, () => {
      const txt = fs.readFileSync(path.join(fixturesDir, f), 'utf-8');
      const res = parseContractData(txt);
      expect(res).toBeDefined();
      // Basic expectations: key fields exist (may be empty string)
      expect(Object.prototype.hasOwnProperty.call(res, 'nouveauClient')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'adresseSiege')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'nouveauSite')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'reference')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'dateDebut')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'dateFin')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'montantTotal')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'clauses')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'creePar')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'lieu')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'objet')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'duree')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'conditions')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'lieu')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'objet')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'duree')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(res, 'conditions')).toBe(true);
    });
  }

  it('generates a structured summary containing key contract analysis fields', () => {
    const sample = `OBJET: Prestations non armées de gardiennage\nREFERENCE: REF-2026/001\nDATE DE SIGNATURE: 12/02/2026\nDATE DE DEBUT: 19/02/2026\nDATE DE FIN: 18/02/2027\nMONTANT GLOBAL (DZD): 1 200 000 DA\nADRESSE DU SIÈGE: DOUNIA PARC-DELY BRAHIM-ALGER\nCLAUSES SPÉCIFIQUES: Sécurité 24h/24\nSAISI PAR: Service Marchés\n`;
    const summary = summarizeContractText(sample);
    expect(summary).toContain('Objet : Prestations non armées de gardiennage');
    expect(summary).toContain('Réf. : REF-2026/001');
    expect(summary).toContain('Signature : 12/02/2026');
    expect(summary).toContain('Début : 19/02/2026');
    expect(summary).toContain('Fin : 18/02/2027');
    expect(summary).toContain('Montant : 1 200 000 DA');
    expect(summary).toContain('Lieu : DOUNIA PARC-DELY BRAHIM-ALGER');
    expect(summary).toContain('Conditions : Sécurité 24h/24');
    expect(summary).toContain('Saisi par : Service Marchés');
  });
});
