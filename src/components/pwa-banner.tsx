"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useLocalFlag } from "@/lib/storage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mq || ios);
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && notOther;
}

export function PwaBanner() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useLocalFlag("du_pwa_dismiss", true);

  useEffect(() => {
    let cancelled = false;
    let gotBip = false;
    const timers: number[] = [];

    const onBip = (e: Event) => {
      e.preventDefault();
      gotBip = true;
      setDeferred(e as BeforeInstallPromptEvent);
      setIosHint(false);
    };

    void (async () => {
      // Yield so we never sync-set inside the effect body (React Compiler lint).
      await Promise.resolve();
      if (cancelled) return;

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }

      if (isStandalone()) {
        setStandalone(true);
        return;
      }

      window.addEventListener("beforeinstallprompt", onBip);
      timers.push(
        window.setTimeout(() => {
          if (!cancelled && !gotBip && isIosSafari()) setIosHint(true);
        }, 1500)
      );
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onBip);
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  if (dismissed || standalone) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-2xl md:left-auto">
      <div className="flex-1">
        <strong className="block text-sm">{t("pwa.title", "Get the DreamUtopia App")}</strong>
        <p className="text-xs text-muted-foreground">
          {deferred
            ? t("pwa.sub", "Install to your home screen for one-tap creating.")
            : t("pwa.ios", "On iPhone: tap Share, then Add to Home Screen.")}
        </p>
      </div>
      {deferred && (
        <Button
          size="sm"
          onClick={async () => {
            await deferred.prompt();
            setDeferred(null);
          }}
        >
          {t("pwa.install", "Install")}
        </Button>
      )}
      <button
        type="button"
        className="text-muted-foreground hover:text-white"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
