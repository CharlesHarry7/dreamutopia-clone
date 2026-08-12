"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const params = useSearchParams();
  const pack = params.get("pack") || "";

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
  const [kieReady, setKieReady] = useState<boolean | null>(null);

  const activeModel = mode === "image" && model === "medium" ? "lite" : model;
  const inviteUrl = user?.referralUrl || "";

  const cost = useMemo(() => {
    if (mode === "video") return VIDEO_COSTS[activeModel as keyof typeof VIDEO_COSTS] || 3;
    return IMAGE_COSTS[activeModel as keyof typeof IMAGE_COSTS] || 1;
  }, [mode, activeModel]);

  const canAfford = !user || user.credits >= cost;
  const guestNeedsImage = !user && mode === "video";
  const generateDisabled =
    busy ||
    authLoading ||
    !prompt.trim() ||
    (guestNeedsImage && !imageUrl.trim()) ||
    (user != null && !canAfford) ||
    (!user && (guestRemaining === null || guestRemaining === 0));

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

    async function loadHistory() {
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
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, resultUrl, noteGuestRemaining]);

  // Poll My Creations while any row is still processing (guest settle / account settle).
  useEffect(() => {
    if (authLoading) return;
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
  }, [history, authLoading, noteGuestRemaining]);

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
        body.durationSec = durationSec;
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
    if (!resultId || !user) return;
    try {
      await api("/gallery", {
        method: "POST",
        body: JSON.stringify({ generationId: resultId }),
      });
      setStatus("Shared to gallery");
    } catch (err) {
      setErrorCode((err as ApiError).code || null);
      setError(formatGenerateError(err, "Share failed"));
    }
  }

  return (
    <>
      <PromoBar />
      <SiteHeader active="workspace" />
      <main className="relative mx-auto w-full max-w-[1120px] flex-1 px-5 py-7 pb-14">
        <div className="pointer-events-none absolute inset-x-[10%] -top-10 h-72 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,.14),transparent_70%)]" />

        {!user && (
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
          <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-400/35 bg-orange-400/10 p-4">
            <div>
              <h2 className="mb-1 text-base font-bold text-[var(--orange)]">Pack saved: {pack}</h2>
              <p className="text-[13px] text-muted-foreground">
                Checkout is not charged unless Stripe secrets are configured.{" "}
                <Link href="/pricing" className="font-semibold text-[var(--primary2)] hover:underline">
                  View pricing
                </Link>
              </p>
            </div>
            <Button asChild>
              <Link href="/pricing">Buy credits</Link>
            </Button>
          </div>
        )}

        {kieReady === false && (
          <div className="relative mb-5 rounded-2xl border border-orange-400/35 bg-orange-400/10 px-4 py-3 text-sm text-[var(--orange)]">
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
              <Input readOnly value={inviteUrl} className="min-w-[180px] flex-1" />
              <Button
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                Copy
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "create" | "history")}
          className="relative"
        >
          <TabsList>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="history">My Creations</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-5">
            <div className="mb-4 flex justify-center">
              <Tabs value={mode} onValueChange={(v) => switchMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="video">{t("tab.video", "🎬 Video")}</TabsTrigger>
                  <TabsTrigger value="image" disabled={!user}>
                    {t("tab.image", "🖼 Image")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {!user && (
              <p className="mb-4 text-center text-xs text-muted-foreground">
                Guests: Lite image-to-video only ·{" "}
                <Link href="/auth?mode=register" className="text-[var(--primary2)] hover:underline">
                  sign up
                </Link>{" "}
                for text-to-video, first/last frame, and stills.
              </p>
            )}

            <Card className="mx-auto max-w-2xl">
              <CardHeader>
                <CardTitle>
                  {mode === "video"
                    ? t("gen.videoTitle", "AI Video Generator")
                    : t("gen.imageTitle", "AI Image Generator")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>
                    {t("gen.upload", "Upload Start Image")}
                    {!user ? " (required for free trial)" : mode === "video" ? " (optional for text-to-video)" : " (optional)"}
                  </Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/tiff,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff"
                    onChange={(e) => void onFile(e.target.files?.[0] || null, "first")}
                  />
                  <Input
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
                    <Label>Last frame (optional)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void onFile(e.target.files?.[0] || null, "last")}
                    />
                    <Input
                      type="url"
                      placeholder="https://example.com/end-frame.png"
                      value={lastImageUrl}
                      onChange={(e) => setLastImageUrl(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="prompt">
                    {mode === "video" ? t("gen.prompt", "Describe Your Video") : "Describe your image"}
                  </Label>
                  <Textarea
                    id="prompt"
                    maxLength={8000}
                    placeholder={t("gen.placeholder", "A futuristic city with flying cars...")}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Model</Label>
                  <div className={`grid gap-2.5 ${mode === "video" ? "grid-cols-3" : "grid-cols-2"}`}>
                    {(mode === "video" ? ["lite", "medium", "pro"] : ["lite", "pro"]).map((m) => {
                      const c =
                        mode === "video"
                          ? VIDEO_COSTS[m as keyof typeof VIDEO_COSTS]
                          : IMAGE_COSTS[m as keyof typeof IMAGE_COSTS];
                      const locked = !user && m !== "lite";
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={locked}
                          onClick={() => setModel(m)}
                          className={`rounded-xl border px-2.5 py-3 text-center transition ${
                            activeModel === m
                              ? "border-[rgba(168,85,247,.7)] bg-[rgba(168,85,247,.12)]"
                              : "border-white/10 bg-black/20 hover:border-white/22"
                          } ${locked ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          <div className="text-[13px] font-bold capitalize">{m}</div>
                          <div className="mt-0.5 text-[11px] text-[var(--text3)]">
                            {locked ? "sign in" : `${c} credits`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode === "video" && (
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <Label>Duration</Label>
                      <div className="flex gap-2">
                        {[5, 10].map((d) => (
                          <Button
                            key={d}
                            type="button"
                            size="sm"
                            variant={durationSec === d ? "default" : "outline"}
                            onClick={() => setDurationSec(d)}
                          >
                            {d}s
                          </Button>
                        ))}
                      </div>
                    </div>
                    {!imageUrl.trim() && (
                      <div className="space-y-1">
                        <Label>Aspect</Label>
                        <div className="flex gap-2">
                          {["16:9", "9:16", "1:1"].map((a) => (
                            <Button
                              key={a}
                              type="button"
                              size="sm"
                              variant={aspectRatio === a ? "default" : "outline"}
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
                    <Label>Resolution</Label>
                    <div className="flex gap-2">
                      {["1K", "2K", "4K"].map((r) => (
                        <Button
                          key={r}
                          type="button"
                          size="sm"
                          variant={resolution === r ? "default" : "outline"}
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
                  <Button size="lg" disabled={generateDisabled} onClick={() => void onGenerate()}>
                    {busy
                      ? status || "…"
                      : user
                        ? t("ws.gen.go", "Generate")
                        : guestRemaining === null
                          ? "…"
                          : guestRemaining === 0
                            ? "Sign up for more"
                            : t("gen.btn", "Generate Free Trial")}
                  </Button>
                </div>

                {error && (
                  <div className="space-y-2 rounded-xl border border-[var(--red)]/35 bg-[var(--red)]/10 px-3 py-3 text-sm text-[var(--red)]">
                    <p>{error}</p>
                    {(errorCode === "insufficient_credits" ||
                      errorCode === "insufficient credits" ||
                      errorCode === "guest_limit") && (
                      <Link
                        href={errorCode === "guest_limit" ? "/auth?mode=register" : "/pricing"}
                        className="inline-block font-semibold text-[var(--primary2)] hover:underline"
                      >
                        {errorCode === "guest_limit" ? "Sign up for 10 credits" : "View credit packs"}
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
                        Set the Workers secret KIE_API_KEY (Pages secrets are separate until cutover).
                      </p>
                    )}
                  </div>
                )}
                {status && !error && <p className="text-sm text-[var(--primary2)]">{status}</p>}

                {resultUrl && (
                  <div className="space-y-3 rounded-xl border border-[var(--border)] bg-black/20 p-3">
                    {resultKind === "image" || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(resultUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resultUrl} alt="Result" className="mx-auto max-h-[420px] rounded-lg" />
                    ) : (
                      <video src={resultUrl} controls className="mx-auto max-h-[420px] rounded-lg" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={resultUrl} target="_blank" rel="noreferrer">
                          {t("gen.open", "Open result")}
                        </a>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={resultUrl} download>
                          {t("gen.download", "Download")}
                        </a>
                      </Button>
                      {user && (
                        <Button size="sm" variant="secondary" onClick={() => void shareToGallery()}>
                          Share to gallery
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!user && (
                  <p
                    className="text-center text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{
                      __html: t(
                        "gen.foot",
                        'Free trial. <a href="/auth?mode=register">Sign up</a> for more.'
                      ),
                    }}
                  />
                )}
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
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {user
                      ? t("ws.history.empty.p", "Start creating to see your work here.")
                      : "No guest jobs on this device yet — generate a free Lite video to see it here."}
                  </p>
                )}
                {history.map((item) => (
                  <div
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
                        <Button asChild size="sm" variant="outline">
                          <a href={item.resultUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!user && history.length > 0 && (
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
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Loading…</div>}>
      <WorkspaceInner />
    </Suspense>
  );
}
