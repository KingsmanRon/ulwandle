import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, setAccessToken, clearTokens } from "../services/apiService";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "supervisor" | "operator" | "viewer";
  has_signing_key: boolean;
  is_active: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const REFRESH_KEY = "ulwandle.refresh.v1";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return false;
    try {
      const r = await apiClient.post("/api/v1/auth/refresh", { refresh_token: rt });
      setAccessToken(r.data.access_token);
      localStorage.setItem(REFRESH_KEY, r.data.refresh_token);
      setUser(r.data.user);
      return true;
    } catch {
      localStorage.removeItem(REFRESH_KEY);
      clearTokens();
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      await tryRefresh();
      setLoading(false);
    })();
  }, [tryRefresh]);

  // axios response interceptor: on 401, try one refresh
  useEffect(() => {
    const interceptor = apiClient.interceptors.response.use(
      (r) => r,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          if (await tryRefresh()) {
            original.headers.Authorization =
              apiClient.defaults.headers.common["Authorization"];
            return apiClient(original);
          }
          setUser(null);
        }
        return Promise.reject(error);
      },
    );
    return () => apiClient.interceptors.response.eject(interceptor);
  }, [tryRefresh]);

  const login = async (email: string, password: string) => {
    const r = await apiClient.post("/api/v1/auth/login", { email, password });
    setAccessToken(r.data.access_token);
    localStorage.setItem(REFRESH_KEY, r.data.refresh_token);
    setUser(r.data.user);
  };

  const logout = async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    try {
      if (rt) await apiClient.post("/api/v1/auth/logout", { refresh_token: rt });
    } catch {
      // best-effort
    }
    localStorage.removeItem(REFRESH_KEY);
    clearTokens();
    setUser(null);
  };

  const refreshMe = async () => {
    const r = await apiClient.get("/api/v1/auth/me");
    setUser(r.data);
  };

  const value = useMemo(() => ({ user, loading, login, logout, refreshMe }),
    [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth requires AuthProvider");
  return v;
};
