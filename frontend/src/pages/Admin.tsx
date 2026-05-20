import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminRoute } from '../components/admin/AdminRoute';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminFeedback from './AdminFeedback';

export default function Admin() {
  return (
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
        path="feedback"
        element={
          <AdminRoute>
            <AdminFeedback />
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
  );
}