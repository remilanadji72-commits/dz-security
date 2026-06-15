import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: vi.fn(() => ({ '!ref': 'A1:C3' })),
    book_new:     vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const mockDoc = {
  setFillColor:  vi.fn(),
  setDrawColor:  vi.fn(),
  rect:          vi.fn(),
  setTextColor:  vi.fn(),
  setFontSize:   vi.fn(),
  setFont:       vi.fn(),
  text:          vi.fn(),
  line:          vi.fn(),
  roundedRect:   vi.fn(),
  save:          vi.fn(),
  lastAutoTable: { finalY: 100 },
};

// jsPDF est utilisé avec `new` — l'implémentation doit être une fonction régulière,
// pas une arrow function (non-constructible). vi.fn() garde les méthodes spy.
vi.mock('jspdf', () => ({
  default: vi.fn(function JsPDF() { return mockDoc; }),
}));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { exportToExcel, exportTableToPDF, exportInvoiceToPDF } from '../../utils/export';

// ── exportToExcel ─────────────────────────────────────────────────────────────
describe('exportToExcel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crée une feuille avec headers + rows', () => {
    exportToExcel(['A', 'B'], [['v1', 'v2']], 'test');
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([['A', 'B'], ['v1', 'v2']]);
  });

  it('écrit le fichier avec extension .xlsx', () => {
    exportToExcel(['H'], [['r']], 'rapport');
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'rapport.xlsx');
  });

  it('fonctionne avec des lignes vides', () => {
    exportToExcel(['Col'], [], 'vide');
    expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalledWith([['Col']]);
  });
});

// ── exportTableToPDF ──────────────────────────────────────────────────────────
describe('exportTableToPDF', () => {
  beforeEach(() => vi.clearAllMocks());

  it('instancie jsPDF', () => {
    exportTableToPDF({ title: 'Test', headers: ['A'], rows: [['v']], filename: 'f' });
    expect(jsPDF).toHaveBeenCalled();
  });

  it('sauvegarde avec le bon nom de fichier', () => {
    exportTableToPDF({ title: 'T', headers: ['A'], rows: [], filename: 'mon_export' });
    expect(mockDoc.save).toHaveBeenCalledWith('mon_export.pdf');
  });
});

// ── exportInvoiceToPDF ────────────────────────────────────────────────────────
describe('exportInvoiceToPDF', () => {
  beforeEach(() => vi.clearAllMocks());

  const facture = {
    numero_facture: '007/2026',
    client: 'SONATRACH',
    mois: 'JUIN',
    montant: 500000,
    statut_paiement: 'EN ATTENTE',
    designation: 'Gardiennage',
    date_facturation: '2026-06-01',
  };

  it('instancie jsPDF', () => {
    exportInvoiceToPDF(facture);
    expect(jsPDF).toHaveBeenCalled();
  });

  it('sauvegarde avec le numéro de facture', () => {
    exportInvoiceToPDF(facture);
    expect(mockDoc.save).toHaveBeenCalledWith('Facture_007/2026.pdf');
  });
});
