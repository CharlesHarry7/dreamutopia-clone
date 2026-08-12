"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  captureReferral,
  clearSession,
  CREDITS_KEY,
  getToken,
  setSession,
  TOKEN_KEY,
} from "@/lib/api";

type AuthUser = {
  userId: number;
  email: string;
  credits: number;
  referralCode?: string;
  referralUrl?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  guestRemaining: number | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  applyAuthResponse: (data: {
    token: string;
    userId: number;
    email: string;
    credits: number;
    referralCode?: string;
    referralUrl?: string;
  }) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [guestRemaining, setGuestRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    captureReferral();
    const token = getToken();
    if (!token) {
      setUser(null);
      try {
        const credits = await api<{
          guest?: boolean;
          guestRemaining?: number;
          credits?: number;
        }>("/credits");
        if (credits.guest) setGuestRemaining(Number(credits.guestRemaining ?? 0));
        else setGuestRemaining(null);
      } catch {
        setGuestRemaining(null);
      }
      setLoading(false);
      return;
    }

    try {
      const me = await api<{
        ok?: boolean;
        user?: {
          id: number;
          email: string;
          credits: number;
          referralCode?: string | null;
          referralUrl?: string | null;
        };
        userId?: number;
        email?: string;
        credits?: number;
        referralCode?: string;
        referralUrl?: string;
      }>("/auth/me");
      const u = me.user;
      const userId = Number(u?.id ?? me.userId);
      const email = String(u?.email ?? me.email ?? "");
      const credits = Number(u?.credits ?? me.credits ?? 0);
      const referralCode = (u?.referralCode ?? me.referralCode) || undefined;
      const referralUrl = (u?.referralUrl ?? me.referralUrl) || undefined;
      setUser({ userId, email, credits, referralCode, referralUrl });
      setSession(token, credits);
      setGuestRemaining(null);
    } catch (err) {
      const status = (err as { status?: number }).status;
      // Keep token on transient failures (same as prior fix).
      if (status === 401 || status === 403) {
        clearSession();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    const token = getToken();
    if (token) {
      try {
        await api("/auth/logout", { method: "POST", body: "{}" });
      } catch {
        /* ignore */
      }
    }
    clearSession();
    setUser(null);
    await refresh();
  }, [refresh]);

  const applyAuthResponse = useCallback(
    (data: {
      token: string;
      userId: number;
      email: string;
      credits: number;
      referralCode?: string;
      referralUrl?: string;
    }) => {
      setSession(data.token, data.credits);
      setUser({
        userId: data.userId,
        email: data.email,
        credits: data.credits,
        referralCode: data.referralCode,
        referralUrl: data.referralUrl,
      });
      setGuestRemaining(null);
    },
    []
  );

  const value = useMemo(
    () => ({ user, guestRemaining, loading, refresh, logout, applyAuthResponse }),
    [user, guestRemaining, loading, refresh, logout, applyAuthResponse]
  );

  // keep TOKEN_KEY referenced for tree-shaking clarity
  void TOKEN_KEY;
  void CREDITS_KEY;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
