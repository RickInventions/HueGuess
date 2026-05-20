import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { adminApi } from '../lib/adminApi';

interface AdminContextType {
  isAdminAuthenticated: boolean;
  adminLogin: (key: string) => void;
  adminLogout: () => void;
  adminKey: string | null;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('adminKey');
    if (storedKey) {
      setAdminKey(storedKey);
      setIsAdminAuthenticated(true);
    }
  }, []);

  const adminLogin = (key: string) => {
    setAdminKey(key);
    setIsAdminAuthenticated(true);
    localStorage.setItem('adminKey', key);
  };

  const adminLogout = () => {
    setAdminKey(null);
    setIsAdminAuthenticated(false);
    localStorage.removeItem('adminKey');
  };

  return (
    <AdminContext.Provider value={{ isAdminAuthenticated, adminLogin, adminLogout, adminKey }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}