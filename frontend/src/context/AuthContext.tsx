import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../lib/api';
import { User } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  resendVerification: (email: string) => Promise<void>;
  isAuthenticated: boolean;
  isVerified: boolean;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored auth data and validate with backend
  useEffect(() => {
const validateStoredAuth = async () => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (storedToken && storedUser) {
    try {
      // Validate token with backend
      const response = await auth.getMe();
      const validatedUser = response.data.user;
      setUser(validatedUser);
      setToken(storedToken);
      localStorage.setItem('user', JSON.stringify(validatedUser));
    } catch (error) {
      // Only clear if it's an auth error (401), not network errors
      if (error.response?.status === 401) {
        console.log('Token invalid, clearing storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setToken(null);
      } else {
        // Network error - keep existing data but mark as potentially stale
        console.log('Network error during validation, keeping existing auth');
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
    }
  }
  setIsLoading(false);
};

    validateStoredAuth();
  }, []);

  // Listen for logout events
  useEffect(() => {
    const handleLogout = () => {
      logout();
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await auth.login(email, password);
    const { user: loggedInUser, token: authToken } = response.data;
    
    setUser(loggedInUser);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await auth.register(username, email, password);
    const { user: newUser, token: authToken } = response.data;
    
    setUser(newUser);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.info('Logged out successfully');
  };

  const resendVerification = async (email: string) => {
    await auth.resendVerification(email);
  };

  const checkAuth = async (): Promise<boolean> => {
    if (!token) return false;
    try {
      await auth.getMe();
      return true;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        resendVerification,
        isAuthenticated: !!user,
        isVerified: user?.is_verified || false,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}