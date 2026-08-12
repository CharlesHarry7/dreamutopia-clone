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
import { useI18n } from "@/lib/i18n";

type Mode = "video" | "image";
type HistoryItem = {
  id: string | number;
  prompt: string;
  status: string;
  resultUrl?: string | null;
  kind?: string;
  model?: string;
};

const VIDEO_COSTS = { lite: 3, medium: 5, pro: 16 } as const;
const IMAGE_COSTS = { lite: 1, pro: 2 } as const;

function WorkspaceInner() {
  const { t } = useI18n();
  const { user, guestRemaining, refresh } = useAuth();
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inviteUrl, setInviteUrl] = useState("");

  const cost = useMemo(() => {
    if (mode === "video") return VIDEO_COSTS[model as keyof typeof VIDEO_COSTS] || 3;
    return IMAGE_COSTS[model as keyof typeof IMAGE_COSTS] || 1;
  }, [mode, model]);

  useEffect(() => {
    if (mode === "image" && model === "medium") setModel("lite");
  }, [mode, model]);

  useEffect(() => {
    if (user?.referralUrl) setInviteUrl(user.referralUrl);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api<{ generations?: Array<HistoryItem & { result_url?: string | null }> }>("/generate")
      .then((data) => {
        const list = Array.isArray(data.generations) ? data.generations : [];
        setHistory(
          list.map((g) => ({
            ...g,
            resultUrl: g.resultUrl ?? g.result_url ?? null,
          }))
        );
      })
      .catch(() => setHistory([]));
  }, [user, resultUrl]);

  async function onFile(file: File | null, which: "first" | "last") {
    if (!file) return;
    setError("");
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
      setError((err as ApiError).message || "Upload failed");
    }
  }

  async function onGenerate() {
    setBusy(true);
    setError("");
    setStatus(t("progress.waiting", "Queued…"));
    setResultUrl(null);
    setResultId(null);
    try {
      const body: Record<string, unknown> = {
        prompt: prompt.trim(),
        kind: mode,
        model,
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

      setStatus(t("progress.rendering", "Rendering…"));
      const settled = await pollGeneration(created.generationId, (tick) => {
        const provider = String(tick.providerState || tick.status || "");
        if (/queue/i.test(provider)) setStatus(t("progress.queue", "Queued…"));
        else if (/render|run|process/i.test(provider))
          setStatus(t("progress.rendering", "Rendering…"));
        else setStatus(t("progress.generating", "Generating…"));
      });

      if (String(settled.status) === "failed") {
        throw new Error(
          String(settled.errorMessage || settled.error || t("progress.failed", "Generation failed"))
        );
      }

      const url = String(settled.resultUrl || "");
      setResultUrl(url || null);
      setResultKind((settled.generation as { kind?: Mode } | undefined)?.kind || created.kind || mode);
      setResultId(created.generationId);
      setStatus("");
      await refresh();
    } catch (err) {
      const e = err as ApiError;
      if (e.code === "kie_api_key_missing") {
        setError(
          e.message ||
            "KIE_API_KEY is not configured. Set it as a Cloudflare secret to enable generation."
        );
      } else {
        setError(e.message || t("progress.failed", "Generation failed"));
      }
      setStatus("");
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
      setError((err as ApiError).message || "Share failed");
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
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="video">{t("tab.video", "🎬 Video")}</TabsTrigger>
                  <TabsTrigger value="image">{t("tab.image", "🖼 Image")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

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
                  <Label>{t("gen.upload", "Upload Start Image")}</Label>
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
                </div>

                {mode === "video" && (model === "medium" || model === "pro") && (
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
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`rounded-xl border px-2.5 py-3 text-center transition ${
                            model === m
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
                  <Badge variant="secondary">
                    {user ? `${cost} credits` : "Free trial (Lite I2V)"}
                  </Badge>
                  <Button
                    size="lg"
                    disabled={busy || !prompt.trim()}
                    onClick={() => void onGenerate()}
                  >
                    {busy
                      ? status || "…"
                      : user
                        ? t("ws.gen.go", "Generate")
                        : t("gen.btn", "Generate Free Trial")}
                  </Button>
                </div>

                {error && <p className="text-sm text-[var(--red)]">{error}</p>}
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
                      "Guest trials stay in this browser until you sign up."
                    )}
                  </p>
                )}
                {user && history.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("ws.history.empty.p", "Start creating to see your work here.")}
                  </p>
                )}
                {history.map((item) => (
                  <div
                    key={String(item.id)}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-muted-foreground">{item.prompt}</div>
                      <div className="mt-1 text-xs text-[var(--text3)]">
                        {item.status} · {item.model || "lite"}
                      </div>
                    </div>
                    {item.resultUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.resultUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
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
