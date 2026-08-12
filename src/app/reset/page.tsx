"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ApiError } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await api("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      router.push("/auth?mode=login&reset=1");
    } catch (err) {
      setError((err as ApiError).message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
      </CardHeader>
      <CardContent>
        {!token ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--red)]" role="alert">
              Missing reset token. Open the link from your email, or request a new one.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth?mode=login">Request a new reset link</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--red)]" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy} aria-busy={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-5 py-14">
        <Suspense
          fallback={
            <Card className="mx-auto w-full max-w-md">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Loading…
              </CardContent>
            </Card>
          }
        >
          <ResetForm />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
