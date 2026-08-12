"use client";

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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      router.push("/auth?mode=login");
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
          <p className="text-sm text-[var(--red)]">Missing reset token.</p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "…" : "Update password"}
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
      <main className="flex flex-1 px-5 py-14">
        <Suspense fallback={<div>Loading…</div>}>
          <ResetForm />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
