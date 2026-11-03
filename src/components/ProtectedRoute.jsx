// ─────────────────────────────────────────────
// Morphia — ProtectedRoute wrapper
//
// Wraps routes that require authentication.
// Shows a spinner while auth is initializing, then
// redirects to /login if not authenticated.
// ─────────────────────────────────────────────

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
