"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, getStoredReferral, type ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

function AuthForm() {
  const { t } = useI18n();
  const { applyAuthResponse } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = params.get("mode") === "login" ? "login" : "register";
  const pack = params.get("pack") || "";
  const ref = params.get("ref") || getStoredReferral();
  const resetOk = params.get("reset") === "1";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState(
    resetOk ? "Password updated — log in with your new password." : ""
  );

  const nextPath = useMemo(() => {
    if (pack) return `/workspace?pack=${encodeURIComponent(pack)}`;
    return "/workspace";
  }, [pack]);

  function switchMode(next: "login" | "register", keepError?: string) {
    setMode(next);
    setError(keepError || "");
    setForgotMsg("");
    const q = new URLSearchParams();
    q.set("mode", next);
    if (pack) q.set("pack", pack);
    if (ref) q.set("ref", ref);
    router.replace(`/auth?${q.toString()}`, { scroll: false });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setForgotMsg("");
    setInfoMsg("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body: Record<string, string> = { email, password };
      if (mode === "register" && ref) body.referralCode = ref;
      const data = await api<{
        token: string;
        userId: number;
        email: string;
        credits: number;
        referralCode?: string;
        referralUrl?: string;
      }>(path, { method: "POST", body: JSON.stringify(body) });
      applyAuthResponse(data);
      router.push(nextPath);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 || e.message?.includes("already registered")) {
        switchMode("login", "That email is already registered — switched to Log In.");
      } else if (e.status === 401) {
        setError("Invalid email or password.");
      } else if (e.code === "schema_migration_required") {
        setError(e.message || "Database migration required (see BACKEND.md).");
      } else {
        setError(e.message || "Auth failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    setForgotMsg("");
    setError("");
    if (!email) {
      setError("Enter your email first");
      return;
    }
    try {
      await api("/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      setForgotMsg("If that email exists and mail is configured, a reset link was sent.");
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "email_not_configured" || e.status === 503) {
        setError("Password reset email is not configured (Resend).");
      } else {
        setError(e.message || "Forgot password failed");
      }
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {mode === "register"
            ? t("auth.signup.h", "Create your account")
            : t("auth.login.h", "Welcome back")}
        </CardTitle>
        <CardDescription>
          {mode === "register"
            ? t("auth.signup.lead", "Claim 10 credits and unlock advanced models.")
            : t("auth.login.lead", "Sign in to spend credits and save history.")}
          {pack ? ` Pack “${pack}” will be remembered in workspace (no charge unless Stripe is live).` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(v) => switchMode(v as "login" | "register")}
          className="mb-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="register" className="flex-1">
              Sign Up
            </TabsTrigger>
            <TabsTrigger value="login" className="flex-1">
              Log In
            </TabsTrigger>
          </TabsList>
          <TabsContent value="register" />
          <TabsContent value="login" />
        </Tabs>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email", "Email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password", "Password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              placeholder={t("auth.passPh", "At least 6 characters")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {infoMsg && (
            <p className="text-sm text-[var(--green)]" role="status">
              {infoMsg}
            </p>
          )}
          {error && (
            <p className="text-sm text-[var(--red)]" role="alert">
              {error}
            </p>
          )}
          {forgotMsg && (
            <p className="text-sm text-[var(--green)]" role="status">
              {forgotMsg}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "…"
              : mode === "register"
                ? t("auth.submitSignup", "Sign up free")
                : t("auth.submitLogin", "Log in")}
          </Button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            className="mt-3 text-sm text-[var(--primary2)] hover:underline"
            onClick={() => void onForgot()}
          >
            Forgot password?
          </button>
        )}

        <p
          className="mt-4 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{
            __html: t(
              "auth.perk",
              "New accounts get <b>10 free credits</b> instantly — no card required."
            ),
          }}
        />
        <Link href="/workspace" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
          {t("auth.back", "← Back to workspace")}
        </Link>
      </CardContent>
    </Card>
  );
}

export default function AuthPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-5 py-14">
        <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
          <AuthForm />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
