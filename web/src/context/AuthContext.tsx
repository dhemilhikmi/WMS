import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, tenant: Tenant, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedTenant = localStorage.getItem('tenant');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedTenant && savedToken) {
      setUser(JSON.parse(savedUser));
      setTenant(JSON.parse(savedTenant));
      setToken(savedToken);
    }
  }, []);

  const login = (newUser: User, newTenant: Tenant, newToken: string) => {
    setUser(newUser);
    setTenant(newTenant);
    setToken(newToken);

    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('tenant', JSON.stringify(newTenant));
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    setToken(null);

    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        token,
        isAuthenticated: !!user && !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
