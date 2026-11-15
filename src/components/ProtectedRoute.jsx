import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from './Spinner.jsx';

export default function ProtectedRoute({ children, manager = false }) {
  const { user, isManager, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (manager && !isManager) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">This area is for store managers only.</div>
      </div>
    );
  }
  return children;
}
