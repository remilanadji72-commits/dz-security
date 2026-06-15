import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="page-container text-center" style={{ paddingTop: '80px' }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>🔍</div>
      <h1 className="page-title" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '10px' }}>404</h1>
      <p className="page-subtitle">
        {t('common.page_not_found', { defaultValue: 'Page introuvable' })}
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/kpi')}>
        {t('common.back_home', { defaultValue: '← Retour à l\'accueil' })}
      </button>
    </div>
  );
}

export default NotFound;
