import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AdminRoute } from '../components/admin/AdminRoute';
import { AdminNav } from '../components/admin/AdminNav';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminModeration from './AdminModeration';
import AdminFeedback from './AdminFeedback';
import AdminLogs from './AdminLogs';

export default function Admin() {
  const { pathname } = useLocation();

  // The login screen is the one page in the section that is not behind the key,
  // so it is also the one page the signed-in nav has no business appearing on.
  const showNav = pathname !== '/admin/login';

  return (
    <>
      {showNav && <AdminNav />}
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route
          path="dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="users"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route
          path="moderation"
          element={
            <AdminRoute>
              <AdminModeration />
            </AdminRoute>
          }
        />
        <Route
          path="feedback"
          element={
            <AdminRoute>
              <AdminFeedback />
            </AdminRoute>
          }
        />
        <Route
          path="logs"
          element={
            <AdminRoute>
              <AdminLogs />
            </AdminRoute>
          }
        />
        {/* Root path: redirect to dashboard if authenticated, else to login */}
        <Route
          path="/"
          element={
            <AdminRoute>
              <Navigate to="/admin/dashboard" replace />
            </AdminRoute>
          }
        />
        {/* Catch-all: redirect to root */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </>
  );
}
