import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AppShell, AuthUser } from "../types";

type AuthContextValue = {
  user: AuthUser | null;
  appShell: AppShell | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appShell, setAppShell] = useState<AppShell | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.auth
      .me()
      .then((response) => {
        setUser(response.user);
        setAppShell(response.appShell);
      })
      .catch(() => {
        setUser(null);
        setAppShell(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value: AuthContextValue = {
    user,
    appShell,
    loading,
    refreshSession: async () => {
      const response = await api.auth.me();
      setUser(response.user);
      setAppShell(response.appShell);
    },
    login: async (email, password) => {
      const response = await api.auth.login(email, password);
      setUser(response.user);
      setAppShell(response.appShell);
    },
    register: async (email, password, displayName) => {
      const response = await api.auth.register(email, password, displayName);
      setUser(response.user);
      setAppShell(response.appShell);
    },
    continueAsGuest: async () => {
      const response = await api.auth.guest();
      setUser(response.user);
      setAppShell(response.appShell);
    },
    logout: async () => {
      await api.auth.logout();
      setUser(null);
      setAppShell(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
