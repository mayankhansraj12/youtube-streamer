import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authState';
import LoadingScreen from './LoadingScreen';

/** Sends signed-out visitors to /login and returns them to the requested page afterwards. */
export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen label="Checking your session" />;

  if (!isAuthenticated) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
