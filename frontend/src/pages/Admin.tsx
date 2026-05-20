import { Routes, Route, Navigate } from 'react-router-dom';
import { useAdmin } from '../context/AdminContext';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminFeedback from './AdminFeedback';

export default function Admin() {
  const { isAdminAuthenticated } = useAdmin();

  if (!isAdminAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="/users" element={<AdminUsers />} />
      <Route path="/feedback" element={<AdminFeedback />} />
      <Route path="*" element={<Navigate to="/admin" />} />
    </Routes>
  );
}