"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PromoBar } from "@/components/promo-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  downloadMedia,
  isAllowedImageFile,
  MAX_UPLOAD_BYTES,
  newIdempotencyKey,
  pollGeneration,
  uploadImage,
  type ApiError,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatGenerateError, guestRemainingFromError } from "@/lib/generate-errors";
import { useI18n } from "@/lib/i18n";
import { packLabel } from "@/lib/packs";

type Mode = "video" | "image";
type HistoryItem = {
  id: string | number;
  prompt: string;
  status: string;
  resultUrl?: string | null;
  errorMessage?: string | null;
  kind?: string;
  model?: string;
};

function asHistoryItem(raw: unknown): HistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    typeof row.id === "string" || typeof row.id === "number"
      ? row.id
      : typeof row.job_id === "string"
        ? row.job_id
        : null;
  if (id === null || id === "") return null;
  const prompt = typeof row.prompt === "string" ? row.prompt : "";
  const status = typeof row.status === "string" ? row.status : "unknown";
  const resultUrl =
    (typeof row.resultUrl === "string" && row.resultUrl) ||
    (typeof row.result_url === "string" && row.result_url) ||
    null;
  const errorMessage =
    (typeof row.errorMessage === "string" && row.errorMessage) ||
    (typeof row.error_message === "string" && row.error_message) ||
    null;
  return {
    id,
    prompt,
    status,
    resultUrl,
    errorMessage,
    kind: typeof row.kind === "string" ? row.kind : undefined,
    model: typeof row.model === "string" ? row.model : undefined,
  };
}

const VIDEO_COSTS = { lite: 3, medium: 5, pro: 16 } as const;
const IMAGE_COSTS = { lite: 1, pro: 2 } as const;

function WorkspaceInner() {
  const { t } = useI18n();
  const { user, guestRemaining, loading: authLoading, refresh, noteGuestRemaining } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const pack = params.get("pack") || "";
  const savedPack = packLabel(pack);

  const [tab, setTab] = useState<"create" | "history">("create");
  const [mode, setMode] = useState<Mode>("video");
  const [model, setModel] = useState<string>("lite");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [lastImageUrl, setLastImageUrl] = useState("");
  const [durationSec, setDurationSec] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("1K");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<Mode>("video");
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [kieReady, setKieReady] = useState<boolean | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [resultLinkCopied, setResultLinkCopied] = useState(false);
  const [historyCopiedId, setHistoryCopiedId] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const startFileRef = useRef<HTMLInputElement>(null);
  const lastFileRef = useRef<HTMLInputElement>(null);

  const activeModel = mode === "image" && model === "medium" ? "lite" : model;
  const inviteUrl = user?.referralUrl || "";

  const cost = useMemo(() => {
    if (mode === "video") return VIDEO_COSTS[activeModel as keyof typeof VIDEO_COSTS] || 3;
    return IMAGE_COSTS[activeModel as keyof typeof IMAGE_COSTS] || 1;
  }, [mode, activeModel]);

  const canAfford = !user || user.credits >= cost;
  const guestNeedsImage = !user && mode === "video";
  const guestTrialExhausted = !user && guestRemaining === 0;
  const generateDisabled =
    busy ||
    authLoading ||
    !prompt.trim() ||
    (guestNeedsImage && !imageUrl.trim()) ||
    (user != null && !canAfford) ||
    (!user && guestRemaining === null) ||
    guestTrialExhausted;

  // Guests always run 5s Lite I2V server-side — ignore a leftover 10s pick after logout.
  const effectiveDurationSec = user ? durationSec : 5;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const health = await api<{ kieConfigured?: boolean; generateReady?: boolean }>("/health");
        // generateReady covers KIE key + SESSIONS probe (guest trials path).
        if (!cancelled) setKieReady(health.generateReady ?? !!health.kieConfigured);
      } catch {
        if (!cancelled) setKieReady(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Account history (D1) or this device's guest jobs (KV) — same GET /api/generate.
    if (authLoading) return;
    let cancelled = false;

    void (async () => {
      // Yield so we never sync-set loading inside the effect body (React Compiler lint).
      await Promise.resolve();
      if (cancelled) return;
      setHistoryLoading(true);
      try {
        const data = await api<{
          generations?: unknown[];
          guest?: boolean;
          guestRemaining?: number;
          ok?: boolean;
        }>("/generate");
        if (cancelled) return;
        if (typeof data.guestRemaining === "number") {
          noteGuestRemaining(data.guestRemaining);
        }
        const list = Array.isArray(data.generations) ? data.generations : [];
        setHistory(list.map(asHistoryItem).filter((g): g is HistoryItem => Boolean(g)));
      } catch {
        // Keep last good history on transient failures (corrupt-row / settle blips).
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, resultUrl, noteGuestRemaining]);

  // Poll My Creations while any row is still processing (guest settle / account settle).
  useEffect(() => {
    if (authLoading || historyLoading) return;
    const inflight = history.some((h) => h.status === "processing" || h.status === "pending");
    if (!inflight) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const data = await api<{
            generations?: unknown[];
            guestRemaining?: number;
          }>("/generate");
          if (cancelled) return;
          if (typeof data.guestRemaining === "number") {
            noteGuestRemaining(data.guestRemaining);
          }
          const list = Array.isArray(data.generations) ? data.generations : [];
          setHistory(list.map(asHistoryItem).filter((g): g is HistoryItem => Boolean(g)));
        } catch {
          /* keep last good */
        }
      })();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [history, authLoading, historyLoading, noteGuestRemaining]);

  function switchMode(next: Mode) {
    setMode(next);
    if (next === "image" && model === "medium") setModel("lite");
    if (next === "image") setLastImageUrl("");
    setError("");
    setErrorCode(null);
  }

  async function onFile(file: File | null, which: "first" | "last") {
    if (!file) return;
    setError("");
    setErrorCode(null);
    if (!isAllowedImageFile(file)) {
      setError("Use JPG, PNG, WebP, GIF, or TIFF");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image must be ≤ 20 MB");
      return;
    }
    try {
      const uploaded = await uploadImage(file);
      if (which === "first") setImageUrl(uploaded.imageUrl);
      else setLastImageUrl(uploaded.imageUrl);
    } catch (err) {
      setErrorCode((err as ApiError).code || null);
      setError(formatGenerateError(err, "Upload failed"));
      const remaining = guestRemainingFromError(err);
      if (remaining !== null) noteGuestRemaining(remaining);
    }
  }

  async function onGenerate() {
    if (generateDisabled) return;
    if (!user && !imageUrl.trim()) {
      setErrorCode("image_url_required");
      setError("Free trial needs a start image. Upload a file or paste a public https URL.");
      return;
    }
    if (user && user.credits < cost) {
      setErrorCode("insufficient_credits");
      setError(`Not enough credits (have ${user.credits}, need ${cost}).`);
      return;
    }

    setBusy(true);
    setError("");
    setErrorCode(null);
    setStatus(t("progress.waiting", "Queued…"));
    setResultUrl(null);
    setResultId(null);
    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        kind: mode,
        model: activeModel,
      };
      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();
      if (mode === "video") {
        body.durationSec = effectiveDurationSec;
        if (!imageUrl.trim()) body.aspectRatio = aspectRatio;
        if (lastImageUrl.trim()) body.lastImageUrl = lastImageUrl.trim();
      } else {
        body.resolution = resolution;
      }

      const created = await api<{
        generationId: string;
        kind?: Mode;
        status?: string;
        guestRemaining?: number;
        credits?: number;
      }>("/generate", {
        method: "POST",
        headers: { "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify(body),
      });

      if (typeof created.guestRemaining === "number") {
        noteGuestRemaining(created.guestRemaining);
      }

      setStatus(t("progress.rendering", "Rendering…"));
      const settled = await pollGeneration(created.generationId, (tick) => {
        if (typeof tick.guestRemaining === "number") {
          noteGuestRemaining(tick.guestRemaining);
        }
        const provider = String(tick.providerState || tick.status || "");
        if (/queue/i.test(provider)) setStatus(t("progress.queue", "Queued…"));
        else if (/render|run|process/i.test(provider))
          setStatus(t("progress.rendering", "Rendering…"));
        else setStatus(t("progress.generating", "Generating…"));
      });

      if (typeof settled.guestRemaining === "number") {
        noteGuestRemaining(settled.guestRemaining);
      }

      if (String(settled.status) === "failed") {
        const failMsg = String(
          settled.errorMessage ||
            (settled.generation as { error_message?: string } | undefined)?.error_message ||
            settled.error ||
            t("progress.failed", "Generation failed")
        );
        // Settle failures are provider job outcomes — do not re-tag as wallet-empty
        // from loose client regex (create path already returns kie_insufficient_balance).
        throw Object.assign(new Error(failMsg), { code: "generation_failed" });
      }

      const url = String(settled.resultUrl || "");
      setResultUrl(url || null);
      setResultKind(
        (settled.generation as { kind?: Mode } | undefined)?.kind || created.kind || mode
      );
      setResultId(String(created.generationId));
      setShareDone(false);
      setStatus("");
      await refresh();
    } catch (err) {
      setErrorCode((err as ApiError).code || null);
      setError(formatGenerateError(err, t("progress.failed", "Generation failed")));
      const remaining = guestRemainingFromError(err);
      if (remaining !== null) noteGuestRemaining(remaining);
      setStatus("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function shareToGallery() {
    if (!resultId || !user || shareBusy) return;
    setShareBusy(true);
    setError("");
    setErrorCode(null);
    try {
      const res = await api<{ already?: boolean }>("/gallery", {
        method: "POST",
        body: JSON.stringify({ generationId: resultId }),
      });
      setShareDone(true);
      setStatus(res.already ? "Already in gallery" : "Shared to gallery");
    } catch (err) {
      setErrorCode((err as ApiError).code || null);
      setError(formatGenerateError(err, "Share failed"));
    } finally {
      setShareBusy(false);
    }
  }

  async function onDownloadResult(url: string, hint?: string) {
    if (downloadBusy) return;
    setDownloadBusy(true);
    try {
      await downloadMedia(url, hint || "dreamutopia-result");
    } finally {
      setDownloadBusy(false);
    }
  }

  function copyLink(url: string, which: "result" | string) {
    void navigator.clipboard.writeText(url).then(() => {
      if (which === "result") {
        setResultLinkCopied(true);
        window.setTimeout(() => setResultLinkCopied(false), 1600);
      } else {
        setHistoryCopiedId(which);
        window.setTimeout(() => setHistoryCopiedId(null), 1600);
      }
    });
  }

  return (
    <>
      <a
        href="#workspace-main"
        className="absolute left-4 top-4 z-50 -translate-y-[120%] rounded-lg bg-background px-4 py-2 text-sm font-semibold shadow-md ring-2 ring-ring transition-transform focus:translate-y-0"
      >
        Skip to workspace
      </a>
      <PromoBar />
      <SiteHeader active="workspace" />
      <main
        id="workspace-main"
        tabIndex={-1}
        className="relative mx-auto w-full max-w-[1120px] flex-1 px-5 py-7 pb-14 outline-none"
      >
        <div className="pointer-events-none absolute inset-x-[10%] -top-10 h-72 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,.14),transparent_70%)]" />

        {authLoading && (
          <div
            className="relative mb-5 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            Loading your session…
          </div>
        )}

        {!user && !authLoading && (
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[rgba(168,85,247,.28)] bg-gradient-to-br from-[rgba(168,85,247,.14)] to-[rgba(236,72,153,.08)] p-5">
            <div>
              <h2 className="mb-1 text-lg font-bold">
                {t("ws.welcome.h", "Welcome — try DreamUtopia free")}
              </h2>
              <p className="max-w-xl text-[13.5px] text-muted-foreground">
                {t(
                  "ws.welcome.p",
                  "2 free Lite videos on this device — no account. Sign up for 10 credits and every model."
                )}
                {guestRemaining !== null ? ` (${guestRemaining} left)` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/auth?mode=login">{t("hdr.login", "Log In")}</Link>
              </Button>
              <Button asChild>
                <Link href="/auth?mode=register">{t("hdr.signup", "Sign Up")}</Link>
              </Button>
            </div>
          </div>
        )}

        {pack && (
          <div
            className="relative mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/35 bg-orange-400/10 p-4"
            role="status"
          >
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 text-base font-bold text-[var(--orange)]">
                {savedPack
                  ? `Pack saved: ${savedPack.name}`
                  : `Pack remembered: ${pack}`}
              </h2>
              <p className="text-[13px] text-muted-foreground">
                {savedPack
                  ? `${savedPack.credits} credits · $${savedPack.usd}. `
                  : ""}
                Nothing is charged until Stripe is configured — then buy from Pricing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/pricing">Buy credits</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Dismiss saved pack"
                onClick={() => router.replace("/workspace", { scroll: false })}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {kieReady === false && (
          <div
            className="relative mb-5 rounded-2xl border border-orange-400/35 bg-orange-400/10 px-4 py-3 text-sm text-[var(--orange)]"
            role="status"
          >
            <b>Generate offline.</b>{" "}
            KIE or guest-trial bindings are not ready on this Worker — jobs return an honest error
            (no fake demo video). Live Pages may still be separate until cutover.
          </div>
        )}

        {user && inviteUrl && (
          <Card className="relative mb-5 border-[rgba(168,85,247,.28)] bg-[rgba(168,85,247,.08)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invite friends — earn 10%</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Label htmlFor="invite-url" className="sr-only">
                Invite URL
              </Label>
              <Input
                id="invite-url"
                readOnly
                value={inviteUrl}
                className="min-w-[180px] flex-1"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={inviteCopied ? "Invite URL copied" : "Copy invite URL"}
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl).then(() => {
                    setInviteCopied(true);
                    window.setTimeout(() => setInviteCopied(false), 1600);
                  });
                }}
              >
                {inviteCopied ? "Copied" : "Copy"}
              </Button>
              <span className="sr-only" aria-live="polite">
                {inviteCopied ? "Invite URL copied to clipboard" : ""}
              </span>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "create" | "history")}
          className="relative"
        >
          <TabsList aria-label="Workspace sections">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="history">My Creations</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-5">
            <div className="mb-4 flex justify-center">
              <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
                <TabsList aria-label="Generation mode">
                  <TabsTrigger value="video">{t("tab.video", "Video")}</TabsTrigger>
                  <TabsTrigger value="image" disabled={!user} title={!user ? "Sign up for image models" : undefined}>
                    {t("tab.image", "Image")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {!user && (
              <p className="mb-4 text-center text-xs text-muted-foreground">
                Guests: Lite image-to-video only ·{" "}
                <Link href="/auth?mode=register" className="text-[var(--primary2)] hover:underline">
                  Sign up
                </Link>{" "}
                for Image mode, Medium/Pro, text-to-video, and first/last frame.
              </p>
            )}

            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle id="generate-title">
                  {mode === "video"
                    ? t("gen.videoTitle", "AI Video Generator")
                    : t("gen.imageTitle", "AI Image Generator")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-5"
                  aria-labelledby="generate-title"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!generateDisabled) void onGenerate();
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="start-image-file">
                        {t("gen.upload", "Upload Start Image")}
                        {!user
                          ? " (required for free trial)"
                          : mode === "video"
                            ? " (optional for text-to-video)"
                            : " (optional)"}
                      </Label>
                      {imageUrl.trim() ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[var(--primary2)] hover:underline"
                          onClick={() => {
                            setImageUrl("");
                            if (startFileRef.current) startFileRef.current.value = "";
                          }}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <Input
                      ref={startFileRef}
                      id="start-image-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/tiff,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff"
                      onChange={(e) => void onFile(e.target.files?.[0] || null, "first")}
                    />
                    <Label htmlFor="start-image-url" className="sr-only">
                      Start image URL
                    </Label>
                    <Input
                      id="start-image-url"
                      type="url"
                      placeholder="https://example.com/start-frame.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                    {imageUrl.trim() && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Start frame preview"
                        className="mt-1 max-h-40 rounded-lg border border-white/10 object-contain"
                      />
                    )}
                  </div>

                  {mode === "video" && (activeModel === "medium" || activeModel === "pro") && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="last-image-file">Last frame (optional)</Label>
                        {lastImageUrl.trim() ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--primary2)] hover:underline"
                            onClick={() => {
                              setLastImageUrl("");
                              if (lastFileRef.current) lastFileRef.current.value = "";
                            }}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <Input
                        ref={lastFileRef}
                        id="last-image-file"
                        type="file"
                        accept="image/*"
                        onChange={(e) => void onFile(e.target.files?.[0] || null, "last")}
                      />
                      <Label htmlFor="last-image-url" className="sr-only">
                        Last frame URL
                      </Label>
                      <Input
                        id="last-image-url"
                        type="url"
                        placeholder="https://example.com/end-frame.png"
                        value={lastImageUrl}
                        onChange={(e) => setLastImageUrl(e.target.value)}
                      />
                      {lastImageUrl.trim() && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lastImageUrl}
                          alt="Last frame preview"
                          className="mt-1 max-h-40 rounded-lg border border-white/10 object-contain"
                        />
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="prompt">
                      {mode === "video"
                        ? t("gen.prompt", "Describe Your Video")
                        : "Describe your image"}
                    </Label>
                    <Textarea
                      id="prompt"
                      maxLength={8000}
                      placeholder={t("gen.placeholder", "A futuristic city with flying cars...")}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                          e.preventDefault();
                          if (!generateDisabled) void onGenerate();
                        }
                      }}
                      aria-describedby="prompt-hint"
                    />
                    <p id="prompt-hint" className="text-xs text-muted-foreground">
                      Tip: Ctrl/⌘ + Enter to generate
                    </p>
                  </div>

                  <fieldset className="min-w-0 border-0 p-0">
                    <legend className="mb-2 text-sm font-medium">Model</legend>
                    <div
                      className={`grid gap-2.5 ${mode === "video" ? "grid-cols-3" : "grid-cols-2"}`}
                      role="radiogroup"
                      aria-label="Model"
                    >
                      {(mode === "video" ? ["lite", "medium", "pro"] : ["lite", "pro"]).map((m) => {
                        const c =
                          mode === "video"
                            ? VIDEO_COSTS[m as keyof typeof VIDEO_COSTS]
                            : IMAGE_COSTS[m as keyof typeof IMAGE_COSTS];
                        const locked = !user && m !== "lite";
                        const selected = activeModel === m;
                        if (locked) {
                          return (
                            <Link
                              key={m}
                              href="/auth?mode=register"
                              className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-3 text-center opacity-70 transition hover:border-[var(--primary2)]/50 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`${m} model — sign up to unlock`}
                            >
                              <div className="text-[13px] font-bold capitalize">{m}</div>
                              <div className="mt-0.5 text-[11px] text-[var(--primary2)]">Sign up</div>
                            </Link>
                          );
                        }
                        return (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${m} model, ${c} credits`}
                            onClick={() => setModel(m)}
                            className={`rounded-xl border px-2.5 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              selected
                                ? "border-[rgba(168,85,247,.7)] bg-[rgba(168,85,247,.12)]"
                                : "border-white/10 bg-black/20 hover:border-white/22"
                            }`}
                          >
                            <div className="text-[13px] font-bold capitalize">{m}</div>
                            <div className="mt-0.5 text-[11px] text-[var(--text3)]">{c} credits</div>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {mode === "video" && (
                    <div className="flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium" id="duration-label">
                          Duration
                        </p>
                        <div className="flex gap-2" role="group" aria-labelledby="duration-label">
                          {/* Guests always run Lite I2V at 5s server-side — don't offer 10s. */}
                          {(user ? [5, 10] : [5]).map((d) => (
                            <Button
                              key={d}
                              type="button"
                              size="sm"
                              variant={effectiveDurationSec === d ? "default" : "outline"}
                              aria-pressed={effectiveDurationSec === d}
                              onClick={() => setDurationSec(d)}
                            >
                              {d}s
                            </Button>
                          ))}
                        </div>
                        {!user && (
                          <p className="text-xs text-muted-foreground">Free trial is 5 seconds.</p>
                        )}
                      </div>
                      {!imageUrl.trim() && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium" id="aspect-label">
                            Aspect
                          </p>
                          <div className="flex gap-2" role="group" aria-labelledby="aspect-label">
                            {["16:9", "9:16", "1:1"].map((a) => (
                              <Button
                                key={a}
                                type="button"
                                size="sm"
                                variant={aspectRatio === a ? "default" : "outline"}
                                aria-pressed={aspectRatio === a}
                                onClick={() => setAspectRatio(a)}
                              >
                                {a}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mode === "image" && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium" id="resolution-label">
                        Resolution
                      </p>
                      <div className="flex gap-2" role="group" aria-labelledby="resolution-label">
                        {["1K", "2K", "4K"].map((r) => (
                          <Button
                            key={r}
                            type="button"
                            size="sm"
                            variant={resolution === r ? "default" : "outline"}
                            aria-pressed={resolution === r}
                            onClick={() => setResolution(r)}
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={user && !canAfford ? "warning" : "secondary"}>
                        {user
                          ? `${cost} credits · balance ${user.credits}`
                          : guestRemaining === null
                            ? "Checking free trial…"
                            : guestRemaining === 0
                              ? "Free trial used up"
                              : `Free trial (Lite I2V) · ${guestRemaining} left`}
                      </Badge>
                      {user && !canAfford && (
                        <Link
                          href="/pricing"
                          className="text-xs font-semibold text-[var(--primary2)] hover:underline"
                        >
                          Buy credits
                        </Link>
                      )}
                    </div>
                    {guestTrialExhausted ? (
                      <Button asChild size="lg">
                        <Link href="/auth?mode=register">Sign up for more</Link>
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="lg"
                        disabled={generateDisabled}
                        aria-busy={busy}
                      >
                        {busy
                          ? status || "Generating…"
                          : user
                            ? t("ws.gen.go", "Generate")
                            : guestRemaining === null
                              ? "Checking…"
                              : t("gen.btn", "Generate Free Trial")}
                      </Button>
                    )}
                  </div>

                  {error && (
                    <div
                      className="space-y-2 rounded-xl border border-[var(--red)]/35 bg-[var(--red)]/10 px-3 py-3 text-sm text-[var(--red)]"
                      role="alert"
                      aria-live="assertive"
                    >
                      <p>{error}</p>
                      {(errorCode === "insufficient_credits" ||
                        errorCode === "insufficient credits" ||
                        errorCode === "guest_limit") && (
                        <Link
                          href={errorCode === "guest_limit" ? "/auth?mode=register" : "/pricing"}
                          className="inline-block font-semibold text-[var(--primary2)] hover:underline"
                        >
                          {errorCode === "guest_limit"
                            ? "Sign up for 10 credits"
                            : "View credit packs"}
                        </Link>
                      )}
                      {errorCode === "kie_insufficient_balance" && (
                        <p className="text-xs text-muted-foreground">
                          Provider wallet is empty — top up at kie.ai. Site credits were refunded when
                          the create call failed. No demo video was invented.
                        </p>
                      )}
                      {errorCode === "kie_api_key_missing" && (
                        <p className="text-xs text-muted-foreground">
                          Set the Workers secret KIE_API_KEY (`npm run cf:secret:kie`), then redeploy
                          the Worker.
                        </p>
                      )}
                    </div>
                  )}
                  {status && !error && (
                    <p className="text-sm text-[var(--primary2)]" role="status" aria-live="polite">
                      {status}
                    </p>
                  )}

                  {resultUrl && (
                    <div
                      className="space-y-3 rounded-xl border border-[var(--border)] bg-black/20 p-3"
                      aria-label="Generation result"
                    >
                      {resultKind === "image" ||
                      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(resultUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resultUrl}
                          alt="Generated result"
                          className="mx-auto max-h-[420px] rounded-lg"
                        />
                      ) : (
                        <video
                          src={resultUrl}
                          controls
                          className="mx-auto max-h-[420px] rounded-lg"
                        />
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={resultUrl} target="_blank" rel="noreferrer">
                            {t("gen.open", "Open result")}
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={downloadBusy}
                          onClick={() => void onDownloadResult(resultUrl, `dreamutopia-${resultId || "result"}`)}
                        >
                          {downloadBusy ? "…" : t("gen.download", "Download")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={resultLinkCopied ? "Result link copied" : "Copy result link"}
                          onClick={() => copyLink(resultUrl, "result")}
                        >
                          {resultLinkCopied ? "Copied" : "Copy link"}
                        </Button>
                        {user && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={shareBusy || shareDone}
                            aria-busy={shareBusy}
                            onClick={() => void shareToGallery()}
                          >
                            {shareBusy ? "Sharing…" : shareDone ? "Shared" : "Share to gallery"}
                          </Button>
                        )}
                        <span className="sr-only" aria-live="polite">
                          {resultLinkCopied ? "Result link copied to clipboard" : ""}
                        </span>
                      </div>
                    </div>
                  )}

                  {!user && (
                    <p className="text-center text-sm text-muted-foreground">
                      Free trial.{" "}
                      <Link
                        href="/auth?mode=register"
                        className="font-semibold text-[var(--primary2)] hover:underline"
                      >
                        Sign up
                      </Link>{" "}
                      for more.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>
                  {user
                    ? t("ws.history.h", "Your creations")
                    : t("ws.history.guest.h", "This device")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!user && (
                  <p className="text-sm text-muted-foreground">
                    {t(
                      "ws.history.guest.p",
                      "Guest tries stay on this browser until you sign up. They are not saved to an account."
                    )}
                    {guestRemaining != null
                      ? ` ${guestRemaining} free Lite ${guestRemaining === 1 ? "try" : "tries"} left.`
                      : ""}
                  </p>
                )}
                {(authLoading || historyLoading) && (
                  <div
                    className="space-y-2"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <p className="text-sm text-muted-foreground">Loading creations…</p>
                    <div className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/5" />
                  </div>
                )}
                {!authLoading && !historyLoading && history.length === 0 && (
                  <div className="space-y-3 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {user
                        ? t("ws.history.empty.p", "Start creating to see your work here.")
                        : "No guest jobs on this device yet — generate a free Lite video to see it here."}
                    </p>
                    <Button type="button" variant="outline" onClick={() => setTab("create")}>
                      Go to Create
                    </Button>
                  </div>
                )}
                {!authLoading && !historyLoading && history.length > 0 && (
                  <ul className="space-y-3" aria-label="Creations list">
                    {history.map((item) => (
                      <li
                        key={String(item.id)}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-muted-foreground">
                            {item.prompt.trim() || t("ws.history.untitled", "Untitled job")}
                          </div>
                          <div className="mt-1 text-xs text-[var(--text3)]">
                            {item.status} · {item.model || "lite"}
                            {!user ? " · guest" : ""}
                          </div>
                          {item.status === "failed" && item.errorMessage ? (
                            <p className="mt-1 text-xs text-destructive">{item.errorMessage}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          {item.status === "processing" && (
                            <Badge variant="secondary">rendering</Badge>
                          )}
                          {item.status === "failed" && <Badge variant="warning">failed</Badge>}
                          {item.resultUrl && (
                            <>
                              <Button asChild size="sm" variant="outline">
                                <a href={item.resultUrl} target="_blank" rel="noreferrer">
                                  Open
                                </a>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={downloadBusy}
                                onClick={() =>
                                  void onDownloadResult(
                                    item.resultUrl!,
                                    `dreamutopia-${String(item.id)}`
                                  )
                                }
                              >
                                Download
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label={
                                  historyCopiedId === String(item.id)
                                    ? "Link copied"
                                    : "Copy result link"
                                }
                                onClick={() => copyLink(item.resultUrl!, String(item.id))}
                              >
                                {historyCopiedId === String(item.id) ? "Copied" : "Copy"}
                              </Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <span className="sr-only" aria-live="polite">
                  {historyCopiedId ? "Result link copied to clipboard" : ""}
                </span>
                {!user && !historyLoading && history.length > 0 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/auth?mode=register">
                      Sign up to keep these jobs in your account
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[40vh] items-center justify-center p-10 text-center text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Loading workspace…
        </div>
      }
    >
      <WorkspaceInner />
    </Suspense>
  );
}
