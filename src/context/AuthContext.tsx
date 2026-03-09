/**
 * Context para gerenciamento de autenticação da aplicação
 * Controla login, logout e estado do usuário logado
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { request, setAuthToken, clearAuthToken, getAuthToken } from '../services/http';

interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'employee' | 'intern' | 'admin' | 'rh' | 'manager';
  employeeId?: string | null;
  companyId?: string | null;
  employeeCode?: string | null;
  position?: string | null;
  department?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await request<User>('/auth/me');
        setUser(me);
      } catch (error) {
        clearAuthToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const result = await request<{ accessToken: string; user: User }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password })
        }
      );
      setAuthToken(result.accessToken);
      setUser(result.user);
      return true;
    } catch (error) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    clearAuthToken();
  };

  const value = {
    user,
    login,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
