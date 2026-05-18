import React, { createContext, useContext, useState } from 'react';

export type Role = 'admin' | 'sala0' | 'sala1' | 'sala2' | 'sala3' | null;

interface AuthContextType {
  role: Role;
  centerId: number | null;
  setRole: (role: Role) => void;
  setCenterId: (id: number | null) => void;
  ecoNumber: number | null;
  login: (centerId: number, role: Role) => void;
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

  const login = (cid: number, newRole: Role) => {
    setCenterId(cid);
    setRole(newRole);
  };

  const logout = () => {
    setRole(null);
    setCenterId(null);
  };

  const ecoNumber: number | null = role && role.startsWith('sala')
    ? parseInt(role.replace('sala', ''), 10)
    : null;

  return (
    <AuthContext.Provider value={{ role, centerId, setRole, setCenterId, ecoNumber, login, logout }}>
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
