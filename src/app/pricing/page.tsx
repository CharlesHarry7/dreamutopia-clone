"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PromoBar } from "@/components/promo-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, getToken, type ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Pack = { id: string; name: string; usd: number; credits: number };

const FALLBACK_PACKS: Pack[] = [
  { id: "starter", name: "Starter Pack", usd: 5, credits: 10 },
  { id: "plus", name: "Plus Pack", usd: 25, credits: 50 },
  { id: "pro", name: "Pro Pack", usd: 90, credits: 200 },
  { id: "premium", name: "Premium Pack", usd: 200, credits: 500 },
];

export default function PricingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>(FALLBACK_PACKS);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ configured?: boolean; packs?: Pack[] }>("/checkout");
        if (cancelled) return;
        setConfigured(!!data.configured);
        if (Array.isArray(data.packs) && data.packs.length) setPacks(data.packs);
        setNote(
          data.configured
            ? user
              ? "Select opens Stripe. First purchase adds 31 bonus credits."
              : "Sign in, then Select opens Stripe."
            : user
              ? "Stripe isn’t configured — nothing will be charged. Continue opens workspace and remembers the pack."
              : "Stripe isn’t configured — nothing will be charged. Continue free opens sign-up (10 free credits)."
        );
      } catch (err) {
        if (cancelled) return;
        const e = err as ApiError;
        const payload = (e.payload || {}) as { packs?: Pack[] };
        if (Array.isArray(payload.packs) && payload.packs.length) setPacks(payload.packs);
        setConfigured(false);
        setNote(
          user
            ? "Stripe isn’t configured — nothing will be charged. Continue opens workspace and remembers the pack."
            : "Stripe isn’t configured — nothing will be charged. Continue free opens sign-up (10 free credits)."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSelect(packId: string) {
    if (!configured) {
      if (user) router.push(`/workspace?pack=${encodeURIComponent(packId)}`);
      else router.push(`/auth?mode=register&pack=${encodeURIComponent(packId)}`);
      return;
    }
    if (!getToken()) {
      router.push(`/auth?mode=login&pack=${encodeURIComponent(packId)}`);
      return;
    }
    setBusy(packId);
    try {
      const res = await api<{ url?: string }>("/checkout", {
        method: "POST",
        body: JSON.stringify({ packId }),
      });
      if (!res.url) throw new Error("No checkout URL");
      // Stripe Checkout is an external host — full navigation is required.
      window.location.assign(res.url);
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "checkout_not_configured" || e.status === 503) {
        router.push(`/workspace?pack=${encodeURIComponent(packId)}`);
        return;
      }
      setNote(e.message || "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PromoBar />
      <SiteHeader active="pricing" />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-4xl font-extrabold">{t("price.h", "Buy credits")}</h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            {t(
              "price.p",
              "Buy credits and use them across every video and image model. No subscriptions."
            )}
          </p>
          <p
            className="mx-auto mt-5 max-w-2xl rounded-xl border border-orange-400/35 bg-orange-400/10 px-4 py-3 text-sm text-[var(--orange)]"
            role="status"
          >
            {note ? (
              <>
                <b>{configured ? "Checkout is live." : "No fake charge."}</b> {note}
              </>
            ) : (
              "Checking checkout…"
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((pack) => {
            const featured = pack.id === "pro" || pack.id === "premium";
            return (
              <Card
                key={pack.id}
                className={featured ? "border-[var(--primary)]/50 bg-[rgba(168,85,247,.08)]" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{pack.name}</CardTitle>
                    {pack.id === "premium" && <Badge>Best Value</Badge>}
                  </div>
                  <CardDescription>
                    <span className="text-3xl font-extrabold text-foreground">${pack.usd}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{pack.credits} credits</p>
                  <Button
                    className="w-full"
                    variant={featured ? "default" : "outline"}
                    disabled={busy === pack.id}
                    aria-busy={busy === pack.id}
                    aria-label={
                      busy === pack.id
                        ? `${pack.name}: working`
                        : configured
                          ? user
                            ? `${pack.name}: Select`
                            : `${pack.name}: Sign in to buy`
                          : user
                            ? `${pack.name}: Continue`
                            : `${pack.name}: Continue free`
                    }
                    onClick={() => void onSelect(pack.id)}
                  >
                    {busy === pack.id
                      ? configured
                        ? "Opening checkout…"
                        : "Continuing…"
                      : configured
                        ? user
                          ? "Select"
                          : "Sign in to buy"
                        : user
                          ? "Continue"
                          : "Continue free"}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {configured
                      ? "Stripe Checkout"
                      : user
                        ? "Checkout coming soon · no charge"
                        : "Free account · pack saved · no charge"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Prefer the free path?{" "}
          <Link href="/auth?mode=register" className="text-[var(--primary2)] hover:underline">
            Sign up for 10 credits
          </Link>{" "}
          or{" "}
          <Link href="/workspace" className="text-[var(--primary2)] hover:underline">
            try 2 guest Lite videos
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
