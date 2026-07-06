import React, { createContext, useContext, useState } from 'react';

export type Role = 'superadmin' | 'admin' | 'sala0' | 'sala1' | 'sala2' | 'sala3' | 'equipotecnico' | null;

interface AuthContextType {
  role: Role;
  centerId: number | null;
  centerName: string | null;
  token: string | null;
  setRole: (role: Role) => void;
  setCenterId: (id: number | null) => void;
  ecoNumber: number | null;
  login: (centerId: number, role: Role, centerName?: string, token?: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const saved = localStorage.getItem('cpi_role');
    return (saved as Role) || null;
  });

  const [centerId, setCenterIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('cpi_center_id');
    return saved ? parseInt(saved) : null;
  });

  const [centerName, setCenterNameState] = useState<string | null>(() => {
    return localStorage.getItem('cpi_center_name');
  });

  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('cpi_token');
  });

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    if (newRole) localStorage.setItem('cpi_role', newRole);
    else localStorage.removeItem('cpi_role');
  };

  const setCenterId = (id: number | null) => {
    setCenterIdState(id);
    if (id != null) localStorage.setItem('cpi_center_id', String(id));
    else localStorage.removeItem('cpi_center_id');
  };

  const setCenterName = (name: string | null) => {
    setCenterNameState(name);
    if (name) localStorage.setItem('cpi_center_name', name);
    else localStorage.removeItem('cpi_center_name');
  };

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem('cpi_token', t);
    else localStorage.removeItem('cpi_token');
  };

  const login = (cid: number, newRole: Role, name?: string, tok?: string | null) => {
    setCenterId(cid);
    setRole(newRole);
    if (name) setCenterName(name);
    if (tok !== undefined) setToken(tok);
  };

  const logout = () => {
    setRole(null);
    setCenterId(null);
    setCenterName(null);
    setToken(null);
  };

  const ecoNumber: number | null = role && role.startsWith('sala')
    ? parseInt(role.replace('sala', ''), 10)
    : null;

  return (
    <AuthContext.Provider value={{ role, centerId, centerName, token, setRole, setCenterId, ecoNumber, login, logout }}>
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
