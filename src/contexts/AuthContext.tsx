import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '@/types';
import { users } from '@/data/mock';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(users[0]); // Default to admin

  const login = (email: string, _password: string) => {
    const found = users.find(u => u.email === email);
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  };

  const logout = () => setUser(null);
  const switchUser = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) setUser(found);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
