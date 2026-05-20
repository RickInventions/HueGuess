import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface AdminContextType {
  isAdminAuthenticated: boolean;
  adminLogin: (key: string) => Promise<boolean>;
  adminLogout: () => void;
  adminKey: string | null;
  isLoading: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const verifyAdminKey = useCallback(async (key: string): Promise<boolean> => {
    try {
      await axios.get(`${API_URL}/admin/verify`, {
        headers: { 'X-Admin-Key': key }
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const adminLogout = useCallback(() => {
    setAdminKey(null);
    setIsAdminAuthenticated(false);
    localStorage.removeItem('adminKey');
  }, []);

  useEffect(() => {
    const validateStoredKey = async () => {
      const storedKey = localStorage.getItem('adminKey');
      if (storedKey) {
        const isValid = await verifyAdminKey(storedKey);
        if (isValid) {
          setAdminKey(storedKey);
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem('adminKey');
        }
      }
      setIsLoading(false);
    };
    validateStoredKey();

    const handleAdminLogout = () => adminLogout();
    window.addEventListener('admin:logout', handleAdminLogout);
    return () => window.removeEventListener('admin:logout', handleAdminLogout);
  }, [verifyAdminKey, adminLogout]);

  const adminLogin = useCallback(async (key: string): Promise<boolean> => {
    const isValid = await verifyAdminKey(key);
    if (isValid) {
      setAdminKey(key);
      setIsAdminAuthenticated(true);
      localStorage.setItem('adminKey', key);
      return true;
    } else {
      setIsAdminAuthenticated(false);
      setAdminKey(null);
      localStorage.removeItem('adminKey');
      return false;
    }
  }, [verifyAdminKey]);

  return (
    <AdminContext.Provider value={{ isAdminAuthenticated, adminLogin, adminLogout, adminKey, isLoading }}>
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