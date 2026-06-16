import { Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useDataStore } from '../store/useDataStore';
import { useLanguage } from '../context/LanguageContext';
import { colors } from '../constants';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const redIcon = new L.Icon({
  iconUrl:   'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const mapCenter = [36.7525, 3.0419];

function Kpi() {
  const { agentsData, incidentsData } = useDataStore();
  const { t } = useLanguage();

  return (
    <div className="page-container">
      <h1 className="page-title">{t('kpi.title')}</h1>
      <p className="page-subtitle">{t('kpi.subtitle')}</p>

      <div className="flex-row mb-30">
        <div className="stat-card" style={{ borderLeft: `5px solid ${colors.blue}` }}>
          <div className="stat-card-label">{t('kpi.total_staff')}</div>
          <div className="stat-card-value">{agentsData.length}</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: colors.red, boxShadow: '0 4px 6px rgba(220,38,38,0.3)' }}>
          <div className="stat-card-label" style={{ color: 'white' }}>{t('kpi.active_sos')}</div>
          <div className="stat-card-value-white">{incidentsData.length}</div>
        </div>
      </div>

      <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
          {t('kpi.live_map')}
        </div>
        <div style={{ flex: 1 }}>
          <MapContainer center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {agentsData.filter(a => a.lat != null && a.lng != null).map(a => (
              <Marker key={`ag-${a.id}`} position={[a.lat, a.lng]}>
                <Popup><strong>{a.nom}</strong><br />{a.site_affecte}</Popup>
              </Marker>
            ))}
            {incidentsData.filter(inc => inc.lat != null && inc.lng != null).map(inc => (
              <Fragment key={`inc-${inc.id}`}>
                <Circle center={[inc.lat, inc.lng]} pathOptions={{ color: 'red', fillColor: 'red' }} radius={500} />
                <Marker position={[inc.lat, inc.lng]} icon={redIcon}>
                  <Popup><strong style={{ color: 'red' }}>🚨 SOS : {inc.nom_agent}</strong></Popup>
                </Marker>
              </Fragment>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default Kpi;
