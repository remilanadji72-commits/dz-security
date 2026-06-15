import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { supabase } from '../supabaseClient';
import { useDataStore } from '../store/useDataStore';
import { useTranslation } from 'react-i18next';
import { colors } from '../constants';
import { exportPlanningToPDF } from '../utils/export';

function Planning() {
  const { contratsData } = useDataStore();
  const { t } = useTranslation();

  const [siteSelectionne, setSiteSelectionne] = useState('');
  const [moisSelectionne, setMoisSelectionne] = useState(new Date().toISOString().slice(0, 7));
  const [groupe1, setGroupe1] = useState('');
  const [groupe2, setGroupe2] = useState('');
  const [groupe3, setGroupe3] = useState('');
  const [groupe4, setGroupe4] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [vue, setVue] = useState('matrice');

  useEffect(() => {
    const charger = async () => {
      if (!siteSelectionne || !moisSelectionne) return;
      const { data } = await supabase.from('plannings').select('*')
        .eq('site', siteSelectionne).eq('mois', moisSelectionne).single();
      if (data) { setGroupe1(data.groupe1 || ''); setGroupe2(data.groupe2 || ''); setGroupe3(data.groupe3 || ''); setGroupe4(data.groupe4 || ''); }
      else { setGroupe1(''); setGroupe2(''); setGroupe3(''); setGroupe4(''); }
    };
    charger();
  }, [siteSelectionne, moisSelectionne]);

  const sauvegarderMatrice = async () => {
    if (!siteSelectionne || !moisSelectionne) return;
    setIsSaving(true);
    const { error } = await supabase.from('plannings').upsert(
      { site: siteSelectionne, mois: moisSelectionne, groupe1, groupe2, groupe3, groupe4 },
      { onConflict: 'site,mois' }
    );
    setIsSaving(false);
    if (!error) alert(`✅ Rotation enregistrée pour ${siteSelectionne}.`);
    else alert('Erreur lors de la sauvegarde.');
  };

  const genererJoursDuMois = () => {
    if (!moisSelectionne) return [];
    const [annee, mois] = moisSelectionne.split('-');
    const nbJours = new Date(parseInt(annee), parseInt(mois), 0).getDate();
    const moisNom = new Date(parseInt(annee), parseInt(mois) - 1, 1)
      .toLocaleString('fr-FR', { month: 'short' }).toUpperCase();
    const jours = [];
    for (let i = 1; i <= nbJours; i++) {
      const j  = String(i).padStart(2, '0');
      const j1 = String(i + 1 > nbJours ? 1 : i + 1).padStart(2, '0');
      jours.push({ type: 'JOUR', libelle: `${j} ${moisNom}`, index: i });
      jours.push({ type: 'NUIT', libelle: `DU ${j} AU ${j1}`, index: i });
    }
    return jours;
  };

  const determinerAffectation = (jourIndex, typeLigne, groupeIndex) => {
    const positionCycle = (jourIndex - 21 + 400) % 4;
    const decalageGroupe = [0, 3, 2, 1][groupeIndex];
    const etape = (positionCycle + decalageGroupe) % 4;
    if (typeLigne === 'JOUR') return etape === 0;
    if (typeLigne === 'NUIT') return etape === 3;
    return false;
  };

  const genererEvenements = () => {
    if (!moisSelectionne) return [];
    const [annee, mois] = moisSelectionne.split('-');
    const nbJours = new Date(parseInt(annee), parseInt(mois), 0).getDate();
    const brigades = [groupe1, groupe2, groupe3, groupe4].map((g, i) => ({
      nom: g || `Brigade ${i + 1}`,
      couleur: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i],
    }));
    const events = [];
    for (let day = 1; day <= nbJours; day++) {
      const dateStr = `${annee}-${mois}-${String(day).padStart(2, '0')}`;
      brigades.forEach((b, gi) => {
        if (determinerAffectation(day, 'JOUR', gi))
          events.push({ title: `☀️ ${b.nom}`, date: dateStr, backgroundColor: b.couleur, borderColor: b.couleur, textColor: 'white' });
        if (determinerAffectation(day, 'NUIT', gi))
          events.push({ title: `🌙 ${b.nom}`, date: dateStr, backgroundColor: b.couleur + 'aa', borderColor: b.couleur, textColor: 'white' });
      });
    }
    return events;
  };

  const handleExportPDF = () => {
    exportPlanningToPDF({
      site: siteSelectionne,
      mois: moisSelectionne,
      brigades: [groupe1, groupe2, groupe3, groupe4],
      lignes: genererJoursDuMois(),
      determinerAffectation,
    });
  };

  const lignesPlanning = genererJoursDuMois();
  const BRIGADES_CONFIG = [
    { val: groupe1, set: setGroupe1, couleur: '#3b82f6', label: 'BRIGADE 01' },
    { val: groupe2, set: setGroupe2, couleur: '#10b981', label: 'BRIGADE 02' },
    { val: groupe3, set: setGroupe3, couleur: '#f59e0b', label: 'BRIGADE 03' },
    { val: groupe4, set: setGroupe4, couleur: '#8b5cf6', label: 'BRIGADE 04' },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">{t('planning.title')}</h1>
      <p className="page-subtitle mb-20">{t('planning.subtitle')}</p>

      {/* Configuration panel */}
      <div className="card card-blue mb-20">
        <div className="flex-wrap" style={{ alignItems: 'flex-end', gap: '15px' }}>
          <div className="flex-col">
            <label className="form-label">Sélectionner le Site</label>
            <select value={siteSelectionne} onChange={e => setSiteSelectionne(e.target.value)} className="form-select">
              <option value="">-- Site --</option>
              <option value="CRCC CHERAGA">CRCC CHERAGA</option>
              {contratsData.map(c => <option key={c.id} value={c.nom_site}>{c.nom_site}</option>)}
            </select>
          </div>
          <div className="flex-col">
            <label className="form-label">Mois et Année</label>
            <input type="month" value={moisSelectionne} onChange={e => setMoisSelectionne(e.target.value)} className="form-input" />
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
            Désignation des Chefs de Brigades
          </h4>
          <div className="flex-row-15">
            {BRIGADES_CONFIG.map((g, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px', borderTop: `3px solid ${g.couleur}` }}>
                <label className="form-label-sm" style={{ color: g.couleur }}>{g.label}</label>
                <input type="text" value={g.val} onChange={e => g.set(e.target.value)} placeholder="Nom du chef..." className="form-input" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {siteSelectionne && moisSelectionne ? (
        <>
          {/* Header actions */}
          <div className="flex-between mb-15">
            <div className="nav-tabs" style={{ marginBottom: 0, border: 'none', paddingBottom: 0 }}>
              <button onClick={() => setVue('matrice')} className={`nav-tab${vue === 'matrice' ? ' active' : ''}`}
                style={vue === 'matrice' ? { backgroundColor: colors.dark } : {}}>
                📋 Vue Matrice
              </button>
              <button onClick={() => setVue('calendrier')} className={`nav-tab${vue === 'calendrier' ? ' active' : ''}`}
                style={vue === 'calendrier' ? { backgroundColor: colors.blue } : {}}>
                📅 Vue Calendrier
              </button>
            </div>
            <div className="flex-row-sm">
              <button onClick={sauvegarderMatrice} disabled={isSaving} className="btn btn-success btn-sm">
                {isSaving ? '💾 ...' : '💾 Enregistrer'}
              </button>
              <button onClick={handleExportPDF} className="btn btn-danger btn-sm">📄 PDF</button>
            </div>
          </div>

          {/* Rotation matrix */}
          {vue === 'matrice' && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <h2 style={{ color: 'black', marginTop: 0, textTransform: 'uppercase', fontSize: '14px', letterSpacing: '0.5px' }}>
                ROTATION DU DISPOSITIF — {siteSelectionne} | {moisSelectionne}
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', border: '2px solid black' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f3f4f6' }}>
                    <th style={{ padding: '10px', border: '1px solid black', width: '190px' }}>DATE / VACATION</th>
                    {BRIGADES_CONFIG.map((b, i) => (
                      <th key={i} style={{ padding: '10px', border: '1px solid black' }}>
                        {b.label}<br />
                        <span style={{ fontSize: '13px', color: b.couleur, fontWeight: 'bold' }}>{b.val || '...'}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignesPlanning.map((ligne, i) => (
                    <tr key={i} style={{ backgroundColor: ligne.type === 'NUIT' ? '#f8fafc' : 'white' }}>
                      <td style={{ padding: '7px', border: '1px solid black', fontWeight: 'bold', textAlign: 'left', color: ligne.type === 'NUIT' ? '#475569' : 'black' }}>
                        {ligne.type === 'NUIT' ? '🌙 ' : '☀️ '}{ligne.libelle}
                      </td>
                      {[0, 1, 2, 3].map(gi => {
                        const active = determinerAffectation(ligne.index, ligne.type, gi);
                        return (
                          <td key={gi} style={{ border: '1px solid black', fontWeight: 'bold', fontSize: '12px', backgroundColor: active ? '#dcfce7' : 'transparent', color: active ? BRIGADES_CONFIG[gi].couleur : '' }}>
                            {active ? (BRIGADES_CONFIG[gi].val || '---') : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', padding: '0 50px' }}>
                <strong>Le Chef de Site</strong>
                <strong>La Direction des Opérations</strong>
              </div>
            </div>
          )}

          {/* FullCalendar view */}
          {vue === 'calendrier' && (
            <div className="card">
              <div className="flex-between mb-15">
                <h3 style={{ margin: 0 }}>Vue Calendaire — {siteSelectionne}</h3>
                <div className="flex-row-sm" style={{ flexWrap: 'wrap' }}>
                  {BRIGADES_CONFIG.map((b, i) => (
                    <span key={i} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '12px', backgroundColor: b.couleur + '22', color: b.couleur, fontWeight: 'bold', border: `1px solid ${b.couleur}` }}>
                      {b.val || b.label}
                    </span>
                  ))}
                </div>
              </div>
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                initialDate={`${moisSelectionne}-01`}
                events={genererEvenements()}
                height="auto"
                locale="fr"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                eventDisplay="block"
                dayMaxEvents={4}
              />
              <p className="text-xs text-muted" style={{ marginTop: '10px' }}>
                ☀️ = Vacation de Jour  |  🌙 = Vacation de Nuit
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state-dashed">
          <span className="empty-state-icon">📋</span>
          Sélectionnez un site et un mois pour générer la rotation.
        </div>
      )}
    </div>
  );
}

export default Planning;
