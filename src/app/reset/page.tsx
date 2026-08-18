"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField } from "@/components/password-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { api } from "@/lib/api";
import { formatAuthError } from "@/lib/auth-errors";

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
      setError(formatAuthError(err, "Reset failed"));
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
            <InlineAlert variant="error">
              Missing reset token. Open the link from your email, or request a new one.
            </InlineAlert>
            <Button asChild className="w-full">
              <Link href="/auth?mode=login">Request a new reset link</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <PasswordField
              id="password"
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              invalid={!!error}
              describedBy={error ? "reset-form-error" : undefined}
            />
            <PasswordField
              id="confirm"
              label="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
              invalid={!!error}
              describedBy={error ? "reset-form-error" : undefined}
            />
            {error && (
              <InlineAlert variant="error" id="reset-form-error">
                {error}
              </InlineAlert>
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
