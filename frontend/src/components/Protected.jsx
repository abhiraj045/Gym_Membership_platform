import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// UI-level guard only. The real enforcement is on the server for every API call.
export default function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted pad">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <p className="error pad">You do not have access to this page.</p>;
  return children;
}
