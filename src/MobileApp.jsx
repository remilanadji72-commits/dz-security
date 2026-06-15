import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const COORDONNEES_SITES = {
  "Banque BNA - Alger": { lat: 36.7725, lng: 3.0543, rayonMaxMetres: 5000000 }, 
  "Usine Cevital - Bejaia": { lat: 36.7500, lng: 5.0667, rayonMaxMetres: 5000000 },
  "Base Pétrolière": { lat: 31.6881, lng: 6.0463, rayonMaxMetres: 5000000 }
};

function calculerDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
}

function MobileApp() {
  const [heureActuelle, setHeureActuelle] = useState('');
  const [estConnecte, setEstConnecte] = useState(false);
  const [nomAgent, setNomAgent] = useState('');
  const [siteAgent, setSiteAgent] = useState('Banque BNA - Alger');
  const [vueActive, setVueActive] = useState('pointage');

  const [statutPointage, setStatutPointage] = useState(null);
  const [statutSOS, setStatutSOS] = useState(false);
  const [messageSOS, setMessageSOS] = useState('');
  const [dernierScan, setDernierScan] = useState(null);
  
  const [positionAgent, setPositionAgent] = useState(null);
  const [erreurGPS, setErreurGPS] = useState('Recherche du signal GPS...');
  const [estDansLaZone, setEstDansLaZone] = useState(false);

  const [chefDescendant, setChefDescendant] = useState('');
  const [consignes, setConsignes] = useState('');
  const [anomalies, setAnomalies] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setHeureActuelle(new Date().toLocaleTimeString('fr-FR')), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (estConnecte) verifierPositionGPS();
  }, [estConnecte, siteAgent]);

  const verifierPositionGPS = () => {
    if (!navigator.geolocation) { setErreurGPS("GPS non supporté."); return; }
    setErreurGPS('Acquisition du signal GPS...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latAgent = position.coords.latitude;
        const lngAgent = position.coords.longitude;
        setPositionAgent({ lat: latAgent, lng: lngAgent });
        const siteCible = COORDONNEES_SITES[siteAgent];
        const distanceMetres = calculerDistance(latAgent, lngAgent, siteCible.lat, siteCible.lng);
        if (distanceMetres <= siteCible.rayonMaxMetres) { setEstDansLaZone(true); setErreurGPS(''); } 
        else { setEstDansLaZone(false); setErreurGPS(`Trop loin du site.`); }
      },
      (error) => { setErreurGPS("Impossible de lire le GPS."); },
      { enableHighAccuracy: true }
    );
  };

  const seConnecter = (e) => {
    e.preventDefault();
    if (nomAgent.trim() === '') return;
    setEstConnecte(true);
  };

  const pointerService = async () => {
    if (!estDansLaZone || !positionAgent) return; 
    const heure = new Date().getHours();
    const typeVac = (heure >= 16 || heure < 6) ? 'NUIT' : 'JOUR';

    try {
      const { error: errHist } = await supabase.from('pointages_journaliers').insert([{ 
          nom_agent: nomAgent, site_affecte: siteAgent, date_pointage: new Date().toISOString().split('T')[0],
          heure_arrivee: heureActuelle, type_vacation: typeVac, statut_validation: 'EN ATTENTE'
      }]);

      await supabase.from('agents').update({ site_affecte: siteAgent, heure_pointage: heureActuelle, lat: positionAgent.lat, lng: positionAgent.lng }).eq('nom', nomAgent);
      if (!errHist) setStatutPointage('VALIDE');
    } catch (err) { console.error(err); }
  };

  const lancerSOS = async () => {
    try {
      const { error } = await supabase.from('incidents').insert([{ 
          nom_agent: nomAgent, site: siteAgent, heure_incident: heureActuelle, resolu: false,
          lat: positionAgent ? positionAgent.lat : 36.75, lng: positionAgent ? positionAgent.lng : 3.05,
          description: messageSOS || "Alerte panique" 
      }]);
      if (!error) { setStatutSOS(true); setMessageSOS(''); }
    } catch (err) { console.error(err); alert("Erreur d'envoi."); }
  };

  const scannerPoint = async (nomDuPoint) => {
    try {
      const { error } = await supabase.from('rondes').insert([{ nom_agent: nomAgent, site: siteAgent, point_controle: nomDuPoint, heure_passage: heureActuelle }]);
      if (!error) { setDernierScan(`${nomDuPoint} à ${heureActuelle}`); alert(`✅ Passage enregistré : ${nomDuPoint}`); }
    } catch (err) { console.error(err); }
  };

  const transmettrePassation = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('passations').insert([{ 
          site: siteAgent, chef_montant: nomAgent, chef_descendant: chefDescendant, materiel_ok: true, consignes: consignes || 'R.A.S', anomalies: anomalies || 'R.A.S'
      }]);
      if (!error) { alert("✅ Rapport de passation transmis !"); setChefDescendant(''); setConsignes(''); setAnomalies(''); setVueActive('pointage'); }
    } catch (err) { console.error(err); }
  };

  if (!estConnecte) {
      return (
        <div style={{ backgroundColor: '#1f2937', minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
            <div style={{ backgroundColor: 'white', width: '90%', maxWidth: '350px', padding: '30px', borderRadius: '15px' }}>
                <h2 style={{ textAlign: 'center' }}>DzSecurity Agent</h2>
                <form onSubmit={seConnecter} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input type="text" placeholder="Nom ou Matricule" value={nomAgent} onChange={(e) => setNomAgent(e.target.value)} style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '8px' }} required/>
                    <select value={siteAgent} onChange={(e) => setSiteAgent(e.target.value)} style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '8px' }}>
                        <option value="Banque BNA - Alger">Banque BNA - Alger</option>
                        <option value="Usine Cevital - Bejaia">Usine Cevital - Bejaia</option>
                        <option value="Base Pétrolière">Base Pétrolière</option>
                    </select>
                    <button type="submit" style={{ backgroundColor: '#3b82f6', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Connexion</button>
                </form>
            </div>
        </div>
      );
  }

  return (
    <div style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '20px', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
        <h3 style={{ margin: 0 }}>DzSecurity Mobile</h3>
        <p style={{ margin: '10px 0 0 0', fontWeight: 'bold' }}>{nomAgent} | {siteAgent}</p>
      </div>

      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
        
        {vueActive === 'pointage' && (
            <>
                <h1 style={{ fontSize: '48px', color: '#1f2937', margin: '20px 0' }}>{heureActuelle}</h1>
                <div style={{ width: '100%', marginBottom: '20px', padding: '10px', borderRadius: '10px', textAlign: 'center', backgroundColor: estDansLaZone ? '#dcfce7' : '#fee2e2', color: estDansLaZone ? '#065f46' : '#991b1b' }}>
                    {erreurGPS ? `❌ ${erreurGPS}` : '✅ GPS Validé'}
                </div>

                {statutPointage === 'VALIDE' ? (
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '15px', textAlign: 'center', width: '100%', boxSizing: 'border-box', marginBottom: '30px' }}>
                        <div style={{ fontSize: '40px' }}>✅</div><h3 style={{ color: '#10b981' }}>Pointage validé !</h3>
                    </div>
                ) : (
                    <button onClick={pointerService} disabled={!estDansLaZone} style={{ width: '100%', padding: '20px', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', backgroundColor: estDansLaZone ? '#10b981' : '#d1d5db', color: estDansLaZone ? 'white' : '#6b7280', cursor: estDansLaZone ? 'pointer' : 'not-allowed', marginBottom: '30px' }}>
                        {estDansLaZone ? 'PRISE DE SERVICE' : 'HORS ZONE (Bloqué)'}
                    </button>
                )}

                <div style={{ marginTop: 'auto', width: '100%', backgroundColor: 'white', padding: '15px', borderRadius: '15px', boxSizing: 'border-box', border: '2px solid #ef4444' }}>
                    {statutSOS ? (
                        <div style={{ color: '#991b1b', textAlign: 'center', fontWeight: 'bold' }}>🚨 Centrale prévenue.</div>
                    ) : (
                        <>
                            <textarea placeholder="Décrivez l'incident..." value={messageSOS} onChange={(e) => setMessageSOS(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px', minHeight: '60px' }} />
                            <button onClick={lancerSOS} style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>🚨 ENVOYER ALERTE</button>
                        </>
                    )}
                </div>
            </>
        )}

        {vueActive === 'rondes' && (
            <div style={{ width: '100%' }}>
                <h2 style={{ textAlign: 'center' }}>Rondes</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <button onClick={() => scannerPoint("Porte Principale")} style={{ padding: '20px', backgroundColor: 'white', border: '2px solid #3b82f6', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Porte Principale</button>
                    <button onClick={() => scannerPoint("Salle des Serveurs")} style={{ padding: '20px', backgroundColor: 'white', border: '2px solid #3b82f6', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>⚡ Salle Serveurs</button>
                </div>
                {dernierScan && (<div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#d1fae5', color: '#065f46', textAlign: 'center', fontWeight: 'bold' }}>Dernier passage : {dernierScan}</div>)}
            </div>
        )}

        {vueActive === 'passation' && (
          <div style={{ width: '100%', backgroundColor: 'white', padding: '15px', borderRadius: '10px', boxSizing: 'border-box' }}>
              <h2 style={{ textAlign: 'center', margin: '0 0 15px 0' }}>Passation de Consignes</h2>
              <form onSubmit={transmettrePassation} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Chef Descendant</label><input type="text" value={chefDescendant} onChange={(e) => setChefDescendant(e.target.value)} required style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} /></div>
                  <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Chef Montant</label><input type="text" value={nomAgent} readOnly style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f3f4f6' }} /></div>
                  <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Consignes</label><textarea value={consignes} onChange={(e) => setConsignes(e.target.value)} rows="2" style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}></textarea></div>
                  <div><label style={{ fontSize: '11px', fontWeight: 'bold', color: '#991b1b' }}>Anomalies</label><textarea value={anomalies} onChange={(e) => setAnomalies(e.target.value)} rows="2" style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #fca5a5', borderRadius: '4px' }}></textarea></div>
                  <button type="submit" style={{ backgroundColor: '#1e3a8a', color: 'white', padding: '15px', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>Transmettre</button>
              </form>
          </div>
        )}

      </div>

      <div style={{ display: 'flex', backgroundColor: 'white', padding: '15px 0', borderTop: '1px solid #e5e7eb', justifyContent: 'space-around' }}>
          <div onClick={() => setVueActive('pointage')} style={{ color: vueActive === 'pointage' ? '#3b82f6' : '#9ca3af', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}><span style={{ fontSize: '24px', display:'block' }}>⏱</span>Pointage</div>
          <div onClick={() => setVueActive('rondes')} style={{ color: vueActive === 'rondes' ? '#3b82f6' : '#9ca3af', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}><span style={{ fontSize: '24px', display:'block' }}>🔦</span>Rondes</div>
          <div onClick={() => setVueActive('passation')} style={{ color: vueActive === 'passation' ? '#3b82f6' : '#9ca3af', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' }}><span style={{ fontSize: '24px', display:'block' }}>📋</span>Relève</div>
      </div>
    </div>
  );
}

export default MobileApp;