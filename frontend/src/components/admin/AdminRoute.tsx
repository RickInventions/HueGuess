import { Navigate } from 'react-router-dom';
import { useAdmin } from '../../context/AdminContext';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdminAuthenticated, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100dvh-3.5rem)]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}