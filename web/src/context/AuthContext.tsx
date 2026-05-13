import React, { createContext, useContext, useState, useEffect } from 'react';
import { featuresAPI, tenantSettingsAPI } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
  email?: string;
  plan?: 'free' | 'pro' | string;
  planExpiry?: string | null;
  partnerType?: 'standard' | 'ppf_partner' | 'reseller' | string | null;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  enabledFeatures: string[];
  login: (user: User, tenant: Tenant, token: string) => void;
  logout: () => void;
  setEnabledFeatures: (features: string[]) => void;
  updateTenant: (updates: Partial<Tenant>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user');
      const savedTenant = localStorage.getItem('tenant');
      const savedToken = localStorage.getItem('token');

      if (savedUser && savedTenant && savedToken) {
        setUser(JSON.parse(savedUser));
        setTenant(JSON.parse(savedTenant));
        setToken(savedToken);
        console.log('✅ Auth loaded from localStorage');
      }
    } catch (err) {
      console.error('❌ Auth restore error:', err);
      localStorage.removeItem('user');
      localStorage.removeItem('tenant');
      localStorage.removeItem('token');
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Load features when tenant changes
  useEffect(() => {
    if (tenant?.id) {
      featuresAPI.listForTenant(tenant.id)
        .then((res) => {
          const names = res.data.data
            .filter((tf: any) => tf.enabled)
            .map((tf: any) => tf.feature.name);
          setEnabledFeatures(names);
          console.log('✅ Features loaded:', names);
        })
        .catch((err) => {
          console.error('❌ Features fetch error:', err.response?.status, err.message);
          setEnabledFeatures([]);
        });
    } else {
      setEnabledFeatures([]);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    tenantSettingsAPI.get('workshop_name')
      .then((res) => {
        const name = res.data.data?.value;
        if (!name || name === tenant.name) return;
        setTenant((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, name };
          localStorage.setItem('tenant', JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {});
  }, [tenant?.id]);

  const login = (newUser: User, newTenant: Tenant, newToken: string) => {
    setUser(newUser);
    setTenant(newTenant);
    setToken(newToken);

    localStorage.setItem('user', JSON.stringify(newUser));
    localStorage.setItem('tenant', JSON.stringify(newTenant));
    localStorage.setItem('token', newToken);
  };

  const updateTenant = (updates: Partial<Tenant>) => {
    setTenant(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('tenant', JSON.stringify(updated));
      return updated;
    });
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
        isInitialized,
        enabledFeatures,
        login,
        logout,
        updateTenant,
        setEnabledFeatures,
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
