import { Navigate, useLocation } from 'react-router-dom';
import { useDataStore } from '../../store/useDataStore';
import { MODULES_FLAT } from '../../navigation/modules';

function RoleGuard({ children }) {
  const roleAdmin = useDataStore(s => s.roleAdmin);
  const location  = useLocation();

  // roleAdmin est null tant que fetchToutesLesDonnees n'a pas résolu le rôle.
  // On affiche un skeleton plutôt que de laisser passer ou de rediriger prématurément.
  if (roleAdmin === null) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 12, color: '#9CA3AF'
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #E5E7EB',
          borderTopColor: '#1B5299', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const route  = location.pathname.replace('/', '') || 'kpi';
  const module = MODULES_FLAT.find(m => m.id === route);

  if (module && !module.roles.includes(roleAdmin)) {
    return <Navigate to="/kpi" replace />;
  }

  return children;
}

export default RoleGuard;
