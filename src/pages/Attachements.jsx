import React, { useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { colors } from '../constants';

function Attachements() {
  const { agentsData, contratsData, historiquePointages } = useDataStore();
  const [siteFiltre, setSiteFiltre] = useState('');
  const moisActuel = new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' });

  const exporterAttachementPDF = () => { window.print(); };

  const exporterVersPCPAIE = () => {
    let txtContent = "data:text/plain;charset=utf-8,";
    txtContent += "MATRICULE;NOM;JOURS;NUITS;ABSENCES;HS;PANIER\n";
    agentsData.forEach((agent) => {
      const pointagesDeLagent = historiquePointages?.filter(p => p.nom_agent === agent.nom && p.statut_validation === 'VALIDE') || [];
      const joursTrav = pointagesDeLagent.filter(p => p.type_vacation === 'JOUR').length;
      const nuitsTrav = pointagesDeLagent.filter(p => p.type_vacation === 'NUIT').length;
      const totalPresences = joursTrav + nuitsTrav;
      const absences = 25 - totalPresences > 0 ? 25 - totalPresences : 0;
      txtContent += `${agent.matricule || 'N/A'};${agent.nom};${joursTrav};${nuitsTrav};${absences};0;${totalPresences}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(txtContent));
    link.setAttribute("download", `IMPORT_PCPAIE_${moisActuel.replace(' ', '_')}.txt`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const forfaitJourDA = 3000;

  return (
    <div className="page-container print-container">
      <div className="hide-on-print">
        <h1 className="page-title">Kouchouf (Attachements) & Pré-Paie</h1>
        <p className="page-subtitle mb-30">Clôture comptable arrêtée au 25 du mois. Période : <strong>{moisActuel}</strong>.</p>

        <div className="card card-blue mb-20 flex-row" style={{ alignItems: 'center' }}>
          <div className="flex-1">
            <label className="form-label-sm">Filtrer par Chantier / Site</label>
            <select value={siteFiltre} onChange={(e) => setSiteFiltre(e.target.value)} className="form-select">
              <option value="">Tous les sites globaux</option>
              {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
            </select>
          </div>
          <div className="flex-row-sm" style={{ marginTop: '20px' }}>
            <button onClick={exporterAttachementPDF} className="btn btn-success">📥 Exporter Attachement PDF</button>
            <button onClick={exporterVersPCPAIE} className="btn btn-dark">💻 Export PCPAIE (.txt)</button>
          </div>
        </div>
      </div>

      {/* GRAND TABLEAU D'ATTACHEMENT - styles inline conservés pour impression */}
      <div className="card print-planning" style={{ overflowX: 'auto' }}>
        <div className="show-only-on-print" style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ textTransform: 'uppercase' }}>ATTACHEMENT DES PRÉSENCES - {siteFiltre || 'GLOBAL'}</h2>
          <h3>MOIS DE : {moisActuel.toUpperCase()}</h3>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #d1d5db' }}>
              <th colSpan="3" style={{ padding: '10px', borderRight: '2px solid #d1d5db', borderLeft: '1px solid #d1d5db' }}>Informations de l'Agent</th>
              <th colSpan="4" style={{ padding: '10px', borderRight: '2px solid #d1d5db', color: colors.blue }}>Récapitulatif des Présences (Validées OPS)</th>
              <th colSpan="2" style={{ padding: '10px', borderRight: '1px solid #d1d5db', color: colors.red }}>Variables Paie</th>
            </tr>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '15px', textAlign: 'left', borderLeft: '1px solid #d1d5db' }}>Matricule</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Nom & Prénom</th>
              <th style={{ padding: '15px', textAlign: 'left', borderRight: '2px solid #e5e7eb' }}>Site Actuel</th>
              <th style={{ padding: '15px', backgroundColor: '#fef08a' }} title="Vacations de 08h à 16h">Jours Travaillés</th>
              <th style={{ padding: '15px', backgroundColor: '#bfdbfe' }} title="Vacations de nuit (Majorées)">Nuits Travaillées</th>
              <th style={{ padding: '15px', backgroundColor: '#fecaca' }}>Absences</th>
              <th style={{ padding: '15px', borderRight: '2px solid #e5e7eb' }}>Total Présences</th>
              <th style={{ padding: '15px' }}>Prime Panier (Jours)</th>
              <th style={{ padding: '15px', borderRight: '1px solid #d1d5db' }}>Montant Est. Facture</th>
            </tr>
          </thead>
          <tbody>
            {agentsData
              .filter(agent => siteFiltre ? agent.site_affecte?.includes(siteFiltre) : true)
              .map((agent) => {
                const pointagesDeLagent = historiquePointages?.filter(p => p.nom_agent === agent.nom && p.statut_validation === 'VALIDE') || [];
                const joursTrav = pointagesDeLagent.filter(p => p.type_vacation === 'JOUR').length;
                const nuitsTrav = pointagesDeLagent.filter(p => p.type_vacation === 'NUIT').length;
                const totalPresences = joursTrav + nuitsTrav;
                const absences = 25 - totalPresences > 0 ? 25 - totalPresences : 0;
                const facturationClient = totalPresences * forfaitJourDA;
                return (
                  <tr key={agent.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', textAlign: 'left', color: '#6b7280', fontSize: '11px', borderLeft: '1px solid #e5e7eb' }}>{agent.matricule || 'N/A'}</td>
                    <td style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#111827' }}>{agent.nom}</td>
                    <td style={{ padding: '12px', textAlign: 'left', fontSize: '11px', borderRight: '2px solid #e5e7eb' }}>{agent.site_affecte || 'Non affecté'}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{joursTrav}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: colors.blue }}>{nuitsTrav}</td>
                    <td style={{ padding: '12px', color: absences === 25 ? '#d1d5db' : colors.red, fontWeight: 'bold' }}>{absences}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold', borderRight: '2px solid #e5e7eb' }}>{totalPresences} j</td>
                    <td style={{ padding: '12px', color: '#059669', fontWeight: 'bold' }}>{totalPresences}</td>
                    <td style={{ padding: '12px', color: '#059669', fontWeight: 'bold', borderRight: '1px solid #e5e7eb' }}>{facturationClient > 0 ? `${facturationClient} DA` : '0 DA'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        <div className="show-only-on-print" style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between', padding: '0 50px' }}>
          <strong>Visa du Client</strong>
          <strong>Signature Direction</strong>
        </div>
      </div>
    </div>
  );
}

export default Attachements;
