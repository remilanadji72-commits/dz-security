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

// ── Plan de Défense PDF ───────────────────────────────────────────────────────
export function exportPlanDefenseToPDF(contrat) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const dateEd = new Date().toLocaleDateString('fr-DZ');
  const ref = `PD-${String(contrat.id || '000').padStart(4, '0')}-${new Date().getFullYear()}`;

  // ── En-tête ──
  doc.setFillColor(43, 48, 59);
  doc.rect(0, 0, W, 38, 'F');
  doc.setTextColor(231, 76, 60);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DZ SECURITY', 14, 16);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Sécurité & Gardiennage — ERP SYSTEM', 14, 24);
  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PLAN DE DÉFENSE', W - 14, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Réf. : ${ref}`, W - 14, 22, { align: 'right' });
  doc.text(`Édité le : ${dateEd}`, W - 14, 29, { align: 'right' });

  const statut = contrat.plan_defense_valide;
  doc.setFillColor(...(statut ? [22, 163, 74] : [220, 38, 38]));
  doc.roundedRect(14, 31, statut ? 42 : 58, 6, 2, 2, 'F');
  doc.setTextColor(255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(statut ? 'PLAN VALIDÉ' : 'EN ATTENTE DE VALIDATION', 16, 35.5);

  // ── Section 1 : Identification ──
  let y = 48;
  doc.setTextColor(43, 48, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. IDENTIFICATION DU SITE GARDIENNÉ', 14, y);
  doc.setDrawColor(231, 76, 60);
  doc.setLineWidth(0.5);
  doc.line(14, y + 2, W - 14, y + 2);
  y += 8;

  const clientNom = contrat.clients?.nom_entreprise || contrat.client || '—';
  autoTable(doc, {
    body: [
      ['Site (Dénomination)', contrat.nom_site || '—'],
      ['Client / Donneur d\'ordre', clientNom],
      ['Coordonnées GPS', contrat.site_gps_lat && contrat.site_gps_lng
        ? `${Number(contrat.site_gps_lat).toFixed(6)}, ${Number(contrat.site_gps_lng).toFixed(6)}`
        : 'Non renseignées'],
      ['Date de prise d\'effet', contrat.date_debut
        ? new Date(contrat.date_debut).toLocaleDateString('fr-DZ') : '—'],
      ['Date d\'échéance', contrat.date_fin
        ? new Date(contrat.date_fin).toLocaleDateString('fr-DZ') : '—'],
      ['Statut du plan', statut ? 'VALIDÉ — En vigueur' : 'NON VALIDÉ — En attente'],
    ],
    startY: y,
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 70 },
      1: { cellWidth: 116 },
    },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: 14, right: 14 },
    tableLineColor: [229, 231, 235],
    tableLineWidth: 0.3,
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section 2 : Dispositif de sécurité ──
  doc.setTextColor(43, 48, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DISPOSITIF DE SÉCURITÉ DÉPLOYÉ', 14, y);
  doc.setDrawColor(231, 76, 60);
  doc.line(14, y + 2, W - 14, y + 2);
  y += 8;

  autoTable(doc, {
    head: [['Vacation', 'Horaires', 'Effectif Min.', 'Mission principale']],
    body: [
      ['Jour', '06:00 – 18:00', '1 agent', 'Contrôle des accès, filtrage des entrées/sorties, rondes'],
      ['Nuit', '18:00 – 06:00', '1 agent', 'Surveillance périmétrique, rondes horaires, levée de doute'],
      ['Week-end / Férié', 'Continu (24h)', '1 agent min.', 'Garde statique renforcée selon consignes client'],
    ],
    startY: y,
    headStyles: { fillColor: [43, 48, 59], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section 3 : Procédures d'urgence ──
  doc.setTextColor(43, 48, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('3. PROCÉDURES D\'URGENCE', 14, y);
  doc.setDrawColor(231, 76, 60);
  doc.line(14, y + 2, W - 14, y + 2);
  y += 8;

  autoTable(doc, {
    head: [['Scénario', 'Conduite à tenir (CAT)']],
    body: [
      ['Intrusion / Effraction',
        '1. Déclencher l\'alarme sonore\n2. Alerter la centrale DZ Security (SOS in-app)\n3. Appeler la Police (17) sans confrontation directe\n4. Sécuriser les accès et attendre les secours'],
      ['Incendie',
        '1. Déclencher le déclencheur manuel (si présent)\n2. Évacuer le site selon le plan d\'évacuation\n3. Appeler les Pompiers (14)\n4. Ne jamais ouvrir les portes coupe-feu'],
      ['Agression / Menace',
        '1. Ne pas résister ni provoquer\n2. Mémoriser les signalements (description, véhicule)\n3. Alerter la centrale via SOS app\n4. Porter plainte après intervention des forces de l\'ordre'],
      ['Malaise d\'un agent',
        '1. Alerter immédiatement la centrale DZ Security\n2. Appeler le SAMU (15)\n3. Ne pas laisser l\'agent seul\n4. Contacter le responsable opérations'],
    ],
    startY: y,
    headStyles: { fillColor: [43, 48, 59], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', fillColor: [254, 242, 242] }, 1: { cellWidth: 141 } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section 4 : Contacts d'urgence ──
  doc.setTextColor(43, 48, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('4. CONTACTS D\'URGENCE', 14, y);
  doc.setDrawColor(231, 76, 60);
  doc.line(14, y + 2, W - 14, y + 2);
  y += 8;

  autoTable(doc, {
    head: [['Service', 'Numéro', 'Disponibilité']],
    body: [
      ['Police Nationale / Gendarmerie', '17 / 1548', '24h/24 — 7j/7'],
      ['Pompiers / Protection Civile', '14', '24h/24 — 7j/7'],
      ['SAMU / Urgences médicales', '15 / 1021', '24h/24 — 7j/7'],
      ['DZ Security — Centrale OPS', 'Voir application mobile', '24h/24 — 7j/7'],
      ['Responsable Opérations DZ Security', 'Voir contacts internes', 'Heures ouvrables (astreinte nuit)'],
    ],
    startY: y,
    headStyles: { fillColor: [43, 48, 59], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: { 1: { fontStyle: 'bold', textColor: [231, 76, 60] } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Section 5 : Clauses spécifiques (si présentes) ──
  if (contrat.clauses_specifiques) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(43, 48, 59);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('5. CLAUSES SPÉCIFIQUES DU CONTRAT', 14, y);
    doc.setDrawColor(231, 76, 60);
    doc.line(14, y + 2, W - 14, y + 2);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    const lignes = doc.splitTextToSize(contrat.clauses_specifiques, W - 28);
    doc.text(lignes, 14, y);
    y += lignes.length * 5 + 10;
  }

  // ── Signatures ──
  if (y > 245) { doc.addPage(); y = 20; }
  const numSection = contrat.clauses_specifiques ? 6 : 5;
  doc.setTextColor(43, 48, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${numSection}. APPROBATION ET SIGNATURES`, 14, y);
  doc.setDrawColor(231, 76, 60);
  doc.line(14, y + 2, W - 14, y + 2);
  y += 12;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(75, 85, 99);
  doc.text('DZ SECURITY — Direction des Opérations', 40, y, { align: 'center' });
  doc.text('LE CLIENT', 170, y, { align: 'center' });
  doc.text('(Signature & Cachet)', 40, y + 6, { align: 'center' });
  doc.text(`(${clientNom})`, 170, y + 6, { align: 'center' });
  doc.setDrawColor(150);
  doc.setLineWidth(0.4);
  doc.line(14, y + 22, 66, y + 22);
  doc.line(144, y + 22, 196, y + 22);

  // ── Pied de page ──
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont('helvetica', 'normal');
    doc.text(`DZ Security ERP — Plan de Défense — Réf. ${ref} — Confidentiel`, W / 2, 292, { align: 'center' });
    doc.text(`Page ${i} / ${pages}`, W - 14, 292, { align: 'right' });
  }

  const nomFichier = (contrat.nom_site || 'site').replace(/[^a-zA-Z0-9_\-]/g, '_');
  doc.save(`PlanDefense_${nomFichier}_${new Date().getFullYear()}.pdf`);
}
