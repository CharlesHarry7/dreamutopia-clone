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
  getToken,
  setSession,
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
  /** Sync guest quota from generate/credits responses without a full refresh. */
  noteGuestRemaining: (n: number) => void;
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
    // Yield so effect bootstraps never sync-set before the first await.
    await Promise.resolve();

    if (!token) {
      try {
        const credits = await api<{
          guest?: boolean;
          guestRemaining?: number;
          credits?: number;
        }>("/credits");
        setUser(null);
        if (credits.guest) setGuestRemaining(Number(credits.guestRemaining ?? 0));
        else setGuestRemaining(null);
      } catch {
        setUser(null);
        setGuestRemaining(null);
      } finally {
        setLoading(false);
      }
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

  // Session bootstrap: load /auth/me or guest credits once on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount fetch
    void refresh();
  }, [refresh]);

  const noteGuestRemaining = useCallback((n: number) => {
    if (!Number.isFinite(n)) return;
    setGuestRemaining(Math.max(0, Math.floor(n)));
  }, []);

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
    setGuestRemaining(null);
    setLoading(true);
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
      setLoading(false);
    },
    []
  );

  const value = useMemo(
    () => ({
      user,
      guestRemaining,
      loading,
      refresh,
      noteGuestRemaining,
      logout,
      applyAuthResponse,
    }),
    [user, guestRemaining, loading, refresh, noteGuestRemaining, logout, applyAuthResponse]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
