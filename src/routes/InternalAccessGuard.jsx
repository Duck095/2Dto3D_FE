import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorState from '../components/ui/ErrorState';
import PageSpinner from '../components/ui/PageSpinner';
import { getInternalAccessState } from '../features/auth/currentUserAccess';

function ForbiddenState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-pocket-paper p-4" aria-labelledby="internal-forbidden-title">
      <section className="joy-card w-full max-w-lg p-6 text-center sm:p-8" role="status">
        <span className="material-symbols-outlined mb-3 text-4xl text-pocket-plum" aria-hidden="true">lock</span>
        <h1 id="internal-forbidden-title" className="text-xl font-bold text-pocket-plum">Bạn không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-slate-600">Backend chưa xác nhận quyền truy cập khu vực này cho tài khoản hiện tại.</p>
      </section>
    </main>
  );
}

export default function InternalAccessGuard({ requiredContext, children }) {
  const { isAuthenticated, isLoading, currentUser, currentUserStatus, verifyCurrentUser } = useAuth();
  const location = useLocation();
  const accessState = getInternalAccessState({ isAuthenticated, isLoading, currentUser, status: currentUserStatus }, requiredContext);

  if (accessState === 'loading') return <PageSpinner />;
  if (accessState === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (accessState === 'error') {
    return (
      <main className="min-h-screen bg-pocket-paper p-4 sm:p-8" aria-live="polite">
        <ErrorState
          title="Không thể xác minh phiên đăng nhập"
          message="Không kết nối được với Backend để xác nhận quyền. Hãy thử lại khi kết nối hoạt động."
          onRetry={verifyCurrentUser}
        />
      </main>
    );
  }
  if (accessState !== 'allowed') return <ForbiddenState />;
  return children;
}
