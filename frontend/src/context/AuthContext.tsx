import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { auth } from '../lib/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Adopt a session handed back by email verification, so verifying logs you in. */
  adoptSession: (user: User, token: string) => void;
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
      if ((error as any).response?.status === 401) {
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
    // Registration deliberately returns no token — the account is not usable
    // until the address is verified. Writing `undefined` into localStorage here
    // is what used to log the new user straight back out: every later request
    // went out as `Bearer undefined`, came back 401, and tripped the global
    // logout. So store nothing and let the caller send them to code entry.
    await auth.register(username, email, password);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  /**
   * Take the session that /verify and /verify-code now hand back.
   *
   * Verifying used to leave you logged out on a success screen, so the account
   * was confirmed in the database while the browser still held nothing.
   */
  const adoptSession = (verifiedUser: User, authToken: string) => {
    setUser(verifiedUser);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(verifiedUser));
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
        adoptSession,
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