import { Navigate, useLocation } from 'react-router-dom';
import { useDataStore } from '../../store/useDataStore';
import { MODULES_FLAT } from '../../navigation/modules';

function RoleGuard({ children }) {
  const { roleAdmin } = useDataStore();
  const location = useLocation();

  const route = location.pathname.replace('/', '') || 'kpi';
  const module = MODULES_FLAT.find(m => m.id === route);

  if (module && roleAdmin && !module.roles.includes(roleAdmin)) {
    return <Navigate to="/kpi" replace />;
  }

  return children;
}

export default RoleGuard;
