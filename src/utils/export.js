import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = (n) => new Intl.NumberFormat('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

// ── Excel export ──────────────────────────────────────────────────────────────
export function exportToExcel(headers, rows, filename = 'export') {
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.max(String(h).length, ...rows.map(r => String(r[i] || '').length), 10),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Données');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Generic table PDF ─────────────────────────────────────────────────────────
export function exportTableToPDF({ title, subtitle = '', headers, rows, filename = 'export', orientation = 'landscape' }) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const W = orientation === 'landscape' ? 297 : 210;

  doc.setFillColor(43, 48, 59);
  doc.rect(0, 0, W, 20, 'F');
  doc.setTextColor(231, 76, 60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DZ SECURITY', 10, 13);
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-DZ')}`, W - 10, 13, { align: 'right' });

  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, 32);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, 10, 39);
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: subtitle ? 44 : 38,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [43, 48, 59], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 10, right: 10 },
  });

  doc.save(`${filename}.pdf`);
}

// ── Professional invoice PDF ──────────────────────────────────────────────────
export function exportInvoiceToPDF(facture) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  doc.setFillColor(43, 48, 59);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(231, 76, 60);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('DZ SECURITY', 14, 20);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sécurité & Gardiennage — ERP SYSTEM', 14, 29);

  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`FACTURE N° ${facture.numero_facture}`, 196, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date : ${facture.date_facturation || new Date().toLocaleDateString('fr-DZ')}`, 196, 26, { align: 'right' });
  doc.text(`Mois : ${facture.mois}`, 196, 33, { align: 'right' });

  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À :', 14, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(facture.client, 14, 60);

  const paid = facture.statut_paiement === 'PAYEE';
  doc.setFillColor(...(paid ? [22, 163, 74] : [239, 68, 68]));
  doc.roundedRect(140, 47, 56, 10, 3, 3, 'F');
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(paid ? '✓ PAYÉE' : '⏳ EN ATTENTE', 168, 54, { align: 'center' });

  doc.setDrawColor(229, 231, 235);
  doc.line(14, 68, 196, 68);

  autoTable(doc, {
    head: [['Désignation', 'Mois', 'Montant HT (DZD)']],
    body: [[
      facture.designation || 'Prestation de gardiennage et surveillance',
      facture.mois,
      `${fmt(facture.montant)} DA`,
    ]],
    startY: 73,
    headStyles: { fillColor: [43, 48, 59], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
  });

  const fy = doc.lastAutoTable.finalY + 8;
  const tva = (facture.montant || 0) * 0.19;
  const ttc = (facture.montant || 0) + tva;

  doc.setFillColor(249, 250, 251);
  doc.rect(120, fy, 76, 36, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(120, fy, 76, 36);

  doc.setTextColor(75, 85, 99);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Montant HT :', 124, fy + 9);
  doc.text('TVA 19% :', 124, fy + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text('TOTAL TTC :', 124, fy + 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  doc.text(`${fmt(facture.montant)} DA`, 194, fy + 9, { align: 'right' });
  doc.text(`${fmt(tva)} DA`, 194, fy + 18, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(231, 76, 60);
  doc.text(`${fmt(ttc)} DA`, 194, fy + 29, { align: 'right' });

  const sy = fy + 54;
  doc.setTextColor(0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DZ SECURITY', 40, sy, { align: 'center' });
  doc.text('(Signature & Cachet)', 40, sy + 7, { align: 'center' });
  doc.line(14, sy + 22, 66, sy + 22);

  doc.text('LE CLIENT', 170, sy, { align: 'center' });
  doc.text('(Lu et approuvé)', 170, sy + 7, { align: 'center' });
  doc.line(144, sy + 22, 196, sy + 22);

  doc.save(`Facture_${facture.numero_facture}.pdf`);
}

// ── Planning PDF (rotation matrix) ───────────────────────────────────────────
export function exportPlanningToPDF({ site, mois, brigades, lignes, determinerAffectation }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFillColor(43, 48, 59);
  doc.rect(0, 0, 210, 25, 'F');
  doc.setTextColor(231, 76, 60);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('DZ SECURITY', 14, 16);
  doc.setTextColor(255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`ROTATION : ${site}  |  ${mois}`, 196, 16, { align: 'right' });

  const headers = ['DATE / VACATION', `G1 — ${brigades[0]}`, `G2 — ${brigades[1]}`, `G3 — ${brigades[2]}`, `G4 — ${brigades[3]}`];
  const rows = lignes.map(l => [
    `${l.type === 'NUIT' ? '🌙 ' : '☀️ '}${l.libelle}`,
    ...([0, 1, 2, 3].map(gi => determinerAffectation(l.index, l.type, gi) ? brigades[gi] || '---' : '')),
  ]);

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 32,
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [43, 48, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    bodyStyles: { minCellHeight: 6 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && data.cell.raw) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.textColor = [22, 101, 52];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const sy = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text('Le Chef de Site', 40, sy, { align: 'center' });
  doc.line(14, sy + 15, 66, sy + 15);
  doc.text('La Direction des Opérations', 170, sy, { align: 'center' });
  doc.line(144, sy + 15, 196, sy + 15);

  doc.save(`Planning_${site}_${mois}.pdf`);
}
