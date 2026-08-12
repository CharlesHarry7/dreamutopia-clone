"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useLocalFlag } from "@/lib/storage";
import { Button } from "@/components/ui/button";

const KEY = "du_promo_dismissed";

export function PromoBar() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useLocalFlag(KEY, true);

  if (dismissed) return null;

  const ctaHref = user ? "/workspace" : loading ? "/pricing" : "/workspace";
  const ctaLabel = user
    ? t("promo.cta.workspace", "Open workspace")
    : t("promo.cta.free", "Start free");

  return (
    <div className="flex flex-wrap items-center justify-center gap-3.5 border-b border-[var(--border)] bg-gradient-to-r from-[#1f1235] to-[#2d1654] px-5 py-2.5 text-[13.5px]">
      <p className="max-w-[800px] flex-1 text-center text-[#e8d5ff]">
        {t(
          "promo.text",
          "Your first purchase unlocks 5 free Lite videos + 1 free Pro video — plus earn 10% credits every time a friend you invite buys."
        )}
      </p>
      <Button asChild size="sm" variant="orange">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
      {!user && (
        <Button asChild size="sm" variant="ghost" className="text-[#e8d5ff] hover:text-white">
          <Link href="/pricing">{t("promo.cta.pricing", "Pricing")}</Link>
        </Button>
      )}
      <button
        type="button"
        className="px-1.5 text-lg text-muted-foreground hover:text-white"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
