"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaBanner() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("du_pwa_dismiss") === "1");
    } catch {
      setDismissed(false);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (dismissed || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl md:left-auto">
      <div className="flex-1">
        <strong className="block text-sm">{t("pwa.title", "Get the DreamUtopia App")}</strong>
        <p className="text-xs text-muted-foreground">
          {t("pwa.sub", "Install to your home screen for one-tap creating.")}
        </p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          setDeferred(null);
        }}
      >
        {t("pwa.install", "Install")}
      </Button>
      <button
        type="button"
        className="text-muted-foreground hover:text-white"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem("du_pwa_dismiss", "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
